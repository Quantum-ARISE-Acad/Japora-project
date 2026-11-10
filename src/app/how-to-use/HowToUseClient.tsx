"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";

/**
 * "How Japora works" — an animated, scroll-driven explainer with interactive
 * WhatsApp Bot & Flow simulator, daily vendor timeline, offline-to-online
 * QR showcase, payment rails breakdown, and FAQ.
 */

type Step = {
  n: string;
  phase: string;
  title: string;
  subtitle: string;
  body: string;
  highlights: string[];
  icon: "shop" | "tag" | "share" | "chat" | "wallet" | "moon";
};

const STEPS: Step[] = [
  {
    n: "01",
    phase: "Inscription · ~90 secondes",
    title: "Ouvrez votre boutique sur WhatsApp",
    subtitle: "Open your shop — sans mot de passe complexe ni carte bancaire",
    body: "Saisissez simplement votre numéro WhatsApp sur /start. Vous recevez un code OTP à 6 chiffres et votre boutique est immédiatement créée en FCFA (ou votre devise locale). Aucune application supplémentaire à installer.",
    highlights: [
      "Connexion ultra-rapide par code WhatsApp OTP",
      "Devise FCFA (XOF) configurée par défaut sans erreur de décimale",
      "30 jours d'essai Pro inclus + offre Starter gratuite à vie",
    ],
    icon: "shop",
  },
  {
    n: "02",
    phase: "Catalogue · 2 minutes",
    title: "Ajoutez vos produits ou importez-les en 1 clic",
    subtitle: "Add what you sell — photos compressées automatiquement pour la 2G/3G",
    body: "Ajoutez vos articles avec photos, prix, tailles, état (neuf/occasion), stock, tarifs de gros ou précommande avec acompte. Vous avez déjà un catalogue WhatsApp Business ? Importez-le en un seul clic.",
    highlights: [
      "Import direct depuis Meta WhatsApp Business Catalog",
      "Compression d'image côté navigateur pour économiser vos data",
      "Gestion des tailles, stocks, prix de gros et acomptes",
    ],
    icon: "tag",
  },
  {
    n: "03",
    phase: "Visibilité · En ligne & Au marché",
    title: "Partagez un lien unique et votre QR code de stand",
    subtitle: "Share one link — Statut WhatsApp, TikTok, Instagram et stand physique",
    body: "Diffusez le lien de votre boutique sur votre Statut WhatsApp, dans votre bio Instagram/TikTok ou dans vos groupes de vente. Au marché, imprimez votre affiche QR code officielle pour que les passants scannent votre catalogue.",
    highlights: [
      "Générateur de visuels prêts pour Statut WhatsApp, IG & TikTok",
      "QR code vectoriel (SVG) imprimable pour votre boutique physique",
      "Référencement automatique sur le Marketplace public Japora",
    ],
    icon: "share",
  },
  {
    n: "04",
    phase: "Automatisation · 24h/24 & 7j/7",
    title: "Le Bot WhatsApp répond aux clients jour et nuit",
    subtitle: "The bot answers — fini de répéter « C'est combien ? » 50 fois par jour",
    body: "Quand un client écrit sur votre WhatsApp, le bot répond instantanément à partir de votre catalogue en direct : prix, tailles disponibles, frais de livraison par quartier. En dehors de vos horaires d'ouverture, votre message d'absence prend le relais.",
    highlights: [
      "Boutons interactifs WhatsApp : Voir le menu, Commander, Mon solde",
      "Assistant IA de boutique pour conseiller les acheteurs",
      "Horaires d'ouverture personnalisables & message d'absence auto",
    ],
    icon: "chat",
  },
  {
    n: "05",
    phase: "Encaissement · Mobile Money natif",
    title: "Vos clients paient directement dans la conversation",
    subtitle: "They pay inline — T-Money, Flooz, Wave, Orange Money & MTN MoMo",
    body: "Le client choisit son moyen de paiement habituel. Dès que le paiement Mobile Money est validé, la commande passe automatiquement au statut « ✓ Payé » sur votre tableau Kanban et le stock est mis à jour.",
    highlights: [
      "PayGate Global (T-Money & Flooz natifs au Togo) + CinetPay UEMOA",
      "Wave, Orange Money, MTN MoMo, Flutterwave, Paystack & M-Pesa",
      "Liens de paiement rapides pour acomptes et commandes sur-mesure",
    ],
    icon: "wallet",
  },
  {
    n: "06",
    phase: "Pilotage · Chaque soir à 18h00",
    title: "Recevez votre bilan quotidien sur WhatsApp",
    subtitle: "Read the 6 PM summary — votre journée résumée en un coup d'œil",
    body: "À 18h00, Japora vous envoie un message récapitulatif sur WhatsApp : chiffre d'affaires du jour, nombre de commandes payées, produit le plus vendu, créances en attente et alertes de réapprovisionnement.",
    highlights: [
      "Résumé WhatsApp quotidien à 18h00 sans ouvrir le tableau de bord",
      "Suivi des créances clients (Pay-later) et relances paniers abandonnés",
      "Comptabilité mensuelle P&L automatique exportable en CSV",
    ],
    icon: "moon",
  },
];

const SIMULATOR_SCENARIOS = [
  {
    id: "price",
    label: "💬 Demande de prix (« C'est combien ? »)",
    buyerMsg: "Bonjour ! C'est combien le Sac Bogolan Cuir et vous livrez à Agoè ?",
    botReply:
      "Bonjour 👋 ! Le **Sac Bogolan Cuir** est à **15 000 FCFA** (En stock : 6 pièces).\n\n📍 Livraison vers **Agoè** : **1 500 FCFA**.\nTotal avec livraison : **16 500 FCFA**.",
    buttons: ["🛒 Commander maintenant", "📖 Voir tout le catalogue", "💬 Parler au vendeur"],
    statusBadge: "Réponse automatique en 0.8s",
  },
  {
    id: "order",
    label: "💳 Paiement T-Money / Flooz en direct",
    buyerMsg: "Je prends 1 Sac Bogolan Cuir avec livraison à Agoè. Je paie par T-Money.",
    botReply:
      "Parfait ! Votre commande **#JP-4092** (16 500 FCFA) est enregistrée.\n\n👉 Appuyez ci-dessous pour valider votre paiement **T-Money / Flooz** en toute sécurité :",
    buttons: ["📲 Payer 16 500 FCFA (T-Money / Flooz)", "📄 Voir le récapitulatif"],
    statusBadge: "Statut : ✓ Payé confirmé automatiquement",
  },
  {
    id: "summary",
    label: "🌙 Bilan du soir à 18h00 (Côté Vendeur)",
    buyerMsg: "[Notification automatique Japora — 18h00]",
    botReply:
      "🌙 **Bilan du jour — Chez Améyo**\n• Commandes payées : **11 commandes**\n• Chiffre d'affaires : **134 500 FCFA**\n• Top vente : **Robe Bazin Brodé (5x)**\n• ⚠️ Stock bas : **Sandales Cuir (reste 2)**",
    buttons: ["📊 Ouvrir le tableau de bord", "📦 Réapprovisionner le stock"],
    statusBadge: "Envoyé chaque soir à 18h00",
  },
];

export default function HowToUseClient() {
  const root = useRef<HTMLDivElement>(null);
  const [activeScenario, setActiveScenario] = useState(0);

  useEffect(() => {
    const el = root.current;
    if (!el) return;

    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const heroes = el.querySelectorAll<HTMLElement>("[data-hero]");
    const steps = el.querySelectorAll<HTMLElement>("[data-step]");
    const line = el.querySelector<SVGPathElement>("[data-ledger-line]");
    const counter = el.querySelector<HTMLElement>("[data-count]");

    const revealAll = () => {
      [...heroes, ...steps].forEach((n) => {
        n.style.opacity = "1";
        n.style.transform = "none";
      });
      if (line) line.style.strokeDashoffset = "0";
      if (counter && counter.dataset.count) counter.textContent = counter.dataset.count;
    };

    if (reduce) {
      revealAll();
      return;
    }

    let cancelled = false;
    let safety: number | undefined;

    import("animejs")
      .then(({ animate, stagger }) => {
        if (cancelled) return;

        animate(heroes, {
          opacity: [0, 1],
          translateY: [14, 0],
          duration: 600,
          delay: stagger(90, { start: 80 }),
          ease: "outQuint",
        });

        if (counter) {
          const target = Number(counter.dataset.count || "0");
          const obj = { v: 0 };
          const io = new IntersectionObserver(
            (entries) => {
              entries.forEach((e) => {
                if (!e.isIntersecting) return;
                animate(obj, {
                  v: target,
                  duration: 1300,
                  ease: "outQuint",
                  onUpdate: () => {
                    counter.textContent = String(Math.round(obj.v));
                  },
                });
                io.unobserve(e.target);
              });
            },
            { threshold: 0.6 }
          );
          io.observe(counter);
        }

        if (line) {
          const len = line.getTotalLength();
          line.style.strokeDasharray = String(len);
          line.style.strokeDashoffset = String(len);
          const io = new IntersectionObserver(
            (entries) => {
              entries.forEach((e) => {
                if (!e.isIntersecting) return;
                animate(line, {
                  strokeDashoffset: [len, 0],
                  duration: 1600,
                  ease: "inOutQuad",
                });
                io.unobserve(e.target);
              });
            },
            { threshold: 0.2 }
          );
          io.observe(line);
        }

        const revealStep = (node: HTMLElement) => {
          if (node.dataset.shown) return;
          node.dataset.shown = "1";
          animate(node.querySelectorAll<HTMLElement>("[data-rise]"), {
            opacity: [0, 1],
            translateY: [18, 0],
            duration: 620,
            delay: stagger(70),
            ease: "outQuint",
          });
        };
        const io = new IntersectionObserver(
          (entries) => {
            entries.forEach((e) => {
              if (!e.isIntersecting) return;
              revealStep(e.target as HTMLElement);
              io.unobserve(e.target);
            });
          },
          { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
        );
        steps.forEach((s) => io.observe(s));

        safety = window.setTimeout(() => {
          steps.forEach((s) => revealStep(s as HTMLElement));
        }, 1600);
      })
      .catch(revealAll);

    return () => {
      cancelled = true;
      if (safety) window.clearTimeout(safety);
    };
  }, []);

  const currentScenario = SIMULATOR_SCENARIOS[activeScenario];

  return (
    <div ref={root} className="min-h-screen flex flex-col">
      <PublicHeader />

      <main className="mx-auto max-w-6xl flex-1 px-4">
        {/* ============================================================
         * 1. HERO SECTION
         * ============================================================ */}
        <section className="py-14 text-center sm:py-20">
          <div data-hero style={{ opacity: 0 }} className="a-eyebrow">
            Guide Complet · How Japora Works
          </div>
          <h1
            data-hero
            style={{ opacity: 0 }}
            className="a-display-sm mx-auto mt-3 max-w-3xl text-arctic-900 sm:a-display-md"
          >
            De « C&apos;est combien ? » jusqu&apos;au paiement — sans quitter WhatsApp.
          </h1>
          <p
            data-hero
            style={{ opacity: 0 }}
            className="a-body-lg mx-auto mt-4 max-w-2xl text-arctic-700"
          >
            Six étapes simples, de l&apos;ouverture de votre boutique au bilan comptable de 18h. Aucune nouvelle application à imposer à vos clients : tout se passe dans la discussion WhatsApp qu&apos;ils utilisent déjà.
          </p>
          <div
            data-hero
            style={{ opacity: 0 }}
            className="mt-7 flex flex-wrap justify-center gap-3"
          >
            <Link href="/start" className="a-btn a-btn--cafe a-btn--lg font-bold">
              Démarrer sur WhatsApp en 90 sec →
            </Link>
            <Link href="/marketplace" className="btn-ghost a-btn--lg">
              Explorer le Marketplace
            </Link>
          </div>
        </section>

        {/* ============================================================
         * 2. THE 6 STEPS WITH GOLD LEDGER SPINE
         * ============================================================ */}
        <section className="relative mx-auto max-w-4xl pb-12">
          {/* Gold "ledger" spine */}
          <svg
            aria-hidden
            className="pointer-events-none absolute left-[27px] top-2 hidden h-[calc(100%-3rem)] w-2 sm:block"
            preserveAspectRatio="none"
            viewBox="0 0 2 100"
          >
            <path
              data-ledger-line
              d="M1 0 L1 100"
              fill="none"
              stroke="rgb(var(--gold) / 0.55)"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          <ol className="space-y-6">
            {STEPS.map((s) => (
              <li key={s.n} data-step className="relative">
                <article className="flex items-start gap-4 sm:gap-6">
                  {/* Number medallion */}
                  <div
                    data-rise
                    style={{ opacity: 0 }}
                    className="relative z-10 grid h-14 w-14 shrink-0 place-items-center rounded-full border border-brand/45 bg-arctic-50 font-display text-lg font-bold text-brand-dark shadow-elev-1"
                  >
                    <span className="a-num">{s.n}</span>
                  </div>

                  <div className="glass glass-edge flex-1 rounded-shape-xl p-6 sm:p-7">
                    <div
                      data-rise
                      style={{ opacity: 0 }}
                      className="flex flex-wrap items-center justify-between gap-2"
                    >
                      <span className="rounded-full bg-brand/15 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-dark">
                        {s.phase}
                      </span>
                      <span className="text-xs text-arctic-500">{s.subtitle}</span>
                    </div>

                    <div
                      data-rise
                      style={{ opacity: 0 }}
                      className="mt-3 flex items-center gap-2.5"
                    >
                      <StepIcon name={s.icon} />
                      <h2 className="a-title-lg font-display text-arctic-900">
                        {s.title}
                      </h2>
                    </div>

                    <p
                      data-rise
                      style={{ opacity: 0 }}
                      className="a-body-md mt-2 text-arctic-700 leading-relaxed"
                    >
                      {s.body}
                    </p>

                    <ul
                      data-rise
                      style={{ opacity: 0 }}
                      className="mt-4 grid gap-2 border-t border-arctic-200/70 pt-3.5 sm:grid-cols-3"
                    >
                      {s.highlights.map((h) => (
                        <li
                          key={h}
                          className="flex items-start gap-1.5 text-xs text-arctic-800"
                        >
                          <span className="font-bold text-brand-dark">✓</span>
                          <span>{h}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </article>
              </li>
            ))}
          </ol>
        </section>

        {/* ============================================================
         * 3. LEDGER METRIC COUNTER — 90 Seconds
         * ============================================================ */}
        <section className="mb-20 mt-4">
          <div className="glass glass-edge mx-auto max-w-xl rounded-shape-xl p-8 text-center shadow-elev-2">
            <div className="a-eyebrow">Temps moyen de mise en ligne</div>
            <div className="mt-2 flex items-end justify-center gap-1.5">
              <span
                data-count="90"
                className="a-num font-display text-6xl font-bold leading-none text-arctic-900"
              >
                90
              </span>
              <span className="a-num pb-1 font-display text-2xl font-bold text-brand-dark">
                secondes
              </span>
            </div>
            <div className="mx-auto mt-4 h-px max-w-[14rem]">
              <hr className="a-rule-gold" />
            </div>
            <p className="a-body-md mt-3 text-arctic-700">
              Recevez un code à 6 chiffres sur WhatsApp, validez, et votre vitrine est prête à encaisser vos premières commandes.
            </p>
          </div>
        </section>

        {/* ============================================================
         * 4. INTERACTIVE WHATSAPP BOT & FLOW SIMULATOR
         * ============================================================ */}
        <section className="mb-20 rounded-shape-xl border border-arctic-300/60 bg-white/85 p-6 shadow-elev-2 backdrop-blur-md sm:p-10">
          <div className="mx-auto max-w-2xl text-center">
            <span className="a-eyebrow">Démonstration Interactive</span>
            <h2 className="a-headline-lg mt-1 text-arctic-900">
              Voyez comment le Bot WhatsApp gère vos clients en direct
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-arctic-600">
              Sélectionnez un scénario ci-dessous pour visualiser la conversation telle qu&apos;elle se déroule sur WhatsApp.
            </p>
          </div>

          <div className="mt-8 grid items-center gap-8 lg:grid-cols-[1fr,1.25fr]">
            {/* Scenario Selector Buttons */}
            <div className="space-y-3">
              {SIMULATOR_SCENARIOS.map((scen, idx) => {
                const isSelected = activeScenario === idx;
                return (
                  <button
                    key={scen.id}
                    type="button"
                    onClick={() => setActiveScenario(idx)}
                    className={`w-full rounded-shape-lg border p-4 text-left transition-all ${
                      isSelected
                        ? "border-arctic-900 bg-arctic-900 text-white shadow-elev-1"
                        : "border-arctic-300/70 bg-white/80 text-arctic-900 hover:border-brand"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">{scen.label}</span>
                      <span
                        className={`text-xs ${
                          isSelected ? "text-gold-bright" : "text-arctic-400"
                        }`}
                      >
                        →
                      </span>
                    </div>
                    <p
                      className={`mt-1 text-[11px] ${
                        isSelected ? "text-arctic-200" : "text-arctic-600"
                      }`}
                    >
                      {scen.statusBadge}
                    </p>
                  </button>
                );
              })}

              <div className="rounded-shape-md border border-brand/30 bg-brand/10 p-4 text-xs text-arctic-800">
                <strong className="font-bold text-brand-dark">
                  Astuce Vendeur :
                </strong>{" "}
                Depuis votre tableau de bord (<code>/dashboard/bot</code>), vous disposez d&apos;un simulateur complet pour tester les réponses de votre propre boutique avant de les activer.
              </div>
            </div>

            {/* Simulated WhatsApp Screen */}
            <div className="glass glass-edge rounded-shape-xl p-6 shadow-elev-2">
              <div className="mb-4 flex items-center justify-between border-b border-arctic-200/70 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-emerald-700 text-xs font-bold text-white">
                    WA
                  </div>
                  <div>
                    <div className="text-xs font-bold text-arctic-900">
                      Chez Améyo · Boutique Vérifiée ✓
                    </div>
                    <div className="text-[10px] text-emerald-700 font-medium">
                      ● Bot Japora actif 24h/24
                    </div>
                  </div>
                </div>
                <span className="rounded-full bg-arctic-200/80 px-2.5 py-0.5 text-[10px] font-semibold text-arctic-800">
                  WhatsApp Business
                </span>
              </div>

              <div className="space-y-3">
                {/* Buyer Bubble */}
                <div className="max-w-md rounded-shape-lg rounded-tl-xs border border-arctic-200 bg-white p-3.5 text-xs text-arctic-800 shadow-xs">
                  <div className="mb-1 text-[10px] font-bold text-arctic-500">
                    Message entrant
                  </div>
                  {currentScenario.buyerMsg}
                </div>

                {/* Bot Reply Bubble */}
                <div className="ml-auto max-w-md rounded-shape-lg rounded-tr-xs border border-brand/35 bg-brand/10 p-4 text-xs text-arctic-900 shadow-xs">
                  <div className="mb-1.5 flex items-center justify-between text-[10px] font-bold text-brand-dark">
                    <span>🤖 Assistant Japora</span>
                    <span>Instantané</span>
                  </div>
                  <div className="whitespace-pre-line leading-relaxed">
                    {currentScenario.botReply}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {currentScenario.buttons.map((b) => (
                      <span
                        key={b}
                        className="rounded-full border border-arctic-300/80 bg-white px-3 py-1 text-[10px] font-bold text-arctic-900 shadow-xs"
                      >
                        {b}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-arctic-200/70 pt-3 text-[11px] text-arctic-600">
                <span>{currentScenario.statusBadge}</span>
                <Link
                  href="/start"
                  className="font-bold text-brand-dark hover:underline"
                >
                  Activer sur mon numéro →
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================
         * 5. A DAY IN THE LIFE OF A JAPORA MERCHANT
         * ============================================================ */}
        <section className="mb-20">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <span className="a-eyebrow">Une journée type</span>
            <h2 className="a-headline-lg mt-1 text-arctic-900">
              Comment Japora vous fait gagner 3 heures par jour
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                time: "07h30 · Matin",
                title: "Commandes de la nuit déjà payées",
                desc: "Pendant votre sommeil, le bot a répondu aux clients nocturnes. Vous vous réveillez avec 3 commandes déjà payées par T-Money.",
              },
              {
                time: "11h00 · Au marché",
                title: "Scan QR code au stand & Statut WhatsApp",
                desc: "Vous publiez une carte produit sur votre Statut WhatsApp en 1 clic. Au stand, les clients scannent votre QR code pour voir toutes les tailles.",
              },
              {
                time: "15h00 · Livraisons",
                title: "Suivi Kanban & Zones de livraison",
                desc: "Votre livreur récupère les colis avec l'adresse exacte et les frais de quartier (Lomé Centre, Agoè…) déjà réglés.",
              },
              {
                time: "18h00 · Bilan du soir",
                title: "Résumé automatique sur WhatsApp",
                desc: "Vous recevez votre récapitulatif de 18h : ventes du jour, produit phare et alerte sur les articles à réapprovisionner.",
              },
            ].map((slot) => (
              <div
                key={slot.time}
                className="glass glass-edge flex flex-col justify-between rounded-shape-lg p-5"
              >
                <div>
                  <span className="inline-block rounded-full bg-brand/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-dark">
                    {slot.time}
                  </span>
                  <h3 className="mt-3 font-display text-sm font-bold text-arctic-900">
                    {slot.title}
                  </h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-arctic-600">
                    {slot.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ============================================================
         * 6. OFFLINE-TO-ONLINE BRIDGE & SOCIAL SHARE KIT
         * ============================================================ */}
        <section className="mb-20 grid gap-6 md:grid-cols-2">
          <div className="glass glass-edge rounded-shape-xl p-6 sm:p-8">
            <span className="a-eyebrow">Pont Physique → Digital</span>
            <h3 className="mt-2 font-display text-xl font-bold text-arctic-900">
              Affiche QR Code pour votre boutique ou étal de marché
            </h3>
            <p className="mt-2 text-xs sm:text-sm leading-relaxed text-arctic-700">
              Depuis vos paramètres (<code>/dashboard/settings</code>), téléchargez et imprimez votre affiche QR code officielle. Même lorsque votre stand est bondé ou fermé, les clients scannent le code, parcourent vos articles et s&apos;abonnent (🔔 Follow) pour recevoir vos prochains arrivages.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-arctic-800">
              <span className="rounded-md bg-white/80 px-2.5 py-1 border border-arctic-300/60">
                ✓ Format SVG haute définition
              </span>
              <span className="rounded-md bg-white/80 px-2.5 py-1 border border-arctic-300/60">
                ✓ Bouton « 🔔 Suivre la boutique »
              </span>
            </div>
          </div>

          <div className="glass glass-edge rounded-shape-xl p-6 sm:p-8">
            <span className="a-eyebrow">Kit Réseaux Sociaux</span>
            <h3 className="mt-2 font-display text-xl font-bold text-arctic-900">
              Visuels Statut WhatsApp, Instagram &amp; TikTok générés automatiquement
            </h3>
            <p className="mt-2 text-xs sm:text-sm leading-relaxed text-arctic-700">
              Chaque produit de votre catalogue dispose d&apos;un générateur de visuels promotionnels avec prix, badge de disponibilité et légende prête à copier. Postez sur votre Statut WhatsApp en quelques secondes et suivez quelle campagne génère le plus de ventes.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-arctic-800">
              <span className="rounded-md bg-white/80 px-2.5 py-1 border border-arctic-300/60">
                ✓ Attribution des ventes par campagne
              </span>
              <span className="rounded-md bg-white/80 px-2.5 py-1 border border-arctic-300/60">
                ✓ Relance des paniers abandonnés
              </span>
            </div>
          </div>
        </section>

        {/* ============================================================
         * 7. CLOSING CTA
         * ============================================================ */}
        <section className="mb-20 text-center">
          <div className="glass glass-edge mx-auto max-w-3xl rounded-shape-xl p-8 sm:p-12 shadow-elev-2">
            <span className="a-eyebrow">Lancez-vous aujourd&apos;hui</span>
            <h2 className="a-headline-lg mt-2 font-display text-arctic-900">
              Votre commerce, géré avec sérénité.
            </h2>
            <p className="a-body-md mx-auto mt-2 max-w-lg text-arctic-700">
              Démarrez gratuitement — gardez 97% lorsque vous encaissez en ligne. Aucun frais mensuel.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href="/start" className="a-btn a-btn--cafe a-btn--lg font-bold">
                Ouvrir ma boutique gratuitement →
              </Link>
              <Link href="/pricing" className="btn-ghost a-btn--lg">
                Voir les tarifs détaillés
              </Link>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}

/* Small line-art step glyphs (gold), consistent with the Lumière icon set. */
function StepIcon({ name }: { name: Step["icon"] }) {
  const paths: Record<Step["icon"], string> = {
    shop: "M4 9l1-4h14l1 4M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9M4 9h16M9 20v-6h6v6",
    tag: "M3 7v5l9 9 6-6-9-9H4a1 1 0 0 0-1 1zM7.5 7.5h.01",
    share: "M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13",
    chat: "M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.8-.8L3 21l1.9-4.2A8.4 8.4 0 0 1 3 11.5 8.5 8.5 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5z",
    wallet: "M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2M3 7v10a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-2M3 7v3m18 5h-4a2 2 0 1 1 0-4h4v4z",
    moon: "M20 14.5A8 8 0 1 1 9.5 4 6.2 6.2 0 0 0 20 14.5z",
  };
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5 shrink-0 text-brand-dark"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={paths[name]} />
    </svg>
  );
}
