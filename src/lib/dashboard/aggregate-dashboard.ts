import { CATEGORY_IDS, type Category } from "../../types/category.ts";
import type { Transaction } from "../../types/transaction.ts";
import type { CategorySummary, DailySummary, DashboardSummary } from "./dashboard-types.ts";

export function aggregateDashboard(
  transactions: readonly Transaction[],
): DashboardSummary {
  if (transactions.length === 0) {
    return {
      totalAmount: 0,
      startDate: null,
      endDate: null,
      categorySummaries: [],
      dailySummaries: [],
    };
  }

  const categoryAmounts = Object.fromEntries(
    CATEGORY_IDS.map((category) => [category, 0]),
  ) as Record<Category, number>;
  const dailyAmounts = new Map<string, number>();
  let totalAmount = 0;
  let startDate = transactions[0].date;
  let endDate = transactions[0].date;

  for (const transaction of transactions) {
    totalAmount += transaction.amount;
    categoryAmounts[transaction.category] += transaction.amount;
    dailyAmounts.set(
      transaction.date,
      (dailyAmounts.get(transaction.date) ?? 0) + transaction.amount,
    );

    if (transaction.date < startDate) {
      startDate = transaction.date;
    }
    if (transaction.date > endDate) {
      endDate = transaction.date;
    }
  }

  const categorySummaries: CategorySummary[] = CATEGORY_IDS.map((category) => ({
    category,
    amount: categoryAmounts[category],
    percentage: totalAmount === 0 ? 0 : (categoryAmounts[category] / totalAmount) * 100,
  }))
    .filter(({ amount }) => amount !== 0)
    .sort((left, right) => right.amount - left.amount);

  const dailySummaries: DailySummary[] = [];
  for (let date = startDate; date <= endDate; date = nextCalendarDate(date)) {
    dailySummaries.push({ date, amount: dailyAmounts.get(date) ?? 0 });
  }

  return {
    totalAmount,
    startDate,
    endDate,
    categorySummaries,
    dailySummaries,
  };
}

function nextCalendarDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return [
    next.getUTCFullYear().toString().padStart(4, "0"),
    (next.getUTCMonth() + 1).toString().padStart(2, "0"),
    next.getUTCDate().toString().padStart(2, "0"),
  ].join("-");
}
