import assert from "node:assert/strict";
import test from "node:test";

import { createAuthorizedApiHandler } from "../src/lib/auth/api-authorization.ts";

const protectedOperations = [
  "POST /api/classify",
  "POST /api/imports",
  "GET /api/imports",
  "GET /api/transactions",
];

for (const operation of protectedOperations) {
  test(`${operation} returns 401 before protected business logic when signed out`, async () => {
    let calls = 0;
    const handler = createAuthorizedApiHandler(
      async () => ({ status: "unauthenticated" }),
      async () => {
        calls += 1;
        return Response.json({ reached: true });
      },
    );

    const response = await handler(new Request("https://example.test/api"));
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), {
      error: { code: "UNAUTHORIZED", message: "Authentication required." },
    });
    assert.equal(calls, 0);
  });

  test(`${operation} returns 403 before protected business logic for a non-allowlisted user`, async () => {
    let calls = 0;
    const handler = createAuthorizedApiHandler(
      async () => ({ status: "forbidden" }),
      async () => {
        calls += 1;
        return Response.json({ reached: true });
      },
    );

    const response = await handler(new Request("https://example.test/api"));
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), {
      error: { code: "FORBIDDEN", message: "Access denied." },
    });
    assert.equal(calls, 0);
  });
}

test("authorized API wrapper forwards the original arguments and response once", async () => {
  const request = new Request("https://example.test/api");
  let received;
  const handler = createAuthorizedApiHandler(
    async () => ({ status: "authorized", userId: "user_allowed" }),
    async (argument) => {
      received = argument;
      return new Response(null, { status: 204 });
    },
  );

  const response = await handler(request);
  assert.equal(received, request);
  assert.equal(response.status, 204);
});
