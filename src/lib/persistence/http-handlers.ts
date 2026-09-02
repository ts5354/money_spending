import type { PersistenceRepository } from "../../db/persistence-repository.ts";
import { ImportContractError, MAX_IMPORT_BODY_LENGTH, parseImportRequest } from "./import-contract.ts";
import { DuplicateImportError, persistStatement } from "./import-service.ts";

export function createPersistenceHttpHandlers(getRepository: () => PersistenceRepository) {
  return {
    postImport: async (request: Request): Promise<Response> => {
      let statement;
      try {
        const contentLength = Number(request.headers.get("content-length") ?? "0");
        if (Number.isFinite(contentLength) && contentLength > MAX_IMPORT_BODY_LENGTH) {
          return errorResponse("INVALID_REQUEST", 400);
        }
        const text = await request.text();
        if (new TextEncoder().encode(text).byteLength > MAX_IMPORT_BODY_LENGTH) {
          return errorResponse("INVALID_REQUEST", 400);
        }
        statement = parseImportRequest(JSON.parse(text) as unknown);
      } catch (error) {
        if (error instanceof SyntaxError || error instanceof ImportContractError) {
          return errorResponse("INVALID_REQUEST", 400);
        }
        return errorResponse("INVALID_REQUEST", 400);
      }

      try {
        const persisted = await persistStatement(getRepository(), statement);
        return Response.json({ batch: persisted.batch, transactions: persisted.transactions }, { status: 201 });
      } catch (error) {
        if (error instanceof DuplicateImportError) return errorResponse("IMPORT_ALREADY_EXISTS", 409);
        return errorResponse("IMPORT_FAILED", 500);
      }
    },

    getImports: async (): Promise<Response> => {
      try {
        return Response.json({ imports: await getRepository().listImports() });
      } catch {
        return errorResponse("READ_FAILED", 500);
      }
    },

    getTransactions: async (request: Request): Promise<Response> => {
      const url = new URL(request.url);
      const keys = [...url.searchParams.keys()];
      if (keys.some((key) => key !== "batchId") || url.searchParams.getAll("batchId").length > 1) {
        return errorResponse("INVALID_REQUEST", 400);
      }
      const batchId = url.searchParams.get("batchId") ?? undefined;
      if (batchId !== undefined && !isUuid(batchId)) return errorResponse("INVALID_REQUEST", 400);

      try {
        return Response.json({ transactions: await getRepository().listTransactions(batchId) });
      } catch {
        return errorResponse("READ_FAILED", 500);
      }
    },
  };
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function errorResponse(code: string, status: number): Response {
  return Response.json({ error: { code } }, { status });
}
