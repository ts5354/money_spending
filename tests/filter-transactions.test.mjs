import assert from "node:assert/strict";
import test from "node:test";

import {
  filterTransactions,
  INITIAL_TRANSACTION_FILTERS,
  validateTransactionFilters,
} from "../src/lib/transactions/filter-transactions.ts";
import { CATEGORY_IDS } from "../src/types/category.ts";

function transaction(overrides = {}) {
  return {
    id: overrides.id ?? "explorer-1",
    date: overrides.date ?? "2026-08-15",
    merchantRaw: overrides.merchantRaw ?? "架空商店A",
    merchantNormalized: overrides.merchantNormalized ?? "架空商店A",
    amount: overrides.amount ?? 1000,
    category: overrides.category ?? "shopping",
    categorySource: overrides.categorySource ?? "ai",
    description: overrides.description ?? null,
    approvalNumber: overrides.approvalNumber ?? null,
  };
}

const transactions = [
  transaction({ id: "1", date: "2026-08-01", category: "shopping", amount: 1000 }),
  transaction({ id: "2", date: "2026-08-15", category: "restaurant", amount: 2000 }),
  transaction({ id: "3", date: "2026-08-15", category: "shopping", amount: -500 }),
  transaction({ id: "4", date: "2026-08-31", category: "transportation", amount: 800 }),
];

test("defines the required initial and clear-filter state", () => {
  assert.deepEqual(INITIAL_TRANSACTION_FILTERS, {
    category: "all",
    from: "",
    to: "",
  });
});

test("handles empty input and applies no restriction for the initial filters", () => {
  assert.deepEqual(filterTransactions([], INITIAL_TRANSACTION_FILTERS), []);
  assert.deepEqual(
    filterTransactions(transactions, INITIAL_TRANSACTION_FILTERS).map(({ id }) => id),
    ["4", "2", "3", "1"],
  );
});

test("filters by one of the fixed categories while all imposes no restriction", () => {
  assert.deepEqual(
    filterTransactions(transactions, { category: "shopping", from: "", to: "" }).map(({ id }) => id),
    ["3", "1"],
  );
  assert.equal(
    filterTransactions(transactions, { category: "all", from: "", to: "" }).length,
    transactions.length,
  );
  for (const category of CATEGORY_IDS) {
    assert.ok(
      filterTransactions(transactions, { category, from: "", to: "" }).every(
        (item) => item.category === category,
      ),
    );
  }
});

test("applies an inclusive From-only boundary", () => {
  assert.deepEqual(
    filterTransactions(transactions, { category: "all", from: "2026-08-15", to: "" }).map(({ id }) => id),
    ["4", "2", "3"],
  );
});

test("applies an inclusive To-only boundary", () => {
  assert.deepEqual(
    filterTransactions(transactions, { category: "all", from: "", to: "2026-08-15" }).map(({ id }) => id),
    ["2", "3", "1"],
  );
});

test("applies inclusive From and To boundaries", () => {
  assert.deepEqual(
    filterTransactions(transactions, {
      category: "all",
      from: "2026-08-01",
      to: "2026-08-15",
    }).map(({ id }) => id),
    ["2", "3", "1"],
  );
});

test("combines category and date filters with AND semantics", () => {
  assert.deepEqual(
    filterTransactions(transactions, {
      category: "shopping",
      from: "2026-08-15",
      to: "",
    }).map(({ id }) => id),
    ["3"],
  );
  assert.deepEqual(
    filterTransactions(transactions, {
      category: "shopping",
      from: "",
      to: "2026-08-01",
    }).map(({ id }) => id),
    ["1"],
  );
  assert.deepEqual(
    filterTransactions(transactions, {
      category: "shopping",
      from: "2026-08-15",
      to: "2026-08-31",
    }).map(({ id }) => id),
    ["3"],
  );
});

test("returns zero matches safely", () => {
  assert.deepEqual(
    filterTransactions(transactions, {
      category: "subscription",
      from: "2026-08-01",
      to: "2026-08-31",
    }),
    [],
  );
});

test("detects From later than To and accepts valid or open ranges", () => {
  assert.deepEqual(
    validateTransactionFilters({ category: "all", from: "2026-08-16", to: "2026-08-15" }),
    { valid: false, message: "開始日は終了日以前の日付を指定してください。" },
  );
  assert.deepEqual(
    validateTransactionFilters({ category: "all", from: "2026-08-15", to: "2026-08-15" }),
    { valid: true },
  );
  assert.deepEqual(
    validateTransactionFilters({ category: "all", from: "2026-08-15", to: "" }),
    { valid: true },
  );
});

test("sorts newest first and preserves original relative order for the same date", () => {
  const result = filterTransactions(transactions, INITIAL_TRANSACTION_FILTERS);
  assert.deepEqual(result.map(({ id }) => id), ["4", "2", "3", "1"]);
});

test("does not mutate the input array or transaction objects", () => {
  const input = transactions.map((item) => ({ ...item }));
  const snapshot = structuredClone(input);
  const originalObjects = [...input];

  const result = filterTransactions(input, { category: "shopping", from: "", to: "" });

  assert.deepEqual(input, snapshot);
  assert.ok(input.every((item, index) => item === originalObjects[index]));
  assert.ok(result.every((item) => originalObjects.includes(item)));
});

test("preserves signed and negative amounts exactly", () => {
  const result = filterTransactions(transactions, { category: "shopping", from: "", to: "" });
  assert.equal(result.find(({ id }) => id === "3").amount, -500);
});

test("reflects Manual Correction-like category membership changes", () => {
  const before = filterTransactions(transactions, {
    category: "restaurant",
    from: "",
    to: "",
  });
  const corrected = transactions.map((item) =>
    item.id === "3" ? { ...item, category: "restaurant", categorySource: "manual" } : item,
  );
  const after = filterTransactions(corrected, {
    category: "restaurant",
    from: "",
    to: "",
  });

  assert.deepEqual(before.map(({ id }) => id), ["2"]);
  assert.deepEqual(after.map(({ id }) => id), ["2", "3"]);
  assert.deepEqual(
    filterTransactions(transactions, { category: "shopping", from: "", to: "" }).map(
      ({ id }) => id,
    ),
    ["3", "1"],
  );
  assert.deepEqual(
    filterTransactions(corrected, { category: "shopping", from: "", to: "" }).map(
      ({ id }) => id,
    ),
    ["1"],
  );
});
