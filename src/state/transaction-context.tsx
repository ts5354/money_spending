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

import type { Transaction } from "@/types/transaction";
import type { Category } from "@/types/category";
import { writeMerchantCategory } from "@/lib/categories/category-cache";
import { updateTransactionsForMerchant } from "@/lib/categories/update-merchant-category";
import { loadPersistedTransactions } from "@/lib/persistence/persistence-client";

export type TransactionLoadStatus = "loading" | "ready" | "error";

type TransactionContextValue = {
  transactions: Transaction[] | null;
  loadStatus: TransactionLoadStatus;
  setTransactions: Dispatch<SetStateAction<Transaction[] | null>>;
  appendTransactions: (transactions: Transaction[]) => void;
  retryLoad: () => void;
  updateMerchantCategory: (merchantNormalized: string, category: Category) => void;
};

const TransactionContext = createContext<TransactionContextValue | null>(null);

export function TransactionProvider({ children }: Readonly<{ children: ReactNode }>) {
  const { isLoaded, isSignedIn } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [loadStatus, setLoadStatus] = useState<TransactionLoadStatus>("loading");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const localMutationVersion = useRef(0);

  useEffect(() => {
    let active = true;
    const synchronizeSession = async () => {
      if (!isLoaded) return;

      if (!isSignedIn) {
        localMutationVersion.current += 1;
        setTransactions(null);
        setLoadStatus("loading");
        return;
      }

      const versionAtStart = localMutationVersion.current;
      setLoadStatus("loading");
      try {
        const persisted = await loadPersistedTransactions();
        if (!active || localMutationVersion.current !== versionAtStart) return;
        setTransactions(persisted);
        setLoadStatus("ready");
      } catch {
        if (!active || localMutationVersion.current !== versionAtStart) return;
        setLoadStatus("error");
      }
    };

    void synchronizeSession();
    return () => {
      active = false;
    };
  }, [isLoaded, isSignedIn, loadAttempt]);

  const appendTransactions = useCallback((newTransactions: Transaction[]) => {
    localMutationVersion.current += 1;
    setTransactions((current) => [...(current ?? []), ...newTransactions]);
    setLoadStatus("ready");
  }, []);

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
    },
    [],
  );
  const value = useMemo(
    () => ({ transactions, loadStatus, setTransactions, appendTransactions, retryLoad, updateMerchantCategory }),
    [appendTransactions, loadStatus, retryLoad, transactions, updateMerchantCategory],
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
