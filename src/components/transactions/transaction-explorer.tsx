"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { TransactionFilterCard } from "@/components/transactions/transaction-filter-card";
import { TransactionList } from "@/components/transactions/transaction-list";
import {
  filterTransactions,
  INITIAL_TRANSACTION_FILTERS,
  validateTransactionFilters,
  type TransactionFilters,
} from "@/lib/transactions/filter-transactions";
import { useTransactions } from "@/state/transaction-context";

export function TransactionExplorer() {
  const { selectedTransactions, loadStatus, retryLoad } = useTransactions();
  const [filters, setFilters] = useState<TransactionFilters>(INITIAL_TRANSACTION_FILTERS);
  const validation = validateTransactionFilters(filters);
  const filteredTransactions = useMemo(
    () =>
      selectedTransactions === null || !validation.valid
        ? []
        : filterTransactions(selectedTransactions, filters),
    [filters, selectedTransactions, validation.valid],
  );

  if (loadStatus === "loading") {
    return <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center shadow-card" aria-live="polite">保存済みの利用明細を読み込んでいます...</div>;
  }

  if (loadStatus === "error") {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-12 text-center shadow-card" role="alert">
        <h2 className="text-xl font-bold text-red-900">利用明細を読み込めませんでした</h2>
        <button className="mt-6 min-h-11 rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white" type="button" onClick={retryLoad}>再試行</button>
      </div>
    );
  }

  if (selectedTransactions === null || selectedTransactions.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center shadow-card sm:px-10 sm:py-20">
        <h2 className="text-xl font-bold text-slate-900">利用明細が読み込まれていません</h2>
        <p className="mx-auto mt-3 max-w-lg leading-7 text-slate-600">
          JCBの利用明細CSVを読み込むと、ここで取引を確認できます。
        </p>
        <Link className="mt-7 inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white transition hover:bg-blue-800" href="/import">
          CSVをアップロード
        </Link>
      </div>
    );
  }

  const updateFilter = <Key extends keyof TransactionFilters>(
    key: Key,
    value: TransactionFilters[Key],
  ) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  return (
    <div className="space-y-6">
      <TransactionFilterCard
        filters={filters}
        validationMessage={validation.valid ? null : validation.message}
        onCategoryChange={(category) => updateFilter("category", category)}
        onFromChange={(from) => updateFilter("from", from)}
        onToChange={(to) => updateFilter("to", to)}
        onClear={() => setFilters(INITIAL_TRANSACTION_FILTERS)}
      />

      {validation.valid ? (
        <>
          <p className="text-sm font-semibold text-slate-700" aria-live="polite">
            {filteredTransactions.length}件 / 全{selectedTransactions.length}件
          </p>
          <TransactionList transactions={filteredTransactions} totalCount={selectedTransactions.length} />
        </>
      ) : null}
    </div>
  );
}
