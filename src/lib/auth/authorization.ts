import "server-only";

import { auth } from "@clerk/nextjs/server";

import { evaluateAccess, type AccessState } from "./access-policy.ts";

export async function getAccessState(): Promise<AccessState> {
  const { userId } = await auth();
  return evaluateAccess(userId, process.env.ALLOWED_CLERK_USER_ID);
}
