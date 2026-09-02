import assert from "node:assert/strict";
import test from "node:test";

import { createImportFingerprint } from "../src/lib/persistence/fingerprint.ts";

function statement() {
  return {
    periodStart: "2026-07-16",
    periodEnd: "2026-08-15",
    transactions: [
      {
        id: "client-id-1", date: "2026-08-01", merchantRaw: "架空商店", merchantNormalized: "架空商店",
        amount: 1000, category: "shopping", categorySource: "ai", description: null, approvalNumber: "[000001]",
      },
      {
        id: "client-id-2", date: "2026-08-01", merchantRaw: "架空商店", merchantNormalized: "架空商店",
        amount: 1000, category: "shopping", categorySource: "cache", description: null, approvalNumber: "[000001]",
      },
    ],
  };
}

test("creates deterministic lowercase SHA-256 independent of client IDs and classifications", () => {
  const first = statement();
  const second = structuredClone(first);
  second.transactions[0].id = "another-file-derived-id";
  second.transactions[0].category = "other";
  second.transactions[0].categorySource = "manual";
  const fingerprint = createImportFingerprint(first);
  assert.match(fingerprint, /^[0-9a-f]{64}$/);
  assert.equal(createImportFingerprint(first), fingerprint);
  assert.equal(createImportFingerprint(second), fingerprint);
});

test("period, meaningful content, duplicates, and source order affect the fingerprint", () => {
  const original = statement();
  const periodChanged = structuredClone(original);
  periodChanged.periodStart = "2026-07-15";
  const amountChanged = structuredClone(original);
  amountChanged.transactions[0].amount = 1001;
  const withoutDuplicate = structuredClone(original);
  withoutDuplicate.transactions.pop();
  const reordered = structuredClone(original);
  reordered.transactions[0].approvalNumber = "[000002]";
  reordered.transactions.reverse();
  assert.notEqual(createImportFingerprint(periodChanged), createImportFingerprint(original));
  assert.notEqual(createImportFingerprint(amountChanged), createImportFingerprint(original));
  assert.notEqual(createImportFingerprint(withoutDuplicate), createImportFingerprint(original));
  assert.notEqual(createImportFingerprint(reordered), createImportFingerprint(original));
});
