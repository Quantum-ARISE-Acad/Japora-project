"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { REGIONS, CATEGORIES } from "@/lib/regions";
import { LANG_NAMES, type Lang } from "@/lib/i18n";
import { slugify } from "@/lib/utils";

const CURRENCY_OPTIONS = [
  { code: "XOF", label: "XOF — Franc CFA (UEMOA : Togo, Bénin, CI, Sénégal…)" },
  { code: "XAF", label: "XAF — Franc CFA (CEMAC : Cameroun, Gabon…)" },
  { code: "GHS", label: "GHS — Cedi Ghanéen (GH₵)" },
  { code: "NGN", label: "NGN — Naira Nigérian (₦)" },
  { code: "GNF", label: "GNF — Franc Guinéen (FG)" },
  { code: "KES", label: "KES — Shilling Kényan (KSh)" },
  { code: "EUR", label: "EUR — Euro (€)" },
  { code: "USD", label: "USD — Dollar US ($)" },
];

const REGIONS_BY_COUNTRY = REGIONS.reduce<Record<string, typeof REGIONS>>(
  (acc, r) => {
    (acc[r.country] ||= []).push(r);
    return acc;
  },
  {},
);

export interface ShopOnboardingInitial {
  shopName: string;
  shopSlug: string;
  tagline: string;
  whatsappNumber: string;
  momoNumber: string;
  currency: string;
  language: string;
  region: string;
  category: string;
  bio: string;
  avatarUrl: string;
  email: string;
  needsOnboarding: boolean;
}

export default function ShopOnboardingModal({
  initial,
}: {
  initial: ShopOnboardingInitial;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(initial.needsOnboarding);
  const [step, setStep] = useState<1 | 2>(1);

  const [shopName, setShopName] = useState(
    initial.shopName && !initial.shopName.includes("@")
      ? initial.shopName
      : "",
  );
  const [shopSlug, setShopSlug] = useState(initial.shopSlug || "");
  const [slugTouched, setSlugTouched] = useState(false);
  const [tagline, setTagline] = useState(initial.tagline || "");
  const [language, setLanguage] = useState(initial.language || "fr");
  const [currency, setCurrency] = useState(initial.currency || "XOF");
  const [whatsappNumber, setWhatsappNumber] = useState(
    initial.whatsappNumber && initial.whatsappNumber !== "15556449932"
      ? initial.whatsappNumber
      : "",
  );
  const [momoNumber, setMomoNumber] = useState(initial.momoNumber || "");
  const [region, setRegion] = useState(initial.region || "lome");
  const [category, setCategory] = useState(initial.category || "fashion");
  const [bio, setBio] = useState(initial.bio || "");
  const [avatarUrl, setAvatarUrl] = useState(initial.avatarUrl || "");

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (initial.needsOnboarding) {
      setIsOpen(true);
    }
  }, [initial.needsOnboarding]);

  useEffect(() => {
    const onOpenOnboarding = () => {
      setStep(1);
      setError("");
      setIsOpen(true);
    };
    window.addEventListener("japora:open-onboarding", onOpenOnboarding);
    return () => window.removeEventListener("japora:open-onboarding", onOpenOnboarding);
  }, []);

  function handleNameChange(val: string) {
    setShopName(val);
    if (!slugTouched) {
      setShopSlug(slugify(val));
    }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("L'image ne doit pas dépasser 5 Mo.");
      return;
    }
    setUploadingAvatar(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "avatars");
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        setAvatarUrl(data.url);
      } else {
        setError(data.error || "Échec du téléversement du logo.");
      }
    } catch {
      setError("Erreur réseau lors de l'envoi de l'image.");
    } finally {
      setUploadingAvatar(false);
      e.target.value = "";
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!shopName.trim()) {
      setError("Veuillez renseigner le nom de votre boutique.");
      setStep(1);
      return;
    }

    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopName: shopName.trim(),
          shopSlug: shopSlug.trim() || slugify(shopName.trim()),
          tagline: tagline.trim(),
          language,
          currency,
          whatsappNumber: whatsappNumber.trim(),
          momoNumber: momoNumber.trim(),
          region,
          category,
          bio: bio.trim(),
          avatarUrl,
          completeOnboarding: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Impossible d'enregistrer la configuration.");
        setSaving(false);
        return;
      }

      setSaving(false);
      setIsOpen(false);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Erreur réseau.");
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-arctic-300/60 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 a-rise-in">
        {/* Top Gradient Header */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 px-6 py-5 text-white">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-0.5 text-xs font-bold backdrop-blur-xs">
              ✨ Configuration de votre boutique Japora
            </span>
            <span className="text-xs font-semibold text-emerald-100">
              Étape {step} sur 2
            </span>
          </div>
          <h2 className="mt-2 text-xl font-extrabold tracking-tight">
            Bienvenue ! Personnalisons votre boutique
          </h2>
          <p className="mt-1 text-xs text-emerald-100">
            Renseignez les informations essentielles de votre boutique pour commencer à vendre sur WhatsApp et Mobile Money.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="max-h-[78vh] overflow-y-auto p-6 space-y-4">
          {step === 1 ? (
            <>
              <div>
                <label className="label font-semibold text-arctic-900">
                  Nom de votre boutique ou marque *
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="Ex: Maison Kossi Lomé, Bella Mode..."
                  value={shopName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="label font-semibold text-arctic-900">
                  Lien public de votre catalogue
                </label>
                <div className="flex items-center gap-2">
                  <span className="rounded-lg bg-arctic-100 px-3 py-2 text-xs font-mono font-semibold text-arctic-600 border border-arctic-300/50">
                    japora.app/c/
                  </span>
                  <input
                    type="text"
                    className="input font-mono text-sm"
                    placeholder="ma-boutique"
                    value={shopSlug}
                    onChange={(e) => {
                      setSlugTouched(true);
                      setShopSlug(slugify(e.target.value));
                    }}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="label font-semibold text-arctic-900">
                    Langue de la boutique *
                  </label>
                  <select
                    className="input"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                  >
                    {(Object.keys(LANG_NAMES) as Lang[]).map((l) => (
                      <option key={l} value={l}>
                        {LANG_NAMES[l]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label font-semibold text-arctic-900">
                    Devise principale *
                  </label>
                  <select
                    className="input"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                  >
                    {CURRENCY_OPTIONS.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="label font-semibold text-arctic-900">
                    Catégorie d&apos;activité
                  </label>
                  <select
                    className="input"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="">— Choisir une catégorie —</option>
                    {CATEGORIES.map((c) => (
                      <option key={c.slug} value={c.slug}>
                        {c.icon} {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label font-semibold text-arctic-900">
                    Ville / Région
                  </label>
                  <select
                    className="input"
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                  >
                    <option value="">— Choisir une région —</option>
                    {Object.entries(REGIONS_BY_COUNTRY).map(([country, list]) => (
                      <optgroup key={country} label={country}>
                        {list.map((r) => (
                          <option key={r.slug} value={r.slug}>
                            {r.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="label font-semibold text-arctic-900">
                  Slogan court (affiché sous le nom)
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="Ex: Prêt-à-porter & accessoires, livraison rapide à Lomé"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                />
              </div>

              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
                  {error}
                </p>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-arctic-200/60">
                <button
                  type="button"
                  onClick={() => {
                    if (!shopName.trim()) {
                      setError("Veuillez d'abord saisir le nom de votre boutique.");
                      return;
                    }
                    setError("");
                    setStep(2);
                  }}
                  className="btn-primary px-5 py-2.5"
                >
                  Continuer (WhatsApp & Paiements) →
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="label font-semibold text-arctic-900">
                    Numéro WhatsApp Business *
                  </label>
                  <input
                    type="tel"
                    className="input"
                    placeholder="Ex: 22890112233"
                    value={whatsappNumber}
                    onChange={(e) => setWhatsappNumber(e.target.value)}
                    required
                  />
                  <span className="mt-1 block text-[11px] text-arctic-500">
                    Avec indicatif pays sans + (ex: 228 pour le Togo, 229 Bénin).
                  </span>
                </div>

                <div>
                  <label className="label font-semibold text-arctic-900">
                    Numéro Mobile Money (T-Money / Flooz)
                  </label>
                  <input
                    type="tel"
                    className="input"
                    placeholder="Identique au WhatsApp si vide"
                    value={momoNumber}
                    onChange={(e) => setMomoNumber(e.target.value)}
                  />
                  <span className="mt-1 block text-[11px] text-arctic-500">
                    Numéro marchand pour recevoir les paiements USSD & FedaPay.
                  </span>
                </div>
              </div>

              <div>
                <label className="label font-semibold text-arctic-900">
                  Présentation de la boutique (Bio, optionnel)
                </label>
                <textarea
                  className="input min-h-[68px]"
                  placeholder="Décrivez vos produits, vos délais de livraison et vos garanties..."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                />
              </div>

              <div className="rounded-xl border border-arctic-300/60 bg-arctic-50/60 p-3.5">
                <label className="block text-xs font-bold text-arctic-900 mb-2">
                  Logo de votre boutique (optionnel)
                </label>
                <div className="flex items-center gap-3.5">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-brand/30 bg-white flex items-center justify-center font-black text-xl text-brand">
                    {avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={avatarUrl} alt={shopName} className="h-full w-full object-cover" />
                    ) : (
                      (shopName[0] || "J").toUpperCase()
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="btn-ghost text-xs py-1.5 px-3 border border-arctic-300 cursor-pointer inline-flex items-center gap-1.5">
                      <span>📷</span>
                      <span>{uploadingAvatar ? "Envoi en cours…" : "Importer un logo"}</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        className="hidden"
                        disabled={uploadingAvatar}
                        onChange={handleAvatarUpload}
                      />
                    </label>
                    <p className="text-[11px] text-arctic-500">
                      PNG, JPG ou WebP (max 5 Mo). Modifiable à tout moment dans Settings.
                    </p>
                  </div>
                </div>
              </div>

              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
                  {error}
                </p>
              )}

              <div className="flex items-center justify-between gap-2 pt-3 border-t border-arctic-200/60">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="btn-ghost text-xs"
                >
                  ← Retour
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary px-6 py-2.5 font-bold"
                >
                  {saving ? "Création de votre espace…" : "🚀 Lancer ma boutique Japora"}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}

