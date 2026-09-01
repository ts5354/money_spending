import assert from "node:assert/strict";
import test from "node:test";

import { updateTransactionsForMerchant } from "../src/lib/categories/update-merchant-category.ts";

function transaction(overrides = {}) {
  return {
    id: overrides.id ?? "jcb-test-1",
    date: overrides.date ?? "2026-08-15",
    merchantRaw: overrides.merchantRaw ?? "架空商店Ａ",
    merchantNormalized: overrides.merchantNormalized ?? "架空商店A",
    amount: overrides.amount ?? 1200,
    category: overrides.category ?? "shopping",
    categorySource: overrides.categorySource ?? "ai",
    description: overrides.description ?? "架空の買い物",
    approvalNumber: overrides.approvalNumber ?? "[999001]",
  };
}

test("updates every transaction with the same normalized merchant", () => {
  const original = [
    transaction({ id: "jcb-test-1" }),
    transaction({ id: "jcb-test-2", amount: 2400, categorySource: "cache" }),
    transaction({
      id: "jcb-test-3",
      merchantRaw: "架空電車",
      merchantNormalized: "架空電車",
      category: "transportation",
    }),
  ];

  const updated = updateTransactionsForMerchant(original, "架空商店A", "restaurant");

  assert.deepEqual(
    updated.map(({ category, categorySource }) => ({ category, categorySource })),
    [
      { category: "restaurant", categorySource: "manual" },
      { category: "restaurant", categorySource: "manual" },
      { category: "transportation", categorySource: "ai" },
    ],
  );
  assert.equal(original[0].category, "shopping");
  assert.equal(updated[0].id, original[0].id);
  assert.equal(updated[0].date, original[0].date);
  assert.equal(updated[0].amount, original[0].amount);
  assert.equal(updated[0].description, original[0].description);
  assert.equal(updated[0].approvalNumber, original[0].approvalNumber);
});
