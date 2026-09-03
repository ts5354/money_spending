import assert from "node:assert/strict";
import test from "node:test";

import {
  loadPersistedImports,
  loadPersistedTransactions,
  persistImportedStatement,
  PersistenceClientError,
} from "../src/lib/persistence/persistence-client.ts";

const transaction = {
  id: "fictional-1", date: "2026-08-01", merchantRaw: "架空商店", merchantNormalized: "架空商店",
  amount: 500, category: "shopping", categorySource: "ai", description: null, approvalNumber: null,
};

test("persistence client sends the classified statement only to the persistence API", async () => {
  let captured;
  await persistImportedStatement({ periodStart: "2026-07-16", periodEnd: "2026-08-15", transactions: [transaction] }, async (url, init) => {
    captured = { url, init };
    return Response.json({ batch: { id: "batch" }, transactions: [transaction] }, { status: 201 });
  });
  assert.equal(captured.url, "/api/imports");
  assert.equal(captured.init.method, "POST");
  assert.deepEqual(Object.keys(JSON.parse(captured.init.body)).sort(), ["periodEnd", "periodStart", "transactions"]);
});

test("persistence client distinguishes duplicate from write failure", async () => {
  await assert.rejects(
    persistImportedStatement({ periodStart: "2026-07-16", periodEnd: "2026-08-15", transactions: [transaction] }, async () => new Response(null, { status: 409 })),
    (error) => error instanceof PersistenceClientError && error.code === "IMPORT_ALREADY_EXISTS",
  );
  await assert.rejects(
    persistImportedStatement({ periodStart: "2026-07-16", periodEnd: "2026-08-15", transactions: [transaction] }, async () => new Response(null, { status: 500 })),
    (error) => error instanceof PersistenceClientError && error.code === "IMPORT_FAILED",
  );
});

test("loads persisted transactions and rejects read failures", async () => {
  assert.deepEqual(await loadPersistedTransactions(async () => Response.json({ transactions: [transaction] })), [transaction]);
  await assert.rejects(
    loadPersistedTransactions(async () => Response.json({ error: { code: "READ_FAILED" } }, { status: 500 })),
    (error) => error instanceof PersistenceClientError && error.code === "READ_FAILED",
  );
});

test("loads import metadata without caching", async () => {
  const imports = [{
    id: "11111111-1111-4111-8111-111111111111",
    periodStart: "2026-07-16",
    periodEnd: "2026-08-15",
    transactionCount: 1,
    importedAt: "2026-08-20T00:00:00.000Z",
  }];
  let captured;
  assert.deepEqual(await loadPersistedImports(async (url, init) => {
    captured = { url, init };
    return Response.json({ imports });
  }), imports);
  assert.deepEqual(captured, { url: "/api/imports", init: { cache: "no-store" } });
});

test("loads one specific batch through the existing batchId query", async () => {
  let captured;
  const batchId = "11111111-1111-4111-8111-111111111111";
  assert.deepEqual(await loadPersistedTransactions(async (url, init) => {
    captured = { url, init };
    return Response.json({ transactions: [transaction] });
  }, batchId), [transaction]);
  assert.deepEqual(captured, {
    url: `/api/transactions?batchId=${batchId}`,
    init: { cache: "no-store" },
  });
});

test("all-period loading uses one queryless transaction request", async () => {
  const calls = [];
  await loadPersistedTransactions(async (url, init) => {
    calls.push({ url, init });
    return Response.json({ transactions: [transaction] });
  });
  assert.deepEqual(calls, [{ url: "/api/transactions", init: { cache: "no-store" } }]);
});

test("import and transaction metadata read failures are safe", async () => {
  for (const operation of [
    () => loadPersistedImports(async () => Response.json({ imports: null })),
    () => loadPersistedImports(async () => new Response(null, { status: 500 })),
    () => loadPersistedTransactions(async () => Response.json({ transactions: null })),
  ]) {
    await assert.rejects(
      operation(),
      (error) => error instanceof PersistenceClientError && error.code === "READ_FAILED",
    );
  }
});
