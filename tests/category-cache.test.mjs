import assert from "node:assert/strict";
import test from "node:test";

import {
  CATEGORY_CACHE_STORAGE_KEY,
  readCategoryCache,
  writeCategoryCache,
  writeMerchantCategory,
} from "../src/lib/categories/category-cache.ts";

function memoryStorage(initialValue = null) {
  let value = initialValue;
  return {
    getItem(key) {
      assert.equal(key, CATEGORY_CACHE_STORAGE_KEY);
      return value;
    },
    setItem(key, nextValue) {
      assert.equal(key, CATEGORY_CACHE_STORAGE_KEY);
      value = nextValue;
    },
    storedValue() {
      return value;
    },
  };
}

test("uses the fixed versioned category cache storage key", () => {
  assert.equal(CATEGORY_CACHE_STORAGE_KEY, "jcb-spending-visualizer:category-cache:v1");
});

test("reads and writes merchant categories without categorySource", () => {
  const storage = memoryStorage();

  assert.equal(
    writeCategoryCache(storage, {
      架空商店A: "shopping",
      架空配信サービス: "subscription",
    }),
    true,
  );

  assert.deepEqual(JSON.parse(storage.storedValue()), {
    架空商店A: "shopping",
    架空配信サービス: "subscription",
  });
  assert.equal(storage.storedValue().includes("categorySource"), false);
  assert.deepEqual({ ...readCategoryCache(storage) }, {
    架空商店A: "shopping",
    架空配信サービス: "subscription",
  });
});

test("treats missing, malformed, and non-object cache data as empty", async (t) => {
  const cases = [null, "{broken", "null", "[]", '"string"', "42"];

  for (const value of cases) {
    await t.test(String(value), () => {
      assert.deepEqual({ ...readCategoryCache(memoryStorage(value)) }, {});
    });
  }
});

test("keeps valid records and ignores invalid categories", () => {
  const storage = memoryStorage(
    JSON.stringify({
      架空商店A: "shopping",
      架空商店B: "utilities",
      架空商店C: 123,
      架空不明店: "other",
    }),
  );

  assert.deepEqual({ ...readCategoryCache(storage) }, {
    架空商店A: "shopping",
    架空不明店: "other",
  });
});

test("handles storage read and write exceptions without throwing", () => {
  const unavailableStorage = {
    getItem() {
      throw new Error("Storage unavailable");
    },
    setItem() {
      throw new Error("Storage unavailable");
    },
  };

  assert.deepEqual({ ...readCategoryCache(unavailableStorage) }, {});
  assert.equal(writeCategoryCache(unavailableStorage, { 架空商店A: "shopping" }), false);
  assert.equal(writeMerchantCategory(unavailableStorage, "架空商店A", "shopping"), false);
});

test("manual category writes overwrite an existing merchant entry", () => {
  const storage = memoryStorage(JSON.stringify({ 架空商店A: "shopping" }));

  assert.equal(writeMerchantCategory(storage, "架空商店A", "restaurant"), true);
  assert.deepEqual({ ...readCategoryCache(storage) }, { 架空商店A: "restaurant" });
});
