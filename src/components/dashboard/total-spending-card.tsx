import { formatPeriodDate, formatYen } from "@/lib/dashboard/dashboard-formatters";

type TotalSpendingCardProps = {
  totalAmount: number;
  startDate: string | null;
  endDate: string | null;
};

export function TotalSpendingCard({ totalAmount, startDate, endDate }: TotalSpendingCardProps) {
  const period = startDate && endDate
    ? `${formatPeriodDate(startDate)} - ${formatPeriodDate(endDate)}`
    : "期間なし";

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card sm:p-8" aria-labelledby="total-spending-heading">
      <p id="total-spending-heading" className="text-sm font-semibold text-slate-600">
        合計支出
      </p>
      <p className="mt-3 break-words text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
        {formatYen(totalAmount)}
      </p>
      <p className="mt-3 text-sm text-slate-500">対象期間: {period}</p>
    </section>
  );
}
