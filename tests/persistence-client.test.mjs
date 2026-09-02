import assert from "node:assert/strict";
import test from "node:test";

import {
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
