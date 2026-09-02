import assert from "node:assert/strict";
import test from "node:test";

import { createClassificationHttpHandler } from "../src/lib/ai/classification-http-handler.ts";

test("classification HTTP handler preserves the existing validated success contract", async () => {
  let received;
  const handler = createClassificationHttpHandler(async (merchants) => {
    received = merchants;
    return { classifications: [{ merchant: "架空商店", category: "shopping" }] };
  });
  const request = new Request("https://example.test/api/classify", {
    method: "POST",
    body: JSON.stringify({ merchants: ["架空商店"] }),
  });

  const response = await handler(request);
  assert.equal(response.status, 200);
  assert.deepEqual(received, ["架空商店"]);
  assert.deepEqual(await response.json(), {
    classifications: [{ merchant: "架空商店", category: "shopping" }],
  });
});

test("classification HTTP handler rejects malformed input without calling its provider", async () => {
  let calls = 0;
  const handler = createClassificationHttpHandler(async () => {
    calls += 1;
    return {};
  });
  const request = new Request("https://example.test/api/classify", {
    method: "POST",
    body: JSON.stringify({ merchants: ["架空商店"], model: "client-controlled" }),
  });

  const response = await handler(request);
  assert.equal(response.status, 400);
  assert.equal(calls, 0);
  assert.deepEqual(await response.json(), { error: { code: "INVALID_REQUEST" } });
});

test("classification HTTP handler keeps provider failures behind the safe error contract", async () => {
  const handler = createClassificationHttpHandler(async () => {
    throw new Error("provider detail must not escape");
  });
  const request = new Request("https://example.test/api/classify", {
    method: "POST",
    body: JSON.stringify({ merchants: ["架空商店"] }),
  });

  const response = await handler(request);
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: { code: "CLASSIFICATION_FAILED" } });
});
