import {
  parseClassificationResponse,
  type ClassificationResponse,
} from "../ai/classification-contract.ts";
import type { ParsedTransaction, Transaction } from "../../types/transaction.ts";

type ClassificationRequester = (merchants: string[]) => Promise<ClassificationResponse>;
type FetchImplementation = typeof fetch;

export class ClientClassificationError extends Error {
  constructor() {
    super("Merchant classification failed.");
    this.name = "ClientClassificationError";
  }
}

export function getUniqueMerchants(transactions: readonly ParsedTransaction[]): string[] {
  return [...new Set(transactions.map((transaction) => transaction.merchantNormalized))];
}

export async function requestMerchantClassifications(
  merchants: string[],
  fetchImplementation: FetchImplementation = fetch,
): Promise<ClassificationResponse> {
  let response: Response;
  try {
    response = await fetchImplementation("/api/classify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ merchants }),
    });
  } catch {
    throw new ClientClassificationError();
  }

  if (!response.ok) {
    throw new ClientClassificationError();
  }

  try {
    const body = (await response.json()) as unknown;
    return parseClassificationResponse(body, merchants);
  } catch {
    throw new ClientClassificationError();
  }
}

export async function classifyTransactions(
  parsedTransactions: ParsedTransaction[],
  requester: ClassificationRequester = requestMerchantClassifications,
): Promise<Transaction[]> {
  const merchants = getUniqueMerchants(parsedTransactions);
  const response = await requester(merchants);
  const validated = parseClassificationResponse(response, merchants);
  const categoryByMerchant = new Map(
    validated.classifications.map(({ merchant, category }) => [merchant, category]),
  );

  return parsedTransactions.map((transaction) => ({
    ...transaction,
    category: categoryByMerchant.get(transaction.merchantNormalized)!,
    categorySource: "ai",
  }));
}
