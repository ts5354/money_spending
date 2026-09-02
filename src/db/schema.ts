import { sql } from "drizzle-orm";
import {
  bigint,
  char,
  check,
  date,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { CATEGORY_IDS } from "../types/category.ts";

const categorySql = sql.raw(CATEGORY_IDS.map((value) => `'${value}'`).join(", "));

export const importBatches = pgTable(
  "import_batches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    periodStart: date("period_start", { mode: "string" }).notNull(),
    periodEnd: date("period_end", { mode: "string" }).notNull(),
    fingerprint: char("fingerprint", { length: 64 }).notNull().unique(),
    transactionCount: integer("transaction_count").notNull(),
    importedAt: timestamp("imported_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  },
  (table) => [
    unique("import_batches_period_unique").on(table.periodStart, table.periodEnd),
    check("import_batches_period_order_check", sql`${table.periodStart} <= ${table.periodEnd}`),
    check("import_batches_transaction_count_check", sql`${table.transactionCount} > 0`),
  ],
);

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    importBatchId: uuid("import_batch_id")
      .notNull()
      .references(() => importBatches.id, { onDelete: "restrict" }),
    sourceTransactionId: text("source_transaction_id"),
    sourceOrder: integer("source_order").notNull(),
    date: date("date", { mode: "string" }).notNull(),
    merchantRaw: text("merchant_raw").notNull(),
    merchantNormalized: text("merchant_normalized").notNull(),
    amount: bigint("amount", { mode: "number" }).notNull(),
    category: text("category").notNull(),
    categorySource: text("category_source").notNull(),
    description: text("description"),
    approvalNumber: text("approval_number"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  },
  (table) => [
    unique("transactions_batch_source_order_unique").on(table.importBatchId, table.sourceOrder),
    check("transactions_source_order_check", sql`${table.sourceOrder} >= 0`),
    check("transactions_category_check", sql`${table.category} in (${categorySql})`),
    check("transactions_category_source_check", sql`${table.categorySource} in ('ai', 'cache', 'manual')`),
  ],
);
