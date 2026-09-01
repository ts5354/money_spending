import { CATEGORY_IDS, isCategory, type Category } from "../../types/category.ts";

export const MAX_MERCHANT_COUNT = 100;
export const MAX_MERCHANT_LENGTH = 200;
export const MAX_REQUEST_BODY_LENGTH = 64_000;

export type Classification = {
  merchant: string;
  category: Category;
};

export type ClassificationResponse = {
  classifications: Classification[];
};

export type ClassificationErrorCode = "INVALID_REQUEST" | "CLASSIFICATION_FAILED";

export const CLASSIFICATION_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    classifications: {
      type: "array",
      items: {
        type: "object",
        properties: {
          merchant: { type: "string" },
          category: { type: "string", enum: [...CATEGORY_IDS] },
        },
        required: ["merchant", "category"],
        additionalProperties: false,
      },
    },
  },
  required: ["classifications"],
  additionalProperties: false,
} as const;

export class ClassificationContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClassificationContractError";
  }
}

export function parseClassifyRequest(value: unknown): string[] {
  if (!isRecord(value) || !hasExactKeys(value, ["merchants"])) {
    throw new ClassificationContractError("Invalid request shape.");
  }

  const merchants = value.merchants;
  if (!Array.isArray(merchants) || merchants.length === 0 || merchants.length > MAX_MERCHANT_COUNT) {
    throw new ClassificationContractError("Invalid merchant count.");
  }

  for (const merchant of merchants) {
    if (
      typeof merchant !== "string" ||
      merchant.trim() === "" ||
      Array.from(merchant).length > MAX_MERCHANT_LENGTH
    ) {
      throw new ClassificationContractError("Invalid merchant.");
    }
  }

  return [...new Set(merchants)];
}

export function parseClassificationResponse(
  value: unknown,
  requestedMerchants: readonly string[],
): ClassificationResponse {
  if (!isRecord(value) || !hasExactKeys(value, ["classifications"])) {
    throw new ClassificationContractError("Invalid classification response shape.");
  }

  const classifications = value.classifications;
  if (!Array.isArray(classifications)) {
    throw new ClassificationContractError("Invalid classifications.");
  }

  const requested = new Set(requestedMerchants);
  const seen = new Set<string>();
  const parsed: Classification[] = [];

  for (const classification of classifications) {
    if (
      !isRecord(classification) ||
      !hasExactKeys(classification, ["merchant", "category"]) ||
      typeof classification.merchant !== "string" ||
      !isCategory(classification.category)
    ) {
      throw new ClassificationContractError("Invalid classification.");
    }

    if (!requested.has(classification.merchant) || seen.has(classification.merchant)) {
      throw new ClassificationContractError("Classification integrity failure.");
    }

    seen.add(classification.merchant);
    parsed.push({
      merchant: classification.merchant,
      category: classification.category,
    });
  }

  if (seen.size !== requested.size || [...requested].some((merchant) => !seen.has(merchant))) {
    throw new ClassificationContractError("Missing classification.");
  }

  return { classifications: parsed };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actualKeys = Object.keys(value);
  return actualKeys.length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}
