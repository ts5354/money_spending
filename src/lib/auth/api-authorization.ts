import type { AccessState } from "./access-policy.ts";

export type AccessResolver = () => Promise<AccessState>;

type ApiHandler<Arguments extends unknown[]> = (...args: Arguments) => Promise<Response>;

export function createAuthorizedApiHandler<Arguments extends unknown[]>(
  resolveAccess: AccessResolver,
  handler: ApiHandler<Arguments>,
): ApiHandler<Arguments> {
  return async (...args) => {
    const access = await resolveAccess();
    if (access.status === "unauthenticated") {
      return authErrorResponse("UNAUTHORIZED", "Authentication required.", 401);
    }
    if (access.status === "forbidden") {
      return authErrorResponse("FORBIDDEN", "Access denied.", 403);
    }
    return handler(...args);
  };
}

function authErrorResponse(code: "UNAUTHORIZED" | "FORBIDDEN", message: string, status: 401 | 403) {
  return Response.json({ error: { code, message } }, { status });
}
