import assert from "node:assert/strict";
import test from "node:test";

import { aggregateDashboard } from "../src/lib/dashboard/aggregate-dashboard.ts";

function transaction(overrides = {}) {
  return {
    id: overrides.id ?? "jcb-dashboard-1",
    date: overrides.date ?? "2026-08-15",
    merchantRaw: overrides.merchantRaw ?? "架空商店A",
    merchantNormalized: overrides.merchantNormalized ?? "架空商店A",
    amount: overrides.amount ?? 1000,
    category: overrides.category ?? "shopping",
    categorySource: overrides.categorySource ?? "ai",
    description: overrides.description ?? null,
    approvalNumber: overrides.approvalNumber ?? null,
  };
}

test("returns the required empty dashboard summary", () => {
  assert.deepEqual(aggregateDashboard([]), {
    totalAmount: 0,
    startDate: null,
    endDate: null,
    categorySummaries: [],
    dailySummaries: [],
  });
});

test("calculates total amount and an order-independent target period", () => {
  const summary = aggregateDashboard([
    transaction({ id: "3", date: "2026-08-15", amount: 3000 }),
    transaction({ id: "1", date: "2026-07-16", amount: 1000 }),
    transaction({ id: "2", date: "2026-08-01", amount: -500 }),
  ]);

  assert.equal(summary.totalAmount, 3500);
  assert.equal(summary.startDate, "2026-07-16");
  assert.equal(summary.endDate, "2026-08-15");
});

test("aggregates categories, excludes zero totals, and sorts by descending amount", () => {
  const summary = aggregateDashboard([
    transaction({ id: "1", amount: 1000, category: "restaurant" }),
    transaction({ id: "2", amount: 2000, category: "restaurant" }),
    transaction({ id: "3", amount: 5000, category: "shopping" }),
    transaction({ id: "4", amount: 700, category: "transportation" }),
    transaction({ id: "5", amount: -700, category: "transportation" }),
  ]);

  assert.deepEqual(
    summary.categorySummaries.map(({ category, amount }) => ({ category, amount })),
    [
      { category: "shopping", amount: 5000 },
      { category: "restaurant", amount: 3000 },
    ],
  );
  assert.equal(
    summary.categorySummaries.reduce((sum, category) => sum + category.amount, 0),
    summary.totalAmount,
  );
});

test("keeps exact percentage values and handles a zero total safely", () => {
  const summary = aggregateDashboard([
    transaction({ id: "1", amount: 1, category: "shopping" }),
    transaction({ id: "2", amount: 2, category: "restaurant" }),
  ]);

  assert.equal(summary.categorySummaries[0].percentage, (2 / 3) * 100);
  assert.equal(summary.categorySummaries[1].percentage, (1 / 3) * 100);

  const zeroTotal = aggregateDashboard([
    transaction({ id: "3", amount: 1000, category: "shopping" }),
    transaction({ id: "4", amount: -1000, category: "restaurant" }),
  ]);
  assert.equal(zeroTotal.totalAmount, 0);
  assert.ok(zeroTotal.categorySummaries.every(({ percentage }) => percentage === 0));
  assert.ok(zeroTotal.categorySummaries.every(({ percentage }) => Number.isFinite(percentage)));
});

test("aggregates same-day transactions and fills missing calendar days", () => {
  const summary = aggregateDashboard([
    transaction({ id: "1", date: "2026-07-31", amount: 1000 }),
    transaction({ id: "2", date: "2026-07-31", amount: 500 }),
    transaction({ id: "3", date: "2026-08-02", amount: 2000 }),
  ]);

  assert.deepEqual(summary.dailySummaries, [
    { date: "2026-07-31", amount: 1500 },
    { date: "2026-08-01", amount: 0 },
    { date: "2026-08-02", amount: 2000 },
  ]);
  assert.equal(
    summary.dailySummaries.reduce((sum, day) => sum + day.amount, 0),
    summary.totalAmount,
  );
});

test("fills calendar dates safely across year-end and leap day", async (t) => {
  const cases = [
    ["year-end", "2026-12-31", "2027-01-02", "2027-01-01"],
    ["leap day", "2028-02-28", "2028-03-01", "2028-02-29"],
  ];

  for (const [name, start, end, expectedMiddle] of cases) {
    await t.test(name, () => {
      const summary = aggregateDashboard([
        transaction({ id: `${name}-1`, date: start, amount: 100 }),
        transaction({ id: `${name}-2`, date: end, amount: 200 }),
      ]);
      assert.deepEqual(summary.dailySummaries.map(({ date }) => date), [
        start,
        expectedMiddle,
        end,
      ]);
    });
  }
});

test("manual category correction only changes category aggregation", () => {
  const beforeTransactions = [
    transaction({ id: "1", date: "2026-08-01", amount: 1000, category: "shopping" }),
    transaction({ id: "2", date: "2026-08-03", amount: 2000, category: "restaurant" }),
  ];
  const afterTransactions = beforeTransactions.map((item) =>
    item.id === "1" ? { ...item, category: "restaurant", categorySource: "manual" } : item,
  );

  const before = aggregateDashboard(beforeTransactions);
  const after = aggregateDashboard(afterTransactions);

  assert.notDeepEqual(after.categorySummaries, before.categorySummaries);
  assert.equal(after.totalAmount, before.totalAmount);
  assert.equal(after.startDate, before.startDate);
  assert.equal(after.endDate, before.endDate);
  assert.deepEqual(after.dailySummaries, before.dailySummaries);
});

test("uses only the selected statement transaction collection for every summary", () => {
  const selected = [
    transaction({ id: "selected-1", date: "2026-08-01", amount: 1000, category: "shopping" }),
    transaction({ id: "selected-2", date: "2026-08-02", amount: 500, category: "restaurant" }),
  ];
  const summary = aggregateDashboard(selected);

  assert.equal(summary.totalAmount, 1500);
  assert.deepEqual(summary.categorySummaries.map(({ amount }) => amount), [1000, 500]);
  assert.deepEqual(summary.dailySummaries, [
    { date: "2026-08-01", amount: 1000 },
    { date: "2026-08-02", amount: 500 },
  ]);
  assert.equal(summary.startDate, "2026-08-01");
  assert.equal(summary.endDate, "2026-08-02");
});
