export default function TransactionsPage() {
  return (
    <section aria-labelledby="transactions-heading">
      <div className="mb-8">
        <p className="mb-2 text-sm font-semibold text-blue-700">Transactions</p>
        <h1 id="transactions-heading" className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
          明細
        </h1>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center shadow-card sm:px-10 sm:py-20">
        <p className="leading-7 text-slate-600">CSVを読み込むと、ここに利用明細が表示されます。</p>
      </div>
    </section>
  );
}

