"use client";

import { useMemo } from "react";

import { CategoryDistributionChart } from "@/components/dashboard/category-distribution-chart";
import { CategorySpendingChart } from "@/components/dashboard/category-spending-chart";
import { DailySpendingChart } from "@/components/dashboard/daily-spending-chart";
import { TotalSpendingCard } from "@/components/dashboard/total-spending-card";
import { aggregateDashboard } from "@/lib/dashboard/aggregate-dashboard";
import type { Transaction } from "@/types/transaction";

type DashboardContentProps = {
  transactions: Transaction[];
};

export function DashboardContent({ transactions }: DashboardContentProps) {
  const summary = useMemo(() => aggregateDashboard(transactions), [transactions]);

  return (
    <div className="space-y-6">
      <TotalSpendingCard totalAmount={summary.totalAmount} startDate={summary.startDate} endDate={summary.endDate} />
      <div className="grid min-w-0 gap-6 lg:grid-cols-2">
        <CategorySpendingChart data={summary.categorySummaries} />
        <CategoryDistributionChart data={summary.categorySummaries} />
      </div>
      <DailySpendingChart data={summary.dailySummaries} />
    </div>
  );
}
