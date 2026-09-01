"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

import type { Transaction } from "@/types/transaction";

type TransactionContextValue = {
  transactions: Transaction[] | null;
  setTransactions: Dispatch<SetStateAction<Transaction[] | null>>;
};

const TransactionContext = createContext<TransactionContextValue | null>(null);

export function TransactionProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const value = useMemo(() => ({ transactions, setTransactions }), [transactions]);

  return <TransactionContext.Provider value={value}>{children}</TransactionContext.Provider>;
}

export function useTransactions(): TransactionContextValue {
  const context = useContext(TransactionContext);
  if (context === null) {
    throw new Error("useTransactions must be used within TransactionProvider.");
  }
  return context;
}
