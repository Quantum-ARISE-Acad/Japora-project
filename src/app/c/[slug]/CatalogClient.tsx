"use client";

import { useEffect, useMemo, useState } from "react";
import { formatMoney, parseSizes, waMeLink } from "@/lib/utils";
import FollowButton from "./FollowButton";
import VerifiedBadge from "@/components/VerifiedBadge";
import Glyph from "@/components/Glyph";
import ProductPlaceholder from "@/components/ProductPlaceholder";
import { ProductReviews } from "@/components/ProductReviews";
import { parseDeliveryZones, calculateDeliveryFee } from "@/lib/delivery";
import ShopCurrencySelector from "@/components/ShopCurrencySelector";
import ShopAiAssistant from "@/components/ShopAiAssistant";
import ShopWhatsAppQrBanner from "@/components/ShopWhatsAppQrBanner";
import { formatConvertedPrice } from "@/lib/currency";
import { telHref, directUssdCode } from "@/lib/payments/ussd";
import {
  trackVisit,
  trackProductView,
  trackCart,
  trackPaymentIntent,
  getSessionId,
} from "@/lib/telemetry";

export type PaymentMethod = "fedapay" | "tmoney" | "flooz" | "online" | "wescrow" | "cash";

export type StorefrontCollection = {
  id: string;
  name: string;
  slug: string;
  description: string;
  productCount: number;
  coverImageUrl?: string;
};

export type Product = {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  imageUrl: string;
  sizes: string;
  stock: number;
  condition?: string;
  collectionId?: string | null;
  createdAt?: string;
  wholesalePriceCents?: number | null;
  wholesaleMinQty?: number;
  preOrderAllowed?: boolean;
  depositPercent?: number;
};

type CartLine = {
  productId: string;
  name: string;
  priceCents: number;
  imageUrl: string;
  size: string;
  qty: number;
  stock: number;
};

type Step = "cart" | "form" | "success";

const PAGE_SIZE = 12;

export default function CatalogClient({
  shopName,
  shopSlug,
  tagline,
  verified = false,
  whatsappNumber,
  momoNumber = "",
  currency,
  avatarUrl = "",
  bio = "",
  deliveryEnabled = false,
  deliveryFeeCents = 0,
  deliveryZones = "",
  products,
  collections = [],
  initialCollectionId = null,
  directProductId = null,
  assistantConfig,
}: {
  shopName: string;
  shopSlug: string;
  tagline: string;
  verified?: boolean;
  whatsappNumber: string;
  momoNumber?: string;
  currency: string;
  avatarUrl?: string;
  bio?: string;
  deliveryEnabled?: boolean;
  deliveryFeeCents?: number;
  deliveryZones?: string;
  products: Product[];
  collections?: StorefrontCollection[];
  initialCollectionId?: string | null;
  directProductId?: string | null;
  assistantConfig?: {
    aiEnabled?: boolean;
    assistantName?: string;
    welcomeMessage?: string;
    whatsappPrefillMessage?: string;
    showQrOnShop?: boolean;
  };
}) {
  const [displayCurrency, setDisplayCurrency] = useState(currency || "XOF");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("cart");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [note, setNote] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("fedapay");
  const [launchingFeda, setLaunchingFeda] = useState(false);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(initialCollectionId);
  const [copiedMomo, setCopiedMomo] = useState(false);
  const [copiedAmount, setCopiedAmount] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fulfillment, setFulfillment] = useState<"pickup" | "delivery">(
    deliveryEnabled ? "delivery" : "pickup"
  );
  const [selectedZone, setSelectedZone] = useState<string>("");
  const [deliveryAddress, setDeliveryAddress] = useState<string>("");
  const [placedSummary, setPlacedSummary] = useState<{
    orderId: string;
    waLink: string;
    paymentMethod: PaymentMethod;
    totalCents: number;
  } | null>(null);

  // Search, filter & pagination state
  const [searchQuery, setSearchQuery] = useState("");
  const [stockFilter, setStockFilter] = useState<"all" | "in_stock" | "low_stock" | "new">("all");
  const [sortBy, setSortBy] = useState<"default" | "price_asc" | "price_desc">("default");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Detail Modal
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [aiOpenTrigger, setAiOpenTrigger] = useState(0);

  // Telemetry: Stage 1 (Visit) & Vendor Theme Auto-Apply
  useEffect(() => {
    trackVisit(shopSlug);
    try {
      const savedTheme = localStorage.getItem(`japora_vendor_theme_${shopSlug}`) || localStorage.getItem(`japora_shop_theme_${shopSlug}`) || "arctic";
      const root = document.getElementById("shop-root") || document.body;
      root.setAttribute("data-shop-theme", savedTheme);
    } catch {}
  }, [shopSlug]);

  // Telemetry: Stage 2 (Product View)
  useEffect(() => {
    if (selectedProduct) {
      trackProductView(shopSlug, selectedProduct.id, selectedProduct.priceCents);
    }
  }, [selectedProduct, shopSlug]);

  const filteredProducts = useMemo(() => {
    let list = [...products];

    // Collection filter
    if (selectedCollectionId) {
      list = list.filter((p) => p.collectionId === selectedCollectionId);
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          (p.condition && p.condition.toLowerCase().includes(q)),
      );
    }

    // Stock & state filter
    if (stockFilter === "in_stock") {
      list = list.filter((p) => p.stock > 0);
    } else if (stockFilter === "low_stock") {
      list = list.filter((p) => p.stock > 0 && p.stock <= 3);
    } else if (stockFilter === "new") {
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      list = list.filter((p) => p.createdAt && new Date(p.createdAt).getTime() >= sevenDaysAgo);
    }

    // Sort
    if (sortBy === "price_asc") {
      list.sort((a, b) => a.priceCents - b.priceCents);
    } else if (sortBy === "price_desc") {
      list.sort((a, b) => b.priceCents - a.priceCents);
    }

    return list;
  }, [products, selectedCollectionId, searchQuery, stockFilter, sortBy]);

  useEffect(() => {
    if (!directProductId) return;
    const index = filteredProducts.findIndex((p) => p.id === directProductId);
    if (index < 0) return;
    setVisibleCount((count) => Math.max(count, index + 1));
    setSelectedProduct(filteredProducts[index]);
  }, [directProductId, filteredProducts]);

  const displayedProducts = useMemo(
    () => filteredProducts.slice(0, visibleCount),
    [filteredProducts, visibleCount],
  );

  const hasMore = visibleCount < filteredProducts.length;

  const total = useMemo(
    () => cart.reduce((s, l) => s + l.priceCents * l.qty, 0),
    [cart],
  );
  const itemCount = useMemo(
    () => cart.reduce((s, l) => s + l.qty, 0),
    [cart],
  );

  const zonesList = useMemo(
    () => parseDeliveryZones(deliveryZones || "", deliveryFeeCents || 0),
    [deliveryZones, deliveryFeeCents]
  );

  const deliveryFee = useMemo(() => {
    if (!deliveryEnabled || fulfillment !== "delivery") return 0;
    return calculateDeliveryFee(
      { deliveryEnabled, deliveryFeeCents, deliveryZones },
      selectedZone || (zonesList[0]?.name ?? "")
    );
  }, [deliveryEnabled, fulfillment, deliveryFeeCents, deliveryZones, selectedZone, zonesList]);

  const grandTotal = total + deliveryFee;

  function addToCart(p: Product, size: string, qty: number) {
    trackCart(shopSlug, p.priceCents * qty);
    setCart((c) => {
      const idx = c.findIndex((l) => l.productId === p.id && l.size === size);
      if (idx >= 0) {
        const copy = [...c];
        const nextQty = Math.min(p.stock, copy[idx].qty + qty);
        copy[idx] = { ...copy[idx], qty: nextQty };
        return copy;
      }
      return [
        ...c,
        {
          productId: p.id,
          name: p.name,
          priceCents: p.priceCents,
          imageUrl: p.imageUrl,
          size,
          qty: Math.min(p.stock, qty),
          stock: p.stock,
        },
      ];
    });
  }

  function updateQty(i: number, qty: number) {
    setCart((c) => {
      const copy = [...c];
      copy[i] = { ...copy[i], qty: Math.max(1, Math.min(copy[i].stock, qty)) };
      return copy;
    });
  }

  function removeLine(i: number) {
    setCart((c) => c.filter((_, idx) => idx !== i));
  }

  function openCart() {
    if (cart.length === 0) return;
    setStep("cart");
    setError("");
    setOpen(true);
  }

  function quickOrderText(p: Product, size: string) {
    const sizeLabel = size ? ` (${size})` : "";
    return `Hi ${shopName}, I'd like to order:\n• ${p.name}${sizeLabel} — ${formatMoney(p.priceCents, currency)}\n\nIs this still available?`;
  }

  function cartOrderText() {
    const lines = cart
      .map((l) => {
        const sizeLabel = l.size ? ` (${l.size})` : "";
        return `• ${l.qty}× ${l.name}${sizeLabel} — ${formatMoney(l.priceCents * l.qty, currency)}`;
      })
      .join("\n");
    return `Bonjour ${shopName},\n\nJe souhaite commander les articles suivants :\n${lines}\n\nTotal : ${formatMoney(total, currency)}\n\nSont-ils disponibles ? Merci !`;
  }

  async function submitOrder(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    const paymentLabel =
      paymentMethod === "fedapay"
        ? "FedaPay (T-Money, Flooz, Mobile Money & Carte)"
        : paymentMethod === "tmoney"
        ? "USSD T-Money (*145#)"
        : paymentMethod === "flooz"
        ? "USSD Flooz (*155#)"
        : paymentMethod === "online"
        ? "Paiement en ligne / Mobile Money automatique"
        : paymentMethod === "wescrow"
        ? "Paiement Garanti WEscrow (Safe Hands)"
        : "Paiement en espèces";

    const fullNote = [
      `[PAIEMENT: ${paymentLabel}]`,
      deliveryEnabled && fulfillment === "delivery"
        ? `[LIVRAISON - ${selectedZone || "Standard"}${deliveryAddress ? ` : ${deliveryAddress}` : ""}]`
        : deliveryEnabled
        ? "[RETRAIT EN BOUTIQUE]"
        : "",
      note.trim(),
    ]
      .filter(Boolean)
      .join("\n");

    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shopSlug,
        customerName,
        customerPhone,
        customerEmail: customerEmail.trim() || undefined,
        note: fullNote,
        paymentMethod,
        sessionId: getSessionId(),
        items: cart.map((l) => ({ productId: l.productId, size: l.size, qty: l.qty })),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (!res.ok) {
      setError(data.error || "Could not place order.");
      return;
    }

    if (paymentMethod === "tmoney" || paymentMethod === "flooz") {
      trackPaymentIntent(shopSlug, data.orderId, paymentMethod, grandTotal);
    }

    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const payUrl = `${origin}/pay/${data.orderId}`;
    const summary = `Bonjour ${shopName},\n\n` +
      `Je viens de valider ma commande (Réf : #${data.orderId.slice(0, 8)}).\n\n` +
      `📦 *Articles commandés :*\n${cart.map((l) => `• ${l.qty}× ${l.name}${l.size ? ` (${l.size})` : ""} — ${formatMoney(l.priceCents * l.qty, currency)}`).join("\n")}\n\n` +
      `💰 *Sous-total :* ${formatMoney(total, currency)}\n` +
      (deliveryFee > 0 ? `🛵 *Frais de livraison :* +${formatMoney(deliveryFee, currency)} (${selectedZone || "Standard"})\n` : "") +
      `💳 *Total à régler :* ${formatMoney(grandTotal, currency)}\n` +
      `📍 *Récupération :* ${fulfillment === "delivery" ? `Livraison à domicile (${deliveryAddress || "Voir adresse"})` : "Retrait en boutique"}\n` +
      `📱 *Mode de paiement :* ${paymentLabel}\n` +
      `👤 *Client :* ${customerName}${customerPhone ? ` (${customerPhone})` : ""}\n` +
      (note ? `📝 *Note :* ${note}\n` : "") +
      `\n🔗 *Lien suivi & paiement :*\n${payUrl}\n\nMerci de bien vouloir confirmer ma commande !`;

    setPlacedSummary({
      orderId: data.orderId,
      waLink: waMeLink(whatsappNumber, summary),
      paymentMethod,
      totalCents: grandTotal,
    });
    setStep("success");
    setCart([]);
  }

  const hasWhatsApp = whatsappNumber.replace(/[^0-9]/g, "").length > 0;

  return (
    <div id="shop-root" className="min-h-screen pb-24 transition-colors duration-medium">
      {/* Sticky Header */}
      <header className="sticky top-0 z-20 border-b border-arctic-400/30 bg-white/80 backdrop-blur-glass-thick shadow-xs">
        <div className="mx-auto max-w-5xl px-4 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt={shopName}
                  className="h-14 w-14 shrink-0 rounded-shape-xl object-cover border border-arctic-300 shadow-sm bg-white"
                />
              ) : (
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-shape-xl bg-brand/15 text-2xl font-black text-brand-dark border border-brand/20">
                  {shopName ? shopName[0].toUpperCase() : "J"}
                </div>
              )}
              <div>
                <h1 className="a-headline-md inline-flex items-center gap-2 text-arctic-900 sm:a-display-sm">
                  {shopName}
                  {verified && <VerifiedBadge withLabel={false} />}
                </h1>
                {tagline && <p className="a-body-md mt-0.5 text-arctic-700 sm:a-body-lg">{tagline}</p>}
                {bio && <p className="text-xs text-arctic-600 mt-0.5 line-clamp-1 max-w-md">{bio}</p>}
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center justify-start sm:justify-end gap-2">
              <ShopCurrencySelector
                selectedCurrency={displayCurrency}
                onCurrencyChange={setDisplayCurrency}
                baseCurrency={currency}
              />
              <button
                type="button"
                onClick={() => {
                  if (cart.length > 0) {
                    openCart();
                  }
                }}
                className={`relative inline-flex items-center gap-2 rounded-shape-full px-3.5 py-2 text-xs font-bold transition shadow-xs ${
                  itemCount > 0
                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                    : "border border-arctic-300 bg-white text-arctic-700 hover:bg-arctic-100"
                }`}
                title="Ouvrir mon panier"
              >
                <span>🛒 Panier</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold ${
                    itemCount > 0 ? "bg-white text-emerald-800" : "bg-arctic-200 text-arctic-700"
                  }`}
                >
                  {itemCount}
                </span>
              </button>
              <FollowButton shopSlug={shopSlug} shopName={shopName} />
              {hasWhatsApp && (
                <a
                  href={waMeLink(whatsappNumber, `Hi ${shopName}, I have a question about your catalog.`)}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-primary gap-1.5"
                >
                  <Glyph name="chat" size={16} /> Chat
                </a>
              )}
            </div>
          </div>

          {/* Search and Filters Bar */}
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-2 border-t border-arctic-300/30">
            {/* Search Box */}
            <div className="relative flex-1 max-w-md">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-arctic-400 text-sm">🔍</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setVisibleCount(PAGE_SIZE);
                }}
                placeholder="Search products..."
                className="w-full rounded-shape-full border border-arctic-300/50 bg-white/90 py-1.5 pl-9 pr-8 text-sm text-arctic-900 placeholder:text-arctic-400 focus:border-arctic-600 focus:outline-none focus:ring-1 focus:ring-arctic-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-arctic-400 hover:text-arctic-700"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filter Chips & Sort */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
                <button
                  type="button"
                  onClick={() => {
                    setStockFilter("all");
                    setVisibleCount(PAGE_SIZE);
                  }}
                  className={`rounded-shape-full px-3 py-1 text-xs font-semibold transition ${
                    stockFilter === "all"
                      ? "bg-arctic-800 text-white"
                      : "bg-arctic-200/60 text-arctic-700 hover:bg-arctic-300/60"
                  }`}
                >
                  All ({products.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStockFilter("in_stock");
                    setVisibleCount(PAGE_SIZE);
                  }}
                  className={`rounded-shape-full px-3 py-1 text-xs font-semibold transition ${
                    stockFilter === "in_stock"
                      ? "bg-arctic-800 text-white"
                      : "bg-arctic-200/60 text-arctic-700 hover:bg-arctic-300/60"
                  }`}
                >
                  In stock
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStockFilter("low_stock");
                    setVisibleCount(PAGE_SIZE);
                  }}
                  className={`rounded-shape-full px-3 py-1 text-xs font-semibold transition ${
                    stockFilter === "low_stock"
                      ? "bg-amber-600 text-white"
                      : "bg-arctic-200/60 text-arctic-700 hover:bg-arctic-300/60"
                  }`}
                >
                  Low stock
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStockFilter("new");
                    setVisibleCount(PAGE_SIZE);
                  }}
                  className={`rounded-shape-full px-3 py-1 text-xs font-semibold transition ${
                    stockFilter === "new"
                      ? "bg-emerald-600 text-white"
                      : "bg-arctic-200/60 text-arctic-700 hover:bg-arctic-300/60"
                  }`}
                >
                  ✨ New
                </button>
              </div>

              {/* Sort selector */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "default" | "price_asc" | "price_desc")}
                className="rounded-shape-md border border-arctic-300/50 bg-white/90 px-2 py-1 text-xs font-medium text-arctic-700 focus:outline-none"
              >
                <option value="default">Sort: Default</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
              </select>
            </div>
          </div>
        </div>
      </header>

      {/* Main Catalog View */}
      <main className="mx-auto max-w-5xl px-4 py-6">
        {assistantConfig?.showQrOnShop !== false && (
          <ShopWhatsAppQrBanner
            shopName={shopName}
            shopSlug={shopSlug}
            whatsappNumber={whatsappNumber}
            assistantName={assistantConfig?.assistantName}
            whatsappPrefillMessage={assistantConfig?.whatsappPrefillMessage}
            onOpenShopAi={() => setAiOpenTrigger((n) => n + 1)}
          />
        )}

        {/* Storefront Collections Showcase */}
        {collections.length > 0 && (
          <section className="mb-6 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-arctic-600 flex items-center gap-1.5">
                <span>📁</span> Collections de la boutique
              </h2>
              {selectedCollectionId && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCollectionId(null);
                    setVisibleCount(PAGE_SIZE);
                  }}
                  className="text-xs font-semibold text-brand-dark hover:underline"
                >
                  Voir tout le catalogue ({products.length})
                </button>
              )}
            </div>

            <div className="flex items-stretch gap-3 overflow-x-auto pb-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedCollectionId(null);
                  setVisibleCount(PAGE_SIZE);
                }}
                className={`group flex shrink-0 items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                  selectedCollectionId === null
                    ? "border-brand bg-brand text-white shadow-md"
                    : "border-arctic-300/60 bg-white text-arctic-800 hover:border-brand/50"
                }`}
              >
                <div
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-base font-bold ${
                    selectedCollectionId === null
                      ? "bg-white/20 text-white"
                      : "bg-arctic-100 text-arctic-700"
                  }`}
                >
                  🛍️
                </div>
                <div>
                  <div className="text-sm font-bold leading-tight">Tout le catalogue</div>
                  <div
                    className={`text-[11px] ${
                      selectedCollectionId === null ? "text-white/80" : "text-arctic-500"
                    }`}
                  >
                    {products.length} article{products.length > 1 ? "s" : ""}
                  </div>
                </div>
              </button>

              {collections.map((col) => {
                const active = selectedCollectionId === col.id;
                return (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => {
                      setSelectedCollectionId(active ? null : col.id);
                      setVisibleCount(PAGE_SIZE);
                    }}
                    className={`group flex shrink-0 items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                      active
                        ? "border-emerald-600 bg-gradient-to-r from-brand-dark to-emerald-700 text-white shadow-md"
                        : "border-arctic-300/60 bg-white text-arctic-800 hover:border-emerald-500/60"
                    }`}
                  >
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-white/20 bg-arctic-100">
                      {col.coverImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={col.coverImageUrl}
                          alt={col.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <ProductPlaceholder name={col.name} size="sm" />
                      )}
                    </div>
                    <div className="max-w-[180px]">
                      <div className="truncate text-sm font-bold leading-tight">{col.name}</div>
                      <div
                        className={`text-[11px] ${
                          active ? "text-emerald-100" : "text-arctic-500"
                        }`}
                      >
                        {col.productCount} produit{col.productCount > 1 ? "s" : ""}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Active Collection Banner */}
            {selectedCollectionId && (() => {
              const activeCol = collections.find((c) => c.id === selectedCollectionId);
              if (!activeCol) return null;
              return (
                <div className="rounded-2xl bg-gradient-to-r from-brand-dark via-brand to-emerald-700 p-4 text-white shadow-sm flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-200">
                      📁 Collection sélectionnée
                    </div>
                    <h3 className="text-lg font-extrabold">{activeCol.name}</h3>
                    {activeCol.description && (
                      <p className="text-xs text-white/90 mt-0.5 max-w-xl">{activeCol.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={`/c/${shopSlug}/collection/${activeCol.slug}`}
                      className="rounded-xl bg-white/15 hover:bg-white/25 px-3 py-1.5 text-xs font-semibold text-white transition"
                    >
                      Lien dédié de la collection ↗
                    </a>
                    <button
                      type="button"
                      onClick={() => setSelectedCollectionId(null)}
                      className="rounded-xl bg-white text-brand-dark px-3 py-1.5 text-xs font-bold hover:bg-emerald-50 transition"
                    >
                      ✕ Tout afficher
                    </button>
                  </div>
                </div>
              );
            })()}
          </section>
        )}

        {/* Results summary if searching */}
        {(searchQuery || stockFilter !== "all" || selectedCollectionId) && (
          <div className="mb-4 flex items-center justify-between text-xs text-arctic-600">
            <span>
              Affichage de <strong>{filteredProducts.length}</strong> article{filteredProducts.length === 1 ? "" : "s"}
            </span>
            <button
              onClick={() => {
                setSearchQuery("");
                setStockFilter("all");
                setSelectedCollectionId(null);
              }}
              className="text-arctic-800 underline hover:text-black"
            >
              Réinitialiser les filtres
            </button>
          </div>
        )}

        {filteredProducts.length === 0 ? (
          <div className="card grid place-items-center gap-3 p-12 text-center text-arctic-600">
            <span className="text-4xl">🔍</span>
            <h3 className="text-base font-semibold text-arctic-800">No products found</h3>
            <p className="text-sm max-w-sm">
              We couldn&apos;t find any items matching your criteria. Try adjusting your search query or filters.
            </p>
            <button
              onClick={() => {
                setSearchQuery("");
                setStockFilter("all");
              }}
              className="btn-ghost mt-2 text-xs"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {displayedProducts.map((p) => {
              const colName = p.collectionId
                ? collections.find((c) => c.id === p.collectionId)?.name
                : undefined;
              return (
                <ProductCard
                  key={p.id}
                  p={p}
                  collectionName={colName}
                  currency={currency}
                  displayCurrency={displayCurrency}
                  onAdd={addToCart}
                  onClickPreview={() => setSelectedProduct(p)}
                  waMeOrderLink={hasWhatsApp ? (size: string) => waMeLink(whatsappNumber, quickOrderText(p, size)) : null}
                />
              );
            })}
          </div>
        )}

        {/* Load more button */}
        {hasMore && (
          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
              className="btn-ghost rounded-shape-full px-6 py-2.5 shadow-xs font-semibold text-arctic-800 hover:bg-arctic-200/50"
            >
              Load more ({filteredProducts.length - visibleCount} remaining)
            </button>
          </div>
        )}
      </main>

      {/* Sticky Bottom Cart Bar */}
      {cart.length > 0 && !open && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-emerald-500/40 bg-white/95 px-4 py-3.5 shadow-2xl backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-100 text-lg">
                🛒
              </span>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">
                  Votre panier ({itemCount} article{itemCount === 1 ? "" : "s"})
                </div>
                <div className="font-extrabold text-arctic-900 text-base">
                  {formatConvertedPrice(total, currency, displayCurrency).primary}
                </div>
              </div>
            </div>
            <button onClick={openCart} className="btn-primary !bg-emerald-600 hover:!bg-emerald-700 px-5 py-2.5 text-sm font-bold shadow-lg">
              Ouvrir le panier & Commander →
            </button>
          </div>
        </div>
      )}

      {/* Product Detail Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-arctic-900/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-lg overflow-hidden rounded-shape-xl bg-white shadow-elev-3 dark:bg-arctic-900">
            <button
              onClick={() => setSelectedProduct(null)}
              className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full bg-white/80 text-arctic-700 shadow hover:bg-white"
            >
              ✕
            </button>
            <div className="max-h-[85vh] overflow-y-auto">
              <div className="relative aspect-video w-full bg-arctic-200/60">
                {selectedProduct.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selectedProduct.imageUrl}
                    alt={selectedProduct.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <ProductPlaceholder name={selectedProduct.name} size="lg" />
                )}
                {selectedProduct.condition && selectedProduct.condition !== "new" && (
                  <span className="absolute bottom-3 left-3 rounded-full bg-arctic-900/80 px-3 py-1 text-xs font-semibold capitalize text-white backdrop-blur">
                    {selectedProduct.condition === "used" ? "Occasion" : "Reconditionné"}
                  </span>
                )}
              </div>

              <div className="p-6 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-arctic-900 dark:text-white">
                      {selectedProduct.name}
                    </h2>
                    <span className="text-xs text-arctic-500">
                      {selectedProduct.stock > 0
                        ? `${selectedProduct.stock} unit${selectedProduct.stock > 1 ? "s" : ""} available`
                        : "Out of stock"}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-extrabold text-brand-dark">
                      {formatConvertedPrice(selectedProduct.priceCents, currency, displayCurrency).primary}
                    </div>
                    {displayCurrency !== currency && (
                      <div className="text-[11px] text-arctic-500">
                        ~{formatMoney(selectedProduct.priceCents, currency)}
                      </div>
                    )}
                    {selectedProduct.wholesalePriceCents && (
                      <div className="text-xs text-arctic-600">
                        Gros: {formatConvertedPrice(selectedProduct.wholesalePriceCents, currency, displayCurrency).primary} (min. {selectedProduct.wholesaleMinQty})
                      </div>
                    )}
                  </div>
                </div>

                {selectedProduct.description && (
                  <p className="text-sm leading-relaxed text-arctic-700 dark:text-arctic-300">
                    {selectedProduct.description}
                  </p>
                )}

                <div className="pt-2">
                  <button
                    type="button"
                    disabled={selectedProduct.stock <= 0}
                    onClick={() => {
                      const sizes = parseSizes(selectedProduct.sizes);
                      addToCart(selectedProduct, sizes[0] || "", 1);
                      setSelectedProduct(null);
                      openCart();
                    }}
                    className="btn-primary w-full py-3"
                  >
                    {selectedProduct.stock > 0 ? "Add to cart & Checkout" : "Out of stock"}
                  </button>
                </div>

                <ProductReviews productId={selectedProduct.id} productName={selectedProduct.name} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Checkout Drawer / Modal */}
      {open && (
        <div className="fixed inset-0 z-[60] grid place-items-end bg-arctic-900/50 sm:place-items-center p-0 sm:p-4">
          <div className="card w-full max-w-md overflow-hidden rounded-b-none sm:rounded-b-xl">
            {/* Progress Indicator */}
            <div className="border-b border-arctic-400/30 bg-arctic-100/50 px-5 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full ${
                      step === "cart"
                        ? "bg-arctic-800 text-white"
                        : "bg-emerald-600 text-white"
                    }`}
                  >
                    {step === "cart" ? "1" : "✓"}
                  </span>
                  <span className={step === "cart" ? "text-arctic-900 font-bold" : "text-arctic-600"}>Cart</span>
                  <span className="text-arctic-400">→</span>
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full ${
                      step === "form"
                        ? "bg-arctic-800 text-white"
                        : step === "success"
                          ? "bg-emerald-600 text-white"
                          : "bg-arctic-300 text-arctic-600"
                    }`}
                  >
                    {step === "success" ? "✓" : "2"}
                  </span>
                  <span className={step === "form" ? "text-arctic-900 font-bold" : "text-arctic-600"}>Details</span>
                  <span className="text-arctic-400">→</span>
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full ${
                      step === "success" ? "bg-emerald-600 text-white" : "bg-arctic-300 text-arctic-600"
                    }`}
                  >
                    3
                  </span>
                  <span className={step === "success" ? "text-arctic-900 font-bold" : "text-arctic-600"}>Done</span>
                </div>
                <button onClick={() => setOpen(false)} className="text-arctic-500 hover:text-arctic-800">
                  ✕
                </button>
              </div>
            </div>

            {step === "cart" && (
              <div className="max-h-[70vh] space-y-3 overflow-y-auto p-5">
                {cart.map((l, i) => (
                  <div key={`${l.productId}-${l.size}-${i}`} className="flex items-center gap-3">
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-arctic-200/65">
                      {l.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={l.imageUrl} alt={l.name} className="h-full w-full object-cover" />
                      ) : (
                        <ProductPlaceholder name={l.name} size="sm" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-arctic-900">
                        {l.name}
                        {l.size && <span className="ml-1 text-xs text-arctic-500">({l.size})</span>}
                      </div>
                      <div className="text-sm text-arctic-600">
                        {formatConvertedPrice(l.priceCents, currency, displayCurrency).primary} each
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => updateQty(i, l.qty - 1)}
                        className="grid h-7 w-7 place-items-center rounded-md bg-arctic-200/65 text-arctic-800 hover:bg-arctic-300"
                      >
                        −
                      </button>
                      <span className="w-6 text-center text-sm font-semibold">{l.qty}</span>
                      <button
                        onClick={() => updateQty(i, l.qty + 1)}
                        disabled={l.qty >= l.stock}
                        className="grid h-7 w-7 place-items-center rounded-md bg-arctic-200/65 text-arctic-800 hover:bg-arctic-300 disabled:opacity-40"
                      >
                        +
                      </button>
                      <button
                        onClick={() => removeLine(i)}
                        className="ml-1 text-arctic-500 hover:text-red-500"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}

                <div className="flex items-center justify-between border-t border-arctic-400/30 pt-3">
                  <span className="text-sm text-arctic-600">Total</span>
                  <div className="text-right">
                    <span className="text-lg font-bold text-arctic-900">
                      {formatConvertedPrice(total, currency, displayCurrency).primary}
                    </span>
                    {displayCurrency !== currency && (
                      <span className="text-xs text-arctic-500 block">
                        ~{formatMoney(total, currency)}
                      </span>
                    )}
                  </div>
                </div>

                <button onClick={() => setStep("form")} className="btn-primary w-full">
                  Continue to details
                </button>
                {hasWhatsApp && (
                  <a
                    href={waMeLink(whatsappNumber, cartOrderText())}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-ghost w-full gap-1.5"
                  >
                    <Glyph name="chat" size={16} /> Or send order on WhatsApp
                  </a>
                )}
              </div>
            )}

            {step === "form" && (
              <form onSubmit={submitOrder} className="space-y-3.5 p-5">
                <div>
                  <label className="label">Your full name *</label>
                  <input
                    className="input"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g. John Doe"
                    required
                  />
                </div>
                <div>
                  <label className="label">WhatsApp phone number</label>
                  <input
                    className="input"
                    inputMode="tel"
                    placeholder="e.g. +228 90 00 00 00"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                  />
                  <span className="text-[11px] text-arctic-500">For delivery coordination & updates</span>
                </div>
                <div>
                  <label className="label">Email address (optional)</label>
                  <input
                    className="input"
                    type="email"
                    placeholder="To receive your order receipt"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                  />
                </div>

                {deliveryEnabled && (
                  <div className="rounded-xl border border-arctic-400/30 bg-arctic-100/30 p-3 space-y-2.5">
                    <label className="text-xs font-semibold text-arctic-800 block">
                      Mode de récupération
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setFulfillment("pickup")}
                        className={`p-2.5 rounded-lg border text-left text-xs transition-colors ${
                          fulfillment === "pickup"
                            ? "border-emerald-600 bg-emerald-50 text-emerald-900 font-semibold"
                            : "border-arctic-200 bg-white text-arctic-700 hover:bg-arctic-50"
                        }`}
                      >
                        <span className="block font-bold">🏪 Retrait</span>
                        <span className="text-[10px] text-arctic-500">Gratuit en boutique</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setFulfillment("delivery")}
                        className={`p-2.5 rounded-lg border text-left text-xs transition-colors ${
                          fulfillment === "delivery"
                            ? "border-emerald-600 bg-emerald-50 text-emerald-900 font-semibold"
                            : "border-arctic-200 bg-white text-arctic-700 hover:bg-arctic-50"
                        }`}
                      >
                        <span className="block font-bold">🛵 Livraison</span>
                        <span className="text-[10px] text-arctic-500">À votre adresse</span>
                      </button>
                    </div>

                    {fulfillment === "delivery" && (
                      <div className="space-y-2 pt-1 border-t border-arctic-200/50">
                        {zonesList.length > 0 && (
                          <div>
                            <label className="text-[11px] font-medium text-arctic-700 block mb-1">
                              Zone de livraison
                            </label>
                            <select
                              value={selectedZone}
                              onChange={(e) => setSelectedZone(e.target.value)}
                              className="input text-xs py-1.5"
                            >
                              {zonesList.map((z) => (
                                <option key={z.name} value={z.name}>
                                  {z.name} (+{formatMoney(z.feeCents, currency)})
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        <div>
                          <label className="text-[11px] font-medium text-arctic-700 block mb-1">
                            Adresse / Quartier de livraison *
                          </label>
                          <input
                            required
                            value={deliveryAddress}
                            onChange={(e) => setDeliveryAddress(e.target.value)}
                            placeholder="Quartier, repère, ville..."
                            className="input text-xs py-1.5"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="label">Notes complémentaires (optionnel)</label>
                  <textarea
                    className="input min-h-[55px]"
                    placeholder="Instructions particulières, détails taille ou couleur..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </div>

                {/* Mode de règlement */}
                <div className="rounded-xl border border-arctic-400/30 bg-arctic-100/30 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-arctic-800 dark:text-arctic-100 block">
                      Mode de règlement souhaité *
                    </label>
                    <span className="text-[10px] uppercase font-bold text-emerald-600 tracking-wide">
                      Options flexibles
                    </span>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    {/* FedaPay Sandbox / Live — Recommandé */}
                    <label
                      className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-all ${
                        paymentMethod === "fedapay"
                          ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 ring-2 ring-emerald-500/30"
                          : "border-arctic-200 dark:border-arctic-700 bg-white dark:bg-arctic-800 hover:bg-arctic-50"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="radio"
                          name="paymentMethod"
                          value="fedapay"
                          checked={paymentMethod === "fedapay"}
                          onChange={() => setPaymentMethod("fedapay")}
                          className="h-4 w-4 text-emerald-600 focus:ring-emerald-500"
                        />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-bold text-arctic-900 dark:text-white">
                              💳 FedaPay (Mobile Money & Carte)
                            </span>
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-600 text-white">
                              Sandbox Actif
                            </span>
                          </div>
                          <p className="text-[11px] text-arctic-500">
                            T-Money, Flooz Moov, MTN MoMo, Celtiis & Visa/Mastercard
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                        Recommandé
                      </span>
                    </label>

                    {/* USSD T-Money */}
                    <label
                      className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-all ${
                        paymentMethod === "tmoney"
                          ? "border-amber-500 bg-amber-50 dark:bg-amber-950/30 ring-1 ring-amber-500"
                          : "border-arctic-200 dark:border-arctic-700 bg-white dark:bg-arctic-800 hover:bg-arctic-50"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="radio"
                          name="paymentMethod"
                          value="tmoney"
                          checked={paymentMethod === "tmoney"}
                          onChange={() => setPaymentMethod("tmoney")}
                          className="h-4 w-4 text-amber-600 focus:ring-amber-500"
                        />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-bold text-arctic-900 dark:text-white">
                              🟡 USSD T-Money
                            </span>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-200/70 text-amber-900 font-bold">
                              *145#
                            </span>
                          </div>
                          <p className="text-[11px] text-arctic-500">
                            Togocom Togo — Paiement direct par code USSD
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                        Togo
                      </span>
                    </label>

                    {/* USSD Flooz */}
                    <label
                      className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-all ${
                        paymentMethod === "flooz"
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30 ring-1 ring-blue-500"
                          : "border-arctic-200 dark:border-arctic-700 bg-white dark:bg-arctic-800 hover:bg-arctic-50"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="radio"
                          name="paymentMethod"
                          value="flooz"
                          checked={paymentMethod === "flooz"}
                          onChange={() => setPaymentMethod("flooz")}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                        />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-bold text-arctic-900 dark:text-white">
                              🔵 USSD Flooz
                            </span>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-blue-200/70 text-blue-900 font-bold">
                              *155#
                            </span>
                          </div>
                          <p className="text-[11px] text-arctic-500">
                            Moov Africa Togo — Virement mobile money direct
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                        Togo
                      </span>
                    </label>

                    {/* Paiement Mobile / En ligne automatique */}
                    <label
                      className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-all ${
                        paymentMethod === "online"
                          ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 ring-1 ring-emerald-600"
                          : "border-arctic-200 dark:border-arctic-700 bg-white dark:bg-arctic-800 hover:bg-arctic-50"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="radio"
                          name="paymentMethod"
                          value="online"
                          checked={paymentMethod === "online"}
                          onChange={() => setPaymentMethod("online")}
                          className="h-4 w-4 text-emerald-600 focus:ring-emerald-500"
                        />
                        <div>
                          <span className="text-sm font-bold text-arctic-900 dark:text-white block">
                            ⚡ Paiement en ligne / API
                          </span>
                          <p className="text-[11px] text-arctic-500">
                            CinetPay, PayGate, Carte bancaire ou Push direct
                          </p>
                        </div>
                      </div>
                    </label>

                    {/* Paiement Garanti WEscrow */}
                    <label
                      className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-all ${
                        paymentMethod === "wescrow"
                          ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30 ring-1 ring-indigo-500"
                          : "border-arctic-200 dark:border-arctic-700 bg-white dark:bg-arctic-800 hover:bg-arctic-50"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="radio"
                          name="paymentMethod"
                          value="wescrow"
                          checked={paymentMethod === "wescrow"}
                          onChange={() => setPaymentMethod("wescrow")}
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                        />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-bold text-indigo-900 dark:text-indigo-300">
                              🛡️ Paiement Garanti WEscrow
                            </span>
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-700">
                              Safe Hands
                            </span>
                          </div>
                          <p className="text-[11px] text-arctic-500">
                            Fonds sous séquestre jusqu&apos;à réception confirmée
                          </p>
                        </div>
                      </div>
                    </label>

                    {/* Espèces à la livraison */}
                    <label
                      className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-all ${
                        paymentMethod === "cash"
                          ? "border-arctic-400 bg-arctic-100 dark:bg-arctic-800 ring-1 ring-arctic-400"
                          : "border-arctic-200 dark:border-arctic-700 bg-white dark:bg-arctic-800 hover:bg-arctic-50"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="radio"
                          name="paymentMethod"
                          value="cash"
                          checked={paymentMethod === "cash"}
                          onChange={() => setPaymentMethod("cash")}
                          className="h-4 w-4 text-arctic-600 focus:ring-arctic-500"
                        />
                        <div>
                          <span className="text-sm font-bold text-arctic-900 dark:text-white block">
                            💵 Espèces / Remise en main propre
                          </span>
                          <p className="text-[11px] text-arctic-500">
                            Paiement à la livraison ou lors du retrait
                          </p>
                        </div>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="space-y-1 border-t border-arctic-400/30 pt-2.5 text-xs">
                  <div className="flex items-center justify-between text-arctic-600">
                    <span>Sous-total articles</span>
                    <span>{formatConvertedPrice(total, currency, displayCurrency).primary}</span>
                  </div>
                  {deliveryFee > 0 && (
                    <div className="flex items-center justify-between text-arctic-600">
                      <span>Frais de livraison</span>
                      <span>+{formatConvertedPrice(deliveryFee, currency, displayCurrency).primary}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between font-bold text-arctic-900 text-base pt-1">
                    <span>Total à payer</span>
                    <div className="text-right">
                      <span>{formatConvertedPrice(grandTotal, currency, displayCurrency).primary}</span>
                      {displayCurrency !== currency && (
                        <span className="text-[11px] font-normal text-arctic-500 block">
                          (~{formatMoney(grandTotal, currency)})
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {error && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
                )}

                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={() => setStep("cart")} className="btn-ghost flex-1">
                    Retour
                  </button>
                  <button className="btn-primary flex-1" disabled={submitting}>
                    {submitting ? "Validation…" : "Confirmer la commande"}
                  </button>
                </div>
              </form>
            )}

            {step === "success" && placedSummary && (() => {
              const effectivePayee = momoNumber || whatsappNumber || "";
              const amountMajor = Math.round(placedSummary.totalCents / 100);
              const isUssd = placedSummary.paymentMethod === "tmoney" || placedSummary.paymentMethod === "flooz";
              const ussdCode = placedSummary.paymentMethod === "tmoney" ? "*145#" : "*155#";
              const directCode = isUssd
                ? directUssdCode(
                    placedSummary.paymentMethod as "tmoney" | "flooz",
                    effectivePayee,
                    amountMajor
                  )
                : null;

              return (
                <div className="space-y-4 p-5 text-center">
                  <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-3xl">
                    🎉
                  </div>
                  <div>
                    <h3 className="font-bold text-arctic-900 text-lg">
                      Merci pour votre commande, {customerName || "cher client"} !
                    </h3>
                    <p className="mt-1 text-sm text-arctic-600">
                      Votre commande a bien été enregistrée chez <strong>{shopName}</strong>.
                      {customerEmail ? " Un email récapitulatif vous a été envoyé." : ""}
                    </p>
                    <p className="mt-1 text-xs text-arctic-500 font-mono">
                      Réf : #{placedSummary.orderId.slice(0, 8)}
                    </p>
                  </div>

                  {/* Carte interactive USSD si TMoney ou Flooz choisi */}
                  {isUssd && (
                    <div className="rounded-xl border border-arctic-300/80 bg-arctic-50 dark:bg-arctic-900/60 p-4 text-left shadow-sm">
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-arctic-200 dark:border-arctic-700">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">
                            {placedSummary.paymentMethod === "tmoney" ? "🟡" : "🔵"}
                          </span>
                          <div>
                            <h4 className="text-sm font-bold text-arctic-900 dark:text-white">
                              Paiement {placedSummary.paymentMethod === "tmoney" ? "T-Money (Togocom)" : "Flooz (Moov Africa)"}
                            </h4>
                            <span className="text-[11px] font-mono text-arctic-500">
                              Code USSD : {ussdCode}
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                          {formatMoney(placedSummary.totalCents, currency)}
                        </span>
                      </div>

                      <dl className="space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <dt className="text-arctic-500">Numéro du vendeur :</dt>
                          <dd className="flex items-center gap-1.5 font-bold text-arctic-900 dark:text-white">
                            <span>{effectivePayee || "Non renseigné"}</span>
                            {effectivePayee && (
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await navigator.clipboard.writeText(effectivePayee);
                                    setCopiedMomo(true);
                                    setTimeout(() => setCopiedMomo(false), 1500);
                                  } catch {}
                                }}
                                className="px-2 py-0.5 rounded border border-arctic-300 text-[10px] font-semibold hover:bg-arctic-200"
                              >
                                {copiedMomo ? "Copié !" : "Copier"}
                              </button>
                            )}
                          </dd>
                        </div>
                        <div className="flex items-center justify-between">
                          <dt className="text-arctic-500">Montant exact :</dt>
                          <dd className="flex items-center gap-1.5 font-bold text-emerald-600">
                            <span>{formatMoney(placedSummary.totalCents, currency)}</span>
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await navigator.clipboard.writeText(String(amountMajor));
                                  setCopiedAmount(true);
                                  setTimeout(() => setCopiedAmount(false), 1500);
                                } catch {}
                              }}
                              className="px-2 py-0.5 rounded border border-arctic-300 text-[10px] font-semibold hover:bg-arctic-200"
                            >
                              {copiedAmount ? "Copié !" : "Copier"}
                            </button>
                          </dd>
                        </div>
                      </dl>

                      {/* Boutons d'appel USSD */}
                      <div className="mt-3 space-y-1.5">
                        {directCode && (
                          <a
                            href={telHref(directCode)}
                            className="btn-primary w-full justify-center gap-1.5 text-xs py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                          >
                            <Glyph name="phone" size={14} /> Composer le code direct ({directCode})
                          </a>
                        )}
                        <a
                          href={telHref(ussdCode)}
                          className="btn-ghost w-full justify-center gap-1.5 text-xs py-1.5 border border-arctic-300 font-medium"
                        >
                          <Glyph name="phone" size={13} /> Composer le menu standard ({ussdCode})
                        </a>
                      </div>

                      {/* Instructions pas à pas */}
                      <details className="mt-2.5 text-xs text-arctic-600">
                        <summary className="cursor-pointer font-semibold hover:text-arctic-900 py-1">
                          Instructions détaillées pas à pas
                        </summary>
                        <ol className="mt-1.5 space-y-1 pl-4 list-decimal text-[11px] text-arctic-700 dark:text-arctic-300">
                          {placedSummary.paymentMethod === "tmoney" ? (
                            <>
                              <li>Composez *145# sur votre ligne Togocel / T-Money</li>
                              <li>Choisissez l&apos;option 1 « Transfert d&apos;argent »</li>
                              <li>Entrez le numéro du vendeur : {effectivePayee}</li>
                              <li>Entrez le montant : {formatMoney(placedSummary.totalCents, currency)}</li>
                              <li>Entrez votre code secret T-Money pour valider</li>
                            </>
                          ) : (
                            <>
                              <li>Composez *155# sur votre ligne Moov Africa / Flooz</li>
                              <li>Choisissez l&apos;option 1 « Transfert d&apos;argent »</li>
                              <li>Entrez le numéro Moov du vendeur : {effectivePayee}</li>
                              <li>Entrez le montant : {formatMoney(placedSummary.totalCents, currency)}</li>
                              <li>Confirmez avec votre code PIN secret Flooz</li>
                            </>
                          )}
                        </ol>
                      </details>
                    </div>
                  )}

                  {/* Bouton Paiement direct FedaPay Sandbox */}
                  <div className="rounded-xl border-2 border-emerald-500/80 bg-emerald-50/70 p-3.5 text-left space-y-2.5 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-emerald-950 flex items-center gap-1.5">
                        <span>💳</span> Règlement instantané FedaPay
                      </span>
                      <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
                        Sandbox
                      </span>
                    </div>
                    <p className="text-[11px] text-arctic-700">
                      Payez votre commande de <strong>{formatMoney(placedSummary.totalCents, currency)}</strong> maintenant par T-Money, Flooz, Mobile Money ou Carte et recevez votre reçu sur WhatsApp.
                    </p>
                    <button
                      type="button"
                      disabled={launchingFeda}
                      onClick={async () => {
                        setLaunchingFeda(true);
                        try {
                          const res = await fetch("/api/payments/checkout", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              orderId: placedSummary.orderId,
                              provider: "fedapay",
                              returnUrl: `${window.location.origin}/pay/${placedSummary.orderId}?paid=1`,
                            }),
                          });
                          const d = await res.json().catch(() => ({}));
                          if (res.ok && d.checkoutUrl) {
                            window.location.href = d.checkoutUrl;
                            return;
                          }
                          setLaunchingFeda(false);
                        } catch {
                          setLaunchingFeda(false);
                        }
                      }}
                      className="btn-primary w-full justify-center gap-2 py-3 !bg-emerald-600 hover:!bg-emerald-700 !text-white text-sm font-bold shadow-md"
                    >
                      {launchingFeda
                        ? "Ouverture de FedaPay Sandbox…"
                        : `💳 Payer ${formatMoney(placedSummary.totalCents, currency)} avec FedaPay →`}
                    </button>
                  </div>

                  {/* Bouton Envoi WhatsApp de la commande */}
                  {hasWhatsApp && (
                    <a
                      href={placedSummary.waLink}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-ghost w-full justify-center gap-2 py-2.5 border border-emerald-600 text-emerald-800 hover:bg-emerald-50 text-xs font-bold"
                    >
                      <Glyph name="chat" size={16} /> Confirmer aussi sur WhatsApp 💬
                    </a>
                  )}

                  {/* Lien page de paiement détaillée */}
                  <a
                    href={`/pay/${placedSummary.orderId}`}
                    className="btn-ghost w-full justify-center gap-1.5 py-2.5 border border-arctic-300/80 text-xs font-semibold"
                  >
                    <Glyph name="phone" size={15} /> Voir toutes les options de paiement (WEscrow, etc.)
                  </a>

                  <button
                    onClick={() => {
                      setOpen(false);
                      setStep("cart");
                    }}
                    className="btn-ghost w-full text-xs text-arctic-500"
                  >
                    Continuer mes achats
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* AI Chatbot Assistant on shop powered by Gemini Flash */}
      {assistantConfig?.aiEnabled !== false && (
        <ShopAiAssistant
          shopSlug={shopSlug}
          shopName={shopName}
          currency={displayCurrency}
          whatsappNumber={whatsappNumber}
          assistantName={assistantConfig?.assistantName}
          welcomeMessage={assistantConfig?.welcomeMessage}
          whatsappPrefillMessage={assistantConfig?.whatsappPrefillMessage}
          externalOpenRequest={aiOpenTrigger}
          cartBarVisible={cart.length > 0 && !open}
          modalOpen={open || Boolean(selectedProduct)}
          onAddProductById={(productId) => {
            const prod = products.find((item) => item.id === productId);
            if (prod && prod.stock > 0) {
              const sizes = parseSizes(prod.sizes);
              addToCart(prod, sizes[0] || "", 1);
            }
          }}
          onBuyNowProductById={(productId) => {
            const prod = products.find((item) => item.id === productId);
            if (prod && prod.stock > 0) {
              const sizes = parseSizes(prod.sizes);
              addToCart(prod, sizes[0] || "", 1);
              setStep("form");
              setError("");
              setOpen(true);
            }
          }}
          onViewProductById={(productId) => {
            const prod = products.find((item) => item.id === productId);
            if (prod) setSelectedProduct(prod);
          }}
        />
      )}

      <footer className="mx-auto mt-8 max-w-5xl px-4 pb-6 text-center text-xs text-arctic-500">
        Powered by <span className="font-semibold">Japora</span>
      </footer>
    </div>
  );
}

function ProductCard({
  p,
  collectionName,
  currency,
  displayCurrency = "XOF",
  onAdd,
  onClickPreview,
  waMeOrderLink,
}: {
  p: Product;
  collectionName?: string;
  currency: string;
  displayCurrency?: string;
  onAdd: (p: Product, size: string, qty: number) => void;
  onClickPreview: () => void;
  waMeOrderLink: ((size: string) => string) | null;
}) {
  const sizes = parseSizes(p.sizes);
  const [size, setSize] = useState(sizes[0] ?? "");
  const [qty, setQty] = useState(1);
  const outOfStock = p.stock <= 0;
  const converted = formatConvertedPrice(p.priceCents, currency, displayCurrency);

  const isNew = p.createdAt
    ? Date.now() - new Date(p.createdAt).getTime() < 7 * 24 * 60 * 60 * 1000
    : false;

  return (
    <article className="card group relative flex flex-col overflow-hidden transition-all duration-short ease-spring hover:-translate-y-1 hover:shadow-elev-2">
      {/* Product Image / Placeholder */}
      <div
        className="relative aspect-square cursor-pointer overflow-hidden bg-arctic-200/65"
        onClick={onClickPreview}
      >
        {p.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={p.imageUrl}
            alt={p.name}
            className="h-full w-full object-cover transition-transform duration-medium group-hover:scale-105"
          />
        ) : (
          <ProductPlaceholder name={p.name} size="md" />
        )}

        {/* Badges */}
        <div className="absolute left-2 top-2 flex flex-col gap-1">
          {collectionName && (
            <span className="rounded-full bg-brand-dark/90 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-xs backdrop-blur-xs">
              📁 {collectionName}
            </span>
          )}
          {isNew && (
            <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-bold text-white shadow-xs">
              Nouveau
            </span>
          )}
          {p.condition && p.condition !== "new" && (
            <span className="rounded-full bg-arctic-900/80 px-2 py-0.5 text-[11px] font-semibold capitalize text-white backdrop-blur">
              {p.condition === "used" ? "Occasion" : "Reconditionné"}
            </span>
          )}
        </div>

        {outOfStock && (
          <div className="absolute inset-0 grid place-items-center bg-arctic-900/60 backdrop-blur-xs">
            <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-arctic-900 shadow">
              Épuisé
            </span>
          </div>
        )}
        {!outOfStock && p.stock <= 3 && (
          <span className="absolute right-2 top-2 rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-semibold text-white shadow-xs">
            Plus que {p.stock}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col space-y-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3
            className="font-semibold leading-tight text-arctic-900 transition-colors group-hover:text-arctic-700 cursor-pointer"
            onClick={onClickPreview}
          >
            {p.name}
          </h3>
          <div className="flex flex-col items-end">
            <span className="whitespace-nowrap font-bold text-brand-dark">
              {converted.primary}
            </span>
            {converted.original && (
              <span className="text-[10px] text-arctic-500 whitespace-nowrap">
                ~{converted.original}
              </span>
            )}
          </div>
        </div>

        {p.description && (
          <p className="line-clamp-2 text-xs text-arctic-600">{p.description}</p>
        )}

        {sizes.length > 0 && (
          <div>
            <label className="label !mb-1 !text-xs">Taille / Variante</label>
            <select
              className="input !py-1 text-xs"
              value={size}
              onChange={(e) => setSize(e.target.value)}
              disabled={outOfStock}
            >
              {sizes.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="mt-auto flex items-center gap-2 pt-2">
          <div className="flex items-center rounded-lg border border-arctic-400/30">
            <button
              type="button"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              disabled={outOfStock}
              className="px-2 py-1 text-arctic-700 hover:bg-arctic-200/65 disabled:opacity-40"
            >
              −
            </button>
            <span className="w-6 text-center text-xs font-semibold">{qty}</span>
            <button
              type="button"
              onClick={() => setQty((q) => Math.min(p.stock, q + 1))}
              disabled={outOfStock || qty >= p.stock}
              className="px-2 py-1 text-arctic-700 hover:bg-arctic-200/65 disabled:opacity-40"
            >
              +
            </button>
          </div>
          <button
            type="button"
            onClick={() => onAdd(p, size, qty)}
            disabled={outOfStock}
            className="btn-primary flex-1 !py-1.5 text-xs"
          >
            {outOfStock ? "Indisponible" : "Ajouter au panier"}
          </button>
        </div>

        {waMeOrderLink && !outOfStock && (
          <a
            href={waMeOrderLink(size)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex w-full items-center justify-center gap-1 text-center text-[11px] font-medium text-brand-dark hover:underline pt-0.5"
          >
            <Glyph name="chat" size={12} /> Commander sur WhatsApp
          </a>
        )}
      </div>
    </article>
  );
}
