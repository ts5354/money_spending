import { asc, desc, eq } from "drizzle-orm";

import { getDatabase, type AppDatabase } from "./client.ts";
import { importBatches, transactions } from "./schema.ts";
import type { ImportBatch, PersistStatementRequest } from "../types/persistence.ts";
import type { Transaction } from "../types/transaction.ts";

export type PersistedImport = { batch: ImportBatch; transactions: Transaction[] };

export interface PersistenceRepository {
  insertStatement(statement: PersistStatementRequest, fingerprint: string): Promise<PersistedImport>;
  listImports(): Promise<ImportBatch[]>;
  listTransactions(batchId?: string): Promise<Transaction[]>;
}

export function createPersistenceRepository(db: AppDatabase = getDatabase()): PersistenceRepository {
  return {
    async insertStatement(statement, fingerprint) {
      const batchId = crypto.randomUUID();
      const transactionRows = statement.transactions.map((transaction, sourceOrder) => ({
        id: crypto.randomUUID(),
        importBatchId: batchId,
        sourceTransactionId: transaction.id,
        sourceOrder,
        date: transaction.date,
        merchantRaw: transaction.merchantRaw,
        merchantNormalized: transaction.merchantNormalized,
        amount: transaction.amount,
        category: transaction.category,
        categorySource: transaction.categorySource,
        description: transaction.description,
        approvalNumber: transaction.approvalNumber,
      }));

      const batchInsert = db.insert(importBatches).values({
        id: batchId,
        periodStart: statement.periodStart,
        periodEnd: statement.periodEnd,
        fingerprint,
        transactionCount: transactionRows.length,
      }).returning();
      const transactionInsert = db.insert(transactions).values(transactionRows).returning();
      const [batchRows, persistedRows] = await db.batch([batchInsert, transactionInsert]);
      const batch = batchRows[0];
      if (!batch || persistedRows.length !== transactionRows.length) {
        throw new Error("Atomic import did not return the expected rows.");
      }
      return {
        batch: mapBatch(batch),
        transactions: persistedRows.map(mapTransaction),
      };
    },

    async listImports() {
      const rows = await db.select().from(importBatches).orderBy(
        desc(importBatches.periodEnd),
        desc(importBatches.importedAt),
        desc(importBatches.id),
      );
      return rows.map(mapBatch);
    },

    async listTransactions(batchId) {
      const query = db
        .select()
        .from(transactions)
        .where(batchId === undefined ? undefined : eq(transactions.importBatchId, batchId))
        .orderBy(asc(transactions.date), asc(transactions.importBatchId), asc(transactions.sourceOrder), asc(transactions.id));
      return (await query).map(mapTransaction);
    },
  };
}

function mapBatch(row: typeof importBatches.$inferSelect): ImportBatch {
  return {
    id: row.id,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    transactionCount: row.transactionCount,
    importedAt: row.importedAt,
  };
}

function mapTransaction(row: typeof transactions.$inferSelect): Transaction {
  return {
    id: row.id,
    date: row.date,
    merchantRaw: row.merchantRaw,
    merchantNormalized: row.merchantNormalized,
    amount: row.amount,
    category: row.category as Transaction["category"],
    categorySource: row.categorySource as Transaction["categorySource"],
    description: row.description,
    approvalNumber: row.approvalNumber,
  };
}
