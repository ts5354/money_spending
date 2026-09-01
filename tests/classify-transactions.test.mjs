import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyTransactions,
  requestMerchantClassifications,
} from "../src/lib/categories/classify-transactions.ts";

function parsedTransaction(overrides = {}) {
  return {
    id: overrides.id ?? "jcb-test-1",
    date: overrides.date ?? "2026-08-15",
    merchantRaw: overrides.merchantRaw ?? "架空商店Ａ",
    merchantNormalized: overrides.merchantNormalized ?? "架空商店A",
    amount: overrides.amount ?? 1200,
    description: overrides.description ?? "架空の買い物",
    approvalNumber: overrides.approvalNumber ?? "[999001]",
  };
}

test("deduplicates merchants and maps classifications to every matching transaction", async () => {
  const parsed = [
    parsedTransaction({ id: "jcb-test-1" }),
    parsedTransaction({ id: "jcb-test-2", amount: 2400, approvalNumber: "[999002]" }),
    parsedTransaction({
      id: "jcb-test-3",
      merchantRaw: "架空電車",
      merchantNormalized: "架空電車",
      amount: 500,
      approvalNumber: null,
    }),
  ];
  let requestedMerchants;

  const transactions = await classifyTransactions(parsed, async (merchants) => {
    requestedMerchants = merchants;
    return {
      classifications: [
        { merchant: "架空商店A", category: "shopping" },
        { merchant: "架空電車", category: "transportation" },
      ],
    };
  });

  assert.deepEqual(requestedMerchants, ["架空商店A", "架空電車"]);
  assert.deepEqual(
    transactions.map(({ category }) => category),
    ["shopping", "shopping", "transportation"],
  );
  assert.ok(transactions.every(({ categorySource }) => categorySource === "ai"));

  for (let index = 0; index < parsed.length; index += 1) {
    assert.deepEqual(
      {
        id: transactions[index].id,
        date: transactions[index].date,
        merchantRaw: transactions[index].merchantRaw,
        merchantNormalized: transactions[index].merchantNormalized,
        amount: transactions[index].amount,
        description: transactions[index].description,
        approvalNumber: transactions[index].approvalNumber,
      },
      parsed[index],
    );
  }
});

test("sends a request body whose only top-level key is merchants", async () => {
  const merchants = ["架空商店A", "架空電車"];
  let requestedUrl;
  let requestedInit;

  const fakeFetch = async (url, init) => {
    requestedUrl = url;
    requestedInit = init;
    return Response.json({
      classifications: [
        { merchant: "架空商店A", category: "shopping" },
        { merchant: "架空電車", category: "transportation" },
      ],
    });
  };

  await requestMerchantClassifications(merchants, fakeFetch);

  assert.equal(requestedUrl, "/api/classify");
  assert.equal(requestedInit.method, "POST");
  const body = JSON.parse(requestedInit.body);
  assert.deepEqual(Object.keys(body), ["merchants"]);
  assert.deepEqual(body, { merchants });
  assert.equal("amount" in body, false);
  assert.equal("date" in body, false);
  assert.equal("approvalNumber" in body, false);
  assert.equal("description" in body, false);
});

test("rejects an unsafe or unsuccessful server response", async (t) => {
  await t.test("HTTP failure", async () => {
    await assert.rejects(
      requestMerchantClassifications(["架空商店A"], async () =>
        Response.json({ error: { code: "CLASSIFICATION_FAILED" } }, { status: 500 }),
      ),
    );
  });

  await t.test("unknown merchant", async () => {
    await assert.rejects(
      requestMerchantClassifications(["架空商店A"], async () =>
        Response.json({ classifications: [{ merchant: "未知商店", category: "other" }] }),
      ),
    );
  });
});
