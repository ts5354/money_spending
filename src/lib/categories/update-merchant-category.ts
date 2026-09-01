import type { Category } from "../../types/category.ts";
import type { Transaction } from "../../types/transaction.ts";

export function updateTransactionsForMerchant(
  transactions: Transaction[],
  merchantNormalized: string,
  category: Category,
): Transaction[] {
  return transactions.map((transaction) =>
    transaction.merchantNormalized === merchantNormalized
      ? { ...transaction, category, categorySource: "manual" }
      : transaction,
  );
}
