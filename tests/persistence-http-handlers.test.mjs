import assert from "node:assert/strict";
import test from "node:test";

import { createPersistenceHttpHandlers } from "../src/lib/persistence/http-handlers.ts";

const batch = {
  id: "11111111-1111-4111-8111-111111111111",
  periodStart: "2026-07-16",
  periodEnd: "2026-08-15",
  transactionCount: 1,
  importedAt: "2026-08-20T00:00:00.000Z",
};
const transaction = {
  id: "fictional-1", date: "2026-08-01", merchantRaw: "架空商店", merchantNormalized: "架空商店",
  amount: 1200, category: "shopping", categorySource: "ai", description: null, approvalNumber: "[000001]",
};
const body = { periodStart: batch.periodStart, periodEnd: batch.periodEnd, transactions: [transaction] };

function repository(overrides = {}) {
  return {
    async insertStatement(statement, fingerprint) {
      assert.deepEqual(statement, body);
      assert.match(fingerprint, /^[0-9a-f]{64}$/);
      return { batch, transactions: [transaction] };
    },
    async listImports() { return [batch]; },
    async listTransactions() { return [transaction]; },
    ...overrides,
  };
}

test("POST returns 201 and persisted batch metadata", async () => {
  const handlers = createPersistenceHttpHandlers(() => repository());
  const response = await handlers.postImport(new Request("http://test/api/imports", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  }));
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { batch, transactions: [transaction] });
});

test("POST maps invalid input, duplicate violations, and unexpected failures safely", async (t) => {
  await t.test("invalid", async () => {
    let calls = 0;
    const response = await createPersistenceHttpHandlers(() => { calls += 1; return repository(); })
      .postImport(new Request("http://test/api/imports", { method: "POST", body: "{}" }));
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: { code: "INVALID_REQUEST" } });
    assert.equal(calls, 0);
  });
  await t.test("duplicate", async () => {
    const response = await createPersistenceHttpHandlers(() => repository({
      async insertStatement() { const error = new Error("private constraint detail"); error.code = "23505"; throw error; },
    })).postImport(new Request("http://test/api/imports", { method: "POST", body: JSON.stringify(body) }));
    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), { error: { code: "IMPORT_ALREADY_EXISTS" } });
  });
  await t.test("failure", async () => {
    const response = await createPersistenceHttpHandlers(() => repository({
      async insertStatement() { throw new Error("private database detail"); },
    })).postImport(new Request("http://test/api/imports", { method: "POST", body: JSON.stringify(body) }));
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: { code: "IMPORT_FAILED" } });
  });
});

test("GET imports and transactions return collections without DB metadata", async () => {
  const handlers = createPersistenceHttpHandlers(() => repository());
  const importsResponse = await handlers.getImports();
  assert.deepEqual(await importsResponse.json(), { imports: [batch] });
  const transactionsResponse = await handlers.getTransactions(new Request("http://test/api/transactions"));
  assert.deepEqual(await transactionsResponse.json(), { transactions: [transaction] });
});

test("GET transactions validates query shape and passes valid batch IDs", async () => {
  let receivedBatchId;
  const handlers = createPersistenceHttpHandlers(() => repository({
    async listTransactions(batchId) { receivedBatchId = batchId; return []; },
  }));
  const valid = await handlers.getTransactions(new Request(`http://test/api/transactions?batchId=${batch.id}`));
  assert.equal(valid.status, 200);
  assert.equal(receivedBatchId, batch.id);
  assert.deepEqual(await valid.json(), { transactions: [] });

  for (const query of ["batchId=bad", "unknown=x", `batchId=${batch.id}&batchId=${batch.id}`]) {
    const response = await handlers.getTransactions(new Request(`http://test/api/transactions?${query}`));
    assert.equal(response.status, 400);
  }
});

test("GET failures return READ_FAILED without internal details", async () => {
  const failing = () => repository({
    async listImports() { throw new Error("secret SQL"); },
    async listTransactions() { throw new Error("secret SQL"); },
  });
  const handlers = createPersistenceHttpHandlers(failing);
  for (const response of [
    await handlers.getImports(),
    await handlers.getTransactions(new Request("http://test/api/transactions")),
  ]) {
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: { code: "READ_FAILED" } });
  }
});
