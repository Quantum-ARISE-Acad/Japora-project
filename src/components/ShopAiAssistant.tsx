"use client";

import React, { useState, useRef, useEffect } from "react";
import { isStoredWhatsAppNumberValid } from "@/lib/whatsapp-number";
import QRCode from "qrcode";
import type { ShopAiActionButton } from "@/app/api/ai/shop-chat/route";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  actions?: ShopAiActionButton[];
}

interface TrackedOrder {
  id: string;
  refCode: string;
  customerName: string;
  status: string;
  statusLabel: string;
  progressPercent: number;
  totalCents: number;
  currency: string;
  createdAt: string;
  payUrl: string;
  items: { productName: string; quantity: number; size: string }[];
}

interface CatalogProductSummary {
  id: string;
  name: string;
  priceFormatted: string;
  priceMajor: number;
  stock: number;
}

interface ShopAiAssistantProps {
  shopSlug: string;
  shopName: string;
  whatsappNumber?: string;
  currency?: string;
  assistantName?: string;
  welcomeMessage?: string;
  whatsappPrefillMessage?: string;
  externalOpenRequest?: number;
  cartBarVisible?: boolean;
  modalOpen?: boolean;
  onAddProductById?: (productId: string) => void;
  onBuyNowProductById?: (productId: string) => void;
  onViewProductById?: (productId: string) => void;
}

export default function ShopAiAssistant({
  shopSlug,
  shopName,
  whatsappNumber,
  currency = "XOF",
  assistantName,
  welcomeMessage,
  whatsappPrefillMessage,
  externalOpenRequest,
  cartBarVisible = false,
  modalOpen = false,
  onAddProductById,
  onBuyNowProductById,
  onViewProductById,
}: ShopAiAssistantProps) {
  const displayAssistantName = assistantName || `Assistant IA ${shopName}`;
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "deal" | "track" | "qr">("chat");

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome-1",
      role: "assistant",
      content:
        welcomeMessage ||
        `Bonjour ! 👋 Je suis **${displayAssistantName}**, votre conseiller intelligent propulsé par **Google Gemini**.\n\nJe peux :\n• Vous présenter le **catalogue** et **chercher un produit disponible**\n• Passer votre **commande** en 1 clic\n• Envoyer une **proposition de deal** au vendeur\n• **Suivre l'état de votre commande** en direct`,
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Catalog summary for the Deal tab
  const [catalogList, setCatalogList] = useState<CatalogProductSummary[]>([]);
  const [dealProductId, setDealProductId] = useState("");
  const [dealProposedPrice, setDealProposedPrice] = useState("");
  const [dealQuantity, setDealQuantity] = useState(1);
  const [dealCustomerName, setDealCustomerName] = useState("");
  const [dealCustomerPhone, setDealCustomerPhone] = useState("22893730817");
  const [dealNote, setDealNote] = useState("");
  const [dealSubmitting, setDealSubmitting] = useState(false);
  const [dealSuccess, setDealSuccess] = useState<{ refCode: string; message: string } | null>(null);
  const [dealError, setDealError] = useState("");

  // Order tracking state
  const [trackRefInput, setTrackRefInput] = useState("");
  const [trackPhoneInput, setTrackPhoneInput] = useState("22893730817");
  const [trackLoading, setTrackLoading] = useState(false);
  const [trackedOrders, setTrackedOrders] = useState<TrackedOrder[]>([]);
  const [trackError, setTrackError] = useState("");

  // WhatsApp QR code state
  const [waQrSvg, setWaQrSvg] = useState<string>("");

  // Without its country code the number would open a wrong WhatsApp contact: no link then.
  const cleanPhone = isStoredWhatsAppNumberValid(whatsappNumber) ? (whatsappNumber || "").replace(/\D/g, "") : "";
  const defaultWaText =
    whatsappPrefillMessage ||
    `Bonjour ${shopName} (${shopSlug}) ! Je viens de scanner votre QR code sur Japora. Pouvez-vous m'aider avec vos articles ?`;
  const whatsappUrl = cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(defaultWaText)}`
    : typeof window !== "undefined"
    ? window.location.href
    : "";

  // Auto-open if URL has ?assistant=open or if triggered from ShopWhatsAppQrBanner
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const param = sp.get("assistant");
    if (param === "open" || param === "1" || param === "chat") {
      setIsOpen(true);
      setActiveTab("chat");
    } else if (param === "deal") {
      setIsOpen(true);
      setActiveTab("deal");
    } else if (param === "track") {
      setIsOpen(true);
      setActiveTab("track");
    } else if (param === "qr") {
      setIsOpen(true);
      setActiveTab("qr");
    }

    const onOpenEvent = () => {
      setIsOpen(true);
      setActiveTab("chat");
    };
    window.addEventListener("japora:open-ai-assistant", onOpenEvent);
    return () => window.removeEventListener("japora:open-ai-assistant", onOpenEvent);
  }, []);

  useEffect(() => {
    if (externalOpenRequest && externalOpenRequest > 0) {
      setIsOpen(true);
      setActiveTab("chat");
    }
  }, [externalOpenRequest]);

  // Generate QR code for WhatsApp redirect
  useEffect(() => {
    if (!whatsappUrl) return;
    let cancelled = false;
    QRCode.toString(whatsappUrl, {
      type: "svg",
      margin: 1,
      width: 220,
      color: { dark: "#075E54", light: "#FFFFFF" },
    })
      .then((svg) => {
        if (!cancelled) setWaQrSvg(svg);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [whatsappUrl]);

  useEffect(() => {
    if (isOpen && activeTab === "chat") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, activeTab]);

  const sendMessage = async (textToSend?: string) => {
    const query = (textToSend ?? input).trim();
    if (!query || isLoading) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: query,
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/ai/shop-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopSlug,
          message: query,
          currency,
          history: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const data = await response.json();
      if (Array.isArray(data.catalogSummary) && data.catalogSummary.length > 0) {
        setCatalogList(data.catalogSummary);
        if (!dealProductId) {
          setDealProductId(data.catalogSummary[0].id);
          setDealProposedPrice(String(Math.round(data.catalogSummary[0].priceMajor * 0.9)));
        }
      }

      const aiMsg: Message = {
        id: `ai-${Date.now()}`,
        role: "assistant",
        content:
          data.reply ||
          "Désolé, je n'ai pas pu traiter votre demande. Essayez à nouveau ou contactez le vendeur sur WhatsApp.",
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        actions: Array.isArray(data.actions) ? data.actions : undefined,
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content:
            "Une erreur réseau est survenue. Vous pouvez réessayer ou ouvrir directement WhatsApp.",
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleActionClick = (action: ShopAiActionButton) => {
    switch (action.type) {
      case "buy_now":
        if (action.productId && onBuyNowProductById) {
          onBuyNowProductById(action.productId);
          setIsOpen(false);
        } else if (action.productId && onAddProductById) {
          onAddProductById(action.productId);
        }
        break;
      case "propose_deal":
        if (action.productId) {
          setDealProductId(action.productId);
          if (action.priceMajor) {
            setDealProposedPrice(String(Math.round(action.priceMajor * 0.9)));
          }
        }
        setDealSuccess(null);
        setActiveTab("deal");
        break;
      case "add_to_cart":
        if (action.productId && onAddProductById) {
          onAddProductById(action.productId);
        }
        break;
      case "view_product":
        if (action.productId && onViewProductById) {
          onViewProductById(action.productId);
        }
        break;
      case "track_order":
        setActiveTab("track");
        break;
      case "open_whatsapp_qr":
        setActiveTab("qr");
        break;
      case "pay_order":
      case "whatsapp_order":
        if (action.url) {
          window.open(action.url, "_blank", "noopener,noreferrer");
        }
        break;
    }
  };

  const handleDealSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dealProductId || !dealProposedPrice || dealSubmitting) return;
    setDealSubmitting(true);
    setDealError("");
    setDealSuccess(null);
    try {
      const res = await fetch("/api/orders/deal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopSlug,
          productId: dealProductId,
          proposedPrice: Number(dealProposedPrice),
          quantity: dealQuantity,
          customerName: dealCustomerName.trim() || "Client Boutique",
          customerPhone: dealCustomerPhone.trim(),
          note: dealNote.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDealError(data.error || "Impossible d'envoyer votre offre.");
      } else {
        setDealSuccess({ refCode: data.refCode, message: data.message });
        setTrackRefInput(data.refCode);
      }
    } catch {
      setDealError("Erreur réseau lors de l'envoi du deal.");
    } finally {
      setDealSubmitting(false);
    }
  };

  const fetchTrackedOrders = async (refOverride?: string, phoneOverride?: string) => {
    const refVal = (refOverride ?? trackRefInput).trim();
    const phoneVal = (phoneOverride ?? trackPhoneInput).trim();
    setTrackLoading(true);
    setTrackError("");
    try {
      const res = await fetch("/api/orders/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopSlug,
          orderRef: refVal,
          phone: phoneVal,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTrackError(data.error || "Impossible de rechercher la commande.");
        setTrackedOrders([]);
      } else {
        setTrackedOrders(data.orders || []);
        if ((data.orders || []).length === 0) {
          setTrackError(
            data.message || "Aucune commande trouvée avec ces informations.",
          );
        }
      }
    } catch {
      setTrackError("Erreur réseau lors de la recherche.");
    } finally {
      setTrackLoading(false);
    }
  };

  const handleTrackSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetchTrackedOrders();
  };

  // Auto-load live orders when switching to the Track tab
  useEffect(() => {
    if (isOpen && activeTab === "track") {
      void fetchTrackedOrders();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, activeTab, shopSlug]);

  // Load catalog list when switching to the Deal tab if not yet loaded
  useEffect(() => {
    if (isOpen && activeTab === "deal" && catalogList.length === 0) {
      fetch("/api/ai/shop-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopSlug,
          message: "Montre-moi le catalogue",
          currency,
        }),
      })
        .then((r) => r.json())
        .then((d) => {
          if (Array.isArray(d.catalogSummary) && d.catalogSummary.length > 0) {
            setCatalogList(d.catalogSummary);
            setDealProductId(d.catalogSummary[0].id);
            setDealProposedPrice(String(Math.round(d.catalogSummary[0].priceMajor * 0.9)));
          }
        })
        .catch(() => {});
    }
  }, [isOpen, activeTab, catalogList.length, shopSlug, currency]);

  const quickPrompts = [
    "🛍️ Voir le catalogue des produits",
    "🔍 Cherche-moi un produit disponible en stock",
    "🤝 Je veux proposer un deal sur un article",
    "📦 Suivre ma commande",
  ];

  const renderFormattedText = (text: string) => {
    return text.split("\n").map((line, idx) => {
      const parts = line.split(/(\*\*.*?\*\*)/g);
      return (
        <p key={idx} className={idx > 0 ? "mt-1.5" : ""}>
          {parts.map((part, pIdx) => {
            if (part.startsWith("**") && part.endsWith("**")) {
              return (
                <strong key={pIdx} className="font-bold text-white">
                  {part.slice(2, -2)}
                </strong>
              );
            }
            return <span key={pIdx}>{part}</span>;
          })}
        </p>
      );
    });
  };

  const selectedDealProduct = catalogList.find((p) => p.id === dealProductId);

  if (modalOpen && !isOpen) {
    return null;
  }

  return (
    <>
      {/* Floating Button — automatically lifts up when sticky bottom cart bar is visible */}
      <div
        className={`fixed right-4 sm:right-6 z-30 flex flex-col items-end gap-2 transition-all duration-300 ${
          cartBarVisible ? "bottom-24" : "bottom-6"
        }`}
      >
        {!isOpen && (
          <div
            onClick={() => setIsOpen(true)}
            className="hidden sm:flex items-center gap-2 bg-slate-900/95 border border-emerald-500/40 text-emerald-300 text-xs font-medium px-3.5 py-2 rounded-full shadow-lg backdrop-blur-md cursor-pointer hover:border-emerald-400 transition"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Questions, Catalogue, Deal ou Suivi ? Demandez à l&apos;IA ✨</span>
          </div>
        )}

        <button
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Ouvrir l'Assistant IA de la boutique"
          className="group relative flex items-center gap-2.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-600 hover:from-emerald-400 hover:to-cyan-500 text-white font-bold px-5 py-3.5 rounded-full shadow-2xl shadow-emerald-500/30 transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer"
        >
          <span className="text-xl">{isOpen ? "✕" : "✨"}</span>
          <span className="text-sm tracking-wide">
            {isOpen ? "Fermer" : "Assistant IA & WhatsApp"}
          </span>
        </button>
      </div>

      {/* Chat & Tools Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-4 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-[440px] max-h-[650px] h-[80vh] bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-600/95 via-teal-600/95 to-slate-900 px-4 py-3 border-b border-slate-700/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center text-lg shadow-inner">
                  🤖
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    {displayAssistantName}
                    <span className="text-[10px] font-semibold bg-emerald-400/20 text-emerald-200 border border-emerald-400/30 px-2 py-0.5 rounded-full">
                      Gemini IA
                    </span>
                  </h3>
                  <p className="text-[11px] text-emerald-100/80 truncate max-w-[230px]">
                    Catalogue • Recherche • Deals • Commandes • Suivi
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-300 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* 4 Navigation Tabs */}
            <div className="mt-2.5 grid grid-cols-4 gap-1 rounded-xl bg-slate-950/50 p-1">
              <button
                type="button"
                onClick={() => setActiveTab("chat")}
                className={`rounded-lg py-1.5 text-[11px] font-bold transition cursor-pointer ${
                  activeTab === "chat"
                    ? "bg-emerald-500 text-white shadow"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                💬 Chat IA
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("deal")}
                className={`rounded-lg py-1.5 text-[11px] font-bold transition cursor-pointer ${
                  activeTab === "deal"
                    ? "bg-amber-500 text-white shadow"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                🤝 Deal
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("track")}
                className={`rounded-lg py-1.5 text-[11px] font-bold transition cursor-pointer ${
                  activeTab === "track"
                    ? "bg-emerald-500 text-white shadow"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                📦 Suivi
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("qr")}
                className={`rounded-lg py-1.5 text-[11px] font-bold transition cursor-pointer ${
                  activeTab === "qr"
                    ? "bg-emerald-500 text-white shadow"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                📲 QR WA
              </button>
            </div>
          </div>

          {/* TAB 1: AI CHAT + DIRECT ACTION BUTTONS */}
          {activeTab === "chat" && (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${
                      msg.role === "user" ? "items-end" : "items-start"
                    }`}
                  >
                    <div
                      className={`max-w-[88%] rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed ${
                        msg.role === "user"
                          ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-br-xs shadow-md"
                          : "bg-slate-800/95 text-slate-200 border border-slate-700/70 rounded-bl-xs shadow"
                      }`}
                    >
                      {renderFormattedText(msg.content)}
                      <div
                        className={`text-[10px] mt-1.5 text-right ${
                          msg.role === "user" ? "text-emerald-100" : "text-slate-400"
                        }`}
                      >
                        {msg.timestamp}
                      </div>
                    </div>

                    {/* Direct Interactive Action Buttons under AI reply */}
                    {msg.role === "assistant" && msg.actions && msg.actions.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5 max-w-[94%]">
                        {msg.actions.map((act, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleActionClick(act)}
                            className={`text-[11px] font-semibold px-3 py-1.5 rounded-xl border transition cursor-pointer flex items-center gap-1 shadow-xs ${
                              act.type === "buy_now" || act.type === "pay_order"
                                ? "bg-emerald-500 hover:bg-emerald-400 text-white border-emerald-400"
                                : act.type === "propose_deal"
                                ? "bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border-amber-400/40"
                                : act.type === "add_to_cart"
                                ? "bg-teal-500/20 hover:bg-teal-500/30 text-teal-200 border-teal-500/40"
                                : "bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-600"
                            }`}
                          >
                            {act.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-slate-800/90 border border-slate-700/70 rounded-2xl rounded-bl-xs px-4 py-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" />
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce [animation-delay:0.15s]" />
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce [animation-delay:0.3s]" />
                      <span className="text-xs text-slate-400 ml-1">
                        Gemini analyse la boutique...
                      </span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Suggestions */}
              {messages.length <= 2 && !isLoading && (
                <div className="px-4 pb-2 flex flex-wrap gap-1.5">
                  {quickPrompts.map((prompt, idx) => (
                    <button
                      key={idx}
                      onClick={() => sendMessage(prompt)}
                      className="text-[11px] bg-slate-800/90 hover:bg-emerald-500/20 hover:border-emerald-500/40 text-slate-300 hover:text-emerald-300 border border-slate-700 px-2.5 py-1.5 rounded-full transition cursor-pointer"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              )}

              {/* Input Area */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sendMessage();
                }}
                className="p-3 bg-slate-950/80 border-t border-slate-800 flex items-center gap-2"
              >
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ex: Cherche-moi un produit disponible, ou quel est le prix..."
                  disabled={isLoading}
                  className="flex-1 bg-slate-800/90 border border-slate-700 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none transition"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-white font-semibold px-4 py-2.5 rounded-xl text-xs sm:text-sm transition cursor-pointer"
                >
                  Envoyer
                </button>
              </form>
            </>
          )}

          {/* TAB 2: PROPOSE A DEAL (SENT TO VENDOR DASHBOARD FOR VALIDATION) */}
          {activeTab === "deal" && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-white">
              <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  🤝 Proposer un Deal au vendeur
                </h4>
                <p className="mt-1 text-xs text-slate-300">
                  Proposez votre prix sur un article de <strong>{shopName}</strong>. Votre offre est envoyée directement dans le <strong>Dashboard du vendeur</strong> et vous recevez une confirmation WhatsApp dès qu&apos;il la valide !
                </p>
              </div>

              <form onSubmit={handleDealSubmit} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Article souhaité
                  </label>
                  <select
                    value={dealProductId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setDealProductId(id);
                      const prod = catalogList.find((p) => p.id === id);
                      if (prod) {
                        setDealProposedPrice(String(Math.round(prod.priceMajor * 0.9)));
                      }
                    }}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
                    required
                  >
                    {catalogList.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — Prix catalogue : {p.priceFormatted} ({p.stock} en stock)
                      </option>
                    ))}
                  </select>
                </div>

                {selectedDealProduct && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-slate-400">Offres rapides :</span>
                    {[0.9, 0.85, 0.8].map((ratio) => {
                      const suggested = Math.max(1, Math.round(selectedDealProduct.priceMajor * ratio));
                      const pct = Math.round((1 - ratio) * 100);
                      return (
                        <button
                          key={ratio}
                          type="button"
                          onClick={() => setDealProposedPrice(String(suggested))}
                          className="rounded-lg border border-amber-400/40 bg-amber-500/15 hover:bg-amber-500/30 px-2.5 py-1 text-[11px] font-bold text-amber-200 cursor-pointer"
                        >
                          -{pct}% ({suggested * dealQuantity})
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Votre prix total proposé
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={dealProposedPrice}
                      onChange={(e) => setDealProposedPrice(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Quantité
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={dealQuantity}
                      onChange={(e) => setDealQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Votre nom
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Kossi"
                      value={dealCustomerName}
                      onChange={(e) => setDealCustomerName(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Numéro WhatsApp (pour réponse)
                    </label>
                    <input
                      type="tel"
                      placeholder="Ex: 22893730817"
                      value={dealCustomerPhone}
                      onChange={(e) => setDealCustomerPhone(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Message pour le vendeur (optionnel)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Je prends 2 pièces si vous acceptez ce prix !"
                    value={dealNote}
                    onChange={(e) => setDealNote(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={dealSubmitting || !dealProductId}
                  className="w-full rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 py-2.5 text-xs font-bold text-slate-950 transition cursor-pointer shadow-md"
                >
                  {dealSubmitting ? "Envoi au Dashboard du vendeur..." : "🤝 Envoyer ma proposition de Deal au vendeur"}
                </button>
              </form>

              {dealError && (
                <div className="rounded-xl border border-red-500/40 bg-red-950/30 p-3 text-xs text-red-200">
                  {dealError}
                </div>
              )}

              {dealSuccess && (
                <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/40 p-3.5 space-y-2 text-xs">
                  <div className="font-bold text-emerald-300">
                    ✅ Deal #{dealSuccess.refCode} transmis au Dashboard du vendeur !
                  </div>
                  <p className="text-slate-200 whitespace-pre-line">{dealSuccess.message}</p>
                  <button
                    type="button"
                    onClick={() => setActiveTab("track")}
                    className="mt-1 inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-1.5 text-[11px] font-bold text-white cursor-pointer"
                  >
                    📦 Suivre la validation de mon deal #{dealSuccess.refCode}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: LIVE ORDER & DEAL TRACKING */}
          {activeTab === "track" && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-white">
              <div className="rounded-xl border border-slate-700 bg-slate-800/70 p-3.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  📦 Suivre ma commande ou mon deal en direct
                </h4>
                <p className="mt-1 text-xs text-slate-300">
                  Entrez votre code de référence (ex: <code className="text-emerald-300">#AB12CD</code>) ou le numéro de téléphone utilisé lors de la commande WhatsApp.
                </p>

                <form onSubmit={handleTrackSearch} className="mt-3 space-y-2.5">
                  <input
                    type="text"
                    value={trackRefInput}
                    onChange={(e) => setTrackRefInput(e.target.value)}
                    placeholder="Référence commande ou deal (ex: #AB12CD)"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                  />
                  <input
                    type="tel"
                    value={trackPhoneInput}
                    onChange={(e) => setTrackPhoneInput(e.target.value)}
                    placeholder="Ou numéro de téléphone (ex: 22893730817)"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={trackLoading}
                      className="flex-1 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 py-2.5 text-xs font-bold text-white transition cursor-pointer"
                    >
                      {trackLoading ? "Actualisation en direct..." : "🔍 Rechercher / Actualiser en direct"}
                    </button>
                    {(trackRefInput || trackPhoneInput) && (
                      <button
                        type="button"
                        onClick={() => {
                          setTrackRefInput("");
                          setTrackPhoneInput("");
                          void fetchTrackedOrders("", "");
                        }}
                        className="rounded-xl border border-slate-600 bg-slate-900 hover:bg-slate-800 px-3 py-2.5 text-xs font-semibold text-slate-300 cursor-pointer"
                        title="Voir toutes les commandes récentes"
                      >
                        Tout voir
                      </button>
                    )}
                  </div>
                </form>
              </div>

              {trackError && (
                <div className="rounded-xl border border-amber-500/40 bg-amber-950/40 p-3 text-xs text-amber-200">
                  {trackError}
                </div>
              )}

              {trackedOrders.map((ord) => (
                <div
                  key={ord.id}
                  className="rounded-xl border border-emerald-500/40 bg-slate-800/90 p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-300">
                      Commande #{ord.refCode}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {new Date(ord.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="text-xs font-semibold text-white">{ord.statusLabel}</div>

                  {/* Progress bar */}
                  <div className="h-2 w-full rounded-full bg-slate-700 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        ord.status === "CANCELLED" ? "bg-red-500" : "bg-emerald-400"
                      }`}
                      style={{ width: `${ord.progressPercent}%` }}
                    />
                  </div>

                  <ul className="space-y-1 text-xs text-slate-300 border-t border-slate-700/80 pt-2">
                    {ord.items.map((it, idx) => (
                      <li key={idx}>
                        • {it.quantity}× {it.productName}
                        {it.size ? ` (${it.size})` : ""}
                      </li>
                    ))}
                  </ul>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-700/80">
                    <a
                      href={ord.payUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg bg-emerald-500 hover:bg-emerald-400 px-3 py-1.5 text-[11px] font-bold text-white transition"
                    >
                      Voir page de suivi / paiement ↗
                    </a>
                    {cleanPhone && (
                      <a
                        href={`https://wa.me/${cleanPhone}?text=${encodeURIComponent(
                          `Bonjour ${shopName}, je souhaite suivre ma commande #${ord.refCode}.`,
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-semibold text-emerald-300 hover:underline"
                      >
                        💬 Suivre sur WhatsApp
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 4: WHATSAPP QR CODE REDIRECT */}
          {activeTab === "qr" && (
            <div className="flex-1 overflow-y-auto p-5 flex flex-col items-center justify-center text-center space-y-4 text-white">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 px-3 py-1 text-[11px] font-bold text-emerald-300">
                📲 Accès direct à l&apos;Assistant sur WhatsApp
              </div>

              <h4 className="text-base font-extrabold">
                Scannez pour discuter sur WhatsApp
              </h4>
              <p className="text-xs text-slate-300 max-w-xs">
                Scannez ce QR code avec votre téléphone pour ouvrir l&apos;assistant IA de{" "}
                <strong>{shopName}</strong> directement dans WhatsApp : posez vos questions, cherchez un produit, proposez un deal, commandez et suivez votre colis !
              </p>

              <div className="rounded-2xl bg-white p-4 shadow-xl">
                {waQrSvg ? (
                  <div
                    className="h-48 w-48 [&>svg]:h-full [&>svg]:w-full"
                    dangerouslySetInnerHTML={{ __html: waQrSvg }}
                  />
                ) : (
                  <div className="grid h-48 w-48 place-items-center text-xs text-slate-500">
                    Génération du QR Code...
                  </div>
                )}
              </div>

              {cleanPhone && (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full max-w-xs rounded-xl bg-[#25D366] hover:bg-[#1ebe5d] py-3 px-4 text-xs font-bold text-white shadow-lg transition flex items-center justify-center gap-2"
                >
                  <span>💬</span> Ouvrir directement dans WhatsApp ↗
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
