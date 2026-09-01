import { TransactionExplorer } from "@/components/transactions/transaction-explorer";

export default function TransactionsPage() {
  return (
    <section aria-labelledby="transactions-heading">
      <div className="mb-8">
        <p className="mb-2 text-sm font-semibold text-blue-700">Transactions</p>
        <h1 id="transactions-heading" className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
          明細
        </h1>
      </div>

      <TransactionExplorer />
    </section>
  );
}
