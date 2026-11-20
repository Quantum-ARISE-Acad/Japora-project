import Link from "next/link";
import { requireVendor } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatMoney, waMeLink } from "@/lib/utils";
import * as receivables from "@/lib/receivables";
import { buildSummary } from "@/lib/hustle";
import { getDashboardLocale, trServer } from "@/lib/dashboard-lang";
import CopyableLink from "./CopyableLink";
import NotifyFollowers from "./NotifyFollowers";
import Glyph from "@/components/Glyph";
import EmailVerificationBanner from "@/components/EmailVerificationBanner";
import { parseWhatsAppAssistantConfig } from "@/lib/whatsapp-config";
import { isLiveMode } from "@/lib/whatsapp";

export default async function OverviewPage() {
  const vendor = await requireVendor();
  const locale = await getDashboardLocale(vendor.language);
  const tr = <T = string,>(frVal: T, enVal: T): T => trServer(locale, frVal, enVal);

  const [productCount, lowStock, orders, receivablesOpenCents, customerCount, followerCount, hustle] =
    await Promise.all([
      prisma.product.count({ where: { vendorId: vendor.id } }),
      prisma.product.count({ where: { vendorId: vendor.id, stock: { lte: 3 } } }),
      prisma.order.findMany({ where: { vendorId: vendor.id, deletedAt: null } }),
      receivables.totalsOpen(vendor.id),
      prisma.customer.count({ where: { vendorId: vendor.id, deletedAt: null } }),
      prisma.follower.count({ where: { vendorId: vendor.id, unsubscribedAt: null } }),
      buildSummary(vendor.id, new Date()),
    ]);

  const count = (s: string) => orders.filter((o) => o.status === s).length;
  const openOrders = count("NEW") + count("CONFIRMED");
  const revenue = orders
    .filter((o) => o.status === "PAID" || o.status === "DELIVERED")
    .reduce((sum, o) => sum + o.totalCents, 0);

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  // Last 7 days revenue sparkline
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now - (6 - i) * dayMs);
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const dayEnd = dayStart + dayMs;
    const dayOrders = orders.filter(
      (o) =>
        (o.status === "PAID" || o.status === "DELIVERED") &&
        new Date(o.createdAt).getTime() >= dayStart &&
        new Date(o.createdAt).getTime() < dayEnd,
    );
    const dayRev = dayOrders.reduce((acc, o) => acc + o.totalCents, 0);
    return {
      date: d.toLocaleDateString(locale === "en" ? "en-US" : "fr-FR", { weekday: "short" }),
      rev: dayRev,
    };
  });
  const maxDayRev = Math.max(1, ...last7Days.map((d) => d.rev));

  // Today vs yesterday comparison
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const yesterdayStart = new Date(todayStart.getTime() - dayMs);

  const todayRev = orders
    .filter((o) => (o.status === "PAID" || o.status === "DELIVERED") && new Date(o.createdAt) >= todayStart)
    .reduce((s, o) => s + o.totalCents, 0);

  const yesterdayRev = orders
    .filter(
      (o) =>
        (o.status === "PAID" || o.status === "DELIVERED") &&
        new Date(o.createdAt) >= yesterdayStart &&
        new Date(o.createdAt) < todayStart,
    )
    .reduce((s, o) => s + o.totalCents, 0);

  const growthPct =
    yesterdayRev > 0
      ? Math.round(((todayRev - yesterdayRev) / yesterdayRev) * 100)
      : todayRev > 0
        ? 100
        : 0;

  // Stale orders alert
  const unconfirmedOlderThan24h = orders.filter(
    (o) => o.status === "NEW" && now - new Date(o.createdAt).getTime() > dayMs,
  ).length;

  const stats = [
    { label: tr("Nouvelles commandes", "New orders"), value: count("NEW"), href: "/dashboard/orders" },
    { label: tr("En cours (non payées)", "Open (unpaid)"), value: openOrders, href: "/dashboard/orders" },
    { label: tr("Revenus (encaissés)", "Revenue (paid)"), value: formatMoney(revenue, vendor.currency), href: "/dashboard/orders" },
    { label: tr("Créances ouvertes", "Receivables open"), value: formatMoney(receivablesOpenCents, vendor.currency), href: "/dashboard/receivables" },
    { label: tr("Clients", "Customers"), value: customerCount, href: "/dashboard/customers" },
    { label: tr("Produits", "Products"), value: productCount, href: "/dashboard/products" },
  ];

  const hustlePreviewLines = hustle.lines.slice(0, 3);
  const shareText = tr(
    `Bonjour ! Découvrez les nouveautés de ${vendor.shopName} sur notre boutique en ligne :\n\nhttps://japora.app/c/${vendor.shopSlug}`,
    `Hello! Check out the latest items from ${vendor.shopName} on our online shop:\n\nhttps://japora.app/c/${vendor.shopSlug}`,
  );
  const whatsappStatusShareUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;

  const waCfg = parseWhatsAppAssistantConfig(vendor.uiPrefs);
  const waLive = isLiveMode(vendor);
  const latestWaError = (waCfg.diagnostics || []).find((d) => d.severity !== "ok") || null;

  return (
    <div className="space-y-7 a-fade-in">
      <EmailVerificationBanner email={vendor.email} verified={Boolean(vendor.emailVerifiedAt)} />

      {/* Alerte de diagnostic WhatsApp Cloud API / IA Gemini en haut du Dashboard */}
      {latestWaError ? (
        <div
          className={`rounded-shape-lg border-2 p-4 ${
            latestWaError.severity === "error"
              ? "border-red-400 bg-red-50 text-red-950"
              : "border-amber-400 bg-amber-50 text-amber-950"
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1 max-w-3xl">
              <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-red-800">
                <span>{latestWaError.severity === "error" ? "🚨" : "⚠️"}</span>
                <span>
                  {tr(
                    `Diagnostic Assistant WhatsApp / IA (${latestWaError.stage.toUpperCase()})`,
                    `WhatsApp / AI Assistant Diagnostic (${latestWaError.stage.toUpperCase()})`,
                  )}
                </span>
              </div>
              <div className="text-sm font-bold">{latestWaError.title}</div>
              <p className="text-xs leading-relaxed opacity-90">{latestWaError.message}</p>
              {latestWaError.fixHint && (
                <p className="mt-1 rounded bg-white/85 p-2 text-xs text-arctic-900 border border-black/10">
                  💡 <strong>{tr("Solution :", "Fix:")}</strong> {latestWaError.fixHint}
                </p>
              )}
            </div>
            <Link
              href="/dashboard/bot"
              className="btn-primary text-xs shrink-0"
            >
              {tr("🩺 Ouvrir le Diagnostic WhatsApp & Régler →", "🩺 Open WhatsApp Diagnostics & Fix →")}
            </Link>
          </div>
        </div>
      ) : !waLive ? (
        <div className="rounded-shape-lg border border-amber-300/80 bg-amber-50/90 px-4 py-3 text-amber-950 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs sm:text-sm">
            <strong>⚠️ {tr("Assistant WhatsApp en mode Simulation (Stub) :", "WhatsApp Assistant in Simulation (Stub) mode:")}</strong>{" "}
            {tr(
              "Renseignez ou transférez votre Phone Number ID et Access Token Meta sur cette boutique pour que la réponse automatique parte sur WhatsApp.",
              "Enter or transfer your Meta Phone Number ID and Access Token on this store so automatic replies are sent on WhatsApp.",
            )}
          </div>
          <Link href="/dashboard/bot" className="text-xs font-bold underline hover:no-underline shrink-0">
            {tr("Configurer l'Assistant WhatsApp →", "Configure WhatsApp Assistant →")}
          </Link>
        </div>
      ) : null}

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="a-headline-md text-arctic-900">
            {tr("Bon retour.", "Welcome back.")}
          </h1>
          <p className="a-body-md mt-1 text-arctic-600">
            {tr(
              `L'activité de ${vendor.shopName}, en temps réel.`,
              `The state of ${vendor.shopName}, right now.`,
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={whatsappStatusShareUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-shape-md bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-emerald-700"
          >
            <Glyph name="chat" size={14} />{" "}
            {tr("Partager sur WhatsApp Status", "Share on WhatsApp Status")}
          </a>
        </div>
      </header>

      {/* Unconfirmed orders alert */}
      {unconfirmedOlderThan24h > 0 && (
        <div className="flex items-center justify-between rounded-shape-md border border-amber-300/80 bg-amber-50 px-4 py-3 text-amber-900">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-base">⚠️</span>
            <span>
              <strong>{unconfirmedOlderThan24h}</strong>{" "}
              {tr(
                `commande${unconfirmedOlderThan24h > 1 ? "s non confirmées" : " non confirmée"} depuis plus de 24 heures.`,
                `order${unconfirmedOlderThan24h > 1 ? "s unconfirmed" : " unconfirmed"} for over 24 hours.`,
              )}
            </span>
          </div>
          <Link href="/dashboard/orders" className="text-xs font-bold underline hover:no-underline">
            {tr("Voir les commandes", "View orders")}
          </Link>
        </div>
      )}

      {/* Shareable Link Bar */}
      <section className="glass glass-edge rounded-shape-lg p-6">
        <h2 className="a-label-md text-arctic-700">
          {tr("Votre lien de catalogue partageable", "Your shareable catalog link")}
        </h2>
        <p className="a-body-md mb-3 mt-1 text-arctic-700">
          {tr(
            "Partagez ce lien dans votre statut WhatsApp, votre bio ou vos groupes. Vos clients consultent et commandent — tout arrive directement ici.",
            "Drop this in your WhatsApp status, bio, or groups. Customers browse and order — orders land right here.",
          )}
        </p>
        <CopyableLink slug={vendor.shopSlug} />
      </section>

      {/* KPI Stats Grid */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {stats.map((s, i) => (
          <Link
            key={s.label}
            href={s.href}
            className="glass glass-edge a-hover-lift group flex min-w-0 flex-col gap-1.5 rounded-shape-lg p-5"
            style={{ animationDelay: `${i * 30}ms` }}
          >
            <div className="a-eyebrow">{s.label}</div>
            <div
              className="a-num min-w-0 break-words font-display font-semibold leading-tight text-arctic-900 transition-colors duration-short group-hover:text-brand-dark"
              style={{ fontSize: "clamp(20px, 5.5vw, 32px)" }}
            >
              {s.value}
            </div>
          </Link>
        ))}
      </section>

      {/* 7 Days Revenue Trend & Comparison */}
      <section className="glass glass-edge rounded-shape-lg p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="a-label-md text-arctic-700">
              {tr("Revenus des 7 derniers jours", "Last 7 days revenue")}
            </h2>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-bold text-arctic-900">
                {tr("Aujourd'hui :", "Today:")} {formatMoney(todayRev, vendor.currency)}
              </span>
              {growthPct !== 0 && (
                <span
                  className={`text-xs font-semibold ${
                    growthPct > 0 ? "text-emerald-600" : "text-red-500"
                  }`}
                >
                  {growthPct > 0 ? `+${growthPct}%` : `${growthPct}%`}{" "}
                  {tr("vs hier", "vs yesterday")}
                </span>
              )}
            </div>
          </div>
          <span className="text-xs text-arctic-500">
            {tr("Commandes payées & livrées", "Paid & delivered orders")}
          </span>
        </div>

        {/* CSS Bar Chart */}
        <div className="grid grid-cols-7 items-end gap-2 h-28 pt-4 border-t border-arctic-300/30">
          {last7Days.map((day, idx) => {
            const heightPct = Math.max(8, Math.round((day.rev / maxDayRev) * 100));
            return (
              <div key={idx} className="flex flex-col items-center gap-1.5 h-full justify-end group">
                <div className="relative flex flex-col items-center w-full">
                  {day.rev > 0 && (
                    <span className="absolute -top-6 text-[10px] font-mono text-arctic-700 opacity-0 group-hover:opacity-100 transition">
                      {formatMoney(day.rev, vendor.currency)}
                    </span>
                  )}
                  <div
                    className={`w-full max-w-[32px] rounded-t-sm transition-all duration-medium ${
                      idx === 6 ? "bg-emerald-600" : "bg-arctic-300/70 hover:bg-arctic-400"
                    }`}
                    style={{ height: `${heightPct}%` }}
                  />
                </div>
                <span className="text-[11px] font-medium text-arctic-600">{day.date}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Hustle Preview */}
      <section className="glass glass-edge rounded-shape-lg p-6">
        <div className="flex items-center justify-between">
          <h2 className="a-label-md text-arctic-700">
            {tr("Aperçu du bilan quotidien", "Today's hustle preview")}
          </h2>
          <span className="a-label-md inline-flex items-center gap-1.5 rounded-shape-full border border-arctic-400/45 bg-white/65 px-2 py-0.5 text-arctic-700 backdrop-blur-glass-thin">
            <Glyph name="moon" size={13} className="text-brand-dark" />{" "}
            {tr("Envoyé à 18h", "Sent at 6 PM")}
          </span>
        </div>
        <pre className="mt-3 whitespace-pre-wrap rounded-shape-md border border-arctic-400/30 bg-arctic-200/35 p-4 a-body-sm text-arctic-800 backdrop-blur-glass-thin">
{hustlePreviewLines.join("\n")}
        </pre>
      </section>

      <NotifyFollowers followerCount={followerCount} />

      <section className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/dashboard/products"
          className="glass glass-edge a-hover-lift flex items-center justify-between rounded-shape-lg p-5"
        >
          <div>
            <div className="a-title-md text-arctic-900">
              {tr("Ajouter un produit", "Add a product")}
            </div>
            <div className="a-body-sm text-arctic-600">
              {tr("Photo, prix, tailles, stock, état.", "Photo, price, sizes, stock, condition.")}
            </div>
          </div>
          <Glyph name="box" size={26} className="text-brand-dark" />
        </Link>
        <Link
          href="/dashboard/orders"
          className="glass glass-edge a-hover-lift flex items-center justify-between rounded-shape-lg p-5"
        >
          <div>
            <div className="a-title-md text-arctic-900">
              {tr("Gérer les commandes", "Manage orders")}
            </div>
            <div className="a-body-sm text-arctic-600">
              {tr(
                "Faites-les avancer : Nouvelle → Payée → Livrée.",
                "Move them New → Paid → Delivered.",
              )}
            </div>
          </div>
          <Glyph name="receipt" size={26} className="text-brand-dark" />
        </Link>
      </section>

      {lowStock > 0 && (
        <div className="inline-flex w-full items-center gap-2 rounded-shape-md border border-amber-300/60 bg-amber-50/85 px-4 py-3 a-body-md text-amber-900 backdrop-blur-glass-thin">
          <Glyph name="alert" size={17} className="shrink-0 text-amber-700" />
          <span>
            {tr(
              `${lowStock} produit${lowStock > 1 ? "s ont" : " a"} un stock faible (3 ou moins).`,
              `${lowStock} product${lowStock > 1 ? "s are" : " is"} low on stock (3 or fewer).`,
            )}{" "}
            <Link href="/dashboard/products" className="font-semibold underline hover:no-underline">
              {tr("Réapprovisionner", "Restock")}
            </Link>
          </span>
        </div>
      )}
    </div>
  );
}
