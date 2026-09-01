"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { CATEGORY_COLORS } from "@/lib/dashboard/category-visuals";
import { formatPercentage, formatYen } from "@/lib/dashboard/dashboard-formatters";
import type { CategorySummary } from "@/lib/dashboard/dashboard-types";
import { CATEGORY_LABELS } from "@/types/category";

type CategoryDistributionChartProps = {
  data: CategorySummary[];
};

export function CategoryDistributionChart({ data }: CategoryDistributionChartProps) {
  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-8" aria-labelledby="category-distribution-heading">
      <h2 id="category-distribution-heading" className="text-xl font-bold text-slate-900">
        カテゴリ構成比
      </h2>
      <div className="mt-6 h-64 min-w-0" aria-label="カテゴリ構成比のドーナツグラフ">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="amount" nameKey="category" innerRadius="55%" outerRadius="82%" paddingAngle={2} isAnimationActive={false}>
              {data.map((item) => (
                <Cell key={item.category} fill={CATEGORY_COLORS[item.category]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name, item) => [
                `${formatYen(Number(value))} (${formatPercentage(Number(item.payload.percentage))})`,
                CATEGORY_LABELS[name as keyof typeof CATEGORY_LABELS],
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-5 grid gap-3 sm:grid-cols-2" aria-label="カテゴリ構成比の凡例">
        {data.map((item) => (
          <li key={item.category} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2 text-slate-700">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[item.category] }} aria-hidden="true" />
              <span className="truncate">{CATEGORY_LABELS[item.category]}</span>
            </span>
            <span className="shrink-0 font-semibold text-slate-900">{formatPercentage(item.percentage)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
