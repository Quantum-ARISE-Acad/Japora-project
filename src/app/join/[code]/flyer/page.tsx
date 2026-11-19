import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCooperativeByCode } from "@/lib/cooperative";
import { appUrl } from "@/lib/token";
import { regionLabel } from "@/lib/regions";
import PrintButton from "./PrintButton";
import { getServerTr } from "@/lib/public-locale";

/**
 * Printable cooperative recruitment flyer — the association multiplier.
 *
 * An A4, French-language one-pager a market-association leader prints and hands
 * out (or pins up): the pitch, a big QR + join code, and the URL. Scanning it
 * drops a vendor straight into onboarding for THIS cooperative. Works for any
 * association via its join code.
 *
 * Print note: this is a print artifact, so it uses explicit ink-on-white colors
 * (not the theme-aware tokens) so it prints reliably regardless of light/dark —
 * an intentional exception to the "tokens only" rule, which governs app UI.
 */

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const coop = await getCooperativeByCode(code);
  return { title: coop ? `Flyer — ${coop.name}` : "Flyer", robots: { index: false } };
}

const INK = "#1C1917";
const STONE = "#6B6760";
const GOLD = "#A16207";
const PAPER = "#FFFFFF";

export default async function FlyerPage({ params }: { params: Promise<{ code: string }> }) {
  const tr = await getServerTr();
  const { code } = await params;
  const coop = await getCooperativeByCode(code);
  if (!coop) notFound();

  const joinUrl = appUrl(`/join/${coop.joinCode}`);
  const qrSrc = `/api/qr?data=${encodeURIComponent(joinUrl)}`;
  const benefits = [
    ["Ton catalogue", "Photos, prix, stock — partagé en un lien."],
    ["Le robot répond", "« C’est combien ? » — jour et nuit, automatiquement."],
    ["Paiement dans le chat", "T-Money, Flooz, Moov, Orange — le client paie sur place."],
    ["Gratuit pour commencer", "Tu paies seulement quand tu vends."],
  ];

  return (
    <>
      {/* Print rules — A4, ink-on-white, hide the screen chrome. */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page { size: A4 portrait; margin: 14mm; }
              .no-print { display: none !important; }
              html, body { background: #fff !important; }
              .flyer-sheet { box-shadow: none !important; border: none !important; margin: 0 !important; }
            }
          `,
        }}
      />

      <div className="min-h-screen px-4 py-8" style={{ background: "#EFEDE8" }}>
        {/* Screen-only toolbar */}
        <div className="no-print mx-auto mb-5 flex max-w-[210mm] items-center justify-between gap-3">
          <Link href="/dashboard/settings" className="btn-ghost">{tr("← Retour aux paramètres", "← Back to settings")}</Link>
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-arctic-600 sm:inline">{tr("Imprimer au format A4 ou enregistrer en PDF.", "Print in A4 or save as PDF.")}</span>
            <PrintButton />
          </div>
        </div>

        {/* The sheet */}
        <div
          className="flyer-sheet mx-auto flex flex-col"
          style={{
            width: "210mm",
            minHeight: "297mm",
            maxWidth: "100%",
            background: PAPER,
            color: INK,
            padding: "18mm 16mm",
            boxShadow: "0 10px 40px rgba(28,25,23,0.18)",
            fontFamily: "var(--font-sans), system-ui, sans-serif",
          }}
        >
          {/* Brand */}
          <div className="flex items-center gap-3">
            <span
              className="grid place-items-center font-display"
              style={{ width: 44, height: 44, borderRadius: 12, background: GOLD, color: "#fff", fontWeight: 800, fontSize: 22 }}
            >
              J
            </span>
            <span className="font-display" style={{ fontSize: 22, fontWeight: 600 }}>Japora</span>
            <span className="ml-auto" style={{ fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: GOLD, fontWeight: 700 }}>
              {coop.region ? `${regionLabel(coop.region)} · ` : ""}{tr("Coopérative", "Cooperative")}
            </span>
          </div>

          <hr style={{ border: 0, height: 1, background: `${GOLD}55`, margin: "14mm 0 10mm" }} />

          {/* Headline */}
          <h1 className="font-display" style={{ fontSize: 40, lineHeight: 1.08, fontWeight: 600, letterSpacing: "-0.01em" }}>
            {tr("Vends sur WhatsApp avec", "Sell on WhatsApp with")}{" "}
            <span style={{ color: GOLD }}>{coop.name}</span>.
          </h1>
          <p style={{ marginTop: 12, fontSize: 16, lineHeight: 1.5, color: STONE, maxWidth: "150mm" }}>
            {tr("Pas de nouvelle application. Ton commerce tourne sur le WhatsApp que tu utilises déjà — et toute la coopérative vend sous la même bannière.", "No new app. Your business runs on the WhatsApp you already use — and the whole cooperative sells under the same banner.")}
          </p>

          {/* Benefits */}
          <div className="mt-8 grid grid-cols-2" style={{ gap: "8mm 10mm" }}>
            {benefits.map(([t, d]) => (
              <div key={t} style={{ display: "flex", gap: 10 }}>
                <span aria-hidden style={{ color: GOLD, fontWeight: 700, fontSize: 18, lineHeight: "24px" }}>✓</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{t}</div>
                  <div style={{ fontSize: 13.5, color: STONE, lineHeight: 1.45 }}>{d}</div>
                </div>
              </div>
            ))}
          </div>

          {/* QR + join — the call to action */}
          <div
            className="mt-auto flex items-center gap-8"
            style={{ borderTop: `1px solid ${GOLD}55`, paddingTop: "12mm", marginTop: "14mm" }}
          >
            <div style={{ background: "#fff", padding: 8, border: `1px solid ${INK}1A`, borderRadius: 12 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrSrc} alt={tr(`QR pour rejoindre ${coop.name}`, `QR to join ${coop.name}`)} width={200} height={200} style={{ display: "block", width: 200, height: 200 }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: GOLD, fontWeight: 700 }}>
                {tr("Scanne pour rejoindre", "Scan to join")}
              </div>
              <div className="font-display" style={{ fontSize: 30, fontWeight: 600, marginTop: 4 }}>
                {tr("Ouvre ta boutique — gratuit", "Open your shop — free")}
              </div>
              <div style={{ marginTop: 10, fontSize: 14, color: STONE }}>
                {tr("Ou va sur :", "Or go to:")}
              </div>
              <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 15, fontWeight: 600, wordBreak: "break-all" }}>
                {joinUrl.replace(/^https?:\/\//, "")}
              </div>
              <div style={{ marginTop: 10, fontSize: 14, color: STONE }}>
                {tr("Code d’adhésion :", "Membership code:")}{" "}
                <span style={{ fontWeight: 700, color: INK, letterSpacing: "0.1em", fontVariantNumeric: "tabular-nums" }}>
                  {coop.joinCode}
                </span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ marginTop: "10mm", display: "flex", justifyContent: "space-between", fontSize: 12, color: STONE }}>
            <span>
              {coop.memberCount} {coop.memberCount === 1 ? tr("boutique", "shop") : tr("boutiques", "shops")} {tr("déjà sur Japora", "already on Japora")}
            </span>
            <span>{tr("Propulsé par Japora — vends sur WhatsApp, encaisse, grandis.", "Powered by Japora — sell on WhatsApp, get paid, grow.")}</span>
          </div>
        </div>
      </div>
    </>
  );
}
