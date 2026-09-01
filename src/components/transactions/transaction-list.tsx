import { formatPeriodDate, formatYen } from "@/lib/dashboard/dashboard-formatters";
import type { Transaction } from "@/types/transaction";
import { CATEGORY_LABELS } from "@/types/category";

type TransactionListProps = {
  transactions: Transaction[];
  totalCount: number;
};

export function TransactionList({ transactions, totalCount }: TransactionListProps) {
  if (transactions.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-6 py-14 text-center shadow-card">
        <p className="leading-7 text-slate-600">
          {totalCount === 0
            ? "読み込まれた取引はありません。"
            : "条件に一致する取引はありません。"}
        </p>
      </div>
    );
  }

  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card" aria-label="取引一覧">
      <div className="hidden md:block">
        <table className="w-full table-fixed border-collapse">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="w-32 px-5 py-4" scope="col">日付</th>
              <th className="px-5 py-4" scope="col">利用先</th>
              <th className="w-28 px-5 py-4" scope="col">カテゴリ</th>
              <th className="w-36 px-5 py-4 text-right" scope="col">金額</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {transactions.map((transaction) => (
              <tr key={transaction.id}>
                <td className="px-5 py-4 text-sm text-slate-600">{formatPeriodDate(transaction.date)}</td>
                <td className="break-words px-5 py-4 font-medium text-slate-900">{transaction.merchantRaw}</td>
                <td className="px-5 py-4 text-sm text-slate-700">{CATEGORY_LABELS[transaction.category]}</td>
                <td className="px-5 py-4 text-right font-semibold tabular-nums text-slate-900">{formatYen(transaction.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-slate-200 md:hidden">
        {transactions.map((transaction) => (
          <li key={transaction.id} className="min-w-0 p-5">
            <div className="flex min-w-0 items-start justify-between gap-4">
              <p className="min-w-0 break-words font-semibold text-slate-900">{transaction.merchantRaw}</p>
              <p className="shrink-0 font-bold tabular-nums text-slate-950">{formatYen(transaction.amount)}</p>
            </div>
            <div className="mt-3 flex items-center justify-between gap-4 text-sm text-slate-600">
              <time dateTime={transaction.date}>{formatPeriodDate(transaction.date)}</time>
              <span>{CATEGORY_LABELS[transaction.category]}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
