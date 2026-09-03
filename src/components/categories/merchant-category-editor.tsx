"use client";

import { CATEGORY_IDS, CATEGORY_LABELS, isCategory } from "@/types/category";
import { useTransactions } from "@/state/transaction-context";

export function MerchantCategoryEditor() {
  const { selectedTransactions, updateMerchantCategory } = useTransactions();

  if (selectedTransactions === null) {
    return null;
  }

  return (
    <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-8" aria-labelledby="category-editor-heading">
      <div className="mb-6">
        <h2 id="category-editor-heading" className="text-xl font-bold text-slate-900">
          利用先のカテゴリを修正
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          同じ利用先の明細には、変更したカテゴリがまとめて反映されます。
        </p>
      </div>

      <div className="divide-y divide-slate-200">
        {selectedTransactions.map((transaction) => (
          <div key={transaction.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="min-w-0 break-words font-medium text-slate-900">
              {transaction.merchantRaw}
            </p>
            <label className="flex shrink-0 items-center gap-3 text-sm text-slate-600">
              <span>カテゴリ</span>
              <select
                className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 font-medium text-slate-900"
                value={transaction.category}
                onChange={(event) => {
                  const category = event.target.value;
                  if (isCategory(category)) {
                    updateMerchantCategory(transaction.merchantNormalized, category);
                  }
                }}
                aria-label={`${transaction.merchantRaw}のカテゴリ`}
              >
                {CATEGORY_IDS.map((category) => (
                  <option key={category} value={category}>
                    {CATEGORY_LABELS[category]}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ))}
      </div>
    </section>
  );
}
