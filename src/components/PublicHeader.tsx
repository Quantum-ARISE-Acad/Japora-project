"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";
import EcosystemSwitcher from "@/components/EcosystemSwitcher";

type PublicHeaderProps = {
  isAuthenticated?: boolean;
  shopSlug?: string;
};

const NAV_LINKS = [
  { href: "/marketplace", label: "Marketplace", badge: "Boutiques" },
  { href: "/how-to-use", label: "Comment ça marche" },
  { href: "/pricing", label: "Tarifs" },
];

export default function PublicHeader({ isAuthenticated = false, shopSlug }: PublicHeaderProps) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 12);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  return (
    <header
      className={`sticky top-0 z-40 border-b transition-all duration-medium ease-emphasized ${
        scrolled || mobileMenuOpen
          ? "border-arctic-300/60 bg-white/85 shadow-elev-1 backdrop-blur-glass-thick dark:border-arctic-300/30"
          : "border-arctic-200/40 bg-white/60 backdrop-blur-md"
      }`}
    >
      {/* Top Announcement Bar */}
      <div className="border-b border-arctic-200/50 bg-arctic-900 px-4 py-1.5 text-center text-[11px] font-medium text-arctic-100">
        <div className="mx-auto flex max-w-6xl items-center justify-center gap-2">
          <span className="inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          <span>
            <strong className="font-semibold text-white">Nouveau en Afrique de l&apos;Ouest :</strong>{" "}
            Bot WhatsApp IA 24/7 + Paiements T-Money, Flooz, Wave &amp; Orange Money intégrés.
          </span>
          <Link
            href="/how-to-use"
            className="hidden underline decoration-gold/60 underline-offset-2 hover:text-gold-bright sm:inline-block"
          >
            Découvrir →
          </Link>
        </div>
      </div>

      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        {/* Brand Logo */}
        <div className="flex items-center gap-3">
          <Link href="/" className="group flex items-center gap-2.5">
            <span
              aria-hidden
              className="grid h-9 w-9 place-items-center rounded-shape-md bg-arctic-900 font-display text-lg font-extrabold text-arctic-50 shadow-elev-1 transition-transform duration-short ease-spring group-hover:rotate-3 group-hover:scale-105"
            >
              J
            </span>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-display text-lg font-bold tracking-tight text-arctic-900">
                  Japora
                </span>
                <span className="rounded-full border border-brand/30 bg-brand/10 px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider text-brand-dark">
                  Afrique
                </span>
              </div>
              <span className="hidden text-[10px] text-arctic-500 sm:block">
                WhatsApp Commerce &amp; Marketplace
              </span>
            </div>
          </Link>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Navigation principale">
          {NAV_LINKS.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/" && pathname?.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex items-center gap-1.5 rounded-shape-full px-3.5 py-2 text-xs font-semibold transition-all duration-short ${
                  active
                    ? "bg-arctic-900 text-arctic-50 shadow-elev-1"
                    : "text-arctic-700 hover:bg-arctic-100/80 hover:text-arctic-900"
                }`}
              >
                <span>{item.label}</span>
                {item.badge && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                      active
                        ? "bg-gold text-white"
                        : "bg-brand/15 text-brand-dark"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <div className="hidden sm:block">
            <EcosystemSwitcher current="japora" />
          </div>
          <ThemeToggle />

          {isAuthenticated ? (
            <div className="flex items-center gap-2">
              {shopSlug && (
                <Link
                  href={`/shop/${shopSlug}`}
                  className="btn-ghost hidden text-xs sm:inline-flex"
                >
                  Ma vitrine
                </Link>
              )}
              <Link href="/dashboard" className="btn-primary text-xs">
                Tableau de bord →
              </Link>
            </div>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <Link href="/login" className="btn-ghost px-4 text-xs">
                Connexion
              </Link>
              <Link
                href="/start"
                className="a-btn a-btn--cafe px-4 text-xs font-bold shadow-elev-1"
              >
                Créer ma boutique
              </Link>
            </div>
          )}

          {/* Mobile Hamburger */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-expanded={mobileMenuOpen}
            aria-label="Menu de navigation"
            className="grid h-10 w-10 place-items-center rounded-shape-md border border-arctic-300/60 bg-white/70 text-arctic-800 lg:hidden"
          >
            {mobileMenuOpen ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="border-t border-arctic-200/60 bg-white/95 px-4 py-5 shadow-elev-3 backdrop-blur-xl lg:hidden a-fade-in">
          <div className="flex flex-col space-y-2">
            {NAV_LINKS.map((item) => {
              const active = pathname === item.href || pathname?.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-between rounded-shape-md px-4 py-3 text-sm font-semibold ${
                    active
                      ? "bg-arctic-900 text-arctic-50"
                      : "text-arctic-800 hover:bg-arctic-100"
                  }`}
                >
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-bold uppercase text-brand-dark">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          <div className="my-4 border-t border-arctic-200/60 pt-4">
            <div className="mb-3 flex items-center justify-between px-1">
              <span className="text-xs font-semibold text-arctic-600">Suite Wataru</span>
              <EcosystemSwitcher current="japora" />
            </div>
            {isAuthenticated ? (
              <Link href="/dashboard" className="btn-primary w-full justify-center">
                Accéder au tableau de bord →
              </Link>
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                <Link href="/login" className="btn-ghost w-full justify-center text-xs">
                  Connexion
                </Link>
                <Link href="/start" className="a-btn a-btn--cafe w-full justify-center text-xs font-bold">
                  Ouvrir ma boutique
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

