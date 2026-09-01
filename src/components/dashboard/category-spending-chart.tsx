"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { CATEGORY_COLORS } from "@/lib/dashboard/category-visuals";
import { formatYen } from "@/lib/dashboard/dashboard-formatters";
import type { CategorySummary } from "@/lib/dashboard/dashboard-types";
import { CATEGORY_LABELS } from "@/types/category";

type CategorySpendingChartProps = {
  data: CategorySummary[];
};

export function CategorySpendingChart({ data }: CategorySpendingChartProps) {
  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-8" aria-labelledby="category-spending-heading">
      <h2 id="category-spending-heading" className="text-xl font-bold text-slate-900">
        カテゴリ別支出
      </h2>
      <div className="mt-6 h-80 min-w-0" aria-label="カテゴリ別支出の棒グラフ">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tickFormatter={formatYen} />
            <YAxis
              type="category"
              dataKey="category"
              tickFormatter={(category: string) => CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS]}
              width={76}
            />
            <Tooltip
              formatter={(value) => [formatYen(Number(value)), "支出額"]}
              labelFormatter={(category) => CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS]}
            />
            <Bar dataKey="amount" name="支出額" radius={[0, 6, 6, 0]} isAnimationActive={false}>
              {data.map((item) => (
                <Cell key={item.category} fill={CATEGORY_COLORS[item.category]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-600" aria-label="カテゴリの色">
        {data.map((item) => (
          <li key={item.category} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[item.category] }} aria-hidden="true" />
            {CATEGORY_LABELS[item.category]}
          </li>
        ))}
      </ul>
    </section>
  );
}
