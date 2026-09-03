"use client";

import {
  formatImportPeriod,
  type PeriodSelection,
} from "@/lib/periods/period-selection";
import type { ImportBatch } from "@/types/persistence";

type PeriodSelectorProps = {
  imports: readonly ImportBatch[];
  selectedPeriod: PeriodSelection | null;
  disabled: boolean;
  onChange: (selection: PeriodSelection) => void;
};

export function PeriodSelector({
  imports,
  selectedPeriod,
  disabled,
  onChange,
}: PeriodSelectorProps) {
  if (imports.length === 0 || selectedPeriod === null) return null;

  const value = selectedPeriod.kind === "all" ? "all" : selectedPeriod.batchId;

  return (
    <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-card sm:flex sm:items-center sm:justify-between sm:gap-6 sm:p-5">
      <div>
        <p className="font-semibold text-slate-900">表示する利用期間</p>
        <p className="mt-1 text-sm text-slate-600">保存済みのJCB利用明細を切り替えます。</p>
      </div>
      <label className="mt-4 block min-w-0 sm:mt-0 sm:w-72">
        <span className="sr-only">表示する利用期間</span>
        <select
          aria-label="表示する利用期間"
          className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-medium text-slate-900 disabled:cursor-wait disabled:bg-slate-100"
          disabled={disabled}
          value={value}
          onChange={(event) =>
            onChange(
              event.target.value === "all"
                ? { kind: "all" }
                : { kind: "batch", batchId: event.target.value },
            )
          }
        >
          {imports.map((batch) => (
            <option key={batch.id} value={batch.id}>
              {formatImportPeriod(batch)}
            </option>
          ))}
          <option value="all">全期間</option>
        </select>
      </label>
    </div>
  );
}
