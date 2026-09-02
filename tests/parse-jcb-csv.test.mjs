import assert from "node:assert/strict";
import test from "node:test";

import {
  getJcbCsvErrorMessage,
  JcbCsvParseError,
  parseJcbCsvText,
  parseJcbStatementText,
} from "../src/lib/csv/parse-jcb-csv.ts";

const MARKER = "◆ご利用明細内訳（お振替済分）";
const HEADERS = [
  "ご利用者",
  "お振替日",
  "ご利用先など",
  "お振替金額（￥）",
  "摘要",
  "承認番号",
];

function csvRow(cells) {
  return cells.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",");
}

function transactionRow(overrides = {}) {
  return [
    overrides.user ?? "0001",
    overrides.date ?? "2026/08/15",
    overrides.merchant ?? "架空商店",
    overrides.amount ?? "600",
    overrides.description ?? "テスト利用",
    overrides.approvalNumber ?? "[100001]",
  ];
}

function jcbCsv(transactionRows, options = {}) {
  const lines = [
    csvRow(["2026/08/31"]),
    csvRow(["19:01時点"]),
    csvRow([MARKER]),
    ...(options.beforeHeader ?? []),
    csvRow(options.headers ?? HEADERS),
    ...transactionRows.map(csvRow),
    ...(options.afterTransactions ?? []),
  ];
  return lines.join("\n");
}

function assertParseError(csv, expectedCode) {
  assert.throws(
    () => parseJcbCsvText(csv),
    (error) => error instanceof JcbCsvParseError && error.code === expectedCode,
  );
}

test("Test 01 — parses a standard JCB CSV", () => {
  const transactions = parseJcbCsvText(jcbCsv([transactionRow()]));

  assert.equal(transactions.length, 1);
  assert.deepEqual(
    {
      date: transactions[0].date,
      merchantRaw: transactions[0].merchantRaw,
      merchantNormalized: transactions[0].merchantNormalized,
      amount: transactions[0].amount,
      description: transactions[0].description,
      approvalNumber: transactions[0].approvalNumber,
    },
    {
      date: "2026-08-15",
      merchantRaw: "架空商店",
      merchantNormalized: "架空商店",
      amount: 600,
      description: "テスト利用",
      approvalNumber: "[100001]",
    },
  );
  assert.equal(Object.hasOwn(transactions[0], "user"), false);
});

test("Test 02 — stops before subsequent JCB sections", () => {
  const csv = jcbCsv([transactionRow()], {
    afterTransactions: [
      csvRow(["◆ご利用明細内訳（差額分・お振替未済分）"]),
      csvRow(transactionRow({ merchant: "対象外商店" })),
      csvRow(["◆キャッシュバック"]),
      csvRow(["◆年会費"]),
    ],
  });

  const transactions = parseJcbCsvText(csv);
  assert.equal(transactions.length, 1);
  assert.equal(transactions[0].merchantRaw, "架空商店");
});

test("Test 03 — resolves required columns by header name", () => {
  const headers = ["承認番号", "ご利用先など", "摘要", "ご利用者", "お振替金額（￥）", "お振替日"];
  const reorderedTransaction = ["[200002]", "架空書店", "書籍", "0002", "1,250", "2026/08/14"];

  const [transaction] = parseJcbCsvText(jcbCsv([reorderedTransaction], { headers }));
  assert.equal(transaction.merchantRaw, "架空書店");
  assert.equal(transaction.amount, 1250);
  assert.equal(transaction.date, "2026-08-14");
});

test("Test 04 — rejects a CSV without the settled section", () => {
  const csv = [csvRow(["別形式", "データ"]), csvRow(HEADERS), csvRow(transactionRow())].join("\n");
  assertParseError(csv, "MISSING_TRANSACTION_SECTION");
});

test("Test 05 — rejects a CSV with a missing required header", () => {
  const headersWithoutApprovalNumber = HEADERS.filter((header) => header !== "承認番号");
  assertParseError(jcbCsv([], { headers: headersWithoutApprovalNumber }), "MISSING_REQUIRED_HEADER");
});

test("Test 06 — converts YYYY/MM/DD to YYYY-MM-DD", () => {
  const [transaction] = parseJcbCsvText(jcbCsv([transactionRow({ date: "2026/08/15" })]));
  assert.equal(transaction.date, "2026-08-15");
});

test("Test 07 — converts plain and comma-separated amounts", () => {
  const transactions = parseJcbCsvText(
    jcbCsv([
      transactionRow({ amount: "600", approvalNumber: "[300001]" }),
      transactionRow({ amount: "12,345", approvalNumber: "[300002]" }),
    ]),
  );
  assert.deepEqual(
    transactions.map((transaction) => transaction.amount),
    [600, 12345],
  );
});

test("Test 08 — normalizes merchant text with NFKC while preserving raw text", () => {
  const merchant = " ＯＰＥＮ　ＮＡＫＡＭＥＧＵＲＯ／Ａｉｒ ";
  const [transaction] = parseJcbCsvText(jcbCsv([transactionRow({ merchant })]));

  assert.equal(transaction.merchantRaw, "ＯＰＥＮ　ＮＡＫＡＭＥＧＵＲＯ／Ａｉｒ");
  assert.equal(transaction.merchantNormalized, "OPEN NAKAMEGURO/Air");
});

test("Test 09 — converts blank optional fields to null", () => {
  const [transaction] = parseJcbCsvText(
    jcbCsv([transactionRow({ description: "", approvalNumber: "" })]),
  );
  assert.equal(transaction.description, null);
  assert.equal(transaction.approvalNumber, null);
});

test("Test 10 — rejects malformed required transaction fields without skipping", async (t) => {
  const cases = [
    ["missing date", { date: "" }],
    ["impossible date", { date: "2026/02/30" }],
    ["missing merchant", { merchant: "" }],
    ["invalid amount", { amount: "six hundred" }],
  ];

  for (const [name, overrides] of cases) {
    await t.test(name, () => {
      assertParseError(jcbCsv([transactionRow(overrides)]), "INVALID_TRANSACTION_ROW");
    });
  }
});

test("Test 11 — rejects a settled section with no transactions", () => {
  assertParseError(jcbCsv([]), "NO_TRANSACTIONS");
});

test("maps a BOM-prefixed CRLF zero-transaction CSV to the no-transactions UI message", () => {
  const csv = `\uFEFF${jcbCsv([]).replaceAll("\n", "\r\n")}\r\n`;

  let parseError;
  try {
    parseJcbCsvText(csv);
  } catch (error) {
    parseError = error;
  }

  assert.ok(parseError instanceof JcbCsvParseError);
  assert.equal(parseError.code, "NO_TRANSACTIONS");
  assert.equal(getJcbCsvErrorMessage(parseError), "利用明細が見つかりませんでした。");
});

test("Test 12 — preserves duplicate rows as separate transactions", () => {
  const duplicate = transactionRow();
  const transactions = parseJcbCsvText(jcbCsv([duplicate, duplicate]));

  assert.equal(transactions.length, 2);
  assert.notEqual(transactions[0].id, transactions[1].id);
});

test("Test 13 — parses a UTF-8 BOM-prefixed CSV", () => {
  const transactions = parseJcbCsvText(`\uFEFF${jcbCsv([transactionRow()])}`);
  assert.equal(transactions.length, 1);
});

test("ignores blank rows inside the settled section", () => {
  const csv = jcbCsv([transactionRow()], { beforeHeader: ["", csvRow(["", ""])] });
  const transactions = parseJcbCsvText(`${csv}\n\n${csvRow(["", ""])}`);
  assert.equal(transactions.length, 1);
});

test("preserves a negative amount instead of converting it to an absolute value", () => {
  const [transaction] = parseJcbCsvText(jcbCsv([transactionRow({ amount: "-1,000" })]));
  assert.equal(transaction.amount, -1000);
});

test("rejects malformed CSV syntax reported by Papa Parse", () => {
  const malformed = `${csvRow([MARKER])}\n${csvRow(HEADERS)}\n"0001","2026/08/15","unclosed`;
  assertParseError(malformed, "INVALID_CSV");
});

test("parses and normalizes the statement target period", () => {
  const csv = [
    csvRow(["対象期間", "2026年7月16日～2026年8月15日"]),
    jcbCsv([transactionRow()]),
  ].join("\n");
  const statement = parseJcbStatementText(csv);
  assert.equal(statement.periodStart, "2026-07-16");
  assert.equal(statement.periodEnd, "2026-08-15");
  assert.equal(statement.transactions.length, 1);
});

test("statement parsing rejects missing, malformed, impossible, and reversed periods", async (t) => {
  const cases = [
    ["missing", jcbCsv([transactionRow()]), "MISSING_STATEMENT_PERIOD"],
    ["malformed", `${csvRow(["対象期間", "2026/07/16-2026/08/15"])}\n${jcbCsv([transactionRow()])}`, "INVALID_STATEMENT_PERIOD"],
    ["impossible", `${csvRow(["対象期間", "2026年2月30日～2026年3月15日"])}\n${jcbCsv([transactionRow()])}`, "INVALID_STATEMENT_PERIOD"],
    ["reversed", `${csvRow(["対象期間", "2026年8月16日～2026年8月15日"])}\n${jcbCsv([transactionRow()])}`, "INVALID_STATEMENT_PERIOD"],
  ];
  for (const [name, csv, code] of cases) {
    await t.test(name, () => assert.throws(
      () => parseJcbStatementText(csv),
      (error) => error instanceof JcbCsvParseError && error.code === code,
    ));
  }
});
