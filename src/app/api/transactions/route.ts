import { createPersistenceRepository } from "@/db/persistence-repository";
import { createAuthorizedApiHandler } from "@/lib/auth/api-authorization";
import { getAccessState } from "@/lib/auth/authorization";
import { createPersistenceHttpHandlers } from "@/lib/persistence/http-handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handlers = createPersistenceHttpHandlers(createPersistenceRepository);

export const GET = createAuthorizedApiHandler(getAccessState, handlers.getTransactions);
