import assert from "node:assert/strict";
import test from "node:test";

import { evaluateAccess } from "../src/lib/auth/access-policy.ts";

test("access policy distinguishes signed-out, forbidden, and exact allowlisted identity", () => {
  assert.deepEqual(evaluateAccess(null, "user_allowed"), { status: "unauthenticated" });
  assert.deepEqual(evaluateAccess(undefined, "user_allowed"), { status: "unauthenticated" });
  assert.deepEqual(evaluateAccess("user_allowed", undefined), { status: "forbidden" });
  assert.deepEqual(evaluateAccess("user_allowed", ""), { status: "forbidden" });
  assert.deepEqual(evaluateAccess("user_allowed", "   "), { status: "forbidden" });
  assert.deepEqual(evaluateAccess("user_other", "user_allowed"), { status: "forbidden" });
  assert.deepEqual(evaluateAccess("USER_ALLOWED", "user_allowed"), { status: "forbidden" });
  assert.deepEqual(evaluateAccess("user_allowed", " user_allowed "), { status: "forbidden" });
  assert.deepEqual(evaluateAccess("user_allowed", "user_allowed"), {
    status: "authorized",
    userId: "user_allowed",
  });
});
