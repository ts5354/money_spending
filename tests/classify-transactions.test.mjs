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

function memoryStorage(cache = {}) {
  let value = JSON.stringify(cache);
  return {
    getItem() {
      return value;
    },
    setItem(_key, nextValue) {
      value = nextValue;
    },
    cache() {
      return JSON.parse(value);
    },
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

  const storage = memoryStorage();
  const transactions = await classifyTransactions(parsed, {
    storage,
    requester: async (merchants) => {
      requestedMerchants = merchants;
      return {
        classifications: [
          { merchant: "架空商店A", category: "shopping" },
          { merchant: "架空電車", category: "transportation" },
        ],
      };
    },
  });

  assert.deepEqual(requestedMerchants, ["架空商店A", "架空電車"]);
  assert.deepEqual(
    transactions.map(({ category }) => category),
    ["shopping", "shopping", "transportation"],
  );
  assert.ok(transactions.every(({ categorySource }) => categorySource === "ai"));
  assert.deepEqual(storage.cache(), {
    架空商店A: "shopping",
    架空電車: "transportation",
  });

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

test("sends only cache misses and marks cached and AI transactions by source", async () => {
  const parsed = [
    parsedTransaction({ id: "jcb-test-1" }),
    parsedTransaction({
      id: "jcb-test-2",
      merchantRaw: "架空電車",
      merchantNormalized: "架空電車",
    }),
  ];
  const storage = memoryStorage({ 架空商店A: "restaurant" });
  let requestedMerchants;

  const transactions = await classifyTransactions(parsed, {
    storage,
    requester: async (merchants) => {
      requestedMerchants = merchants;
      return {
        classifications: [{ merchant: "架空電車", category: "transportation" }],
      };
    },
  });

  assert.deepEqual(requestedMerchants, ["架空電車"]);
  assert.deepEqual(
    transactions.map(({ category, categorySource }) => ({ category, categorySource })),
    [
      { category: "restaurant", categorySource: "cache" },
      { category: "transportation", categorySource: "ai" },
    ],
  );
  assert.deepEqual(storage.cache(), {
    架空商店A: "restaurant",
    架空電車: "transportation",
  });
});

test("skips classification entirely when all merchants are cached", async () => {
  const storage = memoryStorage({ 架空商店A: "supermarket" });
  let requestCount = 0;

  const transactions = await classifyTransactions(
    [parsedTransaction(), parsedTransaction({ id: "jcb-test-2" })],
    {
      storage,
      requester: async () => {
        requestCount += 1;
        throw new Error("The requester must not run for an all-cached import.");
      },
    },
  );

  assert.equal(requestCount, 0);
  assert.ok(transactions.every(({ category }) => category === "supermarket"));
  assert.ok(transactions.every(({ categorySource }) => categorySource === "cache"));
});

test("keeps a successful AI classification when cache persistence fails", async () => {
  const storage = {
    getItem() {
      return null;
    },
    setItem() {
      throw new Error("Quota exceeded");
    },
  };

  const transactions = await classifyTransactions([parsedTransaction()], {
    storage,
    requester: async () => ({
      classifications: [{ merchant: "架空商店A", category: "shopping" }],
    }),
  });

  assert.equal(transactions[0].category, "shopping");
  assert.equal(transactions[0].categorySource, "ai");
});

test("rejects the entire mixed import when classification of a cache miss fails", async () => {
  const storage = memoryStorage({ 架空商店A: "shopping" });
  const parsed = [
    parsedTransaction(),
    parsedTransaction({
      id: "jcb-test-2",
      merchantRaw: "架空電車",
      merchantNormalized: "架空電車",
    }),
  ];

  await assert.rejects(
    classifyTransactions(parsed, {
      storage,
      requester: async () => {
        throw new Error("AI unavailable");
      },
    }),
  );
  assert.deepEqual(storage.cache(), { 架空商店A: "shopping" });
});

test("uses a manually overwritten cache entry on the next import", async () => {
  const storage = memoryStorage({ 架空商店A: "restaurant" });

  const [transaction] = await classifyTransactions([parsedTransaction()], {
    storage,
    requester: async () => {
      throw new Error("A manually cached merchant must not be classified again.");
    },
  });

  assert.equal(transaction.category, "restaurant");
  assert.equal(transaction.categorySource, "cache");
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
