import { SignOutButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";

import { getAccessState } from "@/lib/auth/authorization";

const navigationItems = [
  { href: "/", label: "Dashboard" },
  { href: "/transactions", label: "明細" },
  { href: "/import", label: "CSV取込" },
] as const;

export async function Navigation() {
  const access = await getAccessState();

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-5 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
        <Link className="w-fit text-lg font-bold tracking-tight text-slate-900" href="/">
          JCB Spending Visualizer
        </Link>
        {access.status === "authorized" ? (
          <div className="flex flex-wrap items-center gap-6">
            <nav aria-label="メインナビゲーション">
              <ul className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-medium text-slate-600">
                {navigationItems.map((item) => (
                  <li key={item.href}>
                    <Link className="rounded-sm transition hover:text-blue-700" href={item.href}>{item.label}</Link>
                  </li>
                ))}
              </ul>
            </nav>
            <UserButton />
          </div>
        ) : access.status === "unauthenticated" ? (
          <Link className="text-sm font-semibold text-blue-700 hover:text-blue-800" href="/sign-in">Googleでログイン</Link>
        ) : (
          <SignOutButton redirectUrl="/sign-in">
            <button className="text-sm font-semibold text-blue-700 hover:text-blue-800" type="button">別のアカウントでログイン</button>
          </SignOutButton>
        )}
      </div>
    </header>
  );
}
