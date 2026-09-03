import type { ImportBatch } from "../../types/persistence.ts";
import type { Transaction } from "../../types/transaction.ts";

export type PeriodSelection =
  | { kind: "all" }
  | { kind: "batch"; batchId: string };

export function sortImportBatches(imports: readonly ImportBatch[]): ImportBatch[] {
  return [...imports].sort(
    (left, right) =>
      right.periodEnd.localeCompare(left.periodEnd) ||
      right.periodStart.localeCompare(left.periodStart) ||
      left.id.localeCompare(right.id),
  );
}

export function getLatestImportBatch(
  imports: readonly ImportBatch[],
): ImportBatch | null {
  return sortImportBatches(imports)[0] ?? null;
}

export function formatImportPeriod(batch: Pick<ImportBatch, "periodStart" | "periodEnd">): string {
  return `${formatDate(batch.periodStart)}〜${formatDate(batch.periodEnd)}`;
}

export function reconcilePeriodSelection(
  selection: PeriodSelection | null,
  imports: readonly ImportBatch[],
): PeriodSelection | null {
  if (imports.length === 0) return null;
  if (selection?.kind === "all") return selection;
  if (
    selection?.kind === "batch" &&
    imports.some((batch) => batch.id === selection.batchId)
  ) {
    return selection;
  }
  const latest = getLatestImportBatch(imports);
  return latest === null ? null : { kind: "batch", batchId: latest.id };
}

export function selectAfterSuccessfulImport(
  selection: PeriodSelection | null,
  previousImports: readonly ImportBatch[],
  importedBatch: ImportBatch,
): PeriodSelection {
  if (previousImports.length === 0 && selection === null) {
    return { kind: "batch", batchId: importedBatch.id };
  }
  return selection ?? { kind: "batch", batchId: importedBatch.id };
}

export function synchronizeTransactionCategories(
  scopedTransactions: readonly Transaction[],
  canonicalTransactions: readonly Transaction[],
): Transaction[] {
  const canonicalById = new Map(
    canonicalTransactions.map((transaction) => [transaction.id, transaction]),
  );
  return scopedTransactions.map((transaction) => {
    const canonical = canonicalById.get(transaction.id);
    return canonical === undefined ||
      (canonical.category === transaction.category &&
        canonical.categorySource === transaction.categorySource)
      ? transaction
      : {
          ...transaction,
          category: canonical.category,
          categorySource: canonical.categorySource,
        };
  });
}

function formatDate(date: string): string {
  return date.replaceAll("-", "/");
}
