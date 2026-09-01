import Link from "next/link";

export default function DashboardPage() {
  return (
    <section aria-labelledby="dashboard-heading">
      <div className="mb-8">
        <p className="mb-2 text-sm font-semibold text-blue-700">Dashboard</p>
        <h1 id="dashboard-heading" className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
          支出ダッシュボード
        </h1>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center shadow-card sm:px-10 sm:py-24">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-2xl" aria-hidden="true">
          ↥
        </div>
        <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">分析するCSVがありません</h2>
        <p className="mx-auto mt-3 max-w-lg leading-7 text-slate-600">
          JCBの利用明細CSVをアップロードしてください。
        </p>
        <Link className="mt-8 inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white transition hover:bg-blue-800" href="/import">
          CSVをアップロード
        </Link>
      </div>
    </section>
  );
}

