import assert from "node:assert/strict";
import test from "node:test";

import { classifyMerchants } from "../src/lib/ai/classify-merchants.ts";

test("passes only the merchant string array to the provider", async () => {
  const merchants = ["架空商店A", "架空配信サービス"];
  let providerArguments;

  const result = await classifyMerchants(merchants, async (...args) => {
    providerArguments = args;
    return {
      classifications: [
        { merchant: "架空商店A", category: "shopping" },
        { merchant: "架空配信サービス", category: "subscription" },
      ],
    };
  });

  assert.deepEqual(providerArguments, [merchants]);
  assert.deepEqual(result.classifications.map(({ category }) => category), [
    "shopping",
    "subscription",
  ]);
});

test("rejects invalid provider output without an OpenAI network request", async () => {
  await assert.rejects(
    classifyMerchants(["架空商店A"], async () => ({
      classifications: [{ merchant: "架空商店A", category: "invalid" }],
    })),
  );
});
