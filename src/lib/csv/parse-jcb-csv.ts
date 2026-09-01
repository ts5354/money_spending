import Papa from "papaparse";

import type { ParsedTransaction } from "@/types/transaction";

const TRANSACTION_SECTION_MARKER = "◆ご利用明細内訳（お振替済分）";

const REQUIRED_HEADERS = {
  user: "ご利用者",
  date: "お振替日",
  merchant: "ご利用先など",
  amount: "お振替金額（￥）",
  description: "摘要",
  approvalNumber: "承認番号",
} as const;

type RequiredColumn = keyof typeof REQUIRED_HEADERS;
type RequiredColumnIndexes = Record<RequiredColumn, number>;

export type JcbCsvParseErrorCode =
  | "READ_FAILED"
  | "INVALID_CSV"
  | "MISSING_TRANSACTION_SECTION"
  | "MISSING_REQUIRED_HEADER"
  | "INVALID_TRANSACTION_ROW"
  | "NO_TRANSACTIONS";

export class JcbCsvParseError extends Error {
  readonly code: JcbCsvParseErrorCode;

  constructor(code: JcbCsvParseErrorCode, message: string) {
    super(message);
    this.name = "JcbCsvParseError";
    this.code = code;
  }
}

export function getJcbCsvErrorMessage(error: unknown): string {
  if (!(error instanceof JcbCsvParseError) || error.code === "READ_FAILED") {
    return "CSVファイルを読み込めませんでした。";
  }

  if (error.code === "NO_TRANSACTIONS") {
    return "利用明細が見つかりませんでした。";
  }

  return "対応しているJCB利用明細CSVではありません。";
}

export async function readJcbCsvFile(file: File): Promise<string> {
  try {
    return await file.text();
  } catch {
    throw new JcbCsvParseError("READ_FAILED", "Failed to read the selected CSV file.");
  }
}

export function normalizeMerchant(merchant: string): string {
  return merchant
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseJcbCsvText(text: string): ParsedTransaction[] {
  const textWithoutBom = text.replace(/^\uFEFF/, "");
  const result = Papa.parse<string[]>(textWithoutBom, {
    delimiter: ",",
    header: false,
    skipEmptyLines: false,
  });

  if (result.errors.length > 0) {
    throw new JcbCsvParseError("INVALID_CSV", "Papa Parse reported invalid CSV syntax.");
  }

  const rows = result.data;
  const sectionIndex = rows.findIndex((row) =>
    row.some((cell) => cell === TRANSACTION_SECTION_MARKER),
  );

  if (sectionIndex === -1) {
    throw new JcbCsvParseError(
      "MISSING_TRANSACTION_SECTION",
      "The settled transaction section was not found.",
    );
  }

  const headerResult = findHeader(rows, sectionIndex + 1);
  if (headerResult === null) {
    throw new JcbCsvParseError(
      "MISSING_REQUIRED_HEADER",
      "The settled transaction section is missing required headers.",
    );
  }

  const transactions: ParsedTransaction[] = [];
  for (let rowIndex = headerResult.rowIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];

    if (isBlankRow(row)) {
      continue;
    }

    if (isSectionHeading(row)) {
      break;
    }

    transactions.push(parseTransactionRow(row, rowIndex, headerResult.indexes));
  }

  if (transactions.length === 0) {
    throw new JcbCsvParseError("NO_TRANSACTIONS", "The settled section has no transactions.");
  }

  return transactions;
}

function findHeader(
  rows: string[][],
  startIndex: number,
): { rowIndex: number; indexes: RequiredColumnIndexes } | null {
  for (let rowIndex = startIndex; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];

    if (isBlankRow(row)) {
      continue;
    }

    if (isSectionHeading(row)) {
      return null;
    }

    const entries = Object.entries(REQUIRED_HEADERS) as [RequiredColumn, string][];
    const indexes = {} as RequiredColumnIndexes;

    for (const [key, header] of entries) {
      const columnIndex = row.indexOf(header);
      if (columnIndex === -1) {
        break;
      }
      indexes[key] = columnIndex;
    }

    if (entries.every(([key]) => indexes[key] !== undefined)) {
      return { rowIndex, indexes };
    }
  }

  return null;
}

function parseTransactionRow(
  row: string[],
  sourceRowIndex: number,
  indexes: RequiredColumnIndexes,
): ParsedTransaction {
  const date = parseDate(cellAt(row, indexes.date), sourceRowIndex);
  const merchantRaw = cellAt(row, indexes.merchant).trim();
  const merchantNormalized = normalizeMerchant(merchantRaw);
  const amount = parseAmount(cellAt(row, indexes.amount), sourceRowIndex);

  if (merchantRaw === "" || merchantNormalized === "") {
    throw invalidRowError(sourceRowIndex);
  }

  const description = optionalText(cellAt(row, indexes.description));
  const approvalNumber = optionalText(cellAt(row, indexes.approvalNumber));

  return {
    id: createTransactionId({
      sourceRowIndex,
      date,
      merchantRaw,
      amount,
      approvalNumber,
    }),
    date,
    merchantRaw,
    merchantNormalized,
    amount,
    description,
    approvalNumber,
  };
}

function parseDate(value: string, sourceRowIndex: number): string {
  const trimmed = value.trim();
  const match = /^(\d{4})\/(\d{2})\/(\d{2})$/.exec(trimmed);

  if (match === null) {
    throw invalidRowError(sourceRowIndex);
  }

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw invalidRowError(sourceRowIndex);
  }

  return `${yearText}-${monthText}-${dayText}`;
}

function parseAmount(value: string, sourceRowIndex: number): number {
  const trimmed = value.trim();
  if (!/^-?(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(trimmed)) {
    throw invalidRowError(sourceRowIndex);
  }

  const amount = Number(trimmed.replaceAll(",", ""));
  if (!Number.isSafeInteger(amount)) {
    throw invalidRowError(sourceRowIndex);
  }

  return amount;
}

function optionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function createTransactionId(input: {
  sourceRowIndex: number;
  date: string;
  merchantRaw: string;
  amount: number;
  approvalNumber: string | null;
}): string {
  const source = [
    input.date,
    input.merchantRaw,
    input.amount.toString(),
    input.approvalNumber ?? "",
    input.sourceRowIndex.toString(),
  ].join("\u0000");

  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return `jcb-${input.sourceRowIndex}-${(hash >>> 0).toString(36)}`;
}

function cellAt(row: string[], index: number): string {
  return row[index] ?? "";
}

function isBlankRow(row: string[]): boolean {
  return row.every((cell) => cell.trim() === "");
}

function isSectionHeading(row: string[]): boolean {
  return row.some((cell) => cell.trimStart().startsWith("◆"));
}

function invalidRowError(sourceRowIndex: number): JcbCsvParseError {
  return new JcbCsvParseError(
    "INVALID_TRANSACTION_ROW",
    `Invalid transaction row at CSV row ${sourceRowIndex + 1}.`,
  );
}
