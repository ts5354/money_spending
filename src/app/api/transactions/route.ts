import { createPersistenceRepository } from "@/db/persistence-repository";
import { createPersistenceHttpHandlers } from "@/lib/persistence/http-handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handlers = createPersistenceHttpHandlers(createPersistenceRepository);

export const GET = handlers.getTransactions;
