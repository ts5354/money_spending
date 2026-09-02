"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import {
  formatChartDate,
  formatThousandsOfYen,
  formatYen,
} from "@/lib/dashboard/dashboard-formatters";
import type { DailySummary } from "@/lib/dashboard/dashboard-types";

type DailySpendingChartProps = {
  data: DailySummary[];
};

const DAILY_CHART_MIN_DAY_WIDTH = 52;

export function DailySpendingChart({ data }: DailySpendingChartProps) {
  const chartWidth = data.length * DAILY_CHART_MIN_DAY_WIDTH;

  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-8" aria-labelledby="daily-spending-heading">
      <h2 id="daily-spending-heading" className="text-xl font-bold text-slate-900">
        日別支出推移
      </h2>
      <div
        className="mt-6 h-80 min-w-0 overflow-x-auto"
        aria-label="日別支出推移の折れ線グラフ。横方向にスクロールできます"
        tabIndex={0}
      >
        <div className="h-full" style={{ width: chartWidth, minWidth: "100%" }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tickFormatter={formatChartDate} minTickGap={24} />
              <YAxis tickFormatter={formatThousandsOfYen} width={68} />
              <Tooltip formatter={(value) => [formatYen(Number(value)), "支出額"]} labelFormatter={(date) => formatPeriodDateForTooltip(String(date))} />
              <Line type="monotone" dataKey="amount" name="支出額" stroke="#2563eb" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}

function formatPeriodDateForTooltip(date: string) {
  return date.replaceAll("-", "/");
}
