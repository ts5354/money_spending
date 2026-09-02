export type AccessState =
  | { status: "unauthenticated" }
  | { status: "forbidden" }
  | { status: "authorized"; userId: string };

export function evaluateAccess(
  userId: string | null | undefined,
  allowedUserId: string | null | undefined,
): AccessState {
  if (!userId) {
    return { status: "unauthenticated" };
  }

  if (!allowedUserId || allowedUserId.trim() === "" || userId !== allowedUserId) {
    return { status: "forbidden" };
  }

  return { status: "authorized", userId };
}
