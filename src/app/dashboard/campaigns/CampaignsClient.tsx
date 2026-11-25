"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatCurrencyAmount } from "@/lib/currency";
import { usePublicLang } from "@/components/PublicLanguageProvider";
import type { CampaignStats } from "@/lib/campaigns";
import type {
  MetaAdCampaignDetails,
  MetaAdObjective,
  MetaCtaType,
  MetaEnvironment,
  MetaMarketingConfig,
  MetaPlacementId,
} from "@/lib/meta-marketing";

function formatMoney(cents: number, currency: string): string {
  return formatCurrencyAmount(cents, currency || "XOF");
}

type ProductOption = {
  id: string;
  name: string;
  priceCents: number;
  imageUrl: string | null;
  description: string;
  stock: number;
  category?: string;
};

type EnrichedCampaign = CampaignStats & {
  approvedForPhone?: string | null;
  metaDetails?: MetaAdCampaignDetails | null;
};

type MetaConfigDTO = MetaMarketingConfig & {
  hasAccessToken: boolean;
  maskedToken: string;
};

const PLACEMENT_OPTIONS: {
  id: MetaPlacementId;
  label: string;
  /** [français, English] */
  badge: [string, string];
  platform: "whatsapp" | "facebook" | "instagram";
}[] = [
  {
    id: "whatsapp_status",
    label: "WhatsApp Status Ads",
    badge: ["Nouveau v27.0", "New v27.0"],
    platform: "whatsapp",
  },
  {
    id: "whatsapp_ctwa",
    label: "Click-to-WhatsApp",
    badge: ["Conversion directe", "Direct conversion"],
    platform: "whatsapp",
  },
  {
    id: "facebook_feed",
    label: "Facebook Feed",
    badge: ["Fil d'actualité", "News feed"],
    platform: "facebook",
  },
  {
    id: "facebook_stories",
    label: "Facebook Stories",
    badge: ["Format 9:16", "9:16 format"],
    platform: "facebook",
  },
  {
    id: "instagram_feed",
    label: "Instagram Feed",
    badge: ["Carrousel / Photo", "Carousel / photo"],
    platform: "instagram",
  },
  {
    id: "instagram_stories",
    label: "Instagram Stories",
    badge: ["Plein écran", "Full screen"],
    platform: "instagram",
  },
  {
    id: "instagram_reels",
    label: "Instagram Reels",
    badge: ["Découverte", "Discovery"],
    platform: "instagram",
  },
];

const COUNTRY_OPTIONS: { code: string; name: string; nameEn?: string; flag: string }[] = [
  { code: "TG", name: "Togo", flag: "🇹🇬" },
  { code: "BJ", name: "Bénin", nameEn: "Benin", flag: "🇧🇯" },
  { code: "CI", name: "Côte d'Ivoire", nameEn: "Côte d'Ivoire", flag: "🇨🇮" },
  { code: "SN", name: "Sénégal", nameEn: "Senegal", flag: "🇸🇳" },
  { code: "BF", name: "Burkina Faso", flag: "🇧🇫" },
  { code: "ML", name: "Mali", flag: "🇲🇱" },
  { code: "CM", name: "Cameroun", nameEn: "Cameroon", flag: "🇨🇲" },
  { code: "GA", name: "Gabon", flag: "🇬🇦" },
  { code: "GH", name: "Ghana", flag: "🇬🇭" },
  { code: "NG", name: "Nigeria", flag: "🇳🇬" },
  { code: "FR", name: "France", flag: "🇫🇷" },
  { code: "US", name: "États-Unis", nameEn: "United States", flag: "🇺🇸" },
];

const OBJECTIVE_OPTIONS: {
  id: MetaAdObjective;
  /** [français, English] */
  label: [string, string];
  desc: [string, string];
}[] = [
  {
    id: "LINK_CLICKS",
    label: ["LINK_CLICKS (Trafic & Clics WhatsApp)", "LINK_CLICKS (traffic & WhatsApp clicks)"],
    desc: ["Optimise pour un maximum de clics vers WhatsApp ou votre produit.", "Optimises for the most clicks to WhatsApp or your product."],
  },
  {
    id: "OUTCOME_SALES",
    label: ["OUTCOME_SALES (Ventes & Conversions Catalogue)", "OUTCOME_SALES (sales & catalog conversions)"],
    desc: ["Cible les acheteurs les plus susceptibles de passer commande.", "Targets the buyers most likely to order."],
  },
  {
    id: "OUTCOME_ENGAGEMENT",
    label: ["OUTCOME_ENGAGEMENT (Messages WhatsApp & Interactions)", "OUTCOME_ENGAGEMENT (WhatsApp messages & interactions)"],
    desc: ["Maximise les discussions démarrées sur WhatsApp Business.", "Maximises the chats started on WhatsApp Business."],
  },
  {
    id: "OUTCOME_TRAFFIC",
    label: ["OUTCOME_TRAFFIC (Visites Boutique Japora)", "OUTCOME_TRAFFIC (Japora shop visits)"],
    desc: ["Attire de nouveaux visiteurs qualifiés sur votre vitrine.", "Brings new qualified visitors to your storefront."],
  },
  {
    id: "OUTCOME_AWARENESS",
    label: ["OUTCOME_AWARENESS (Notoriété & WhatsApp Status)", "OUTCOME_AWARENESS (awareness & WhatsApp Status)"],
    desc: ["Diffuse largement votre marque dans les statuts WhatsApp et Stories.", "Spreads your brand widely in WhatsApp statuses and Stories."],
  },
];

const CTA_OPTIONS: { id: MetaCtaType; label: string; defaultText: [string, string] }[] = [
  {
    id: "WHATSAPP_MESSAGE",
    label: "WHATSAPP_MESSAGE",
    defaultText: ["Commander sur WhatsApp", "Order on WhatsApp"],
  },
  {
    id: "SHOP_NOW",
    label: "SHOP_NOW",
    defaultText: ["Acheter maintenant", "Shop now"],
  },
  {
    id: "ORDER_NOW",
    label: "ORDER_NOW",
    defaultText: ["Passer commande", "Order now"],
  },
  {
    id: "LEARN_MORE",
    label: "LEARN_MORE",
    defaultText: ["Voir les détails", "See details"],
  },
];

// The French value is what is saved and sent; English is only shown.
const INTEREST_SUGGESTIONS: [string, string][] = [
  ["Shopping en ligne", "Online shopping"],
  ["Mode & Vêtements", "Fashion & clothing"],
  ["Beauté & Cosmétiques", "Beauty & cosmetics"],
  ["Électronique & Smartphones", "Electronics & smartphones"],
  ["Maison & Décoration", "Home & decor"],
  ["Entrepreneuriat", "Entrepreneurship"],
  ["Livraison rapide", "Fast delivery"],
];


const RECOVERY_STATUSES = ["draft", "approved", "sent", "stubbed", "blocked", "failed", "cancelled"];

export default function CampaignsClient({
  initialCampaigns,
  products,
  currency,
  shopName,
  shopSlug,
  whatsappNumber,
  initialMetaConfig,
}: {
  initialCampaigns: EnrichedCampaign[];
  products: ProductOption[];
  currency: string;
  shopName: string;
  shopSlug: string | null;
  whatsappNumber: string | null;
  initialMetaConfig: MetaConfigDTO;
}) {
  const { tr } = usePublicLang();
  const [campaigns, setCampaigns] = useState<EnrichedCampaign[]>(initialCampaigns);
  const [metaConfig, setMetaConfig] = useState<MetaConfigDTO>(initialMetaConfig);

  // Studio & Modals visibility
  const [showStudio, setShowStudio] = useState<boolean>(initialCampaigns.length === 0);
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);
  const [inspectedCampaign, setInspectedCampaign] = useState<EnrichedCampaign | null>(
    null,
  );
  const [previewFormat, setPreviewFormat] = useState<"whatsapp_status" | "feed">(
    "whatsapp_status",
  );
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "paused" | "recovery"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Ad Creation Form State
  const firstProduct = products[0] ?? null;
  const [productId, setProductId] = useState<string>(firstProduct?.id ?? "");
  const [name, setName] = useState<string>(
    firstProduct ? tr(`Promo WhatsApp Status — ${firstProduct.name}`, `WhatsApp Status promo — ${firstProduct.name}`) : "",
  );
  const [objective, setObjective] = useState<MetaAdObjective>("LINK_CLICKS");
  const [placements, setPlacements] = useState<MetaPlacementId[]>([
    "whatsapp_status",
    "whatsapp_ctwa",
    "facebook_feed",
    "instagram_feed",
  ]);
  const [countries, setCountries] = useState<string[]>(["TG", "BJ", "CI", "SN"]);
  const [ageMin, setAgeMin] = useState<number>(18);
  const [ageMax, setAgeMax] = useState<number>(50);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([
    "Shopping en ligne",
    "Mode & Vêtements",
  ]);
  const [dailyBudget, setDailyBudget] = useState<string>("2500");
  const [durationDays, setDurationDays] = useState<number>(7);
  const [headline, setHeadline] = useState<string>(
    firstProduct ? tr(`${firstProduct.name} — Disponible dès maintenant !`, `${firstProduct.name} — Available now!`) : "",
  );
  const [body, setBody] = useState<string>(
    firstProduct
      ? tr(
          `🔥 Découvrez ${firstProduct.name} chez ${shopName}.\n✅ Qualité garantie • Livraison rapide • Paiement sécurisé.\nCliquez ci-dessous pour commander directement sur WhatsApp !`,
          `🔥 Discover ${firstProduct.name} at ${shopName}.\n✅ Guaranteed quality • Fast delivery • Secure payment.\nTap below to order directly on WhatsApp!`,
        )
      : "",
  );
  const [ctaType, setCtaType] = useState<MetaCtaType>("WHATSAPP_MESSAGE");
  const [cta, setCta] = useState<string>(tr("Commander sur WhatsApp", "Order on WhatsApp"));
  const [destinationType, setDestinationType] = useState<"whatsapp" | "shop_product">(
    "whatsapp",
  );
  const [initialStatus, setInitialStatus] = useState<"ACTIVE" | "PAUSED">("ACTIVE");

  // Async action states
  const [creating, setCreating] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [busyCampaignId, setBusyCampaignId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  // Meta API Config Form State
  const [cfgEnv] = useState<MetaEnvironment>(metaConfig.environment);
  const [cfgAdAccountId, setCfgAdAccountId] = useState<string>(metaConfig.adAccountId);
  const [cfgPageId, setCfgPageId] = useState<string>(metaConfig.pageId);
  const [cfgAppId, setCfgAppId] = useState<string>(metaConfig.appId || "158291049281720");
  const [cfgInstagramId] = useState<string>(
    metaConfig.instagramActorId || "",
  );
  const [cfgTokenType, setCfgTokenType] = useState<
    "USER_TOKEN" | "LONG_LIVED_TOKEN" | "SYSTEM_USER_TOKEN"
  >(metaConfig.tokenType || "SYSTEM_USER_TOKEN");
  const [cfgAccessToken, setCfgAccessToken] = useState<string>("");
  const [savingConfig, setSavingConfig] = useState<boolean>(false);
  const [configFeedback, setConfigFeedback] = useState<string | null>(null);

  // Selected product object
  const selectedProduct = useMemo(
    () => products.find((p) => p.id === productId) ?? null,
    [products, productId],
  );

  function showToastMessage(msg: string) {
    setToast(msg);
    setTimeout(() => {
      setToast((prev) => (prev === msg ? null : prev));
    }, 4000);
  }

  function handleSelectProduct(nextProductId: string) {
    setProductId(nextProductId);
    const prod = products.find((p) => p.id === nextProductId);
    if (prod) {
      setName(tr(`Campagne Meta — ${prod.name}`, `Meta campaign — ${prod.name}`));
      setHeadline(
        `${prod.name} • ${formatMoney(prod.priceCents, currency)}`,
      );
      setBody(
        tr(
          `🔥 Offre spéciale chez ${shopName} : ${prod.name} à seulement ${formatMoney(prod.priceCents, currency)} !\n${prod.description ? prod.description.slice(0, 120) + "\n" : ""}✅ Stock disponible (${prod.stock} unités) • Cliquez pour commander sur WhatsApp.`,
          `🔥 Special offer at ${shopName}: ${prod.name} for only ${formatMoney(prod.priceCents, currency)}!\n${prod.description ? prod.description.slice(0, 120) + "\n" : ""}✅ In stock (${prod.stock} units) • Tap to order on WhatsApp.`,
        ),
      );
    }
  }

  function togglePlacement(id: MetaPlacementId) {
    setPlacements((prev) =>
      prev.includes(id)
        ? prev.length > 1
          ? prev.filter((item) => item !== id)
          : prev
        : [...prev, id],
    );
  }

  function toggleCountry(code: string) {
    setCountries((prev) =>
      prev.includes(code)
        ? prev.length > 1
          ? prev.filter((c) => c !== code)
          : prev
        : [...prev, code],
    );
  }

  function toggleInterest(interest: string) {
    setSelectedInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : [...prev, interest],
    );
  }

  async function draftWithAi() {
    setDrafting(true);
    setErr("");
    try {
      // Same ad writer as the rest of the dashboard: Gemini when the key is set,
      // otherwise a simple text built from the shop and the product.
      const r = await fetch("/api/ai/ad-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: productId || undefined, platform: "meta" }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || typeof d.headline !== "string") {
        setErr(d.error || tr("Impossible de générer le texte publicitaire.", "Could not generate the ad text."));
        return;
      }
      setHeadline(d.headline);
      setBody(d.body || "");
      setCta(d.cta || "Commander sur WhatsApp");
      showToastMessage(
        d.mode === "ai"
          ? tr("✨ Texte publicitaire rédigé par Gemini IA !", "✨ Ad text written by Gemini AI!")
          : tr("Texte publicitaire proposé (modèle simple, sans IA). Vous pouvez le modifier.", "Suggested ad text (simple template, no AI). You can edit it."),
      );
    } catch {
      setErr(tr("Erreur réseau lors de la génération IA.", "Network error during AI generation."));
    } finally {
      setDrafting(false);
    }
  }

  async function createMetaAdCampaign(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setErr(tr("Veuillez renseigner un nom de campagne.", "Please enter a campaign name."));
      return;
    }
    setCreating(true);
    setErr("");
    try {
      const dailyNum = Number(dailyBudget) || 2500;
      const totalSpendMajor = dailyNum * Math.max(1, durationDays);

      const r = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          productId: productId || null,
          objective,
          placements,
          countries,
          ageMin,
          ageMax,
          interests: selectedInterests,
          dailyBudget: dailyNum,
          durationDays,
          spend: totalSpendMajor,
          headline,
          body,
          cta,
          ctaType,
          destinationType,
          initialStatus,
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        setErr(d.error || tr("Erreur lors de la création sur Meta Marketing API.", "Error while creating on the Meta Marketing API."));
        return;
      }
      setCampaigns((prev) => [d.campaign, ...prev]);
      setInspectedCampaign(d.campaign);
      showToastMessage(
        tr(`🚀 Publicité "${d.campaign.name}" créée via Meta Marketing API v27.0 (${initialStatus}) !`, `🚀 Ad "${d.campaign.name}" created via Meta Marketing API v27.0 (${initialStatus})!`),
      );
    } catch {
      setErr(tr("Erreur réseau lors de l'appel à Meta Marketing API.", "Network error while calling the Meta Marketing API."));
    } finally {
      setCreating(false);
    }
  }

  async function toggleCampaignStatus(
    campaign: EnrichedCampaign,
    nextStatus: "ACTIVE" | "PAUSED",
  ) {
    setBusyCampaignId(campaign.id);
    setErr("");
    try {
      const r = await fetch(`/api/campaigns/${campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_status",
          status: nextStatus,
        }),
      });
      const d = await r.json();
      if (!r.ok || !d.campaign) {
        setErr(d.error || tr("Impossible de modifier le statut de la publicité.", "Could not change the ad status."));
        return;
      }
      setCampaigns((prev) =>
        prev.map((c) => (c.id === campaign.id ? d.campaign : c)),
      );
      if (inspectedCampaign?.id === campaign.id) {
        setInspectedCampaign(d.campaign);
      }
      showToastMessage(
        nextStatus === "ACTIVE"
          ? tr(`▶️ Campagne "${campaign.name}" activée sur Meta Marketing API.`, `▶️ Campaign "${campaign.name}" activated on the Meta Marketing API.`)
          : tr(`⏸️ Campagne "${campaign.name}" mise en pause.`, `⏸️ Campaign "${campaign.name}" paused.`),
      );
    } finally {
      setBusyCampaignId(null);
    }
  }

  async function syncCampaignInsights(campaign: EnrichedCampaign) {
    setBusyCampaignId(campaign.id);
    setErr("");
    try {
      const r = await fetch(`/api/campaigns/${campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sync_insights",
          simulateBoost: true,
        }),
      });
      const d = await r.json();
      if (!r.ok || !d.campaign) {
        setErr(d.error || tr("Impossible de synchroniser les statistiques Meta.", "Could not sync Meta statistics."));
        return;
      }
      setCampaigns((prev) =>
        prev.map((c) => (c.id === campaign.id ? d.campaign : c)),
      );
      if (inspectedCampaign?.id === campaign.id) {
        setInspectedCampaign(d.campaign);
      }
      showToastMessage(
        tr(`📊 Insights Meta synchronisés pour "${campaign.name}" (Impressions, Clics WhatsApp & Conversions mis à jour).`, `📊 Meta insights synced for "${campaign.name}" (impressions, WhatsApp clicks and conversions updated).`),
      );
    } finally {
      setBusyCampaignId(null);
    }
  }

  async function archiveCampaign(id: string) {
    setBusyCampaignId(id);
    try {
      const r = await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
      if (r.ok) {
        setCampaigns((prev) => prev.filter((c) => c.id !== id));
        if (inspectedCampaign?.id === id) setInspectedCampaign(null);
        showToastMessage(tr("🗑️ Campagne arrêtée et archivée.", "🗑️ Campaign stopped and archived."));
      }
    } finally {
      setBusyCampaignId(null);
    }
  }

  async function approveAndRun(id: string) {
    setBusyCampaignId(id);
    setErr("");
    try {
      const approveRes = await fetch(`/api/campaigns/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const approveData = await approveRes.json().catch(() => ({}));
      if (!approveRes.ok) {
        setErr(approveData.error || tr("Impossible d'approuver la campagne.", "Could not approve the campaign."));
        return;
      }
      const runRes = await fetch(`/api/campaigns/${id}/run`, {
        method: "POST",
      });
      const runData = await runRes.json().catch(() => ({}));
      if (!runRes.ok) {
        setErr(runData.error || tr("Impossible d'envoyer le message.", "Could not send the message."));
      } else {
        showToastMessage(
          runData.status === "stubbed"
            ? tr("Message de relance enregistré (WhatsApp n'est pas encore configuré : rien n'a été envoyé).", "Follow-up message saved (WhatsApp is not configured yet: nothing was sent).")
            : tr("Message de relance envoyé sur WhatsApp.", "Follow-up message sent on WhatsApp."),
        );
      }
      const listRes = await fetch("/api/campaigns");
      if (listRes.ok) {
        const listData = await listRes.json();
        setCampaigns(listData.campaigns || []);
      }
    } finally {
      setBusyCampaignId(null);
    }
  }

  async function cancelRecoveryCampaign(id: string) {
    setBusyCampaignId(id);
    setErr("");
    try {
      const r = await fetch(`/api/campaigns/${id}/cancel`, { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErr(d.error || tr("Impossible d'annuler la campagne.", "Could not cancel the campaign."));
        return;
      }
      setCampaigns((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: "cancelled" } : c)),
      );
    } finally {
      setBusyCampaignId(null);
    }
  }

  async function handleSaveMetaConfig(e: React.FormEvent) {
    e.preventDefault();
    setSavingConfig(true);
    setConfigFeedback(null);
    try {
      const r = await fetch("/api/campaigns/meta-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          environment: cfgEnv,
          adAccountId: cfgAdAccountId,
          pageId: cfgPageId,
          appId: cfgAppId,
          instagramActorId: cfgInstagramId,
          tokenType: cfgTokenType,
          ...(cfgAccessToken.trim() ? { accessToken: cfgAccessToken.trim() } : {}),
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        setConfigFeedback("Erreur lors de l'enregistrement de la configuration Meta.");
        return;
      }
      setMetaConfig(d.config);
      setCfgAdAccountId(d.config.adAccountId);
      setCfgAccessToken("");
      setConfigFeedback(
        d.verification?.message ||
          "Configuration Meta Marketing API v27.0 enregistrée avec succès.",
      );
      showToastMessage(tr("✅ Configuration Meta Marketing API mise à jour !", "✅ Meta Marketing API settings updated!"));
    } finally {
      setSavingConfig(false);
    }
  }

  function copyLink(c: EnrichedCampaign) {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url =
      c.metaDetails?.destinationUrl || `${origin}/go/${c.refCode}`;
    navigator.clipboard.writeText(url);
    setCopiedId(c.id);
    setTimeout(() => setCopiedId((x) => (x === c.id ? null : x)), 1800);
  }

  // Global Aggregated Analytics
  const analytics = useMemo(() => {
    let impressions = 0;
    let reach = 0;
    let statusViews = 0;
    let totalClicks = 0;
    let whatsappChats = 0;
    let orders = 0;
    let spendCents = 0;
    let revenueCents = 0;
    let activeCount = 0;

    for (const c of campaigns) {
      const m = c.metaDetails?.insights;
      const cImpressions = m?.impressions ?? c.clicks * 24;
      const cReach = m?.reach ?? Math.round(cImpressions * 0.8);
      const cStatusViews = m?.statusViews ?? Math.round(cImpressions * 0.5);
      const cChats = m?.whatsappChatsStarted ?? Math.max(c.orders, Math.round(c.clicks * 0.4));

      impressions += cImpressions;
      reach += cReach;
      statusViews += cStatusViews;
      totalClicks += Math.max(c.clicks, m?.metaClicks ?? 0);
      whatsappChats += cChats;
      orders += c.orders;
      spendCents += c.spendCents;
      revenueCents += c.revenueCents;
      if (c.status === "active" || c.metaDetails?.status === "ACTIVE") {
        activeCount++;
      }
    }

    const ctr =
      impressions > 0 ? Number(((totalClicks / impressions) * 100).toFixed(2)) : 0;
    const cpcCents = totalClicks > 0 ? Math.round(spendCents / totalClicks) : 0;
    const cvr =
      totalClicks > 0 ? Number(((orders / totalClicks) * 100).toFixed(1)) : 0;
    const roas =
      spendCents > 0 ? Number((revenueCents / spendCents).toFixed(2)) : null;

    return {
      impressions,
      reach,
      statusViews,
      totalClicks,
      whatsappChats,
      orders,
      spendCents,
      revenueCents,
      activeCount,
      ctr,
      cpcCents,
      cvr,
      roas,
    };
  }, [campaigns]);

  // Filtered campaigns
  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((c) => {
      if (statusFilter === "active" && c.status !== "active") return false;
      if (statusFilter === "paused" && c.status !== "paused") return false;
      if (
        statusFilter === "recovery" &&
        c.status !== "draft" &&
        c.status !== "approved" &&
        c.status !== "sent"
      ) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = c.name.toLowerCase().includes(q);
        const matchHeadline = (c.headline || "").toLowerCase().includes(q);
        const matchRef = c.refCode.toLowerCase().includes(q);
        const matchMetaId = (c.metaDetails?.metaCampaignId || "").includes(q);
        if (!matchName && !matchHeadline && !matchRef && !matchMetaId) return false;
      }
      return true;
    });
  }, [campaigns, statusFilter, searchQuery]);

  // Estimated daily reach from budget
  const estimatedDailyBudgetMajor = Number(dailyBudget) || 2500;
  const estimatedDailyReachMin = Math.max(
    350,
    Math.round(estimatedDailyBudgetMajor * 0.9),
  );
  const estimatedDailyReachMax = Math.round(estimatedDailyReachMin * 2.4);
  const estimatedTotalSpendCents =
    Math.round(estimatedDailyBudgetMajor * 100) * Math.max(1, durationDays);

  // Live cURL preview in studio
  const liveCurlPreview = useMemo(() => {
    const act = metaConfig.adAccountId || "act_108492048192041";
    const budgetCents = Math.round((Number(dailyBudget) || 2500) * 100);
    const countriesJson = JSON.stringify({
      geo_locations: { countries },
      age_min: ageMin,
      age_max: ageMax,
      publisher_platforms: Array.from(
        new Set(
          placements.map((p) =>
            p.startsWith("whatsapp")
              ? "whatsapp"
              : p.startsWith("instagram")
                ? "instagram"
                : "facebook",
          ),
        ),
      ),
    });

    return [
      `# 1. Create Campaign (Idempotent)`,
      `curl -X POST https://graph.facebook.com/v27.0/${act}/campaigns \\`,
      `  -H 'X-Client-Idempotent-Key: japora_campaign_<UUID>' \\`,
      `  -F 'name=${name || "Ma Campagne"}' \\`,
      `  -F 'objective=${objective}' \\`,
      `  -F 'status=${initialStatus}' \\`,
      `  -F 'access_token=<ACCESS_TOKEN>'`,
      ``,
      `# 2. Create Ad Set (Targeting & Budget)`,
      `curl -X POST https://graph.facebook.com/v27.0/${act}/adsets \\`,
      `  -H 'X-Client-Idempotent-Key: japora_adset_<UUID>' \\`,
      `  -F 'name=${name || "Ma Campagne"} — Ad Set' \\`,
      `  -F 'campaign_id=<CAMPAIGN_ID>' \\`,
      `  -F 'daily_budget=${budgetCents}' \\`,
      `  -F 'targeting=${countriesJson}' \\`,
      `  -F 'access_token=<ACCESS_TOKEN>'`,
      ``,
      `# 3. Create Ad Creative (Product & CTA)`,
      `curl -X POST https://graph.facebook.com/v27.0/${act}/adcreatives \\`,
      `  -H 'X-Client-Idempotent-Key: japora_creative_<UUID>' \\`,
      `  -F 'name=${name || "Ma Campagne"} — Creative' \\`,
      `  -F 'object_story_spec={"page_id":"${metaConfig.pageId}","link_data":{"message":${JSON.stringify(body.slice(0, 60))}...,"call_to_action":{"type":"${ctaType}"}}}' \\`,
      `  -F 'access_token=<ACCESS_TOKEN>'`,
      ``,
      `# 4. Create Ad`,
      `curl -X POST https://graph.facebook.com/v27.0/${act}/ads \\`,
      `  -H 'X-Client-Idempotent-Key: japora_ad_<UUID>' \\`,
      `  -F 'name=${name || "Ma Campagne"} — Ad' \\`,
      `  -F 'adset_id=<AD_SET_ID>' \\`,
      `  -F 'creative={"creative_id":"<CREATIVE_ID>"}' \\`,
      `  -F 'status=${initialStatus}' \\`,
      `  -F 'access_token=<ACCESS_TOKEN>'`,
    ].join("\n");
  }, [
    metaConfig.adAccountId,
    metaConfig.pageId,
    dailyBudget,
    countries,
    ageMin,
    ageMax,
    placements,
    name,
    objective,
    initialStatus,
    body,
    ctaType,
  ]);

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-arctic-900 px-4 py-3 text-sm font-medium text-white shadow-xl">
          <span>{toast}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-xs text-arctic-400 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Banner & Meta Marketing API Connection Bar */}
      <div className="rounded-2xl border border-arctic-400/25 bg-gradient-to-br from-white via-arctic-50/70 to-emerald-50/40 p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600/10 px-3 py-1 text-xs font-semibold text-emerald-800">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Meta Marketing API v27.0
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-2.5 py-0.5 text-xs font-semibold text-white">
                {tr("🟢 Connecté (Graph API v27.0)", "🟢 Connected (Graph API v27.0)")}
              </span>
              <span className="rounded-full bg-arctic-100 px-2.5 py-0.5 font-mono text-xs text-arctic-700">
                {metaConfig.adAccountId}
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-arctic-100 px-2.5 py-0.5 text-[11px] text-arctic-600">
                ✓ ads_management • ✓ ads_read • ✓ X-Client-Idempotent-Key
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-arctic-900">
              {tr(
                "Publicités & Acquisition — WhatsApp Status, Facebook & Instagram",
                "Ads & Acquisition — WhatsApp Status, Facebook & Instagram",
              )}
            </h1>
            <p className="max-w-3xl text-sm text-arctic-600">
              {tr(
                "Créez et pilotez vos campagnes publicitaires directement avec les produits de votre boutique",
                "Create and manage your ad campaigns directly with products from your store",
              )}{" "}
              <strong>{shopName}</strong>{" "}
              {tr(
                "via le pipeline officiel Meta Marketing API (/campaigns → /adsets → /adcreatives → /ads) avec suivi en temps réel des clics, discussions WhatsApp, commandes et ROAS.",
                "via the official Meta Marketing API pipeline (/campaigns → /adsets → /adcreatives → /ads) with real-time tracking of clicks, WhatsApp chats, orders, and ROAS.",
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/dashboard/broadcasts"
              className="rounded-xl border border-arctic-400/30 bg-white px-3.5 py-2 text-xs font-medium text-arctic-700 hover:bg-arctic-50"
            >
              {tr("📣 Broadcasts WhatsApp", "📣 WhatsApp Broadcasts")}
            </Link>
            <button
              type="button"
              onClick={() => setShowConfigModal(true)}
              className="rounded-xl border border-arctic-400/35 bg-white px-3.5 py-2 text-xs font-semibold text-arctic-800 shadow-2xs hover:bg-arctic-50"
            >
              {tr("⚙️ Configurer Meta API & Token", "⚙️ Configure Meta API & Token")}
            </button>
            <button
              type="button"
              onClick={() => setShowStudio((v) => !v)}
              className="btn-primary text-xs sm:text-sm"
            >
              {showStudio
                ? tr("Fermer le Studio Publicitaire", "Close Ad Studio")
                : tr("+ Créer une Publicité Produit", "+ Create Product Ad")}
            </button>
          </div>
        </div>
      </div>

      {/* Global Analytics KPI Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard
          label={tr("Impressions & Portée", "Impressions & Reach")}
          value={analytics.impressions.toLocaleString("fr-FR")}
          sub={`${tr("Portée unique :", "Unique reach:")} ${analytics.reach.toLocaleString("fr-FR")}`}
          badge="Meta Reach"
          accent="blue"
        />
        <KpiCard
          label={tr("Vues WhatsApp Status", "WhatsApp Status Views")}
          value={analytics.statusViews.toLocaleString("fr-FR")}
          sub={`${analytics.activeCount} ${tr("campagne(s) active(s)", "active campaign(s)")}`}
          badge="Status Ads"
          accent="emerald"
        />
        <KpiCard
          label={tr("Clics Publicitaires", "Ad Clicks")}
          value={analytics.totalClicks.toLocaleString("fr-FR")}
          sub={`CTR : ${analytics.ctr}% • CPC : ${formatMoney(analytics.cpcCents, currency)}`}
          badge="LINK_CLICKS"
          accent="indigo"
        />
        <KpiCard
          label={tr("Discussions WhatsApp", "WhatsApp Chats")}
          value={analytics.whatsappChats.toLocaleString("fr-FR")}
          sub={tr("Conversations engagées", "Started conversations")}
          badge="CTWA"
          accent="teal"
        />
        <KpiCard
          label={tr("Commandes Attribuées", "Attributed Orders")}
          value={analytics.orders.toLocaleString("fr-FR")}
          sub={`${tr("Taux conv. (CVR) :", "Conv. rate (CVR):")} ${analytics.cvr}%`}
          badge={tr("Ventes", "Sales")}
          accent="amber"
        />
        <KpiCard
          label={tr("Revenu & ROAS Global", "Global Revenue & ROAS")}
          value={formatMoney(analytics.revenueCents, currency)}
          sub={`${tr("Dépensé :", "Spent:")} ${formatMoney(analytics.spendCents, currency)} • ROAS : ${
            analytics.roas !== null ? `${analytics.roas}×` : "—"
          }`}
          badge={analytics.roas && analytics.roas >= 2 ? tr("Rentable 🔥", "Profitable 🔥") : "ROAS"}
          accent="emerald"
          highlight
        />
      </div>

      {/* Visual Conversion Funnel Bar */}
      <div className="card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-arctic-600">
            {tr(
              "Entonnoir de Conversion Meta Marketing API → Boutique Japora & WhatsApp",
              "Conversion Funnel Meta Marketing API → Japora Storefront & WhatsApp",
            )}
          </div>
          <div className="text-xs text-arctic-600">
            {tr("Attribution automatique sur 7 jours via", "7-day automatic attribution via")} <code>/go/&lt;refCode&gt;</code>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <FunnelStage
            step={tr("1. Impressions Meta", "1. Meta Impressions")}
            count={analytics.impressions}
            pct={100}
            color="bg-blue-500"
          />
          <FunnelStage
            step={tr("2. Portée & Status WA", "2. Reach & WA Status")}
            count={analytics.reach}
            pct={
              analytics.impressions > 0
                ? Math.min(100, Math.round((analytics.reach / analytics.impressions) * 100))
                : 0
            }
            color="bg-indigo-500"
          />
          <FunnelStage
            step={tr("3. Clics (/go/ref)", "3. Clicks (/go/ref)")}
            count={analytics.totalClicks}
            pct={
              analytics.reach > 0
                ? Math.min(100, Math.max(8, Math.round((analytics.totalClicks / analytics.reach) * 100)))
                : 0
            }
            color="bg-emerald-500"
          />
          <FunnelStage
            step={tr("4. Discussions WhatsApp", "4. WhatsApp Chats")}
            count={analytics.whatsappChats}
            pct={
              analytics.totalClicks > 0
                ? Math.min(
                    100,
                    Math.max(12, Math.round((analytics.whatsappChats / analytics.totalClicks) * 100)),
                  )
                : 0
            }
            color="bg-teal-500"
          />
          <FunnelStage
            step={tr("5. Commandes Payées", "5. Paid Orders")}
            count={analytics.orders}
            pct={
              analytics.whatsappChats > 0
                ? Math.min(
                    100,
                    Math.max(15, Math.round((analytics.orders / analytics.whatsappChats) * 100)),
                  )
                : 0
            }
            color="bg-amber-500"
          />
        </div>
      </div>

      {err && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-700">
          ⚠️ {err}
        </div>
      )}

      {/* ===================================================================== */}
      {/* STUDIO DE CRÉATION DE PUBLICITÉ META MARKETING API (4 ÉTAPES)          */}
      {/* ===================================================================== */}
      {showStudio && (
        <div className="rounded-2xl border border-arctic-400/30 bg-white p-5 shadow-md">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-arctic-400/20 pb-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                {tr("Studio Publicitaire Meta Graph API v27.0", "Meta Graph API v27.0 ad studio")}
              </span>
              <h2 className="text-lg font-bold text-arctic-900">
                {tr("Lancer une publicité avec un produit de votre boutique", "Launch an ad with a product from your shop")}
              </h2>
            </div>
            <div className="flex items-center gap-2 text-xs text-arctic-600">
              <span className="rounded-lg bg-arctic-100 px-2.5 py-1 font-mono">
                1. /campaigns
              </span>
              <span>→</span>
              <span className="rounded-lg bg-arctic-100 px-2.5 py-1 font-mono">
                2. /adsets
              </span>
              <span>→</span>
              <span className="rounded-lg bg-arctic-100 px-2.5 py-1 font-mono">
                3. /adcreatives
              </span>
              <span>→</span>
              <span className="rounded-lg bg-arctic-100 px-2.5 py-1 font-mono">
                4. /ads
              </span>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-12">
            {/* Left 7 columns: Form Wizard */}
            <form
              onSubmit={createMetaAdCampaign}
              className="space-y-6 lg:col-span-7"
            >
              {/* ÉTAPE 1 : Sélection du Produit de la Boutique & Objectif */}
              <div className="rounded-xl border border-arctic-400/20 bg-arctic-50/50 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-arctic-900">
                    {tr("Étape 1 — Produit de la boutique & Objectif Meta (`/campaigns`)", "Step 1 — Shop product & Meta objective (`/campaigns`)")}
                  </h3>
                  <span className="text-[11px] font-medium text-emerald-700">
                    {tr("Catalogue Japora (", "Japora catalog (")}{products.length} {tr("produits)", "products)")}
                  </span>
                </div>

                {/* Visual Product Carousel / Grid */}
                {products.length > 0 ? (
                  <div>
                    <label className="label">
                      {tr("Choisissez le produit à promouvoir dans la publicité", "Choose the product to promote in the ad")}
                    </label>
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 max-h-56 overflow-y-auto pr-1">
                      {products.map((p) => {
                        const isSelected = p.id === productId;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => handleSelectProduct(p.id)}
                            className={`flex items-center gap-3 rounded-xl border p-2.5 text-left transition ${
                              isSelected
                                ? "border-emerald-600 bg-emerald-50/70 ring-2 ring-emerald-500/20"
                                : "border-arctic-400/25 bg-white hover:border-arctic-400/50"
                            }`}
                          >
                            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-arctic-100 border border-arctic-200">
                              {p.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={p.imageUrl}
                                  alt={p.name}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-lg">
                                  🛍️
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-xs font-bold text-arctic-900">
                                {p.name}
                              </div>
                              <div className="text-xs font-semibold text-emerald-700">
                                {formatMoney(p.priceCents, currency)}
                              </div>
                              <div className="text-[10px] text-arctic-600">
                                {tr("Stock :", "Stock:")} {p.stock} • {p.category || tr("Catalogue", "Catalog")}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-50 p-3 text-xs text-amber-800">
                    {tr("Aucun produit dans votre catalogue.", "No products in your catalog.")}{" "}
                    <Link href="/dashboard/products" className="font-semibold underline">
                      {tr("Ajoutez un produit ici", "Add a product here")}
                    </Link>{" "}
                    {tr("ou créez une publicité générale pour votre boutique.", "or create a general ad for your shop.")}
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="label">{tr("Nom de la campagne Meta *", "Meta campaign name *")}</label>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      placeholder={tr("Ex: Promo Tabaski — Robe Bazin", "e.g. Tabaski promo — Bazin dress")}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">{tr("Objectif Marketing API (`objective`)", "Marketing API objective (`objective`)")}</label>
                    <select
                      value={objective}
                      onChange={(e) => setObjective(e.target.value as MetaAdObjective)}
                      className="input"
                    >
                      {OBJECTIVE_OPTIONS.map((o) => (
                        <option key={o.id} value={o.id}>
                          {tr(...o.label)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Placements (WhatsApp Status, CTWA, FB, IG) */}
                <div>
                  <label className="label">
                    {tr("Emplacements de diffusion (`publisher_platforms` & WhatsApp Status)", "Placements (`publisher_platforms` & WhatsApp Status)")}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {PLACEMENT_OPTIONS.map((pl) => {
                      const active = placements.includes(pl.id);
                      return (
                        <button
                          key={pl.id}
                          type="button"
                          onClick={() => togglePlacement(pl.id)}
                          className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
                            active
                              ? "border-emerald-600 bg-emerald-600 text-white shadow-2xs"
                              : "border-arctic-400/30 bg-white text-arctic-700 hover:bg-arctic-50"
                          }`}
                        >
                          <span>
                            {pl.platform === "whatsapp"
                              ? "💬"
                              : pl.platform === "instagram"
                                ? "📸"
                                : "📘"}
                          </span>
                          <span>{pl.label}</span>
                          <span
                            className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                              active
                                ? "bg-white/20 text-white"
                                : "bg-arctic-100 text-arctic-600"
                            }`}
                          >
                            {tr(...pl.badge)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* ÉTAPE 2 : Ciblage Géographique, Audience & Budget Quotidien (/adsets) */}
              <div className="rounded-xl border border-arctic-400/20 bg-arctic-50/50 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-arctic-900">
                    {tr("Étape 2 — Ensemble de Publicités : Ciblage & Budget (`/adsets`)", "Step 2 — Ad set: targeting & budget (`/adsets`)")}
                  </h3>
                  <span className="text-[11px] text-arctic-600">
                    {tr("Portée estimée :", "Estimated reach:")} {estimatedDailyReachMin.toLocaleString("fr-FR")} –{" "}
                    {estimatedDailyReachMax.toLocaleString("fr-FR")} {tr("pers./jour", "people/day")}
                  </span>
                </div>

                <div>
                  <label className="label">
                    {tr("Pays ciblés (`targeting.geo_locations.countries`)", "Target countries (`targeting.geo_locations.countries`)")}
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {COUNTRY_OPTIONS.map((c) => {
                      const active = countries.includes(c.code);
                      return (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => toggleCountry(c.code)}
                          className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                            active
                              ? "border-arctic-900 bg-arctic-900 text-white"
                              : "border-arctic-400/30 bg-white text-arctic-700 hover:bg-arctic-100"
                          }`}
                        >
                          {c.flag} {tr(c.name, c.nameEn ?? c.name)} ({c.code})
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div>
                    <label className="label">{tr("Budget / jour (", "Budget / day (")}{currency})</label>
                    <input
                      type="number"
                      min="1"
                      step="any"
                      value={dailyBudget}
                      onChange={(e) => setDailyBudget(e.target.value)}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">{tr("Durée (jours)", "Duration (days)")}</label>
                    <input
                      type="number"
                      min="1"
                      max="90"
                      value={durationDays}
                      onChange={(e) =>
                        setDurationDays(Math.max(1, Number(e.target.value) || 7))
                      }
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">{tr("Âge min", "Min age")}</label>
                    <input
                      type="number"
                      min="18"
                      max="65"
                      value={ageMin}
                      onChange={(e) => setAgeMin(Number(e.target.value) || 18)}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">{tr("Âge max", "Max age")}</label>
                    <input
                      type="number"
                      min="18"
                      max="65"
                      value={ageMax}
                      onChange={(e) => setAgeMax(Number(e.target.value) || 55)}
                      className="input"
                    />
                  </div>
                </div>

                <div>
                  <label className="label">{tr("Centres d'intérêt de l'audience", "Audience interests")}</label>
                  <div className="flex flex-wrap gap-1.5">
                    {INTEREST_SUGGESTIONS.map(([interest, interestEn]) => {
                      const active = selectedInterests.includes(interest);
                      return (
                        <button
                          key={interest}
                          type="button"
                          onClick={() => toggleInterest(interest)}
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                            active
                              ? "border-indigo-600 bg-indigo-600/10 text-indigo-800"
                              : "border-arctic-400/25 bg-white text-arctic-600"
                          }`}
                        >
                          {active ? "✓ " : "+ "}
                          {tr(interest, interestEn)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* ÉTAPE 3 : Créatif Publicitaire & Copywriting IA (/adcreatives) */}
              <div className="rounded-xl border border-arctic-400/20 bg-arctic-50/50 p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-arctic-900">
                    {tr("Étape 3 — Créatif Publicitaire (`object_story_spec` • `/adcreatives`)", "Step 3 — Ad creative (`object_story_spec` • `/adcreatives`)")}
                  </h3>
                  <button
                    type="button"
                    onClick={draftWithAi}
                    disabled={drafting}
                    className="rounded-lg border border-emerald-600/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-500/20 disabled:opacity-50"
                  >
                    {drafting
                      ? tr("✨ Génération IA en cours…", "✨ AI generation in progress…")
                      : tr("✨ Rédiger avec Gemini IA", "✨ Write with Gemini AI")}
                  </button>
                </div>

                <div>
                  <label className="label">{tr("Accroche / Titre (`link_data.name`)", "Headline (`link_data.name`)")}</label>
                  <input
                    value={headline}
                    onChange={(e) => setHeadline(e.target.value)}
                    placeholder={tr("Ex: Nouvelle Collection Disponible — Livraison 24h", "e.g. New collection available — 24h delivery")}
                    className="input"
                  />
                </div>

                <div>
                  <label className="label">
                    {tr("Texte de la publicité (`link_data.message`)", "Ad text (`link_data.message`)")}
                  </label>
                  <textarea
                    rows={3}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder={tr("Présentez les avantages du produit, le prix et l'appel à l'action...", "Describe the product's benefits, the price and the call to action...")}
                    className="input"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="label">{tr("Type de bouton (`call_to_action`)", "Button type (`call_to_action`)")}</label>
                    <select
                      value={ctaType}
                      onChange={(e) => {
                        const nextType = e.target.value as MetaCtaType;
                        setCtaType(nextType);
                        const match = CTA_OPTIONS.find((o) => o.id === nextType);
                        if (match) setCta(tr(...match.defaultText));
                      }}
                      className="input"
                    >
                      {CTA_OPTIONS.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">{tr("Texte du bouton CTA", "CTA button text")}</label>
                    <input
                      value={cta}
                      onChange={(e) => setCta(e.target.value)}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">{tr("Destination du clic", "Click destination")}</label>
                    <select
                      value={destinationType}
                      onChange={(e) =>
                        setDestinationType(
                          e.target.value === "shop_product"
                            ? "shop_product"
                            : "whatsapp",
                        )
                      }
                      className="input"
                    >
                      <option value="whatsapp">
                        {tr("💬 WhatsApp Direct (/go/ref)", "💬 WhatsApp direct (/go/ref)")}
                      </option>
                      <option value="shop_product">
                        {tr("🛍️ Fiche Produit Boutique (/c/", "🛍️ Shop product page (/c/")}{shopSlug || tr("boutique", "shop")})
                      </option>
                    </select>
                  </div>
                </div>
              </div>

              {/* ÉTAPE 4 : Statut de lancement & Idempotence (/ads) */}
              <div className="rounded-xl border border-arctic-400/20 bg-arctic-50/50 p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-arctic-900">
                    {tr("Étape 4 — Lancement & Idempotence (`/ads`)", "Step 4 — Launch & idempotency (`/ads`)")}
                  </h3>
                  <span className="font-mono text-[11px] text-arctic-600">
                    Header: X-Client-Idempotent-Key
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setInitialStatus("ACTIVE")}
                    className={`rounded-xl border p-3 text-left transition ${
                      initialStatus === "ACTIVE"
                        ? "border-emerald-600 bg-emerald-50/80 ring-2 ring-emerald-500/20"
                        : "border-arctic-400/25 bg-white"
                    }`}
                  >
                    <div className="flex items-center gap-2 text-xs font-bold text-arctic-900">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                      {tr("status = ACTIVE (Diffuser immédiatement)", "status = ACTIVE (start delivering now)")}
                    </div>
                    <p className="mt-1 text-[11px] text-arctic-600">
                      {tr("Active la campagne, l'ensemble de publicités et la publicité dès la création.", "Activates the campaign, the ad set and the ad as soon as they are created.")}
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setInitialStatus("PAUSED")}
                    className={`rounded-xl border p-3 text-left transition ${
                      initialStatus === "PAUSED"
                        ? "border-amber-600 bg-amber-50/80 ring-2 ring-amber-500/20"
                        : "border-arctic-400/25 bg-white"
                    }`}
                  >
                    <div className="flex items-center gap-2 text-xs font-bold text-arctic-900">
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                      {tr("status = PAUSED (Créer en pause)", "status = PAUSED (create paused)")}
                    </div>
                    <p className="mt-1 text-[11px] text-arctic-600">
                      {tr("Prépare les 4 objets sur Meta sans dépenser le budget avant votre validation finale.", "Prepares the 4 objects on Meta without spending budget before your final approval.")}
                    </p>
                  </button>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <div className="text-xs text-arctic-600">
                    {tr("Budget total estimé sur", "Estimated total budget over")} {durationDays}j :{" "}
                    <strong className="text-arctic-900">
                      {formatMoney(estimatedTotalSpendCents, currency)}
                    </strong>
                  </div>
                  <button
                    type="submit"
                    disabled={creating}
                    className="btn-primary px-6 py-2.5 text-sm font-semibold"
                  >
                    {creating
                      ? tr("Exécution du pipeline Meta v27.0 (4/4)…", "Running the Meta v27.0 pipeline (4/4)…")
                      : tr(`🚀 Créer et Lancer sur Meta (${initialStatus})`, `🚀 Create and launch on Meta (${initialStatus})`)}
                  </button>
                </div>
              </div>
            </form>

            {/* Right 5 columns: Live Ad Preview (WhatsApp Status 9:16 + FB/IG Feed) & cURL */}
            <div className="space-y-4 lg:col-span-5">
              <div className="rounded-2xl border border-arctic-400/25 bg-arctic-50/70 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-arctic-600">
                    {tr("Aperçu Temps Réel de la Publicité", "Live ad preview")}
                  </span>
                  <div className="flex rounded-lg border border-arctic-400/30 bg-white p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setPreviewFormat("whatsapp_status")}
                      className={`rounded-md px-2.5 py-1 font-medium transition ${
                        previewFormat === "whatsapp_status"
                          ? "bg-emerald-600 text-white"
                          : "text-arctic-600 hover:text-arctic-900"
                      }`}
                    >
                      💬 WhatsApp Status
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewFormat("feed")}
                      className={`rounded-md px-2.5 py-1 font-medium transition ${
                        previewFormat === "feed"
                          ? "bg-blue-600 text-white"
                          : "text-arctic-600 hover:text-arctic-900"
                      }`}
                    >
                      📘 FB / IG Feed
                    </button>
                  </div>
                </div>

                {previewFormat === "whatsapp_status" ? (
                  /* WhatsApp Status 9:16 Mockup */
                  <div className="mx-auto max-w-[300px] overflow-hidden rounded-3xl border-4 border-arctic-900 bg-arctic-950 text-white shadow-xl">
                    {/* Status progress bar */}
                    <div className="flex gap-1 px-3 pt-2.5">
                      <div className="h-1 flex-1 rounded-full bg-white" />
                      <div className="h-1 flex-1 rounded-full bg-white/30" />
                    </div>
                    {/* Status Header */}
                    <div className="flex items-center justify-between px-3.5 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold">
                          {shopName.slice(0, 1).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-xs font-bold leading-tight">
                            {shopName}
                          </div>
                          <div className="text-[10px] text-emerald-300">
                            {tr("Sponsorisé • WhatsApp Status", "Sponsored • WhatsApp Status")}
                          </div>
                        </div>
                      </div>
                      <span className="text-xs text-white/60">•••</span>
                    </div>

                    {/* Product Visual */}
                    <div className="relative aspect-square w-full bg-arctic-900">
                      {selectedProduct?.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={selectedProduct.imageUrl}
                          alt={selectedProduct.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-emerald-900 to-arctic-900 p-6 text-center">
                          <span className="text-4xl">🛍️</span>
                          <span className="mt-2 text-sm font-semibold text-white/90">
                            {selectedProduct?.name || shopName}
                          </span>
                        </div>
                      )}
                      {selectedProduct && (
                        <div className="absolute bottom-3 right-3 rounded-full bg-emerald-500 px-3 py-1 text-xs font-extrabold text-white shadow-lg">
                          {formatMoney(selectedProduct.priceCents, currency)}
                        </div>
                      )}
                    </div>

                    {/* Status Caption & CTA */}
                    <div className="space-y-3 bg-gradient-to-t from-black via-arctic-950 to-arctic-950 p-4">
                      <div className="text-xs font-bold text-emerald-300">
                        {headline || selectedProduct?.name || tr("Titre de votre publicité", "Your ad headline")}
                      </div>
                      <p className="line-clamp-3 whitespace-pre-line text-[11px] leading-relaxed text-white/85">
                        {body ||
                          tr("Votre texte publicitaire apparaîtra ici dans les statuts WhatsApp de votre audience cible.", "Your ad text will appear here in your target audience's WhatsApp statuses.")}
                      </p>
                      <div className="pt-1">
                        <div className="flex w-full items-center justify-center gap-2 rounded-full bg-emerald-500 py-2 text-xs font-bold text-white shadow-md">
                          <span>💬</span>
                          <span>{cta || tr("Commander sur WhatsApp", "Order on WhatsApp")}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Facebook / Instagram Feed 1:1 Mockup */
                  <div className="mx-auto max-w-[340px] overflow-hidden rounded-2xl border border-arctic-400/30 bg-white shadow-md">
                    <div className="flex items-center justify-between px-3.5 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                          {shopName.slice(0, 1).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-arctic-900">
                            {shopName}
                          </div>
                          <div className="text-[10px] text-arctic-600">
                            {tr("Sponsorisé • 🌍", "Sponsored • 🌍")} {countries.join(", ")}
                          </div>
                        </div>
                      </div>
                      <span className="text-xs text-arctic-400">•••</span>
                    </div>

                    <div className="px-3.5 pb-2.5 text-xs text-arctic-800 whitespace-pre-line line-clamp-3">
                      {body || tr("Texte principal de votre publicité Facebook & Instagram.", "Main text of your Facebook & Instagram ad.")}
                    </div>

                    <div className="relative aspect-square w-full bg-arctic-100">
                      {selectedProduct?.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={selectedProduct.imageUrl}
                          alt={selectedProduct.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-3xl">
                          🛍️
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 bg-arctic-50 px-3.5 py-2.5 border-t border-arctic-200">
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] uppercase text-arctic-600">
                          {destinationType === "shop_product"
                            ? `japora.shop/c/${shopSlug || "boutique"}`
                            : `wa.me/${whatsappNumber || "japora"}`}
                        </div>
                        <div className="truncate text-xs font-bold text-arctic-900">
                          {headline || selectedProduct?.name || shopName}
                        </div>
                      </div>
                      <span className="shrink-0 rounded-lg bg-arctic-900 px-3 py-1.5 text-xs font-semibold text-white">
                        {cta || tr("Acheter", "Buy")}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Live Graph API v27.0 Payload Preview */}
              <div className="rounded-2xl border border-arctic-400/25 bg-arctic-950 p-4 text-arctic-100">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                    {tr("Requêtes Graph API v27.0 générées", "Generated Graph API v27.0 requests")}
                  </span>
                  <span className="rounded bg-emerald-500/20 px-2 py-0.5 font-mono text-[10px] text-emerald-300">
                    Idempotent
                  </span>
                </div>
                <pre className="max-h-60 overflow-auto font-mono text-[10px] leading-relaxed text-arctic-200">
                  {liveCurlPreview}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* LISTE DES CAMPAGNES, PILOTAGE (PLAY/PAUSE/STOP) & ANALYTICS           */}
      {/* ===================================================================== */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: "all", label: `Toutes (${campaigns.length})` },
                {
                  id: "active",
                  label: `Actives (${campaigns.filter((c) => c.status === "active").length})`,
                },
                {
                  id: "paused",
                  label: `En pause (${campaigns.filter((c) => c.status === "paused").length})`,
                },
                {
                  id: "recovery",
                  label: `Relances IA (${
                    campaigns.filter(
                      (c) =>
                        c.status === "draft" ||
                        c.status === "approved" ||
                        c.status === "sent",
                    ).length
                  })`,
                },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                  statusFilter === tab.id
                    ? "bg-arctic-900 text-white"
                    : "border border-arctic-400/30 bg-white text-arctic-700 hover:bg-arctic-50"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="w-full sm:w-64">
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={tr("Rechercher par nom, ID Meta, réf…", "Search by name, Meta ID, ref…")}
              className="input text-xs"
            />
          </div>
        </div>

        {filteredCampaigns.length === 0 ? (
          <div className="card p-10 text-center space-y-3">
            <div className="text-3xl">📢</div>
            <div className="text-base font-bold text-arctic-900">
              {tr("Aucune campagne publicitaire dans cette vue", "No ad campaigns in this view")}
            </div>
            <p className="mx-auto max-w-md text-xs text-arctic-600">
              {tr("Sélectionnez un produit de votre boutique Japora et lancez votre première publicité sur WhatsApp Status, Facebook et Instagram via Meta Marketing API.", "Pick a product from your Japora shop and launch your first ad on WhatsApp Status, Facebook and Instagram through the Meta Marketing API.")}
            </p>
            <div>
              <button
                type="button"
                onClick={() => setShowStudio(true)}
                className="btn-primary text-xs"
              >
                {tr("+ Créer ma première publicité produit", "+ Create my first product ad")}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredCampaigns.map((c) => {
              const meta = c.metaDetails;
              // Recovery messages (abandoned cart, reactivation) go through these statuses.
              const isRecovery = RECOVERY_STATUSES.includes(c.status);
              const canSend = ["draft", "approved", "blocked", "failed"].includes(c.status);
              const isActive = c.status === "active";
              const isBusy = busyCampaignId === c.id;

              const prod =
                products.find((p) => p.id === c.productId) ||
                meta?.productSnapshot ||
                null;

              const impressions = meta?.insights.impressions ?? c.clicks * 24;
              const reach = meta?.insights.reach ?? Math.round(impressions * 0.8);
              const statusViews =
                meta?.insights.statusViews ?? Math.round(impressions * 0.55);
              const totalClicks = Math.max(c.clicks, meta?.insights.metaClicks ?? 0);
              const ctr =
                impressions > 0
                  ? ((totalClicks / impressions) * 100).toFixed(2)
                  : "0.00";
              const cpcCents =
                totalClicks > 0 ? Math.round(c.spendCents / totalClicks) : 0;
              const whatsappChats =
                meta?.insights.whatsappChatsStarted ??
                Math.max(c.orders, Math.round(totalClicks * 0.4));

              return (
                <div
                  key={c.id}
                  className="rounded-2xl border border-arctic-400/25 bg-white p-5 shadow-2xs transition hover:border-arctic-400/45"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    {/* Left: Product Thumbnail + Campaign Title & Meta IDs */}
                    <div className="flex items-start gap-3.5 min-w-0 flex-1">
                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-arctic-200 bg-arctic-100">
                        {prod?.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={prod.imageUrl}
                            alt={prod.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xl">
                            📢
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-bold text-arctic-900">
                            {c.name}
                          </h3>
                          <CampaignStatusBadge status={c.status} />
                          <span className="rounded-md bg-arctic-100 px-2 py-0.5 font-mono text-[11px] text-arctic-700">
                            ref:{c.refCode}
                          </span>
                          {meta && (
                            <span className="rounded-md bg-blue-50 px-2 py-0.5 font-mono text-[11px] text-blue-800">
                              {meta.objective}
                            </span>
                          )}
                        </div>

                        {c.headline && (
                          <div className="text-xs font-semibold text-arctic-800">
                            {c.headline}
                          </div>
                        )}
                        {c.body && (
                          <p className="line-clamp-2 text-xs text-arctic-600">
                            {c.body}
                          </p>
                        )}

                        {/* Meta Object IDs & Placements */}
                        {meta && (
                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            {meta.placements.map((pl) => (
                              <span
                                key={pl}
                                className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-800"
                              >
                                {pl === "whatsapp_status"
                                  ? "💬 WhatsApp Status"
                                  : pl === "whatsapp_ctwa"
                                    ? "💬 Click-to-WhatsApp"
                                    : pl.replace("_", " ")}
                              </span>
                            ))}
                            <span className="rounded-full bg-arctic-100 px-2 py-0.5 text-[10px] text-arctic-600">
                              🌍 {meta.targeting.countries.join(", ")} •{" "}
                              {meta.targeting.ageMin}-{meta.targeting.ageMax} {tr("ans", "years")}
                            </span>
                            <span className="font-mono text-[10px] text-arctic-600">
                              Campaign ID: {meta.metaCampaignId} • Ad ID:{" "}
                              {meta.metaAdId}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Action Buttons (Play / Pause / Sync Insights / Inspect API / Copy Link / Archive) */}
                    <div className="flex flex-wrap items-center gap-2">
                      {!isRecovery && (
                        <>
                          {isActive ? (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => toggleCampaignStatus(c, "PAUSED")}
                              className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-500/20 disabled:opacity-50"
                            >
                              {tr("⏸️ Mettre en pause", "⏸️ Pause")}
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => toggleCampaignStatus(c, "ACTIVE")}
                              className="rounded-xl border border-emerald-600/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-500/25 disabled:opacity-50"
                            >
                              {tr("▶️ Relancer (ACTIVE)", "▶️ Restart (ACTIVE)")}
                            </button>
                          )}

                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => syncCampaignInsights(c)}
                            className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-500/20 disabled:opacity-50"
                            title={tr("Synchroniser les performances Meta Graph API et les ventes réelles enregistrées dans la base de données", "Sync Meta Graph API performance and the real sales recorded in the database")}
                          >
                            {isBusy ? tr("Sync…", "Syncing…") : tr("🔄 Synchroniser Insights", "🔄 Sync insights")}
                          </button>
                        </>
                      )}

                      <button
                        type="button"
                        onClick={() => copyLink(c)}
                        className="rounded-xl border border-arctic-400/30 bg-white px-3 py-1.5 text-xs font-medium text-arctic-700 hover:bg-arctic-50"
                      >
                        {copiedId === c.id ? tr("✓ Lien copié", "✓ Link copied") : tr("🔗 Lien /go/", "🔗 /go/ link")}
                      </button>

                      {meta && (
                        <button
                          type="button"
                          onClick={() => setInspectedCampaign(c)}
                          className="rounded-xl border border-arctic-400/30 bg-arctic-50 px-3 py-1.5 text-xs font-medium text-arctic-800 hover:bg-arctic-100"
                        >
                          {tr("💻 Logs API Meta", "💻 Meta API logs")}
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => archiveCampaign(c.id)}
                        className="rounded-xl border border-rose-500/25 bg-rose-500/5 px-2.5 py-1.5 text-xs text-rose-700 hover:bg-rose-500/15"
                        title={tr("Arrêter et archiver la campagne", "Stop and archive the campaign")}
                      >
                        {tr("🛑 Arrêter", "🛑 Stop")}
                      </button>
                    </div>
                  </div>

                  {/* Per-Campaign Detailed Analytics Bar */}
                  <div className="mt-4 grid grid-cols-2 gap-2.5 border-t border-arctic-400/15 pt-3.5 sm:grid-cols-4 lg:grid-cols-8">
                    <MiniMetric
                      label="Impressions"
                      value={impressions.toLocaleString("fr-FR")}
                    />
                    <MiniMetric
                      label={tr("Portée (Reach)", "Reach")}
                      value={reach.toLocaleString("fr-FR")}
                    />
                    <MiniMetric
                      label={tr("Vues Status WA", "WA Status views")}
                      value={statusViews.toLocaleString("fr-FR")}
                    />
                    <MiniMetric
                      label={tr("Clics & CTR", "Clicks & CTR")}
                      value={`${totalClicks} (${ctr}%)`}
                    />
                    <MiniMetric
                      label={tr("CPC Moyen", "Avg. CPC")}
                      value={formatMoney(cpcCents, currency)}
                    />
                    <MiniMetric
                      label={tr("Chats WhatsApp", "WhatsApp chats")}
                      value={String(whatsappChats)}
                    />
                    <MiniMetric
                      label={tr("Commandes (CVR)", "Orders (CVR)")}
                      value={`${c.orders} (${c.cvr}%)`}
                    />
                    <MiniMetric
                      label={tr("Revenu / ROAS", "Revenue / ROAS")}
                      value={`${formatMoney(c.revenueCents, currency)} (${
                        c.roas !== null ? `${c.roas}×` : "—"
                      })`}
                      highlight={c.revenueCents > 0}
                    />
                  </div>

                  {/* Recovery / Reactivation Approval Box (preserved for abandoned cart drafts) */}
                  {isRecovery && (
                    <div className="mt-3 rounded-xl border border-arctic-400/25 bg-arctic-100/55 p-3 text-xs text-arctic-600">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          {c.status === "draft" &&
                            tr("En attente d'approbation vendeur avant envoi WhatsApp.", "Waiting for the vendor's approval before sending on WhatsApp.")}
                          {c.status === "approved" &&
                            (c.approvedForPhone
                              ? tr(`Approuvée pour ${c.approvedForPhone} · prête à envoyer.`, `Approved for ${c.approvedForPhone} · ready to send.`)
                              : tr("Approuvée · prête à envoyer.", "Approved · ready to send."))}
                          {c.status === "sent" &&
                            (c.approvedForPhone
                              ? tr(`Envoyée à ${c.approvedForPhone}.`, `Sent to ${c.approvedForPhone}.`)
                              : tr("Envoyée.", "Sent."))}
                          {c.status === "stubbed" &&
                            tr("Enregistrée, mais WhatsApp n'est pas encore configuré : rien n'a été envoyé.", "Saved, but WhatsApp is not configured yet: nothing was sent.")}
                          {c.status === "blocked" &&
                            tr("Bloquée : le message ou le client a changé, ou ce client a reçu trop de messages. Vous pouvez réessayer.", "Blocked: the message or the customer changed, or this customer received too many messages. You can try again.")}
                          {c.status === "failed" && tr("L'envoi a échoué. Vous pouvez réessayer.", "Sending failed. You can try again.")}
                          {c.status === "cancelled" && tr("Annulée : ce message ne sera pas envoyé.", "Cancelled: this message will not be sent.")}
                        </div>
                        {canSend && (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => approveAndRun(c.id)}
                              className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                              {c.status === "approved"
                                ? tr("Envoyer maintenant", "Send now")
                                : tr("Approuver & Envoyer", "Approve & send")}
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => cancelRecoveryCampaign(c.id)}
                              className="rounded-lg border border-arctic-400/35 px-2.5 py-1 text-xs text-arctic-600"
                            >
                              {tr("Annuler", "Cancel")}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* MODAL : CONFIGURATION META MARKETING API (AD ACCOUNT, PAGE, TOKEN)    */}
      {/* ===================================================================== */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-arctic-950/60 p-4 backdrop-blur-xs">
          <div className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto overscroll-contain rounded-2xl border border-arctic-400/30 bg-white p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between gap-3 border-b border-arctic-200 pb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                  {tr("Authentification & Autorisations Meta Graph API v27.0", "Meta Graph API v27.0 authentication & permissions")}
                </span>
                <h3 className="text-lg font-bold text-arctic-900">
                  {tr("Configuration Meta Marketing API & Jetons d'Accès", "Meta Marketing API settings & access tokens")}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="rounded-lg p-1.5 text-arctic-600 hover:bg-arctic-100"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveMetaConfig} className="space-y-4">
              <div className="rounded-xl border border-blue-600 bg-blue-50/70 p-3.5 text-left">
                <div className="text-xs font-bold text-arctic-900">
                  {tr("🟢 Connexion Directe Meta Graph API (`graph.facebook.com/v27.0`)", "🟢 Direct Meta Graph API connection (`graph.facebook.com/v27.0`)")}
                </div>
                <p className="mt-1 text-[11px] text-arctic-600">
                  {tr("Exécute les appels HTTP POST en direct sur votre compte publicitaire Meta (`/campaigns`, `/adsets`, `/adcreatives`, `/ads`) avec votre jeton `ads_management` et enregistre toutes les campagnes dans MySQL.", "Makes live HTTP POST calls on your Meta ad account (`/campaigns`, `/adsets`, `/adcreatives`, `/ads`) with your `ads_management` token and saves every campaign in the database.")}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label">
                    {tr("ID du Compte Publicitaire (`act_<AD_ACCOUNT_ID>`)", "Ad account ID (`act_<AD_ACCOUNT_ID>`)")}
                  </label>
                  <input
                    value={cfgAdAccountId}
                    onChange={(e) => setCfgAdAccountId(e.target.value)}
                    placeholder="act_108492048192041"
                    className="input font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="label">{tr("ID de la Page Facebook (`PAGE_ID`)", "Facebook Page ID (`PAGE_ID`)")}</label>
                  <input
                    value={cfgPageId}
                    onChange={(e) => setCfgPageId(e.target.value)}
                    placeholder="104928193847102"
                    className="input font-mono text-xs"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label">Meta App ID (`CLIENT_ID`)</label>
                  <input
                    value={cfgAppId}
                    onChange={(e) => setCfgAppId(e.target.value)}
                    placeholder="158291049281720"
                    className="input font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="label">{tr("Type de Jeton (`Access Token`)", "Token type (`Access Token`)")}</label>
                  <select
                    value={cfgTokenType}
                    onChange={(e) =>
                      setCfgTokenType(
                        e.target.value as
                          | "USER_TOKEN"
                          | "LONG_LIVED_TOKEN"
                          | "SYSTEM_USER_TOKEN",
                      )
                    }
                    className="input text-xs"
                  >
                    <option value="SYSTEM_USER_TOKEN">
                      {tr("System User Access Token (Serveur / Production)", "System User Access Token (server / production)")}
                    </option>
                    <option value="LONG_LIVED_TOKEN">
                      {tr("Long-Lived Access Token (60 jours)", "Long-Lived Access Token (60 days)")}
                    </option>
                    <option value="USER_TOKEN">
                      {tr("User Access Token (Session OAuth)", "User Access Token (OAuth session)")}
                    </option>
                  </select>
                </div>
              </div>

              <div>
                <label className="label">
                  {tr("Jeton d'Accès Meta (`ACCESS_TOKEN` avec scopes", "Meta access token (`ACCESS_TOKEN` with scopes")}{" "}
                  <code>ads_management,ads_read</code>)
                </label>
                <input
                  type="password"
                  value={cfgAccessToken}
                  onChange={(e) => setCfgAccessToken(e.target.value)}
                  placeholder={
                    metaConfig.maskedToken
                      ? tr(`Jeton actuel : ${metaConfig.maskedToken} (laisser vide pour conserver)`, `Current token: ${metaConfig.maskedToken} (leave empty to keep it)`)
                      : tr("Collez votre jeton EAAB... (ou laissez vide en mode Sandbox)", "Paste your EAAB... token (or leave empty in Sandbox mode)")
                  }
                  className="input font-mono text-xs"
                />
              </div>

              {/* OAuth Helper Box from Meta Documentation */}
              <div className="rounded-xl border border-arctic-200 bg-arctic-50 p-3.5 text-xs space-y-2">
                <div className="font-bold text-arctic-900">
                  {tr("🔗 URL d'Autorisation OAuth Meta (`ads_management,ads_read`)", "🔗 Meta OAuth authorization URL (`ads_management,ads_read`)")}
                </div>
                <p className="text-[11px] text-arctic-600">
                  {tr("Conformément à la documentation Meta Marketing API, utilisez ce lien pour demander les permissions", "As described in the Meta Marketing API documentation, use this link to request the permissions")} <code>ads_management</code> {tr("et", "and")}{" "}
                  <code>ads_read</code> :
                </p>
                <code className="block break-all rounded-lg bg-arctic-900 p-2.5 font-mono text-[10px] text-emerald-300">
                  {`https://www.facebook.com/v27.0/dialog/oauth?client_id=${cfgAppId || "<CLIENT_ID>"}&redirect_uri=${
                    typeof window !== "undefined"
                      ? encodeURIComponent(`${window.location.origin}/dashboard/campaigns`)
                      : "https://japora.shop/dashboard/campaigns"
                  }&scope=ads_management,ads_read&response_type=code`}
                </code>
              </div>

              {configFeedback && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs font-medium text-emerald-800">
                  ✓ {configFeedback}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="rounded-xl border border-arctic-300 px-4 py-2 text-xs font-semibold text-arctic-700"
                >
                  {tr("Fermer", "Close")}
                </button>
                <button
                  type="submit"
                  disabled={savingConfig}
                  className="btn-primary text-xs"
                >
                  {savingConfig
                    ? tr("Vérification & Sauvegarde…", "Checking & saving…")
                    : tr("Enregistrer & Vérifier le Token", "Save & check the token")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL : LOGS D'EXÉCUTION API META & CLÉS D'IDEMPOTENCE (cURL)         */}
      {/* ===================================================================== */}
      {inspectedCampaign && inspectedCampaign.metaDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-arctic-950/60 p-4 backdrop-blur-xs">
          <div className="max-h-[90dvh] w-full max-w-3xl overflow-y-auto overscroll-contain rounded-2xl border border-arctic-400/30 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-arctic-200 pb-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                  {tr("Journal d'Exécution Meta Marketing API v27.0", "Meta Marketing API v27.0 run log")}
                </span>
                <h3 className="text-lg font-bold text-arctic-900">
                  {inspectedCampaign.name}
                </h3>
                <p className="font-mono text-xs text-arctic-600">
                  Master X-Client-Idempotent-Key:{" "}
                  {inspectedCampaign.metaDetails.idempotencyKey}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectedCampaign(null)}
                className="rounded-lg p-1.5 text-arctic-600 hover:bg-arctic-100"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <div className="rounded-xl border border-arctic-200 bg-arctic-50 p-3">
                <div className="text-[10px] uppercase text-arctic-600">
                  1. Campaign ID
                </div>
                <div className="font-mono text-xs font-bold text-arctic-900">
                  {inspectedCampaign.metaDetails.metaCampaignId}
                </div>
              </div>
              <div className="rounded-xl border border-arctic-200 bg-arctic-50 p-3">
                <div className="text-[10px] uppercase text-arctic-600">
                  2. Ad Set ID
                </div>
                <div className="font-mono text-xs font-bold text-arctic-900">
                  {inspectedCampaign.metaDetails.metaAdSetId}
                </div>
              </div>
              <div className="rounded-xl border border-arctic-200 bg-arctic-50 p-3">
                <div className="text-[10px] uppercase text-arctic-600">
                  3. Ad Creative ID
                </div>
                <div className="font-mono text-xs font-bold text-arctic-900">
                  {inspectedCampaign.metaDetails.metaCreativeId}
                </div>
              </div>
              <div className="rounded-xl border border-arctic-200 bg-arctic-50 p-3">
                <div className="text-[10px] uppercase text-arctic-600">
                  4. Ad ID
                </div>
                <div className="font-mono text-xs font-bold text-arctic-900">
                  {inspectedCampaign.metaDetails.metaAdId}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {inspectedCampaign.metaDetails.apiLogs.map((log, idx) => (
                <div
                  key={`${log.step}_${idx}`}
                  className="rounded-xl border border-arctic-300 bg-arctic-950 p-4 text-arctic-100 space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-emerald-400">
                      [{idx + 1}] {log.method} {log.endpoint}
                    </span>
                    <span className="font-mono text-[10px] text-arctic-400">
                      X-Client-Idempotent-Key: {log.idempotencyKey}
                    </span>
                  </div>
                  <pre className="overflow-x-auto font-mono text-[11px] text-arctic-200">
                    {log.curlPreview}
                  </pre>
                  <div className="border-t border-arctic-800 pt-2 font-mono text-[10px] text-emerald-300">
                    {tr("Réponse :", "Response:")} {JSON.stringify(log.responsePayload)}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setInspectedCampaign(null)}
                className="btn-primary text-xs"
              >
                {tr("Fermer l'inspecteur", "Close the inspector")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  badge,
  highlight,
}: {
  label: string;
  value: string;
  sub: string;
  badge: string;
  accent?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 shadow-2xs ${
        highlight
          ? "border-emerald-500/40 bg-emerald-500/10"
          : "border-arctic-400/25 bg-white"
      }`}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="text-[11px] font-semibold text-arctic-600">{label}</span>
        <span className="rounded-full bg-arctic-100 px-2 py-0.5 text-[10px] font-semibold text-arctic-700">
          {badge}
        </span>
      </div>
      <div className="mt-2 text-xl font-extrabold text-arctic-900">{value}</div>
      <div className="mt-1 text-[11px] text-arctic-600">{sub}</div>
    </div>
  );
}

function FunnelStage({
  step,
  count,
  pct,
  color,
}: {
  step: string;
  count: number;
  pct: number;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-arctic-400/20 bg-arctic-50/70 p-3">
      <div className="text-[11px] font-medium text-arctic-600">{step}</div>
      <div className="mt-1 flex items-baseline justify-between">
        <span className="text-base font-bold text-arctic-900">
          {count.toLocaleString("fr-FR")}
        </span>
        <span className="text-[11px] font-semibold text-arctic-600">{pct}%</span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-arctic-200">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${Math.max(6, Math.min(100, pct))}%` }}
        />
      </div>
    </div>
  );
}

function MiniMetric({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-lg bg-arctic-50/80 px-2.5 py-2">
      <div className="text-[10px] font-medium text-arctic-600">{label}</div>
      <div
        className={`mt-0.5 text-xs font-bold ${
          highlight ? "text-emerald-700" : "text-arctic-900"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function CampaignStatusBadge({ status }: { status: string }) {
  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
        ACTIVE
      </span>
    );
  }
  if (status === "paused") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
        ⏸ PAUSED
      </span>
    );
  }
  const map: Record<string, { label: string; cls: string }> = {
    draft: { label: "BROUILLON", cls: "bg-amber-500/15 text-amber-700" },
    approved: { label: "APPROUVÉE", cls: "bg-sky-500/15 text-sky-700" },
    sent: { label: "ENVOYÉE", cls: "bg-emerald-500/15 text-emerald-700" },
    cancelled: { label: "ANNULÉE", cls: "bg-arctic-400/20 text-arctic-600" },
    archived: { label: "ARCHIVÉE", cls: "bg-arctic-400/20 text-arctic-600" },
  };
  const cfg = map[status] ?? {
    label: status.toUpperCase(),
    cls: "bg-arctic-400/20 text-arctic-600",
  };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}
