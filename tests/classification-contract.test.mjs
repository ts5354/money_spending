import assert from "node:assert/strict";
import test from "node:test";

import {
  ClassificationContractError,
  parseClassificationResponse,
  parseClassifyRequest,
} from "../src/lib/ai/classification-contract.ts";
import { CATEGORY_IDS } from "../src/types/category.ts";

function assertContractError(callback) {
  assert.throws(callback, ClassificationContractError);
}

test("accepts a valid merchant array and deduplicates exact duplicates", () => {
  assert.deepEqual(
    parseClassifyRequest({ merchants: ["架空商店A", "架空商店A", "架空商店B"] }),
    ["架空商店A", "架空商店B"],
  );
});

test("rejects missing, non-array, and empty merchants", async (t) => {
  const cases = [
    ["missing", {}],
    ["not an array", { merchants: "架空商店A" }],
    ["empty", { merchants: [] }],
  ];

  for (const [name, input] of cases) {
    await t.test(name, () => assertContractError(() => parseClassifyRequest(input)));
  }
});

test("rejects non-string, empty, and whitespace-only merchants", async (t) => {
  const cases = [42, "", "   "];

  for (const merchant of cases) {
    await t.test(JSON.stringify(merchant), () =>
      assertContractError(() => parseClassifyRequest({ merchants: [merchant] })),
    );
  }
});

test("rejects more than 100 merchants", () => {
  const merchants = Array.from({ length: 101 }, (_, index) => `架空商店${index}`);
  assertContractError(() => parseClassifyRequest({ merchants }));
});

test("rejects a merchant longer than 200 Unicode characters", () => {
  assertContractError(() => parseClassifyRequest({ merchants: ["架".repeat(201)] }));
});

test("accepts a merchant with exactly 200 Unicode characters", () => {
  const merchant = "架".repeat(200);
  assert.deepEqual(parseClassifyRequest({ merchants: [merchant] }), [merchant]);
});

test("rejects extra top-level request fields", async (t) => {
  const cases = [
    ["model", { merchants: ["架空商店A"], model: "任意モデル" }],
    ["prompt", { merchants: ["架空商店A"], prompt: "任意指示" }],
    ["instructions", { merchants: ["架空商店A"], instructions: "任意指示" }],
    ["other", { merchants: ["架空商店A"], amount: 1000 }],
  ];

  for (const [name, input] of cases) {
    await t.test(name, () => assertContractError(() => parseClassifyRequest(input)));
  }
});

test("defines exactly the fixed nine categories including other", () => {
  assert.deepEqual(CATEGORY_IDS, [
    "convenience_store",
    "supermarket",
    "vending_machine",
    "restaurant",
    "subscription",
    "shopping",
    "transportation",
    "entertainment",
    "other",
  ]);
});

test("accepts valid complete classifications", () => {
  const value = {
    classifications: [
      { merchant: "架空商店A", category: "shopping" },
      { merchant: "架空配信サービス", category: "subscription" },
    ],
  };

  assert.deepEqual(
    parseClassificationResponse(value, ["架空商店A", "架空配信サービス"]),
    value,
  );
});

test("accepts other as a valid category", () => {
  const value = { classifications: [{ merchant: "架空不明店", category: "other" }] };
  assert.deepEqual(parseClassificationResponse(value, ["架空不明店"]), value);
});

test("rejects an invalid category", () => {
  assertContractError(() =>
    parseClassificationResponse(
      { classifications: [{ merchant: "架空商店A", category: "utilities" }] },
      ["架空商店A"],
    ),
  );
});

test("rejects missing, unknown, and duplicate merchant classifications", async (t) => {
  const cases = [
    [
      "missing",
      { classifications: [{ merchant: "架空商店A", category: "shopping" }] },
      ["架空商店A", "架空商店B"],
    ],
    [
      "unknown",
      { classifications: [{ merchant: "未知商店", category: "other" }] },
      ["架空商店A"],
    ],
    [
      "duplicate",
      {
        classifications: [
          { merchant: "架空商店A", category: "shopping" },
          { merchant: "架空商店A", category: "other" },
        ],
      },
      ["架空商店A"],
    ],
  ];

  for (const [name, value, requested] of cases) {
    await t.test(name, () =>
      assertContractError(() => parseClassificationResponse(value, requested)),
    );
  }
});

test("rejects extra fields in classification responses", () => {
  assertContractError(() =>
    parseClassificationResponse(
      {
        classifications: [
          { merchant: "架空商店A", category: "shopping", explanation: "不要" },
        ],
      },
      ["架空商店A"],
    ),
  );
});
