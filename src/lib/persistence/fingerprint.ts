import { createHash } from "node:crypto";

import type { PersistStatementRequest } from "../../types/persistence.ts";

export function createImportFingerprint(statement: PersistStatementRequest): string {
  const canonical = {
    version: 1,
    period: [statement.periodStart, statement.periodEnd],
    transactions: statement.transactions.map((transaction) => [
      transaction.date,
      transaction.merchantRaw,
      transaction.merchantNormalized,
      transaction.amount,
      transaction.description,
      transaction.approvalNumber,
    ]),
  };
  return createHash("sha256").update(JSON.stringify(canonical), "utf8").digest("hex");
}
