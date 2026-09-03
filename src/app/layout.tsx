import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { Navigation } from "@/components/layout/navigation";
import { TransactionProvider } from "@/state/transaction-context";

import "./globals.css";

export const metadata: Metadata = {
  title: "浪費対策ナビ",
  applicationName: "浪費対策ナビ",
  description: "JCB利用明細の支出を分かりやすく可視化するアプリ",
  appleWebApp: {
    capable: true,
    title: "浪費対策ナビ",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#087fca",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ja">
      <body className="antialiased">
        <ClerkProvider>
          <Navigation />
          <TransactionProvider>
            <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
              {children}
            </main>
          </TransactionProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
