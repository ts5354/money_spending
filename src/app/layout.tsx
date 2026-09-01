import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Navigation } from "@/components/layout/navigation";
import { TransactionProvider } from "@/state/transaction-context";

import "./globals.css";

export const metadata: Metadata = {
  title: "JCB Spending Visualizer",
  description: "JCB利用明細の支出を分かりやすく可視化するアプリ",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ja">
      <body className="antialiased">
        <Navigation />
        <TransactionProvider>
          <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
            {children}
          </main>
        </TransactionProvider>
      </body>
    </html>
  );
}
