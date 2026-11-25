"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";
import { LanguageSwitcher, usePublicLang } from "@/components/PublicLanguageProvider";

type PublicHeaderProps = {
  isAuthenticated?: boolean;
  shopSlug?: string;
};

export default function PublicHeader({ isAuthenticated = false, shopSlug }: PublicHeaderProps) {
  const pathname = usePathname();
  const { tr } = usePublicLang();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    {
      href: "/marketplace",
      label: tr("Marketplace", "Marketplace"),
    },
    {
      href: "/how-to-use",
      label: tr("Comment ça marche", "How it works"),
    },
  ];

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
            <span className="font-display text-lg font-bold tracking-tight text-arctic-900">
              Japora
            </span>
          </Link>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-1.5 lg:flex" aria-label={tr("Navigation principale", "Main navigation")}>
          {navLinks.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/" && pathname?.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex items-center gap-1.5 rounded-shape-full px-4 py-2 text-xs font-semibold transition-all duration-short ${
                  active
                    ? "bg-arctic-900 text-arctic-50 shadow-elev-1"
                    : "text-arctic-700 hover:bg-arctic-100/80 hover:text-arctic-900"
                }`}
              >
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle />

          {isAuthenticated ? (
            <div className="flex items-center gap-2">
              {shopSlug && (
                <Link
                  href={`/shop/${shopSlug}`}
                  className="btn-ghost hidden text-xs sm:inline-flex"
                >
                  {tr("Ma vitrine", "My storefront")}
                </Link>
              )}
              <Link href="/dashboard" className="btn-primary hidden text-xs sm:inline-flex">
                {tr("Tableau de bord", "Dashboard")}
              </Link>
            </div>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <Link href="/login" className="btn-ghost px-4 text-xs">
                {tr("Connexion", "Sign in")}
              </Link>
              <Link
                href="/signup"
                className="a-btn a-btn--cafe px-4 text-xs font-bold shadow-elev-1"
              >
                {tr("Créer ma boutique", "Open a shop")}
              </Link>
            </div>
          )}

          {/* Mobile Hamburger */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-expanded={mobileMenuOpen}
            aria-label={tr("Menu de navigation", "Navigation menu")}
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
            {navLinks.map((item) => {
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
                </Link>
              );
            })}
          </div>

          <div className="my-4 border-t border-arctic-200/60 pt-4">
            {isAuthenticated ? (
              <Link href="/dashboard" className="btn-primary w-full justify-center">
                {tr("Accéder au tableau de bord", "Go to dashboard")}
              </Link>
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                <Link href="/login" className="btn-ghost w-full justify-center text-xs">
                  {tr("Connexion", "Sign in")}
                </Link>
                <Link href="/signup" className="a-btn a-btn--cafe w-full justify-center text-xs font-bold">
                  {tr("Ouvrir ma boutique", "Open a shop")}
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
