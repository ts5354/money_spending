import assert from "node:assert/strict";
import test from "node:test";

import {
  formatChartDate,
  formatPercentage,
  formatPeriodDate,
  formatThousandsOfYen,
  formatYen,
} from "../src/lib/dashboard/dashboard-formatters.ts";

test("formats integer yen amounts with thousands separators and no decimal part", () => {
  const formatted = formatYen(104407);
  assert.match(formatted, /104,407/);
  assert.match(formatted, /[¥￥]/);
  assert.doesNotMatch(formatted, /\.00/);
});

test("preserves a negative sign when formatting yen", () => {
  assert.match(formatYen(-1200), /-.*1,200/);
});

test("formats Daily Chart Y-axis ticks in compact thousands of yen", () => {
  const cases = [
    [0, "0千円"],
    [500, "0.5千円"],
    [1000, "1千円"],
    [6500, "6.5千円"],
    [13000, "13千円"],
    [19500, "19.5千円"],
    [26000, "26千円"],
  ];

  for (const [amount, expected] of cases) {
    assert.equal(formatThousandsOfYen(amount), expected);
  }
});

test("keeps the full JPY formatter unchanged for chart tooltips", () => {
  assert.match(formatYen(500), /[¥￥].*500/);
  assert.match(formatYen(6500), /[¥￥].*6,500/);
  assert.match(formatYen(13000), /[¥￥].*13,000/);
  assert.match(formatYen(26000), /[¥￥].*26,000/);
});

test("formats period dates, chart dates, and percentages", () => {
  assert.equal(formatPeriodDate("2026-08-15"), "2026/08/15");
  assert.equal(formatChartDate("2026-08-15"), "08/15");
  assert.equal(formatPercentage(100 / 3), "33.3%");
});
