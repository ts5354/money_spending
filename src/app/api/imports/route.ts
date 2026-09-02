import { createPersistenceRepository } from "@/db/persistence-repository";
import { createPersistenceHttpHandlers } from "@/lib/persistence/http-handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handlers = createPersistenceHttpHandlers(createPersistenceRepository);

export const POST = handlers.postImport;
export const GET = handlers.getImports;
