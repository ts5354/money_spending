import Link from "next/link";

const navigationItems = [
  { href: "/", label: "Dashboard" },
  { href: "/transactions", label: "明細" },
  { href: "/import", label: "CSV取込" },
] as const;

export function Navigation() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-5 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
        <Link className="w-fit text-lg font-bold tracking-tight text-slate-900" href="/">
          JCB Spending Visualizer
        </Link>
        <nav aria-label="メインナビゲーション">
          <ul className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-medium text-slate-600">
            {navigationItems.map((item) => (
              <li key={item.href}>
                <Link className="rounded-sm transition hover:text-blue-700" href={item.href}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}

