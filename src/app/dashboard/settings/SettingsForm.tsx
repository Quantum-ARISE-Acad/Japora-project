"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import CopyableLink from "../CopyableLink";
import ShopQrCard from "../ShopQrCard";
import DangerZone from "./DangerZone";
import { REGIONS, CATEGORIES } from "@/lib/regions";
import { LANG_NAMES, type Lang } from "@/lib/i18n";
import { usePublicLang } from "@/components/PublicLanguageProvider";

type Initial = {
  shopName: string;
  shopSlug: string;
  tagline: string;
  whatsappNumber: string;
  momoNumber: string;
  currency: string;
  email: string;
  region: string;
  category: string;
  language: string;
  bio: string;
  avatarUrl: string;
  isPublic: boolean;
  wholesaleEnabled: boolean;
  deliveryEnabled?: boolean;
  deliveryFeeCents?: number;
  deliveryZones?: string;
  referralCode: string;
  qualifiedReferrals: number;
};

// West-African-first: XOF (CFA, Togo + 7 UEMOA countries) leads, then the
// other African currencies Japora settles, then global.
const CURRENCY_PRESETS = ["XOF", "XAF", "GHS", "NGN", "KES", "GNF", "RWF", "UGX", "USD", "EUR"];
const BIO_MAX = 200;

// Group regions by country so the select reads like a directory.
const REGIONS_BY_COUNTRY = REGIONS.reduce<Record<string, typeof REGIONS>>(
  (acc, r) => {
    (acc[r.country] ||= []).push(r);
    return acc;
  },
  {},
);

export default function SettingsForm({
  initial,
  whatsappLive,
  storageMode,
}: {
  initial: Initial;
  whatsappLive: boolean;
  storageMode: "firebase" | "s3" | "local";
}) {
  const { tr } = usePublicLang();
  const router = useRouter();
  const [shopName, setShopName] = useState(initial.shopName);
  const [shopSlug, setShopSlug] = useState(initial.shopSlug);
  const [tagline, setTagline] = useState(initial.tagline);
  const [whatsappNumber, setWhatsappNumber] = useState(initial.whatsappNumber);
  const [momoNumber, setMomoNumber] = useState(initial.momoNumber);
  const [currency, setCurrency] = useState(initial.currency);
  const [region, setRegion] = useState(initial.region);
  const [category, setCategory] = useState(initial.category);
  const [language, setLanguage] = useState<string>(initial.language || "en");
  const [bio, setBio] = useState(initial.bio);
  const [avatarUrl, setAvatarUrl] = useState(initial.avatarUrl);
  const [isPublic, setIsPublic] = useState(initial.isPublic);
  const [wholesaleEnabled, setWholesaleEnabled] = useState(initial.wholesaleEnabled);
  const [deliveryEnabled, setDeliveryEnabled] = useState(initial.deliveryEnabled ?? false);
  const [deliveryFeeMajor, setDeliveryFeeMajor] = useState(
    initial.deliveryFeeCents ? Math.round(initial.deliveryFeeCents / 100) : 0,
  );
  const [deliveryZones, setDeliveryZones] = useState(initial.deliveryZones ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const [avatarSavedMsg, setAvatarSavedMsg] = useState("");

  async function persistAvatarUrl(newUrl: string) {
    try {
      const saveRes = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: newUrl }),
      });
      const saveData = await saveRes.json().catch(() => ({}));
      if (!saveRes.ok) {
        setAvatarError(saveData.error || "Impossible d'enregistrer le logo.");
        return false;
      }
      setAvatarSavedMsg(
        newUrl
          ? "✓ Logo enregistré avec succès sur votre boutique !"
          : "✓ Logo supprimé et mis à jour.",
      );
      router.refresh();
      setTimeout(() => setAvatarSavedMsg(""), 4000);
      return true;
    } catch {
      setAvatarError("Erreur lors de l'enregistrement du logo.");
      return false;
    }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError("L'image ne doit pas dépasser 5 Mo.");
      return;
    }
    setUploadingAvatar(true);
    setAvatarError("");
    setAvatarSavedMsg("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "avatars");
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAvatarError(data.error || "Échec de l'envoi de l'image.");
      } else if (data.url) {
        setAvatarUrl(data.url);
        await persistAvatarUrl(data.url);
      }
    } catch (err: any) {
      setAvatarError(err.message || "Erreur de connexion lors de l'upload.");
    } finally {
      setUploadingAvatar(false);
      e.target.value = "";
    }
  }

  const appUrl =
    typeof window !== "undefined" ? window.location.origin : "https://japora.app";
  const inviteUrl = initial.referralCode
    ? `${appUrl}/signup?ref=${initial.referralCode}`
    : "";
  const waInvite = inviteUrl
    ? `https://wa.me/?text=${encodeURIComponent(
        `Join me on Japora — sell on WhatsApp, only pay 1% when you make money. ${inviteUrl}`,
      )}`
    : "";

  async function copyInvite() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard refused — fall back to a no-op; the wa.me button still works.
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSavedAt(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopName,
          shopSlug,
          tagline,
          whatsappNumber,
          momoNumber,
          currency,
          region,
          category,
          language,
          bio,
          avatarUrl,
          isPublic,
          wholesaleEnabled,
          deliveryEnabled,
          deliveryFeeCents: Math.max(0, Math.round((Number(deliveryFeeMajor) || 0) * 100)),
          deliveryZones,
        }),
      });
      const data = await res.json().catch(() => ({}));
      setSaving(false);
      if (!res.ok) {
        setError(data.error || "Impossible d'enregistrer les paramètres.");
        return;
      }
      if (data.vendor) {
        if (data.vendor.shopName) setShopName(data.vendor.shopName);
        if (data.vendor.shopSlug) setShopSlug(data.vendor.shopSlug);
        if (typeof data.vendor.tagline === "string") setTagline(data.vendor.tagline);
        if (typeof data.vendor.whatsappNumber === "string") setWhatsappNumber(data.vendor.whatsappNumber);
        if (typeof data.vendor.momoNumber === "string") setMomoNumber(data.vendor.momoNumber);
        if (data.vendor.currency) setCurrency(data.vendor.currency);
        if (typeof data.vendor.region === "string") setRegion(data.vendor.region);
        if (typeof data.vendor.category === "string") setCategory(data.vendor.category);
        if (data.vendor.language) setLanguage(data.vendor.language);
        if (typeof data.vendor.bio === "string") setBio(data.vendor.bio);
        if (typeof data.vendor.avatarUrl === "string") setAvatarUrl(data.vendor.avatarUrl);
      }
      setSavedAt(Date.now());
      router.refresh();
    } catch (err: any) {
      setSaving(false);
      setError(err.message || "Erreur réseau lors de l'enregistrement.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="a-headline-md text-arctic-900">{tr("Paramètres de la boutique", "Shop settings")}</h1>
          <p className="text-sm text-arctic-600">
            {tr("Connecté en tant que", "Signed in as")} {initial.email}
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event("japora:open-onboarding"))}
          className="btn-ghost text-xs border border-brand/30 text-brand-dark font-semibold self-start sm:self-auto"
        >
          {tr("✨ Assistant de configuration rapide", "✨ Quick setup wizard")}
        </button>
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold text-arctic-900">{tr("Lien de votre catalogue", "Your catalog link")}</h2>
        <p className="mb-3 mt-1 text-sm text-arctic-600">
          {tr(
            "Partagez cette URL partout — bio WhatsApp, statuts, groupes, Instagram.",
            "Share this URL anywhere — WhatsApp bio, status, groups, Instagram.",
          )}
        </p>
        <CopyableLink slug={shopSlug} />
      </div>

      <ShopQrCard slug={shopSlug} shopName={initial.shopName} whatsappNumber={whatsappNumber} />

      <form onSubmit={onSubmit} className="card space-y-4 p-5">
        <div>
          <label className="label">{tr("Nom de la boutique", "Shop name")}</label>
          <input className="input" value={shopName} onChange={(e) => setShopName(e.target.value)} required />
        </div>

        <div>
          <label className="label">{tr("Identifiant URL du catalogue", "Catalog URL slug")}</label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-arctic-600">/c/</span>
            <input
              className="input"
              value={shopSlug}
              onChange={(e) => setShopSlug(e.target.value)}
              required
            />
          </div>
          <p className="mt-1 text-xs text-arctic-600">
            {tr(
              "Lettres minuscules, chiffres et tirets. Modifier ceci invalide vos anciens liens.",
              "Lowercase letters, numbers, and dashes. Changing this breaks old links.",
            )}
          </p>
        </div>

        <div>
          <label className="label">{tr("Slogan (optionnel)", "Tagline (optional)")}</label>
          <input
            className="input"
            placeholder={tr(
              "Une phrase que vos clients verront sous le nom de votre boutique.",
              "One line your customers will see under the shop name.",
            )}
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label">{tr("Numéro WhatsApp", "WhatsApp number")}</label>
            <input
              className="input"
              inputMode="tel"
              placeholder={tr("Avec indicatif pays, ex: 22890123456", "With country code, e.g. 2348012345678")}
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
            />
            <p className="mt-1 text-xs text-arctic-600">
              {tr(
                "Chiffres uniquement — utilisé pour les boutons WhatsApp de votre catalogue.",
                "Digits only — used for 'Chat' / order links on your catalog.",
              )}
            </p>
          </div>
          <div>
            <label className="label">{tr("Numéro Mobile Money (optionnel)", "Mobile-money number (optional)")}</label>
            <input
              className="input"
              inputMode="tel"
              placeholder={tr("Identique au WhatsApp si laissé vide", "Same as WhatsApp if left blank")}
              value={momoNumber}
              onChange={(e) => setMomoNumber(e.target.value)}
            />
            <p className="mt-1 text-xs text-arctic-600">
              {tr(
                "Numéro marchand vers lequel les clients envoient les paiements USSD (T-Money, Flooz…). Laissez vide pour utiliser votre numéro WhatsApp.",
                "The merchant number buyers send to when paying by dial code (T-Money, Flooz…). Leave empty to use your WhatsApp number.",
              )}
            </p>
          </div>
          <div>
            <label className="label">{tr("Devise", "Currency")}</label>
            <select className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {[currency, ...CURRENCY_PRESETS.filter((c) => c !== currency)].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label">{tr("Région", "Region")}</label>
            <select className="input" value={region} onChange={(e) => setRegion(e.target.value)}>
              <option value="">{tr("— Aucune —", "— None —")}</option>
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
          <div>
            <label className="label">{tr("Catégorie", "Category")}</label>
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">{tr("— Aucune —", "— None —")}</option>
              {CATEGORIES.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.icon} {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="label">{tr("Langue par défaut de la boutique", "Language")}</label>
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
          <label className="label">{tr("Biographie / Présentation (optionnel)", "Bio (optional)")}</label>
          <textarea
            className="input min-h-[72px]"
            value={bio}
            maxLength={BIO_MAX}
            onChange={(e) => setBio(e.target.value)}
            placeholder={tr(
              "Courte présentation affichée sur votre page boutique publique.",
              "One-paragraph intro shown on your public shop page.",
            )}
          />
          <p className="mt-1 text-right text-xs text-arctic-600">
            {bio.length}/{BIO_MAX}
          </p>
        </div>

        <div className="rounded-shape-lg border border-arctic-300/60 bg-arctic-100/40 p-4">
          <label className="label text-arctic-900 font-semibold mb-2 block">
            {tr("Logo ou Photo de Profil de la Boutique", "Store Logo or Profile Picture")}
          </label>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-shape-xl border-2 border-brand/30 bg-white shadow-sm flex items-center justify-center">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt={shopName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="text-2xl font-black text-brand">
                  {shopName ? shopName[0].toUpperCase() : "J"}
                </div>
              )}
              {uploadingAvatar && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white text-xs font-semibold">
                  {tr("Envoi…", "Uploading…")}
                </div>
              )}
            </div>

            <div className="flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <label className="btn-primary cursor-pointer text-xs py-1.5 px-3 inline-flex items-center gap-1.5">
                  <span>📷</span>
                  <span>
                    {uploadingAvatar
                      ? tr("Téléversement…", "Uploading…")
                      : tr("Choisir une image", "Choose image")}
                  </span>
                  <input
                    type="file"
                    accept="image/png, image/jpeg, image/webp, image/gif"
                    className="hidden"
                    disabled={uploadingAvatar}
                    onChange={handleAvatarUpload}
                  />
                </label>
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setAvatarUrl("");
                      void persistAvatarUrl("");
                    }}
                    className="btn-ghost text-xs py-1.5 px-2.5 text-red-600 hover:text-red-700"
                  >
                    {tr("Supprimer", "Remove")}
                  </button>
                )}
              </div>
              <p className="text-[11px] text-arctic-600">
                {tr(
                  "Formats acceptés : PNG, JPG, WebP jusqu'à 5 Mo. Ce logo est enregistré automatiquement dès sa sélection et apparaît sur votre boutique publique.",
                  "Accepted formats: PNG, JPG, WebP up to 5 MB. This logo is automatically saved on selection and appears on your public storefront.",
                )}
              </p>
              {avatarSavedMsg && (
                <p className="text-xs text-emerald-700 font-semibold">{avatarSavedMsg}</p>
              )}
              {avatarError && (
                <p className="text-xs text-red-600 font-medium">{avatarError}</p>
              )}
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-arctic-200/60">
            <details className="text-xs text-arctic-600">
              <summary className="cursor-pointer font-medium hover:text-arctic-900">
                {tr("Ou spécifier une URL d'image externe", "Or enter an external image URL")}
              </summary>
              <input
                className="input mt-2 text-xs py-1.5"
                type="text"
                placeholder="https://images.unsplash.com/..."
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
              />
            </details>
          </div>
        </div>

        <label className="flex items-start gap-2 text-sm text-arctic-800">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-arctic-400/45 text-brand focus:ring-brand"
          />
          <span>
            <span className="font-medium">
              {tr("Afficher ma boutique sur la marketplace publique", "List my shop in the public marketplace")}
            </span>
            <span className="block text-xs text-arctic-600">
              {tr(
                "Décochez pour garder votre catalogue privé (toujours accessible par lien direct).",
                "Uncheck to keep the catalog link unlisted (still accessible by URL).",
              )}
            </span>
          </span>
        </label>

        <label className="flex items-start gap-2 text-sm text-arctic-800">
          <input
            type="checkbox"
            checked={wholesaleEnabled}
            onChange={(e) => setWholesaleEnabled(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-arctic-400/45 text-brand focus:ring-brand"
          />
          <span>
            <span className="font-medium">
              {tr("Activer les tarifs de gros (B2B)", "Enable wholesale tier")}
            </span>
            <span className="block text-xs text-arctic-600">
              {tr(
                "Affiche les prix de gros et quantités minimales pour les acheteurs en volume.",
                "Show wholesale pricing + minimum quantities for bulk buyers.",
              )}
            </span>
          </span>
        </label>

        {/* Delivery Options */}
        <div className="rounded-xl border border-arctic-400/30 bg-arctic-100/30 p-4 space-y-3">
          <label className="flex items-start gap-2 text-sm text-arctic-800">
            <input
              type="checkbox"
              checked={deliveryEnabled}
              onChange={(e) => setDeliveryEnabled(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-arctic-400/45 text-brand focus:ring-brand"
            />
            <span>
              <span className="font-medium">
                {tr("Proposer la livraison à domicile / expédition", "Offer home delivery / shipping")}
              </span>
              <span className="block text-xs text-arctic-600">
                {tr(
                  "Permet aux clients de choisir une option de livraison lors de la commande.",
                  "Allows customers to select a delivery option during checkout.",
                )}
              </span>
            </span>
          </label>

          {deliveryEnabled && (
            <div className="space-y-3 pl-6 pt-2">
              <div>
                <label className="block text-xs font-semibold text-arctic-700">
                  {tr("Frais de livraison par défaut", "Default delivery fee")} ({currency})
                </label>
                <input
                  type="number"
                  min="0"
                  value={deliveryFeeMajor}
                  onChange={(e) => setDeliveryFeeMajor(Number(e.target.value) || 0)}
                  placeholder="Ex: 1000"
                  className="input mt-1 w-full max-w-xs text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-arctic-700">
                  {tr("Zones spécifiques et tarifs (optionnel)", "Specific zones and rates (optional)")}
                </label>
                <textarea
                  rows={2}
                  value={deliveryZones}
                  onChange={(e) => setDeliveryZones(e.target.value)}
                  placeholder="Ex: Lomé: 1000, Agoè: 1500, Baguida: 2000"
                  className="input mt-1 w-full text-xs font-mono"
                />
                <span className="block text-[11px] text-arctic-500 mt-0.5">
                  {tr(
                    "Format : « Nom de zone: Tarif », séparés par des virgules.",
                    "Format: 'Zone name: Rate', separated by commas.",
                  )}
                </span>
              </div>
            </div>
          )}
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        {savedAt && (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-50/90 px-4 py-3 text-sm font-semibold text-emerald-800 flex items-center justify-between">
            <span>
              {tr(
                "✅ Vos informations de boutique ont été mises à jour avec succès !",
                "✅ Your shop settings have been updated successfully!",
              )}
            </span>
            <a
              href={`/c/${shopSlug}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs underline hover:text-emerald-950"
            >
              {tr("Voir ma boutique ↗", "View my shop ↗")}
            </a>
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          {savedAt && (
            <span className="text-xs font-semibold text-emerald-700">
              {tr("Enregistré ✓", "Saved ✓")}
            </span>
          )}
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving
              ? tr("Enregistrement…", "Saving…")
              : tr("Enregistrer les modifications", "Save changes")}
          </button>
        </div>
      </form>

      <div className="card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-arctic-900">
            {tr("Parrainez un vendeur, gagnez tous les deux", "Refer a vendor, both win")}
          </h2>
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
            {initial.qualifiedReferrals} {tr("qualifié(s)", "qualified")}
          </span>
        </div>
        <p className="mt-1 text-sm text-arctic-600">
          {tr(
            "Partagez votre lien d'invitation. Quand un vendeur s'inscrit et commence à vendre, vous êtes récompensés.",
            "Share your invite link. When a vendor signs up and starts selling, both of you get rewards.",
          )}
        </p>
        {initial.referralCode ? (
          <div className="mt-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <code className="rounded bg-arctic-200/65 px-2 py-1 text-sm font-mono text-arctic-800">
                {initial.referralCode}
              </code>
              <code className="break-all rounded bg-arctic-100/55 px-2 py-1 text-xs text-arctic-600">
                {inviteUrl}
              </code>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={copyInvite}
                className="btn-ghost text-xs"
              >
                {copied ? tr("Copié ✓", "Copied ✓") : tr("Copier le lien d'invitation", "Copy invite link")}
              </button>
              <a
                href={waInvite}
                target="_blank"
                rel="noreferrer"
                className="btn-primary text-xs"
              >
                {tr("Partager sur WhatsApp ↗", "Share on WhatsApp ↗")}
              </a>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-xs text-arctic-500">
            {tr(
              "Votre code de parrainage apparaîtra après votre prochaine sauvegarde.",
              "Your referral code will appear after your next save.",
            )}
          </p>
        )}
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-arctic-900">
            {tr("Stockage d'images et de documents", "Image & document storage")}
          </h2>
          <span
            className={
              "rounded-full px-2 py-0.5 text-xs font-semibold " +
              (storageMode === "firebase" || storageMode === "s3"
                ? "bg-brand/10 text-brand-dark"
                : "bg-arctic-200/65 text-arctic-700")
            }
          >
            {storageMode === "firebase"
              ? "● Firebase Storage (live)"
              : storageMode === "s3"
                ? "● S3-compatible (live)"
                : "● Local filesystem"}
          </span>
        </div>
        <p className="mt-2 text-sm text-arctic-600">
          {storageMode === "firebase"
            ? tr(
                "Toutes les photos de produits, couvertures de collections, logos de boutiques et documents sont hébergés sur Firebase Cloud Storage.",
                "All product photos, collection covers, store logos, and documents are hosted on Firebase Cloud Storage.",
              )
            : storageMode === "s3"
              ? "Product photos are uploaded to your configured S3-compatible bucket (AWS S3, Cloudflare R2, or Supabase Storage)."
              : "Product photos are saved to ./public/uploads. Fine for a single Node host — configure NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET or STORAGE_S3_* before deploying to serverless."}
        </p>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-arctic-900">WhatsApp Business API</h2>
          <span
            className={
              "rounded-full px-2 py-0.5 text-xs font-semibold " +
              (whatsappLive
                ? "bg-brand/10 text-brand-dark"
                : "bg-arctic-200/65 text-arctic-700")
            }
          >
            {whatsappLive ? "● Live (Cloud API)" : "● Stub mode"}
          </span>
        </div>
        <p className="mt-2 text-sm text-arctic-600">
          {whatsappLive
            ? tr(
                "Les messages WhatsApp sortants passent en direct par Meta WhatsApp Cloud API.",
                "Outbound WhatsApp messages are sent live through Meta WhatsApp Cloud API.",
              )
            : tr(
                "Configurez votre Access Token et votre Phone Number ID dans l'onglet Assistant WhatsApp du tableau de bord pour activer l'envoi réel.",
                "Configure your Access Token and Phone Number ID in the WhatsApp Assistant tab of the dashboard to enable live sending.",
              )}
        </p>
        <div className="mt-4 space-y-2 text-sm">
          <div>
            <span className="font-semibold text-arctic-800">Webhook URL:</span>{" "}
            <code className="rounded bg-arctic-200/65 px-1.5 py-0.5 text-xs">
              {process.env.NEXT_PUBLIC_APP_URL || "https://your-domain"}/api/whatsapp/webhook
            </code>
          </div>
          <div className="pt-2">
            <a href="/dashboard/bot" className="btn-primary text-xs">
              {tr(
                "🤖 Configurer l'Assistant WhatsApp Cloud API & IA Gemini →",
                "🤖 Configure WhatsApp Cloud API & Gemini AI Assistant →",
              )}
            </a>
          </div>
        </div>
      </div>

      <DangerZone shopName={shopName} />
    </div>
  );
}
