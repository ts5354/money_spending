"use client";

import { useAuth } from "@clerk/nextjs";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

import { writeMerchantCategory } from "@/lib/categories/category-cache";
import { updateTransactionsForMerchant } from "@/lib/categories/update-merchant-category";
import {
  reconcilePeriodSelection,
  selectAfterSuccessfulImport,
  sortImportBatches,
  synchronizeTransactionCategories,
  type PeriodSelection,
} from "@/lib/periods/period-selection";
import {
  loadPersistedImports,
  loadPersistedTransactions,
} from "@/lib/persistence/persistence-client";
import type { Category } from "@/types/category";
import type { ImportBatch } from "@/types/persistence";
import type { Transaction } from "@/types/transaction";

export type TransactionLoadStatus = "loading" | "ready" | "error";

type TransactionContextValue = {
  transactions: Transaction[] | null;
  selectedTransactions: Transaction[] | null;
  imports: ImportBatch[];
  selectedPeriod: PeriodSelection | null;
  loadStatus: TransactionLoadStatus;
  setTransactions: Dispatch<SetStateAction<Transaction[] | null>>;
  selectPeriod: (selection: PeriodSelection) => void;
  recordImportedBatch: (batch: ImportBatch, transactions: Transaction[]) => void;
  retryLoad: () => void;
  updateMerchantCategory: (merchantNormalized: string, category: Category) => void;
};

const TransactionContext = createContext<TransactionContextValue | null>(null);

export function TransactionProvider({ children }: Readonly<{ children: ReactNode }>) {
  const { isLoaded, isSignedIn } = useAuth();
  // Preserve the pre-Spec-09 contract: this is the canonical all-period collection.
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [imports, setImports] = useState<ImportBatch[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodSelection | null>(null);
  const [batchTransactions, setBatchTransactions] = useState<Record<string, Transaction[]>>({});
  const [loadStatus, setLoadStatus] = useState<TransactionLoadStatus>("loading");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const localMutationVersion = useRef(0);
  const requestGeneration = useRef(0);

  useEffect(() => {
    let active = true;
    const synchronizeSession = async () => {
      if (!isLoaded) return;

      if (!isSignedIn) {
        localMutationVersion.current += 1;
        requestGeneration.current += 1;
        setTransactions(null);
        setImports([]);
        setSelectedPeriod(null);
        setBatchTransactions({});
        setLoadStatus("loading");
        return;
      }

      const versionAtStart = localMutationVersion.current;
      const generationAtStart = ++requestGeneration.current;
      setLoadStatus("loading");
      try {
        const [persistedImports, allTransactions] = await Promise.all([
          loadPersistedImports(),
          loadPersistedTransactions(),
        ]);
        const sortedImports = sortImportBatches(persistedImports);
        const initialSelection = reconcilePeriodSelection(null, sortedImports);
        let initialBatchTransactions: Transaction[] | null = null;
        if (initialSelection?.kind === "batch") {
          initialBatchTransactions = await loadPersistedTransactions(
            fetch,
            initialSelection.batchId,
          );
        }
        if (
          !active ||
          localMutationVersion.current !== versionAtStart ||
          requestGeneration.current !== generationAtStart
        ) {
          return;
        }
        setImports(sortedImports);
        setTransactions(allTransactions);
        setSelectedPeriod(initialSelection);
        setBatchTransactions(
          initialSelection?.kind === "batch" && initialBatchTransactions !== null
            ? { [initialSelection.batchId]: initialBatchTransactions }
            : {},
        );
        setLoadStatus("ready");
      } catch {
        if (
          !active ||
          localMutationVersion.current !== versionAtStart ||
          requestGeneration.current !== generationAtStart
        ) {
          return;
        }
        setLoadStatus("error");
      }
    };

    void synchronizeSession();
    return () => {
      active = false;
    };
  }, [isLoaded, isSignedIn, loadAttempt]);

  const selectedTransactions = useMemo(() => {
    if (transactions === null) return null;
    if (selectedPeriod === null) return [];
    if (selectedPeriod.kind === "all") return transactions;
    return batchTransactions[selectedPeriod.batchId] ?? [];
  }, [batchTransactions, selectedPeriod, transactions]);

  const selectPeriod = useCallback(
    (requestedSelection: PeriodSelection) => {
      const selection = reconcilePeriodSelection(requestedSelection, imports);
      if (selection === null) {
        requestGeneration.current += 1;
        setSelectedPeriod(null);
        setLoadStatus("ready");
        return;
      }

      const generationAtStart = ++requestGeneration.current;
      setSelectedPeriod(selection);
      if (selection.kind === "all" || batchTransactions[selection.batchId] !== undefined) {
        setLoadStatus("ready");
        return;
      }

      setLoadStatus("loading");
      void loadPersistedTransactions(fetch, selection.batchId)
        .then((loadedTransactions) => {
          if (requestGeneration.current !== generationAtStart) return;
          setBatchTransactions((current) => ({
            ...current,
            [selection.batchId]: synchronizeTransactionCategories(
              loadedTransactions,
              transactions ?? [],
            ),
          }));
          setLoadStatus("ready");
        })
        .catch(() => {
          if (requestGeneration.current !== generationAtStart) return;
          setLoadStatus("error");
        });
    },
    [batchTransactions, imports, transactions],
  );

  const recordImportedBatch = useCallback(
    (batch: ImportBatch, importedTransactions: Transaction[]) => {
      localMutationVersion.current += 1;
      requestGeneration.current += 1;
      setImports((current) => {
        const nextImports = sortImportBatches([
          ...current.filter((existing) => existing.id !== batch.id),
          batch,
        ]);
        setSelectedPeriod((selection) =>
          selectAfterSuccessfulImport(selection, current, batch),
        );
        return nextImports;
      });
      setTransactions((current) => [...(current ?? []), ...importedTransactions]);
      setBatchTransactions((current) => ({
        ...current,
        [batch.id]: importedTransactions,
      }));
      setLoadStatus("ready");
    },
    [],
  );

  const retryLoad = useCallback(() => {
    setLoadStatus("loading");
    setLoadAttempt((attempt) => attempt + 1);
  }, []);

  const updateMerchantCategory = useCallback(
    (merchantNormalized: string, category: Category) => {
      writeMerchantCategory(window.localStorage, merchantNormalized, category);
      setTransactions((current) =>
        current === null
          ? null
          : updateTransactionsForMerchant(current, merchantNormalized, category),
      );
      setBatchTransactions((current) =>
        Object.fromEntries(
          Object.entries(current).map(([batchId, entries]) => [
            batchId,
            updateTransactionsForMerchant(entries, merchantNormalized, category),
          ]),
        ),
      );
    },
    [],
  );

  const value = useMemo(
    () => ({
      transactions,
      selectedTransactions,
      imports,
      selectedPeriod,
      loadStatus,
      setTransactions,
      selectPeriod,
      recordImportedBatch,
      retryLoad,
      updateMerchantCategory,
    }),
    [
      imports,
      loadStatus,
      recordImportedBatch,
      retryLoad,
      selectPeriod,
      selectedPeriod,
      selectedTransactions,
      transactions,
      updateMerchantCategory,
    ],
  );

  return <TransactionContext.Provider value={value}>{children}</TransactionContext.Provider>;
}

export function useTransactions(): TransactionContextValue {
  const context = useContext(TransactionContext);
  if (context === null) {
    throw new Error("useTransactions must be used within TransactionProvider.");
  }
  return context;
}
