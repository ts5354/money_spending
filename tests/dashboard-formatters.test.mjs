import assert from "node:assert/strict";
import test from "node:test";

import {
  formatChartDate,
  formatPercentage,
  formatPeriodDate,
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

test("formats period dates, chart dates, and percentages", () => {
  assert.equal(formatPeriodDate("2026-08-15"), "2026/08/15");
  assert.equal(formatChartDate("2026-08-15"), "08/15");
  assert.equal(formatPercentage(100 / 3), "33.3%");
});
