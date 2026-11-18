"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/orders", label: "Orders" },
  { href: "/dashboard/products", label: "Products" },
  { href: "/dashboard/collections", label: "Collections" },
  { href: "/dashboard/customers", label: "Customers" },
  { href: "/dashboard/receivables", label: "Receivables" },
  { href: "/dashboard/bookkeeping", label: "Bookkeeping" },
  { href: "/dashboard/payment-links", label: "Payment Links" },
  { href: "/dashboard/analytics", label: "Analytics" },
  { href: "/dashboard/bot", label: "Bot" },
  { href: "/dashboard/broadcasts", label: "Marketing" },
  { href: "/dashboard/campaigns", label: "Ads" },
  { href: "/dashboard/billing", label: "Money" },
  { href: "/dashboard/settings", label: "Settings" },
];

export default function DashboardNav({
  shopName,
  shopSlug,
}: {
  shopName: string;
  shopSlug: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-20 border-b border-arctic-400/30 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-5">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand font-black text-white">J</span>
            <span className="hidden font-bold text-arctic-900 sm:inline">
              {shopName}
            </span>
          </Link>
          <nav className="flex items-center gap-0.5 overflow-x-auto md:gap-1">
            {LINKS.map((l) => {
              const active =
                l.href === "/dashboard"
                  ? pathname === l.href
                  : pathname.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={
                    (active
                      ? "bg-brand/10 text-brand-dark "
                      : "text-arctic-700 hover:bg-arctic-200/70 ") +
                    "shrink-0 truncate rounded-lg px-2 py-1.5 text-xs font-medium md:px-3 md:text-sm" +
                    (active ? " font-semibold" : "")
                  }
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/c/${shopSlug}`}
            target="_blank"
            rel="noreferrer"
            className="btn-ghost hidden sm:inline-flex"
          >
            View catalog ↗
          </a>
          <button onClick={logout} className="btn-ghost">
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
