"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

import type { Transaction } from "@/types/transaction";
import type { Category } from "@/types/category";
import { writeMerchantCategory } from "@/lib/categories/category-cache";
import { updateTransactionsForMerchant } from "@/lib/categories/update-merchant-category";

type TransactionContextValue = {
  transactions: Transaction[] | null;
  setTransactions: Dispatch<SetStateAction<Transaction[] | null>>;
  updateMerchantCategory: (merchantNormalized: string, category: Category) => void;
};

const TransactionContext = createContext<TransactionContextValue | null>(null);

export function TransactionProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
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
    () => ({ transactions, setTransactions, updateMerchantCategory }),
    [transactions, updateMerchantCategory],
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
