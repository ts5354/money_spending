import type {
  ImportsResponse,
  ImportBatch,
  ImportSuccessResponse,
  PersistStatementRequest,
  TransactionsResponse,
} from "../../types/persistence.ts";
import type { Transaction } from "../../types/transaction.ts";

export class PersistenceClientError extends Error {
  readonly code: "IMPORT_ALREADY_EXISTS" | "IMPORT_FAILED" | "READ_FAILED";

  constructor(code: PersistenceClientError["code"]) {
    super(code);
    this.name = "PersistenceClientError";
    this.code = code;
  }
}

export async function persistImportedStatement(
  statement: PersistStatementRequest,
  fetchImplementation: typeof fetch = fetch,
): Promise<ImportSuccessResponse> {
  let response: Response;
  try {
    response = await fetchImplementation("/api/imports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(statement),
    });
  } catch {
    throw new PersistenceClientError("IMPORT_FAILED");
  }
  if (response.status === 409) throw new PersistenceClientError("IMPORT_ALREADY_EXISTS");
  if (response.status !== 201) throw new PersistenceClientError("IMPORT_FAILED");
  try {
    return (await response.json()) as ImportSuccessResponse;
  } catch {
    throw new PersistenceClientError("IMPORT_FAILED");
  }
}

export async function loadPersistedTransactions(
  fetchImplementation: typeof fetch = fetch,
  batchId?: string,
): Promise<Transaction[]> {
  try {
    const url =
      batchId === undefined
        ? "/api/transactions"
        : `/api/transactions?batchId=${encodeURIComponent(batchId)}`;
    const response = await fetchImplementation(url, { cache: "no-store" });
    if (!response.ok) throw new Error("Read failed.");
    const body = (await response.json()) as TransactionsResponse;
    if (!body || !Array.isArray(body.transactions)) throw new Error("Invalid response.");
    return body.transactions;
  } catch {
    throw new PersistenceClientError("READ_FAILED");
  }
}

export async function loadPersistedImports(
  fetchImplementation: typeof fetch = fetch,
): Promise<ImportBatch[]> {
  try {
    const response = await fetchImplementation("/api/imports", { cache: "no-store" });
    if (!response.ok) throw new Error("Read failed.");
    const body = (await response.json()) as ImportsResponse;
    if (!body || !Array.isArray(body.imports)) throw new Error("Invalid response.");
    return body.imports;
  } catch {
    throw new PersistenceClientError("READ_FAILED");
  }
}
