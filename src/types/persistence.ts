import type { Transaction } from "./transaction.ts";

export type PersistStatementRequest = {
  periodStart: string;
  periodEnd: string;
  transactions: Transaction[];
};

export type ImportBatch = {
  id: string;
  periodStart: string;
  periodEnd: string;
  transactionCount: number;
  importedAt: string;
};

export type ImportSuccessResponse = { batch: ImportBatch; transactions: Transaction[] };
export type TransactionsResponse = { transactions: Transaction[] };
export type ImportsResponse = { imports: ImportBatch[] };
