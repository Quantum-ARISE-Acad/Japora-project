"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";
import { usePublicLang } from "@/components/PublicLanguageProvider";
import OrderFlowDiagram from "@/components/landing/OrderFlowDiagram";
import { SaasIcon, type SaasIconName } from "@/components/ui/SaasIcons";

/**
 * "How Japora works" — bilingual (FR / EN) animated, scroll-driven explainer
 * with interactive WhatsApp Bot & Flow simulator, daily vendor timeline, and
 * offline-to-online QR showcase.
 */

type StepIconName = "shop" | "tag" | "share" | "chat" | "wallet" | "moon";

export default function HowToUseClient() {
  const root = useRef<HTMLDivElement>(null);
  const { tr } = usePublicLang();
  const [activeScenario, setActiveScenario] = useState(0);

  const steps = [
    {
      n: "01",
      title: tr(
        "Ouvrez votre boutique marchande Japora",
        "Open your Japora merchant shop"
      ),
      subtitle: tr(
        "Configuration immédiate avec Google ou votre adresse email",
        "Instant setup with Google or your email address"
      ),
      icon: "shop" as StepIconName,
    },
    {
      n: "02",
      title: tr(
        "Ajoutez vos produits ou importez-les en 1 clic",
        "Add your products or import in 1 click"
      ),
      subtitle: tr(
        "Photos compressées automatiquement pour la 2G/3G",
        "Photos automatically compressed for 2G/3G networks"
      ),
      icon: "tag" as StepIconName,
    },
    {
      n: "03",
      title: tr(
        "Partagez un lien unique et votre QR code de stand",
        "Share one link and your printable stall QR code"
      ),
      subtitle: tr(
        "Statut WhatsApp, TikTok, Instagram et stand physique",
        "WhatsApp Status, TikTok, Instagram, and physical stall"
      ),
      icon: "share" as StepIconName,
    },
    {
      n: "04",
      title: tr(
        "Le Bot WhatsApp répond aux clients jour et nuit",
        "The WhatsApp Bot replies day and night"
      ),
      subtitle: tr(
        "Fini de répéter « C'est combien ? » 50 fois par jour",
        "Stop repeating 'How much?' 50 times a day"
      ),
      icon: "chat" as StepIconName,
    },
    {
      n: "05",
      title: tr(
        "Vos clients paient directement dans la conversation",
        "Customers pay inline inside the chat"
      ),
      subtitle: tr(
        "T-Money, Flooz, Celtiis, MoMo & carte bancaire",
        "T-Money, Flooz, Celtiis, MoMo & bank card"
      ),
      icon: "wallet" as StepIconName,
    },
    {
      n: "06",
      title: tr(
        "Suivez vos ventes et recevez votre bilan quotidien à 18h",
        "Track your sales and read your 6 PM daily summary"
      ),
      subtitle: tr(
        "Votre journée résumée en un coup d'œil sur WhatsApp",
        "Your entire day distilled into one WhatsApp message"
      ),
      icon: "moon" as StepIconName,
    },
  ];

  const simulatorScenarios: {
    id: string;
    icon: SaasIconName;
    label: string;
    buyerMsg: string;
    botReply: string;
    buttons: { icon: SaasIconName; text: string }[];
    statusBadge: string;
  }[] = [
    {
      id: "price",
      icon: "message",
      label: tr(
        "Demande de prix (« C'est combien ? »)",
        "Price check ('How much is this?')"
      ),
      buyerMsg: tr(
        "Bonjour ! C'est combien le Sac Bogolan Cuir et vous livrez à Agoè ?",
        "Hello! How much is the Bogolan Leather Bag and do you deliver to Agoè?"
      ),
      botReply: tr(
        "Bonjour ! Le Sac Bogolan Cuir est à 15 000 FCFA (En stock : 6 pièces).\n\nLivraison vers Agoè : 1 500 FCFA.\nTotal avec livraison : 16 500 FCFA.",
        "Hello! The Bogolan Leather Bag is 15,000 XOF (In stock: 6 left).\n\nDelivery to Agoè: 1,500 XOF.\nTotal with delivery: 16,500 XOF."
      ),
      buttons: [
        { icon: "cart", text: tr("Commander maintenant", "Order now") },
        { icon: "catalog", text: tr("Voir tout le catalogue", "View full catalog") },
        { icon: "message", text: tr("Parler au vendeur", "Talk to seller") },
      ],
      statusBadge: tr(
        "Réponse automatique en 0.8s",
        "Automated reply in 0.8s"
      ),
    },
    {
      id: "order",
      icon: "wallet",
      label: tr(
        "Paiement T-Money / Flooz en direct",
        "Inline T-Money / Flooz Payment"
      ),
      buyerMsg: tr(
        "Je prends 1 Sac Bogolan Cuir avec livraison à Agoè. Je paie par T-Money.",
        "I'll take 1 Bogolan Leather Bag with delivery to Agoè. Paying via T-Money."
      ),
      botReply: tr(
        "Parfait ! Votre commande #JP-4092 (16 500 FCFA) est enregistrée.\n\nSélectionnez le bouton ci-dessous pour valider votre paiement T-Money / Flooz en toute sécurité :",
        "Awesome! Your order #JP-4092 (16,500 XOF) is created.\n\nSelect the button below to complete your T-Money / Flooz payment securely:"
      ),
      buttons: [
        {
          icon: "smartphone",
          text: tr("Payer 16 500 FCFA (T-Money / Flooz)", "Pay 16,500 XOF (T-Money / Flooz)"),
        },
        { icon: "catalog", text: tr("Voir le récapitulatif", "View order summary") },
      ],
      statusBadge: tr(
        "Statut : Payé confirmé automatiquement",
        "Status: Paid confirmed automatically"
      ),
    },
    {
      id: "summary",
      icon: "moon",
      label: tr(
        "Bilan du soir à 18h00 (Côté Vendeur)",
        "6 PM Daily Summary (Merchant View)"
      ),
      buyerMsg: tr(
        "[Notification automatique Japora — 18h00]",
        "[Automated Japora Notification — 6:00 PM]"
      ),
      botReply: tr(
        "Bilan du jour — Chez Améyo\n• Commandes payées : 11 commandes\n• Chiffre d'affaires : 134 500 FCFA\n• Top vente : Robe Bazin Brodé (5x)\n• Alerte stock bas : Sandales Cuir (reste 2)",
        "Daily Hustle Summary — Chez Améyo\n• Paid orders: 11 orders\n• Revenue: 134,500 XOF\n• Top seller: Embroidered Bazin Dress (5x)\n• Low stock alert: Leather Sandals (2 left)"
      ),
      buttons: [
        { icon: "chart", text: tr("Ouvrir le tableau de bord", "Open dashboard") },
        { icon: "package", text: tr("Réapprovisionner le stock", "Restock items") },
      ],
      statusBadge: tr(
        "Envoyé chaque soir à 18h00",
        "Sent every evening at 6:00 PM"
      ),
    },
  ];

  useEffect(() => {
    const el = root.current;
    if (!el) return;

    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const heroes = el.querySelectorAll<HTMLElement>("[data-hero]");
    const stepNodes = el.querySelectorAll<HTMLElement>("[data-step]");
    const line = el.querySelector<SVGPathElement>("[data-ledger-line]");
    const counter = el.querySelector<HTMLElement>("[data-count]");

    const revealAll = () => {
      [...heroes, ...stepNodes].forEach((n) => {
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
        stepNodes.forEach((s) => io.observe(s));

        safety = window.setTimeout(() => {
          stepNodes.forEach((s) => revealStep(s as HTMLElement));
        }, 1600);
      })
      .catch(revealAll);

    return () => {
      cancelled = true;
      if (safety) window.clearTimeout(safety);
    };
  }, []);

  const currentScenario = simulatorScenarios[activeScenario];

  return (
    <div ref={root} className="min-h-screen flex flex-col">
      <PublicHeader />

      <main className="mx-auto max-w-6xl flex-1 px-4">
        {/* ============================================================
         * 1. HERO SECTION
         * ============================================================ */}
        <section className="py-14 text-center sm:py-20">
          <div data-hero style={{ opacity: 0 }} className="a-eyebrow">
            {tr("Guide Complet · Comment ça marche", "Complete Guide · How Japora Works")}
          </div>
          <h1
            data-hero
            style={{ opacity: 0 }}
            className="a-display-sm mx-auto mt-3 max-w-3xl text-arctic-900 sm:a-display-md"
          >
            {tr(
              "De « C'est combien ? » jusqu'au paiement — sans quitter WhatsApp.",
              "From “how much?” to paid — without leaving WhatsApp."
            )}
          </h1>
          <p
            data-hero
            style={{ opacity: 0 }}
            className="a-body-lg mx-auto mt-4 max-w-2xl text-arctic-700"
          >
            {tr(
              "Six étapes simples, de l'ouverture de votre boutique en ligne jusqu'au suivi de vos ventes et au bilan de 18h.",
              "Six simple steps, from opening your online storefront to tracking your sales and reading your 6 PM daily summary."
            )}
          </p>
          <div
            data-hero
            style={{ opacity: 0 }}
            className="mt-7 flex flex-wrap justify-center gap-3"
          >
            <Link href="/signup" className="a-btn a-btn--cafe a-btn--lg font-bold">
              <span>
                {tr(
                  "Créer ma boutique gratuitement",
                  "Create my free shop"
                )}
              </span>
              <SaasIcon name="arrow-right" size={16} />
            </Link>
            <Link href="/marketplace" className="btn-ghost a-btn--lg">
              {tr("Explorer le Marketplace", "Explore the Marketplace")}
            </Link>
          </div>
        </section>

        {/* ============================================================
         * 2. THE 6 STEPS WITH GOLD LEDGER SPINE
         * ============================================================ */}
        <section className="mx-auto mb-12 max-w-5xl" data-reveal-group>
          <OrderFlowDiagram />
        </section>

        <section className="relative mx-auto max-w-4xl pb-12">
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
            {steps.map((s) => (
              <li key={s.n} data-step className="relative">
                <article className="flex items-start gap-4 sm:gap-6">
                  <div
                    data-rise
                    style={{ opacity: 0 }}
                    className="relative z-10 grid h-14 w-14 shrink-0 place-items-center rounded-full border border-brand/45 bg-arctic-50 font-display text-lg font-bold text-brand-dark shadow-elev-1"
                  >
                    <span className="a-num">{s.n}</span>
                  </div>

                  <div className="glass glass-edge flex-1 rounded-shape-xl p-6 sm:p-7">
                    {/* Title leads. The card used to open with a phase pill
                        and a subtitle, so the first thing read was metadata,
                        and at 375px the display-size title then wrapped to
                        four lines under them. */}
                    <div
                      data-rise
                      style={{ opacity: 0 }}
                      className="flex items-start gap-2.5"
                    >
                      <StepIcon name={s.icon} />
                      <h2 className="font-display text-base font-bold leading-snug text-arctic-900 sm:text-xl">
                        {s.title}
                      </h2>
                    </div>

                    <p
                      data-rise
                      style={{ opacity: 0 }}
                      className="mt-2 text-xs text-arctic-700"
                    >
                      {s.subtitle}
                    </p>

                  </div>
                </article>
              </li>
            ))}
          </ol>
        </section>

        {/* ============================================================
         * 3. LEDGER METRIC COUNTER — 24/7 Automation
         * ============================================================ */}
        <section className="mb-20 mt-4">
          <div className="glass glass-edge mx-auto max-w-xl rounded-shape-xl p-8 text-center shadow-elev-2">
            <div className="a-eyebrow">
              {tr("Disponibilité de votre vitrine", "Storefront & Bot Uptime")}
            </div>
            <div className="mt-2 flex items-end justify-center gap-1.5">
              <span
                data-count="24"
                className="a-num font-display text-6xl font-bold leading-none text-arctic-900"
              >
                24
              </span>
              <span className="a-num pb-1 font-display text-2xl font-bold text-brand-dark">
                {tr("heures / 24", "hours / 7")}
              </span>
            </div>
            <div className="mx-auto mt-4 h-px max-w-[14rem]">
              <hr className="a-rule-gold" />
            </div>
            <p className="a-body-md mt-3 text-arctic-700">
              {tr(
                "Votre catalogue en ligne et votre assistant WhatsApp répondent aux clients, encaissent par Mobile Money et suivent vos commandes sans interruption.",
                "Your online catalog and WhatsApp assistant reply to buyers, collect Mobile Money payments, and track orders around the clock."
              )}
            </p>
          </div>
        </section>

        {/* ============================================================
         * 4. INTERACTIVE WHATSAPP BOT & FLOW SIMULATOR
         * ============================================================ */}
        <section className="mb-20 rounded-shape-xl border border-arctic-300/60 bg-white/85 p-6 shadow-elev-2 backdrop-blur-md sm:p-10">
          <div className="mx-auto max-w-2xl text-center">
            <span className="a-eyebrow">
              {tr("Démonstration Interactive", "Interactive Demo")}
            </span>
            <h2 className="a-headline-lg mt-1 text-arctic-900">
              {tr(
                "Voyez comment le Bot WhatsApp gère vos clients en direct",
                "See how the WhatsApp Bot handles your customers live"
              )}
            </h2>
            <p className="mt-2 text-xs text-arctic-600 sm:text-sm">
              {tr(
                "Sélectionnez un scénario ci-dessous pour visualiser la conversation telle qu'elle se déroule sur WhatsApp.",
                "Select a scenario below to preview the conversation right inside WhatsApp."
              )}
            </p>
          </div>

          <div className="mt-8 grid items-center gap-8 lg:grid-cols-[1fr,1.25fr]">
            <div className="space-y-3">
              {simulatorScenarios.map((scen, idx) => {
                const isSelected = activeScenario === idx;
                return (
                  <button
                    key={scen.id}
                    type="button"
                    onClick={() => setActiveScenario(idx)}
                    className={`w-full rounded-shape-lg border p-4 text-left transition-all ${
                      isSelected
                        ? "border-arctic-900 bg-arctic-900 text-arctic-50 shadow-elev-1"
                        : "border-arctic-300/70 bg-white/80 text-arctic-900 hover:border-brand"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-2 text-xs font-bold">
                        <SaasIcon
                          name={scen.icon}
                          size={15}
                          className={isSelected ? "text-amber-300 dark:text-gold-fill" : "text-brand-dark"}
                        />
                        <span>{scen.label}</span>
                      </span>
                      <SaasIcon
                        name="arrow-right"
                        size={14}
                        className={isSelected ? "text-gold-bright dark:text-gold-fill" : "text-arctic-400"}
                      />
                    </div>
                    <p
                      className={`mt-1.5 text-[11px] ${
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
                  {tr("Astuce Vendeur :", "Merchant Tip:")}
                </strong>{" "}
                {tr(
                  "Depuis votre tableau de bord (/dashboard/bot), vous disposez d'un simulateur complet pour tester les réponses de votre propre boutique.",
                  "From your dashboard (/dashboard/bot), you get a full simulator to test your own shop's automated replies."
                )}
              </div>
            </div>

            <div className="glass glass-edge rounded-shape-xl p-6 shadow-elev-2">
              <div className="mb-4 flex items-center justify-between border-b border-arctic-200/70 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-emerald-700 text-xs font-bold text-white">
                    WA
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-arctic-900">
                      <span>Chez Améyo</span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1 text-emerald-800">
                        <SaasIcon name="shield-check" size={13} />
                        {tr("Boutique Vérifiée", "Verified Shop")}
                      </span>
                    </div>
                    <div className="text-[10px] font-medium text-emerald-700">
                      {tr("● Bot Japora actif 24h/24", "● Japora Bot active 24/7")}
                    </div>
                  </div>
                </div>
                <span className="rounded-full bg-arctic-200/80 px-2.5 py-0.5 text-[10px] font-semibold text-arctic-800">
                  WhatsApp Business
                </span>
              </div>

              <div className="space-y-3">
                <div className="max-w-md rounded-shape-lg rounded-tl-xs border border-arctic-200 bg-white p-3.5 text-xs text-arctic-800 shadow-xs">
                  <div className="mb-1 text-[10px] font-bold text-arctic-500">
                    {tr("Message entrant", "Incoming message")}
                  </div>
                  {currentScenario.buyerMsg}
                </div>

                <div className="ml-auto max-w-md rounded-shape-lg rounded-tr-xs border border-brand/35 bg-brand/10 p-4 text-xs text-arctic-900 shadow-xs">
                  <div className="mb-1.5 flex items-center justify-between text-[10px] font-bold text-brand-dark">
                    <span className="inline-flex items-center gap-1.5">
                      <SaasIcon name="bot" size={13} />
                      <span>{tr("Assistant Japora", "Japora assistant")}</span>
                    </span>
                    <span>{tr("Instantané", "Instant")}</span>
                  </div>
                  <div className="whitespace-pre-line leading-relaxed">
                    {currentScenario.botReply}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {currentScenario.buttons.map((b) => (
                      <span
                        key={b.text}
                        className="inline-flex items-center gap-1.5 rounded-full border border-arctic-300/80 bg-white px-3 py-1 text-[10px] font-bold text-arctic-900 shadow-xs"
                      >
                        <SaasIcon name={b.icon} size={12} className="text-brand-dark" />
                        <span>{b.text}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-arctic-200/70 pt-3 text-[11px] text-arctic-600">
                <span>{currentScenario.statusBadge}</span>
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-1 font-bold text-brand-dark hover:underline"
                >
                  <span>
                    {tr("Activer sur ma boutique", "Activate on my shop")}
                  </span>
                  <SaasIcon name="arrow-right" size={12} />
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
            <span className="a-eyebrow">
              {tr("Une journée type", "A Day in the Life")}
            </span>
            <h2 className="a-headline-lg mt-1 text-arctic-900">
              {tr(
                "Comment Japora vous fait gagner 3 heures par jour",
                "How Japora saves you 3 hours every single day"
              )}
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                time: tr("07h30 · Matin", "07:30 AM · Morning"),
                title: tr(
                  "Commandes de la nuit déjà payées",
                  "Overnight orders already paid"
                ),
                desc: tr(
                  "Pendant votre sommeil, le bot a répondu aux clients nocturnes. Vous vous réveillez avec 3 commandes déjà payées par T-Money.",
                  "While you slept, the bot answered night shoppers. You wake up to 3 orders already paid via T-Money."
                ),
              },
              {
                time: tr("11h00 · Au marché", "11:00 AM · At the Stall"),
                title: tr(
                  "Scan QR code au stand & Statut WhatsApp",
                  "Stall QR scans & WhatsApp Status"
                ),
                desc: tr(
                  "Vous publiez une carte produit sur votre Statut WhatsApp en 1 clic. Au stand, les clients scannent votre QR code pour voir toutes les tailles.",
                  "You post a product card to your WhatsApp Status in 1 tap. At your stall, buyers scan your QR poster to browse all sizes."
                ),
              },
              {
                time: tr("15h00 · Livraisons", "03:00 PM · Deliveries"),
                title: tr(
                  "Suivi Kanban & Zones de livraison",
                  "Kanban tracking & Delivery zones"
                ),
                desc: tr(
                  "Votre livreur récupère les colis avec l'adresse exacte et les frais de quartier (Lomé Centre, Agoè…) déjà réglés.",
                  "Your rider picks up parcels with the exact neighborhood address and delivery fees already settled."
                ),
              },
              {
                time: tr("18h00 · Bilan du soir", "06:00 PM · Evening Recap"),
                title: tr(
                  "Résumé automatique sur WhatsApp",
                  "Automated WhatsApp summary"
                ),
                desc: tr(
                  "Vous recevez votre récapitulatif de 18h : ventes du jour, produit phare et alerte sur les articles à réapprovisionner.",
                  "You get your 6 PM recap on WhatsApp: daily revenue, top seller, and alerts on items to restock."
                ),
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
            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-shape-md border border-brand/30 bg-brand/10 text-brand-dark">
              <SaasIcon name="qr" size={20} />
            </div>
            <div className="a-eyebrow">
              {tr("Pont Physique → Digital", "Offline → Online Bridge")}
            </div>
            <h3 className="mt-2 font-display text-xl font-bold text-arctic-900">
              {tr("Une affiche QR pour votre étal", "A QR poster for your stall")}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-arctic-700">
              {tr(
                "Le passant scanne, votre catalogue s'ouvre. Même stand fermé.",
                "A passer-by scans, your catalog opens. Even with the stall shut."
              )}
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-arctic-800">
              <span className="inline-flex items-center gap-1.5 rounded-md border border-arctic-300/60 bg-white/80 px-2.5 py-1">
                <SaasIcon name="check" size={13} className="text-brand-dark" />
                <span>
                  {tr("Format SVG haute définition", "High-res printable SVG")}
                </span>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-md border border-arctic-300/60 bg-white/80 px-2.5 py-1">
                <SaasIcon name="bell" size={13} className="text-brand-dark" />
                <span>
                  {tr("Bouton « Suivre la boutique »", "'Follow shop' opt-in")}
                </span>
              </span>
            </div>
          </div>

          <div className="glass glass-edge rounded-shape-xl p-6 sm:p-8">
            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-shape-md border border-brand/30 bg-brand/10 text-brand-dark">
              <SaasIcon name="smartphone" size={20} />
            </div>
            <div className="a-eyebrow">
              {tr("Kit Réseaux Sociaux", "Social Share Kit")}
            </div>
            <h3 className="mt-2 font-display text-xl font-bold text-arctic-900">
              {tr("Des visuels prêts à poster", "Posts, ready to share")}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-arctic-700">
              {tr(
                "Chaque produit, avec son prix et sa légende. Pour le Statut, IG, TikTok.",
                "Every product, with its price and caption. For Status, IG, TikTok."
              )}
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-arctic-800">
              <span className="inline-flex items-center gap-1.5 rounded-md border border-arctic-300/60 bg-white/80 px-2.5 py-1">
                <SaasIcon name="check" size={13} className="text-brand-dark" />
                <span>
                  {tr(
                    "Attribution des ventes par campagne",
                    "Campaign sales attribution"
                  )}
                </span>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-md border border-arctic-300/60 bg-white/80 px-2.5 py-1">
                <SaasIcon name="check" size={13} className="text-brand-dark" />
                <span>
                  {tr(
                    "Relance des paniers abandonnés",
                    "Abandoned cart recovery"
                  )}
                </span>
              </span>
            </div>
          </div>
        </section>

        {/* ============================================================
         * 7. CLOSING CTA
         * ============================================================ */}
        <section className="mb-20 text-center">
          <div className="glass glass-edge mx-auto max-w-3xl rounded-shape-xl p-8 shadow-elev-2 sm:p-12">
            <span className="a-eyebrow">
              {tr("Lancez-vous aujourd'hui", "Get started today")}
            </span>
            <h2 className="a-headline-lg mt-2 font-display text-arctic-900">
              {tr(
                "Vendez en ligne et sur WhatsApp, suivez vos ventes en toute sérénité.",
                "Sell online and on WhatsApp, track your sales with peace of mind."
              )}
            </h2>
            <p className="a-body-md mx-auto mt-2 max-w-lg text-arctic-700">
              {tr(
                "Créez votre boutique gratuitement — aucune carte bancaire requise.",
                "Open your shop for free — no credit card required."
              )}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href="/signup" className="a-btn a-btn--cafe a-btn--lg font-bold">
                <span>
                  {tr(
                    "Ouvrir ma boutique gratuitement",
                    "Open my free shop now"
                  )}
                </span>
                <SaasIcon name="arrow-right" size={16} />
              </Link>
              <Link href="/marketplace" className="btn-ghost a-btn--lg">
                {tr("Explorer le Marketplace", "Explore the Marketplace")}
              </Link>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}

function StepIcon({ name }: { name: StepIconName }) {
  const paths: Record<StepIconName, string> = {
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
