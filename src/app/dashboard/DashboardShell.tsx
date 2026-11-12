"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { isClerkConfigured } from "@/components/auth/ClerkAuthProvider";
import ThemeToggle from "@/components/ThemeToggle";
import EcosystemSwitcher from "@/components/EcosystemSwitcher";

/**
 * Lumière dashboard shell — the "orchestrator".
 *
 * Addresses the recurring ERP complaints head-on:
 *  - Overcrowded nav → an adaptive left sidebar (desktop) with the destinations
 *    GROUPED by job (Miller's law: ≤4 per group), off-canvas drawer on mobile.
 *  - No search → a global command palette (⌘K / the search button) to jump
 *    anywhere in two keystrokes.
 *  - Weak hierarchy → one clear active state (gold rail), section eyebrows, a
 *    persistent page identity in the top bar.
 *  - Inconsistent chrome → one shell wraps every page; nav never moves.
 * All targets ≥44px, full keyboard nav, visible gold focus ring.
 */

type Item = { href: string; label: string; icon: IconName; exact?: boolean };
type Group = { section: string | null; items: Item[] };

const NAV: Group[] = [
  { section: null, items: [{ href: "/dashboard", label: "Overview", icon: "home", exact: true }] },
  {
    section: "Sell",
    items: [
      { href: "/dashboard/orders", label: "Orders", icon: "orders" },
      { href: "/dashboard/products", label: "Products", icon: "products" },
      { href: "/dashboard/collections", label: "Collections", icon: "products" },
      { href: "/dashboard/customers", label: "Customers", icon: "customers" },
    ],
  },
  {
    section: "Money",
    items: [
      { href: "/dashboard/receivables", label: "Receivables", icon: "coins" },
      { href: "/dashboard/bookkeeping", label: "Bookkeeping", icon: "coins" },
      { href: "/dashboard/payment-links", label: "Payment Links", icon: "wallet" },
      { href: "/dashboard/billing", label: "Money", icon: "wallet" },
    ],
  },
  {
    section: "Grow",
    items: [
      { href: "/dashboard/analytics", label: "Analytics", icon: "target" },
      { href: "/dashboard/cooperative", label: "Cooperative", icon: "customers" },
      { href: "/dashboard/broadcasts", label: "Marketing", icon: "megaphone" },
      { href: "/dashboard/campaigns", label: "Ads", icon: "target" },
      { href: "/dashboard/bot", label: "Assistant WhatsApp", icon: "bot" },
    ],
  },
  { section: null, items: [{ href: "/dashboard/settings", label: "Settings", icon: "settings" }] },
];

const FLAT = NAV.flatMap((g) => g.items);

export default function DashboardShell({
  shopName,
  shopSlug, avatarUrl,
  children,
}: {
  shopName: string;
  shopSlug: string; avatarUrl?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawer, setDrawer] = useState(false);
  const [palette, setPalette] = useState(false);

  const clerkActive = isClerkConfigured();
  let clerk: any = null;
  try {
    if (clerkActive) {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      clerk = useClerk();
    }
  } catch {
    clerk = null;
  }

  // ⌘K / Ctrl-K opens the command palette anywhere.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((p) => !p);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Close the mobile drawer on navigation.
  useEffect(() => setDrawer(false), [pathname]);

  const active = (it: Item) =>
    it.exact ? pathname === it.href : pathname === it.href || pathname.startsWith(it.href + "/");
  const current = useMemo(
    () => [...FLAT].sort((a, b) => b.href.length - a.href.length).find((it) => active(it)),
    [pathname], // eslint-disable-line react-hooks/exhaustive-deps
  );

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    if (clerk?.signOut) {
      try {
        const origin = typeof window !== "undefined" ? window.location.origin : "";
        await clerk.signOut({ redirectUrl: `${origin}/login` });
        return;
      } catch {
        // Fall through to client router redirect if Clerk signOut fails
      }
    }
    router.push("/login");
    router.refresh();
  }

  const sidebar = (
    <nav aria-label="Primary" className="flex h-full flex-col gap-1 px-3 py-4">
      <Link href="/dashboard" className="mb-4 flex items-center gap-2.5 px-2">
        <span className="grid h-9 w-9 place-items-center rounded-shape-md bg-brand font-black text-white shadow-elev-1">
          {avatarUrl ? <img src={avatarUrl} alt={shopName} className="h-9 w-9 rounded-shape-md object-cover" /> : (shopName.charAt(0).toUpperCase() || "S")}
        </span>
        <span className="min-w-0 truncate font-display text-[17px] font-semibold text-arctic-900">
          {shopName}
        </span>
      </Link>

      <div className="flex-1 space-y-4 overflow-y-auto">
        {NAV.map((group, gi) => (
          <div key={gi} className="space-y-0.5">
            {group.section && <div className="a-eyebrow px-3 pb-1 pt-2">{group.section}</div>}
            {group.items.map((it) => {
              const on = active(it);
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  aria-current={on ? "page" : undefined}
                  className={
                    "group relative flex min-h-[44px] items-center gap-3 rounded-shape-md px-3 text-[14px] font-medium transition-colors duration-short " +
                    (on
                      ? "bg-brand/10 text-brand-dark"
                      : "text-arctic-700 hover:bg-arctic-200/60 hover:text-arctic-900")
                  }
                >
                  {/* Active gold rail — the one clear location signal. */}
                  <span
                    className={
                      "absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-brand transition-opacity " +
                      (on ? "opacity-100" : "opacity-0")
                    }
                  />
                  <Icon name={it.icon} className={on ? "text-brand-dark" : "text-arctic-500 group-hover:text-arctic-700"} />
                  <span className="truncate">{it.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      <div className="mt-3 space-y-1 border-t border-arctic-300/50 pt-3">
        <a
          href={`/c/${shopSlug}`}
          target="_blank"
          rel="noreferrer"
          className="flex min-h-[44px] items-center gap-3 rounded-shape-md px-3 text-[14px] font-medium text-arctic-700 hover:bg-arctic-200/60 hover:text-arctic-900"
        >
          <Icon name="catalog" className="text-arctic-500" />
          View catalog
        </a>
        <button
          onClick={logout}
          className="flex min-h-[44px] w-full items-center gap-3 rounded-shape-md px-3 text-[14px] font-medium text-arctic-700 hover:bg-arctic-200/60 hover:text-arctic-900"
        >
          <Icon name="logout" className="text-arctic-500" />
          Sign out
        </button>
      </div>
    </nav>
  );

  return (
    <div className="lg:grid lg:grid-cols-[264px_1fr]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen border-r border-arctic-300/50 bg-arctic-50/55 backdrop-blur-glass-thin lg:block">
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-arctic-900/40 backdrop-blur-[2px]" onClick={() => setDrawer(false)} />
          <div className="absolute left-0 top-0 h-full w-[280px] max-w-[82%] border-r border-arctic-300/50 bg-arctic-50 shadow-elev-3 a-rise-in">
            {sidebar}
          </div>
        </div>
      )}

      <div className="min-w-0">
        {/* Top bar — page identity + search + theme + mobile menu. */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-arctic-300/50 bg-arctic-50/80 px-4 py-3 backdrop-blur-glass">
          <button
            onClick={() => setDrawer(true)}
            aria-label="Open menu"
            className="grid h-10 w-10 place-items-center rounded-shape-md text-arctic-700 hover:bg-arctic-200/60 lg:hidden"
          >
            <Icon name="menu" />
          </button>

          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-[18px] font-semibold leading-tight text-arctic-900">
              {current?.label ?? "Dashboard"}
            </div>
          </div>

          <button
            onClick={() => setPalette(true)}
            className="inline-flex h-10 items-center gap-2 rounded-shape-full border border-arctic-400/45 px-3 text-[13px] text-arctic-600 transition-colors hover:border-brand/50 hover:text-arctic-900"
            style={{ background: "var(--aurora-surface)" }}
            aria-label="Search and quick navigation"
          >
            <Icon name="search" className="h-4 w-4" />
            <span className="hidden sm:inline">Search</span>
            <kbd className="hidden rounded border border-arctic-400/50 px-1.5 py-0.5 text-[10px] font-semibold text-arctic-500 sm:inline">
              ⌘K
            </kbd>
          </button>

          <EcosystemSwitcher current="japora" />
          <ThemeToggle />
        </header>

        <main className="mx-auto max-w-6xl px-4 py-6 md:px-6 lg:py-8">{children}</main>
      </div>

      {palette && (
        <CommandPalette
          items={FLAT}
          shopSlug={shopSlug}
          onClose={() => setPalette(false)}
          onNavigate={(href) => {
            setPalette(false);
            router.push(href);
          }}
        />
      )}
    </div>
  );
}

/* ----------------------------- Command palette ---------------------------- */

function CommandPalette({
  items,
  shopSlug, avatarUrl,
  onClose,
  onNavigate,
}: {
  items: Item[];
  shopSlug: string; avatarUrl?: string;
  onClose: () => void;
  onNavigate: (href: string) => void;
}) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);

  const actions = useMemo(
    () => [
      ...items.map((it) => ({ label: it.label, href: it.href, hint: "Go to" })),
      { label: "Add product", href: "/dashboard/products", hint: "Action" },
      { label: "New campaign", href: "/dashboard/campaigns", hint: "Action" },
      { label: "View public catalog", href: `/c/${shopSlug}`, hint: "Open" },
      { label: "How Japora works", href: "/how-to-use", hint: "Guide" },
    ],
    [items, shopSlug],
  );

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return actions;
    return actions.filter((a) => a.label.toLowerCase().includes(t));
  }, [q, actions]);

  useEffect(() => setSel(0), [q]);

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
    else if (e.key === "Enter" && results[sel]) { e.preventDefault(); onNavigate(results[sel].href); }
    else if (e.key === "Escape") onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]">
      <div className="absolute inset-0 bg-arctic-900/45 backdrop-blur-[3px]" onClick={onClose} />
      <div className="glass-strong glass-edge relative w-full max-w-lg overflow-hidden rounded-shape-lg a-rise-in">
        <div className="flex items-center gap-3 border-b border-arctic-300/50 px-4">
          <Icon name="search" className="text-arctic-500" />
          {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder="Search pages and actions…"
            className="h-14 flex-1 bg-transparent text-[15px] text-arctic-900 outline-none placeholder:text-arctic-500"
          />
          <kbd className="rounded border border-arctic-400/50 px-1.5 py-0.5 text-[10px] font-semibold text-arctic-500">Esc</kbd>
        </div>
        <ul className="max-h-[50vh] overflow-y-auto p-2">
          {results.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-arctic-500">No matches.</li>
          )}
          {results.map((a, i) => (
            <li key={a.label}>
              <button
                onMouseEnter={() => setSel(i)}
                onClick={() => onNavigate(a.href)}
                className={
                  "flex min-h-[44px] w-full items-center justify-between gap-3 rounded-shape-md px-3 text-left text-[14px] transition-colors " +
                  (i === sel ? "bg-brand/10 text-brand-dark" : "text-arctic-800 hover:bg-arctic-200/60")
                }
              >
                <span className="font-medium">{a.label}</span>
                <span className="a-eyebrow opacity-70">{a.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* --------------------------------- Icons ---------------------------------- */

type IconName =
  | "home" | "orders" | "products" | "customers" | "coins" | "wallet"
  | "megaphone" | "target" | "bot" | "settings" | "search" | "menu"
  | "catalog" | "logout";

const PATHS: Record<IconName, string> = {
  home: "M3 11.5 12 4l9 7.5M5 10v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9",
  orders: "M6 2h9l3 3v17l-3-2-3 2-3-2-3 2V2zM9 7h6M9 11h6M9 15h4",
  products: "M3 7l9-4 9 4-9 4-9-4zM3 7v10l9 4 9-4V7M12 11v10",
  customers: "M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM22 19v-1a4 4 0 0 0-3-3.8M16 3.2A3.5 3.5 0 0 1 16 10",
  coins: "M9 9.5c0-1.4 2.7-2.5 6-2.5s6 1.1 6 2.5S18.3 12 15 12 9 10.9 9 9.5zM21 9.5v5c0 1.4-2.7 2.5-6 2.5s-6-1.1-6-2.5M3 14.5C3 13.1 5.7 12 9 12M3 14.5v0C3 15.9 5.7 17 9 17M3 14.5v-5",
  wallet: "M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2M3 7v10a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-2M3 7v3m18 5h-4a2 2 0 1 1 0-4h4v4z",
  megaphone: "M3 11v2a1 1 0 0 0 1 1h2l9 5V5L6 10H4a1 1 0 0 0-1 1zM18 8a4 4 0 0 1 0 8",
  target: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01",
  bot: "M12 3v3M7 8h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2zM9 13h.01M15 13h.01M9 17h6",
  settings: "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM19.4 13a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.2A1.6 1.6 0 0 0 7 19.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 4.6 13H4.4a2 2 0 1 1 0-4h.2A1.6 1.6 0 0 0 6 6.3l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 11 4.6h.2a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8 1.6 1.6 0 0 0 1.5 1h.2a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.4 1z",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3",
  menu: "M4 6h16M4 12h16M4 18h16",
  catalog: "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
};

function Icon({ name, className = "" }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={"h-[18px] w-[18px] shrink-0 " + className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
