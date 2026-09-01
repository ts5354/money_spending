"use client";

import type { TransactionFilters } from "@/lib/transactions/filter-transactions";
import { CATEGORY_IDS, CATEGORY_LABELS, type Category } from "@/types/category";

type TransactionFilterCardProps = {
  filters: TransactionFilters;
  validationMessage: string | null;
  onCategoryChange: (category: Category | "all") => void;
  onFromChange: (from: string) => void;
  onToChange: (to: string) => void;
  onClear: () => void;
};

export function TransactionFilterCard({
  filters,
  validationMessage,
  onCategoryChange,
  onFromChange,
  onToChange,
  onClear,
}: TransactionFilterCardProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-6" aria-labelledby="transaction-filter-heading">
      <h2 id="transaction-filter-heading" className="text-lg font-bold text-slate-900">
        表示条件
      </h2>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
        <label className="min-w-0 text-sm font-semibold text-slate-700" htmlFor="transaction-category-filter">
          カテゴリ
          <select
            id="transaction-category-filter"
            className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal text-slate-900"
            value={filters.category}
            onChange={(event) => {
              const category = event.target.value;
              if (category === "all" || CATEGORY_IDS.some((item) => item === category)) {
                onCategoryChange(category as Category | "all");
              }
            }}
          >
            <option value="all">すべて</option>
            {CATEGORY_IDS.map((category) => (
              <option key={category} value={category}>
                {CATEGORY_LABELS[category]}
              </option>
            ))}
          </select>
        </label>

        <label className="min-w-0 text-sm font-semibold text-slate-700" htmlFor="transaction-from-filter">
          開始日
          <input
            id="transaction-from-filter"
            className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal text-slate-900"
            type="date"
            value={filters.from}
            onChange={(event) => onFromChange(event.target.value)}
          />
        </label>

        <label className="min-w-0 text-sm font-semibold text-slate-700" htmlFor="transaction-to-filter">
          終了日
          <input
            id="transaction-to-filter"
            className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal text-slate-900"
            type="date"
            value={filters.to}
            onChange={(event) => onToChange(event.target.value)}
          />
        </label>

        <button
          type="button"
          className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 transition hover:border-blue-600 hover:text-blue-700"
          onClick={onClear}
        >
          条件をクリア
        </button>
      </div>

      {validationMessage ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800" role="alert">
          {validationMessage}
        </p>
      ) : null}
    </section>
  );
}
