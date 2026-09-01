import {
  parseClassificationResponse,
  type ClassificationResponse,
} from "../ai/classification-contract.ts";
import type { ParsedTransaction, Transaction } from "../../types/transaction.ts";
import {
  readCategoryCache,
  writeCategoryCache,
  type CategoryCacheStorage,
} from "./category-cache.ts";

type ClassificationRequester = (merchants: string[]) => Promise<ClassificationResponse>;
type FetchImplementation = typeof fetch;

type ClassifyTransactionsOptions = {
  storage: CategoryCacheStorage;
  requester?: ClassificationRequester;
};

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
  {
    storage,
    requester = requestMerchantClassifications,
  }: ClassifyTransactionsOptions,
): Promise<Transaction[]> {
  const merchants = getUniqueMerchants(parsedTransactions);
  const cache = readCategoryCache(storage);
  const categoryByMerchant = new Map<
    string,
    { category: Transaction["category"]; categorySource: Transaction["categorySource"] }
  >();
  const uncachedMerchants: string[] = [];

  for (const merchant of merchants) {
    const cachedCategory = cache[merchant];
    if (cachedCategory === undefined) {
      uncachedMerchants.push(merchant);
    } else {
      categoryByMerchant.set(merchant, {
        category: cachedCategory,
        categorySource: "cache",
      });
    }
  }

  if (uncachedMerchants.length > 0) {
    const response = await requester(uncachedMerchants);
    const validated = parseClassificationResponse(response, uncachedMerchants);

    for (const { merchant, category } of validated.classifications) {
      categoryByMerchant.set(merchant, { category, categorySource: "ai" });
      cache[merchant] = category;
    }

    // Cache persistence is best-effort. A successful AI result remains usable
    // even when localStorage is unavailable or full.
    writeCategoryCache(storage, cache);
  }

  return parsedTransactions.map((transaction) => {
    const classification = categoryByMerchant.get(transaction.merchantNormalized)!;
    return {
      ...transaction,
      category: classification.category,
      categorySource: classification.categorySource,
    };
  });
}
