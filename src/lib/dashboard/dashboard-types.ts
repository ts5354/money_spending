import type { Category } from "../../types/category.ts";

export type CategorySummary = {
  category: Category;
  amount: number;
  percentage: number;
};

export type DailySummary = {
  date: string;
  amount: number;
};

export type DashboardSummary = {
  totalAmount: number;
  startDate: string | null;
  endDate: string | null;
  categorySummaries: CategorySummary[];
  dailySummaries: DailySummary[];
};
