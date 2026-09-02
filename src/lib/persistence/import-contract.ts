import { isCategory } from "../../types/category.ts";
import type { PersistStatementRequest } from "../../types/persistence.ts";
import type { Transaction } from "../../types/transaction.ts";

export const MAX_IMPORT_BODY_LENGTH = 2 * 1024 * 1024;
export const MAX_IMPORT_TRANSACTIONS = 2000;
const MAX_ID_LENGTH = 200;
const MAX_MERCHANT_LENGTH = 500;
const MAX_OPTIONAL_LENGTH = 1000;
const TOP_LEVEL_KEYS = ["periodStart", "periodEnd", "transactions"];
const TRANSACTION_KEYS = [
  "id", "date", "merchantRaw", "merchantNormalized", "amount", "category",
  "categorySource", "description", "approvalNumber",
];

export class ImportContractError extends Error {
  constructor() {
    super("Invalid import request.");
    this.name = "ImportContractError";
  }
}

export function parseImportRequest(value: unknown): PersistStatementRequest {
  if (!isExactObject(value, TOP_LEVEL_KEYS)) fail();
  const periodStart = parseCalendarDate(value.periodStart);
  const periodEnd = parseCalendarDate(value.periodEnd);
  if (periodStart === null || periodEnd === null || periodStart > periodEnd) fail();
  if (!Array.isArray(value.transactions) || value.transactions.length < 1 || value.transactions.length > MAX_IMPORT_TRANSACTIONS) fail();

  const transactions = value.transactions.map((entry) => parseTransaction(entry, periodStart, periodEnd));
  return { periodStart, periodEnd, transactions };
}

export function parseCalendarDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? value
    : null;
}

function parseTransaction(value: unknown, periodStart: string, periodEnd: string): Transaction {
  if (!isExactObject(value, TRANSACTION_KEYS)) fail();
  const date = parseCalendarDate(value.date);
  if (date === null || date < periodStart || date > periodEnd) fail();
  if (!validString(value.id, 1, MAX_ID_LENGTH)) fail();
  if (!validString(value.merchantRaw, 1, MAX_MERCHANT_LENGTH)) fail();
  if (!validString(value.merchantNormalized, 1, MAX_MERCHANT_LENGTH)) fail();
  if (typeof value.amount !== "number" || !Number.isSafeInteger(value.amount)) fail();
  if (!isCategory(value.category)) fail();
  if (value.categorySource !== "ai" && value.categorySource !== "cache" && value.categorySource !== "manual") fail();
  if (!validNullableString(value.description) || !validNullableString(value.approvalNumber)) fail();

  return {
    id: value.id,
    date,
    merchantRaw: value.merchantRaw,
    merchantNormalized: value.merchantNormalized,
    amount: value.amount,
    category: value.category,
    categorySource: value.categorySource,
    description: value.description,
    approvalNumber: value.approvalNumber,
  };
}

function isExactObject(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function validString(value: unknown, min: number, max: number): value is string {
  return typeof value === "string" && value.length >= min && value.length <= max;
}

function validNullableString(value: unknown): value is string | null {
  return value === null || validString(value, 0, MAX_OPTIONAL_LENGTH);
}

function fail(): never {
  throw new ImportContractError();
}
