import assert from "node:assert/strict";
import test from "node:test";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const isSafeTestDatabase = Boolean(testDatabaseUrl) && testDatabaseUrl !== process.env.DATABASE_URL;

test("Neon persistence integration: migration, atomicity, duplicates, and multi-period reads", {
  skip: isSafeTestDatabase ? false : "Set an isolated TEST_DATABASE_URL different from DATABASE_URL.",
}, async () => {
  const [{ drizzle }, { migrate }, { eq, sql }, schemaModule, repositoryModule] = await Promise.all([
    import("drizzle-orm/neon-http"),
    import("drizzle-orm/neon-http/migrator"),
    import("drizzle-orm"),
    import("../src/db/schema.ts"),
    import("../src/db/persistence-repository.ts"),
  ]);
  const { importBatches, transactions } = schemaModule;
  const db = drizzle(testDatabaseUrl, { schema: schemaModule });
  await migrate(db, { migrationsFolder: "drizzle" });
  await db.delete(transactions);
  await db.delete(importBatches);

  const repository = repositoryModule.createPersistenceRepository(db);
  const fictionalTransaction = (id, date, amount, overrides = {}) => ({
    id,
    date,
    merchantRaw: "架空商店",
    merchantNormalized: "架空商店",
    amount,
    category: "shopping",
    categorySource: "ai",
    description: null,
    approvalNumber: null,
    ...overrides,
  });
  const july = {
    periodStart: "2026-07-16",
    periodEnd: "2026-08-15",
    transactions: [
      fictionalTransaction("july-1", "2026-08-01", -500, { approvalNumber: "[000001]" }),
      fictionalTransaction("july-2", "2026-08-01", -500, { approvalNumber: "[000001]" }),
    ],
  };
  const august = {
    periodStart: "2026-08-16",
    periodEnd: "2026-09-15",
    transactions: [fictionalTransaction("august-1", "2026-09-01", 1200, { description: "架空の購入" })],
  };

  const julyResult = await repository.insertStatement(july, "1".repeat(64));
  assert.equal(julyResult.transactions.length, 2);
  assert.equal(julyResult.transactions[0].amount, -500);
  assert.equal(julyResult.transactions[0].date, "2026-08-01");
  assert.equal(julyResult.transactions[0].description, null);
  assert.equal(julyResult.transactions[0].approvalNumber, "[000001]");
  assert.equal(new Set(julyResult.transactions.map((row) => row.id)).size, 2);

  const augustResult = await repository.insertStatement(august, "2".repeat(64));
  assert.equal((await repository.listImports()).length, 2);
  assert.equal((await repository.listTransactions()).length, 3);
  assert.deepEqual(
    (await repository.listTransactions(julyResult.batch.id)).map((row) => row.id),
    julyResult.transactions.map((row) => row.id),
  );
  assert.deepEqual(
    (await repository.listTransactions(augustResult.batch.id)).map((row) => row.id),
    augustResult.transactions.map((row) => row.id),
  );

  await assert.rejects(repository.insertStatement(july, "3".repeat(64)));
  await assert.rejects(repository.insertStatement({ ...august, periodStart: "2026-09-16", periodEnd: "2026-10-15" }, "2".repeat(64)));
  assert.equal((await repository.listImports()).length, 2);
  assert.equal((await repository.listTransactions()).length, 3);

  const failedBatchId = crypto.randomUUID();
  await assert.rejects(db.batch([
    db.insert(importBatches).values({
      id: failedBatchId, periodStart: "2026-10-16", periodEnd: "2026-11-15",
      fingerprint: "4".repeat(64), transactionCount: 1,
    }),
    db.insert(transactions).values({
      id: crypto.randomUUID(), importBatchId: failedBatchId, sourceOrder: 0, date: "2026-11-01",
      merchantRaw: "架空商店", merchantNormalized: "架空商店", amount: 100,
      category: "invalid-category", categorySource: "ai",
    }),
  ]));
  const failedBatch = await db.select().from(importBatches).where(eq(importBatches.id, failedBatchId));
  assert.equal(failedBatch.length, 0);
  assert.equal((await repository.listImports()).length, 2);

  const concurrent = await Promise.allSettled([
    repository.insertStatement({ ...july, periodStart: "2026-11-16", periodEnd: "2026-12-15" }, "5".repeat(64)),
    repository.insertStatement({ ...july, periodStart: "2026-11-16", periodEnd: "2026-12-15" }, "5".repeat(64)),
  ]);
  assert.equal(concurrent.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(concurrent.filter((result) => result.status === "rejected").length, 1);

  const count = await db.select({ count: sql`count(*)` }).from(transactions);
  assert.equal(Number(count[0].count), 5);
});
