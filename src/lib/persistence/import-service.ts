import type { PersistenceRepository, PersistedImport } from "../../db/persistence-repository.ts";
import type { PersistStatementRequest } from "../../types/persistence.ts";
import { createImportFingerprint } from "./fingerprint.ts";

export class DuplicateImportError extends Error {
  constructor() {
    super("Import already exists.");
    this.name = "DuplicateImportError";
  }
}

export async function persistStatement(
  repository: PersistenceRepository,
  statement: PersistStatementRequest,
): Promise<PersistedImport> {
  try {
    return await repository.insertStatement(statement, createImportFingerprint(statement));
  } catch (error) {
    if (isPostgresUniqueViolation(error)) throw new DuplicateImportError();
    throw error;
  }
}

export function isPostgresUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth += 1) {
    if ("code" in current && current.code === "23505") return true;
    current = "cause" in current ? current.cause : null;
  }
  return false;
}
