import type { Category } from "../../types/category.ts";
import type { Transaction } from "../../types/transaction.ts";

export type TransactionFilters = {
  category: Category | "all";
  from: string;
  to: string;
};

export const INITIAL_TRANSACTION_FILTERS: TransactionFilters = {
  category: "all",
  from: "",
  to: "",
};

export type TransactionFilterValidation =
  | { valid: true }
  | { valid: false; message: string };

export function validateTransactionFilters(
  filters: TransactionFilters,
): TransactionFilterValidation {
  if (filters.from !== "" && filters.to !== "" && filters.from > filters.to) {
    return {
      valid: false,
      message: "開始日は終了日以前の日付を指定してください。",
    };
  }

  return { valid: true };
}

export function filterTransactions(
  transactions: readonly Transaction[],
  filters: TransactionFilters,
): Transaction[] {
  return transactions
    .map((transaction, originalIndex) => ({ transaction, originalIndex }))
    .filter(({ transaction }) => {
      const categoryMatches =
        filters.category === "all" || transaction.category === filters.category;
      const fromMatches = filters.from === "" || transaction.date >= filters.from;
      const toMatches = filters.to === "" || transaction.date <= filters.to;

      return categoryMatches && fromMatches && toMatches;
    })
    .sort(
      (left, right) =>
        right.transaction.date.localeCompare(left.transaction.date) ||
        left.originalIndex - right.originalIndex,
    )
    .map(({ transaction }) => transaction);
}
