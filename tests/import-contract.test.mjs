import assert from "node:assert/strict";
import test from "node:test";

import {
  ImportContractError,
  MAX_IMPORT_TRANSACTIONS,
  parseImportRequest,
} from "../src/lib/persistence/import-contract.ts";

function transaction(overrides = {}) {
  return {
    id: "fictional-1",
    date: "2026-08-01",
    merchantRaw: "架空商店",
    merchantNormalized: "架空商店",
    amount: -500,
    category: "shopping",
    categorySource: "ai",
    description: null,
    approvalNumber: "[000001]",
    ...overrides,
  };
}

function request(overrides = {}) {
  return {
    periodStart: "2026-07-16",
    periodEnd: "2026-08-15",
    transactions: [transaction()],
    ...overrides,
  };
}

function rejects(value) {
  assert.throws(() => parseImportRequest(value), ImportContractError);
}

test("accepts a strict import and preserves signed safe-integer and nullable fields", () => {
  assert.deepEqual(parseImportRequest(request()), request());
});

test("rejects unknown or missing top-level and transaction keys", () => {
  rejects({ ...request(), model: "forbidden" });
  rejects({ periodStart: "2026-07-16", periodEnd: "2026-08-15" });
  rejects(request({ transactions: [{ ...transaction(), prompt: "forbidden" }] }));
});

test("rejects invalid periods, transaction dates, and dates outside the statement", () => {
  rejects(request({ periodStart: "2026-02-30" }));
  rejects(request({ periodStart: "2026-08-16", periodEnd: "2026-08-15" }));
  rejects(request({ transactions: [transaction({ date: "2026-02-30" })] }));
  rejects(request({ transactions: [transaction({ date: "2026-08-16" })] }));
});

test("rejects invalid amount, category, source, and nullable fields", () => {
  rejects(request({ transactions: [transaction({ amount: 1.5 })] }));
  rejects(request({ transactions: [transaction({ amount: Number.MAX_SAFE_INTEGER + 1 })] }));
  rejects(request({ transactions: [transaction({ category: "unknown" })] }));
  rejects(request({ transactions: [transaction({ categorySource: "unknown" })] }));
  rejects(request({ transactions: [transaction({ description: 42 })] }));
});

test("enforces non-empty and bounded transaction collections", () => {
  rejects(request({ transactions: [] }));
  rejects(request({ transactions: Array.from({ length: MAX_IMPORT_TRANSACTIONS + 1 }, () => transaction()) }));
});
