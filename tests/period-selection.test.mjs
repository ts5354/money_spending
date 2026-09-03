import assert from "node:assert/strict";
import test from "node:test";

import {
  formatImportPeriod,
  getLatestImportBatch,
  reconcilePeriodSelection,
  selectAfterSuccessfulImport,
  sortImportBatches,
  synchronizeTransactionCategories,
} from "../src/lib/periods/period-selection.ts";

function batch(id, periodStart, periodEnd, importedAt = "2026-01-01T00:00:00.000Z") {
  return { id, periodStart, periodEnd, transactionCount: 1, importedAt };
}

const july = batch("batch-july", "2026-06-16", "2026-07-15", "2026-09-30T00:00:00.000Z");
const august = batch("batch-august", "2026-07-16", "2026-08-15", "2026-08-20T00:00:00.000Z");
const partialAugust = batch("batch-partial", "2026-08-01", "2026-08-15", "2026-07-01T00:00:00.000Z");

test("sorts statement periods by periodEnd, periodStart, then stable id", () => {
  const input = [july, august, partialAugust];
  const snapshot = structuredClone(input);
  assert.deepEqual(sortImportBatches(input).map(({ id }) => id), [
    "batch-partial",
    "batch-august",
    "batch-july",
  ]);
  assert.deepEqual(input, snapshot);
});

test("chooses the latest statement period rather than the latest import time", () => {
  assert.equal(getLatestImportBatch([july, august]).id, "batch-august");
  assert.equal(getLatestImportBatch([]), null);
});

test("formats a statement period without timezone conversion", () => {
  assert.equal(formatImportPeriod(august), "2026/07/16〜2026/08/15");
});

test("reconciles null and stale selections to the latest valid batch", () => {
  assert.deepEqual(reconcilePeriodSelection(null, [july, august]), {
    kind: "batch",
    batchId: "batch-august",
  });
  assert.deepEqual(
    reconcilePeriodSelection({ kind: "batch", batchId: "missing" }, [july, august]),
    { kind: "batch", batchId: "batch-august" },
  );
  assert.equal(reconcilePeriodSelection({ kind: "batch", batchId: "missing" }, []), null);
});

test("preserves valid batch and explicit all selections", () => {
  const selectedJuly = { kind: "batch", batchId: july.id };
  const all = { kind: "all" };
  assert.equal(reconcilePeriodSelection(selectedJuly, [july, august]), selectedJuly);
  assert.equal(reconcilePeriodSelection(all, [july, august]), all);
});

test("selects the first import but preserves later batch and all selections", () => {
  assert.deepEqual(selectAfterSuccessfulImport(null, [], july), {
    kind: "batch",
    batchId: july.id,
  });
  const selectedJuly = { kind: "batch", batchId: july.id };
  const all = { kind: "all" };
  assert.equal(selectAfterSuccessfulImport(selectedJuly, [july], august), selectedJuly);
  assert.equal(selectAfterSuccessfulImport(all, [july], august), all);
});

test("carries current-session manual categories into a newly loaded period", () => {
  const scoped = [{
    id: "transaction-1", date: "2026-08-01", merchantRaw: "架空商店", merchantNormalized: "架空商店",
    amount: 500, category: "shopping", categorySource: "ai", description: null, approvalNumber: null,
  }];
  const canonical = [{ ...scoped[0], category: "restaurant", categorySource: "manual" }];
  const result = synchronizeTransactionCategories(scoped, canonical);

  assert.equal(result[0].category, "restaurant");
  assert.equal(result[0].categorySource, "manual");
  assert.equal(scoped[0].category, "shopping");
  assert.equal(scoped[0].categorySource, "ai");
});
