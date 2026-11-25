"use client";

import { errorMessage } from "@/lib/errors";
import { formatStoredWhatsAppNumber, WHATSAPP_NUMBER_EXAMPLE } from "@/lib/whatsapp-number";

import { useState } from "react";
import { useRouter } from "next/navigation";
import CopyableLink from "../CopyableLink";
import ShopQrCard from "../ShopQrCard";
import DangerZone from "./DangerZone";
import { REGIONS, CATEGORIES, categoryName } from "@/lib/regions";
import { LANG_NAMES, type Lang } from "@/lib/i18n";
import { usePublicLang } from "@/components/PublicLanguageProvider";
import Glyph from "@/components/Glyph";

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
  storageMissing = [],
}: {
  initial: Initial;
  whatsappLive: boolean;
  storageMode: "firebase" | "local" | "s3" | "incomplete";
  storageMissing?: string[];
}) {
  const { tr } = usePublicLang();
  const router = useRouter();
  const [shopName, setShopName] = useState(initial.shopName);
  const [shopSlug, setShopSlug] = useState(initial.shopSlug);
  const [tagline, setTagline] = useState(initial.tagline);
  const [whatsappNumber, setWhatsappNumber] = useState(formatStoredWhatsAppNumber(initial.whatsappNumber));
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
          ? "Logo enregistré avec succès sur votre boutique !"
          : "Logo supprimé et mis à jour.",
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
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAvatarError(data.error || "Échec de l'envoi de l'image.");
      } else if (data.url) {
        setAvatarUrl(data.url);
        await persistAvatarUrl(data.url);
      }
    } catch (err) {
      setAvatarError(errorMessage(err, "Erreur de connexion lors de l'upload."));
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
        setError(data.error || tr("Impossible d'enregistrer les paramètres.", "Could not save the settings."));
        return;
      }
      if (data.vendor) {
        if (data.vendor.shopName) setShopName(data.vendor.shopName);
        if (data.vendor.shopSlug) setShopSlug(data.vendor.shopSlug);
        if (typeof data.vendor.tagline === "string") setTagline(data.vendor.tagline);
        if (typeof data.vendor.whatsappNumber === "string") setWhatsappNumber(formatStoredWhatsAppNumber(data.vendor.whatsappNumber));
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
    } catch (err: unknown) {
      setSaving(false);
      setError(err instanceof Error ? err.message : tr("Erreur réseau lors de l'enregistrement.", "Network error while saving."));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="a-headline-md text-arctic-900">{tr("Paramètres de la boutique", "Shop settings")}</h1>
          <p className="text-sm text-arctic-600">{tr("Connecté en tant que", "Signed in as")} {initial.email}</p>
        </div>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event("japora:open-onboarding"))}
          className="btn-ghost text-xs border border-brand/30 text-brand-dark font-semibold self-start sm:self-auto"
        >
          {tr("Assistant de configuration rapide", "Quick setup assistant")}
        </button>
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold text-arctic-900">{tr("Le lien de votre catalogue", "Your catalog link")}</h2>
        <p className="mb-3 mt-1 text-sm text-arctic-600">
          {tr("Partagez ce lien partout : bio WhatsApp, statut, groupes, Instagram.", "Share this URL anywhere — WhatsApp bio, status, groups, Instagram.")}
        </p>
        <CopyableLink slug={shopSlug} />
      </div>

      <ShopQrCard slug={shopSlug} shopName={initial.shopName} whatsappNumber={whatsappNumber} />

      <form onSubmit={onSubmit} className="card settings-form-card space-y-4 p-5">
        <div>
          <label htmlFor="settingsform-1" className="label">{tr("Nom de la boutique", "Shop name")}</label>
          <input id="settingsform-1" className="input" value={shopName} onChange={(e) => setShopName(e.target.value)} required />
        </div>

        <div>
          <label htmlFor="settingsform-2" className="label">{tr("Adresse du catalogue (slug)", "Catalog URL slug")}</label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-arctic-600">/c/</span>
            <input id="settingsform-2"
              className="input"
              value={shopSlug}
              onChange={(e) => setShopSlug(e.target.value)}
              required
            />
          </div>
          <p className="mt-1 text-xs text-arctic-600">
            {tr("Lettres minuscules, chiffres et tirets. La changer casse les anciens liens.", "Lowercase letters, numbers, and dashes. Changing this breaks old links.")}
          </p>
        </div>

        <div>
          <label htmlFor="settingsform-3" className="label">{tr("Slogan (facultatif)", "Tagline (optional)")}</label>
          <input id="settingsform-3"
            className="input"
            placeholder={tr("Une phrase que vos clients verront sous le nom de la boutique.", "One line your customers will see under the shop name.")}
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="settingsform-4" className="label">{tr("Numéro WhatsApp", "WhatsApp number")}</label>
            <input id="settingsform-4"
              className="input"
              inputMode="tel"
              placeholder={tr(`Avec l'indicatif du pays, par ex. ${WHATSAPP_NUMBER_EXAMPLE}`, `With country code, e.g. ${WHATSAPP_NUMBER_EXAMPLE}`)}
              aria-describedby="whatsapp-number-help"
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
            />
            <p id="whatsapp-number-help" className="mt-1 text-xs text-arctic-600">
              {tr("Commencez par + et l'indicatif du pays (+228 pour le Togo). Sans lui, les clients qui scannent votre QR code tombent sur un mauvais numéro.", "Start with + and your country code (+228 for Togo). Without it, customers who scan your QR code reach the wrong number.")}
            </p>
          </div>
          <div>
            <label htmlFor="settingsform-5" className="label">{tr("Numéro Mobile Money (facultatif)", "Mobile-money number (optional)")}</label>
            <input id="settingsform-5"
              className="input"
              inputMode="tel"
              placeholder={tr("Le même que WhatsApp si vide", "Same as WhatsApp if left blank")}
              value={momoNumber}
              onChange={(e) => setMomoNumber(e.target.value)}
            />
            <p className="mt-1 text-xs text-arctic-600">
              {tr("Votre numéro Mobile Money (T-Money, Flooz…). Laissez vide pour utiliser votre numéro WhatsApp.", "Your Mobile Money number (T-Money, Flooz…). Leave empty to use your WhatsApp number.")}
            </p>
          </div>
          <div>
            <label htmlFor="settingsform-6" className="label">{tr("Devise", "Currency")}</label>
            <select id="settingsform-6" className="input settings-select" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {[currency, ...CURRENCY_PRESETS.filter((c) => c !== currency)].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="settingsform-7" className="label">{tr("Région", "Region")}</label>
            <select id="settingsform-7" className="input settings-select" value={region} onChange={(e) => setRegion(e.target.value)}>
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
            <label htmlFor="settingsform-8" className="label">{tr("Catégorie", "Category")}</label>
            <select id="settingsform-8" className="input settings-select" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">{tr("— Aucune —", "— None —")}</option>
              {CATEGORIES.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.icon} {tr(...categoryName(c))}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="settingsform-9" className="label">{tr("Langue", "Language")}</label>
          <select id="settingsform-9"
            className="input settings-select"
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
          <label htmlFor="settingsform-10" className="label">{tr("Présentation (facultatif)", "Bio (optional)")}</label>
          <textarea id="settingsform-10"
            className="input min-h-[72px]"
            value={bio}
            maxLength={BIO_MAX}
            onChange={(e) => setBio(e.target.value)}
            placeholder={tr("Un paragraphe de présentation affiché sur la page publique de votre boutique.", "One-paragraph intro shown on your public shop page.")}
          />
          <p className="mt-1 text-right text-xs text-arctic-600">
            {bio.length}/{BIO_MAX}
          </p>
        </div>

        <div className="rounded-shape-lg border border-arctic-300/60 bg-arctic-100/40 p-4">
          <label className="label text-arctic-900 font-semibold mb-2 block">
            {tr("Logo ou Photo de Profil de la Boutique", "Shop logo or profile picture")}
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
                  {tr("Envoi…", "Sending…")}
                </div>
              )}
            </div>

            <div className="flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <label className="btn-primary cursor-pointer text-xs py-1.5 px-3 inline-flex items-center gap-1.5">
                  <Glyph name="camera" size={18} />
                  <span>{uploadingAvatar ? tr("Téléversement…", "Uploading…") : tr("Choisir une image", "Choose an image")}</span>
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
                    className="btn-ghost text-xs py-1.5 px-2.5 text-aurora-error-text hover:text-aurora-error-text"
                  >
                    {tr("Supprimer", "Remove")}
                  </button>
                )}
              </div>
              <p className="text-[11px] text-arctic-600">
                {tr("Formats acceptés : PNG, JPG, WebP jusqu'à 5 Mo. Ce logo est enregistré automatiquement dès sa sélection et apparaît sur votre boutique publique et vos fiches produits.", "Accepted formats: PNG, JPG, WebP up to 5 MB. This logo is saved as soon as you select it and appears on your public shop and product pages.")}
              </p>
              {avatarSavedMsg && (
                <p className="text-xs text-signal-text font-semibold">{avatarSavedMsg}</p>
              )}
              {avatarError && (
                <p className="text-xs text-aurora-error-text font-medium">{avatarError}</p>
              )}
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-arctic-200/60">
            <details className="text-xs text-arctic-600">
              <summary className="flex min-h-6 cursor-pointer items-center font-medium hover:text-arctic-900">
                {tr("Ou spécifier une URL d'image externe", "Or give an external image URL")}
              </summary>
              <input
                className="input mt-2 text-xs py-1.5"
                type="text"
                aria-label={tr("URL de l'image", "Image URL")}
                placeholder="https://images.unsplash.com/... ou /uploads/..."
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
            className="mt-0.5 h-6 w-6 shrink-0 rounded-shape-xs border-arctic-400/45 text-brand focus:ring-brand"
          />
          <span>
            <span className="font-medium">{tr("Afficher ma boutique sur la marketplace publique", "List my shop in the public marketplace")}</span>
            <span className="block text-xs text-arctic-600">
              {tr("Décochez pour que le lien du catalogue ne soit pas listé (il reste accessible par son adresse).", "Uncheck to keep the catalog link unlisted (still accessible by URL).")}
            </span>
          </span>
        </label>

        <label className="flex items-start gap-2 text-sm text-arctic-800">
          <input
            type="checkbox"
            checked={wholesaleEnabled}
            onChange={(e) => setWholesaleEnabled(e.target.checked)}
            className="mt-0.5 h-6 w-6 shrink-0 rounded-shape-xs border-arctic-400/45 text-brand focus:ring-brand"
          />
          <span>
            <span className="font-medium">{tr("Activer les prix de gros", "Enable wholesale tier")}</span>
            <span className="block text-xs text-arctic-600">
              {tr("Affiche les prix de gros et les quantités minimum pour les acheteurs en gros.", "Show wholesale pricing + minimum quantities for bulk buyers.")}
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
              className="mt-0.5 h-6 w-6 shrink-0 rounded-shape-xs border-arctic-400/45 text-brand focus:ring-brand"
            />
            <span>
              <span className="font-medium">{tr("Proposer la livraison à domicile / expédition", "Offer home delivery / shipping")}</span>
              <span className="block text-xs text-arctic-600">
                {tr("Permet aux clients de choisir une option de livraison lors de la commande.", "Lets customers choose a delivery option when ordering.")}
              </span>
            </span>
          </label>

          {deliveryEnabled && (
            <div className="space-y-3 pl-6 pt-2">
              <div>
                <label className="block text-xs font-semibold text-arctic-700">
                  {tr("Frais de livraison par défaut (", "Default delivery fee (")}{currency})
                </label>
                <input
                  type="number"
                  min="0"
                  value={deliveryFeeMajor}
                  onChange={(e) => setDeliveryFeeMajor(Number(e.target.value) || 0)}
                  placeholder={tr("Ex: 1000", "e.g. 1000")}
                  className="input mt-1 w-full max-w-xs text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-arctic-700">
                  {tr("Zones spécifiques et tarifs (", "Specific zones and prices (")}{currency}{tr(", optionnel)", ", optional)")}
                </label>
                <textarea
                  rows={2}
                  value={deliveryZones}
                  onChange={(e) => setDeliveryZones(e.target.value)}
                  placeholder={tr("Ex: Lomé: 1000, Agoè: 1500, Baguida: 2000", "e.g. Lomé: 1000, Agoè: 1500, Baguida: 2000")}
                  className="input mt-1 w-full text-xs font-mono"
                />
                <span className="block text-[11px] text-arctic-600 mt-0.5">
                  {tr("Format: &ldquo;Nom de zone: Tarif&rdquo;, séparés par des virgules.", "Format: “Zone name: Price”, separated by commas.")}
                </span>
              </div>
            </div>
          )}
        </div>

        {error && <p className="rounded-lg bg-aurora-error-bg px-3 py-2 text-sm text-aurora-error-text">{error}</p>}

        {savedAt && (
          <div className="rounded-xl border border-emerald-500/40 bg-arctic-100/60/90 px-4 py-3 text-sm font-semibold text-signal-text flex items-center justify-between">
            <span>{tr("Vos informations de boutique ont été mises à jour avec succès !", "Your shop information was updated successfully!")}</span>
            <a
              href={`/c/${shopSlug}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs underline hover:text-emerald-950"
            >
              {tr("Voir ma boutique", "View my shop")}
            </a>
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          {savedAt && <span className="text-xs font-semibold text-signal-text">{tr("Enregistré", "Saved")}</span>}
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? tr("Enregistrement…", "Saving…") : tr("Enregistrer les modifications", "Save changes")}
          </button>
        </div>
      </form>

      <div className="card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-arctic-900">{tr("Parrainez un vendeur, vous gagnez tous les deux", "Refer a vendor, both win")}</h2>
          <span className="rounded-full bg-arctic-100/60 px-2 py-0.5 text-xs font-semibold text-signal-text">
            {initial.qualifiedReferrals} {tr("qualifiés", "qualified")}
          </span>
        </div>
        <p className="mt-1 text-sm text-arctic-600">
          {tr("Partagez votre lien d'invitation. Quand un vendeur s'inscrit et commence à vendre, vous recevez tous les deux une récompense.", "Share your invite link. When a vendor signs up and starts selling, both of you get rewards.")}
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
                {copied ? tr("Copié", "Copied") : tr("Copier le lien d'invitation", "Copy invite link")}
              </button>
              <a
                href={waInvite}
                target="_blank"
                rel="noreferrer"
                className="btn-primary text-xs"
              >
                {tr("Partager sur WhatsApp", "Share on WhatsApp")}
              </a>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-xs text-arctic-600">
            {tr("Votre code de parrainage apparaîtra après le prochain enregistrement.", "Your referral code will appear after your next save.")}
          </p>
        )}
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-arctic-900">{tr("Stockage des photos", "Photo storage")}</h2>
          <span
            className={
              "rounded-full px-2 py-0.5 text-xs font-semibold " +
              (storageMode === "s3" || storageMode === "firebase"
                ? "bg-brand/10 text-brand-dark"
                : "bg-arctic-200/65 text-arctic-700")
            }
          >
            {storageMode === "firebase"
              ? tr("Firebase Storage", "Firebase Storage")
              : storageMode === "s3"
              ? tr("Stockage externe (S3 / R2)", "External storage (S3 / R2)")
              : storageMode === "incomplete"
                ? tr("Configuration incomplète", "Incomplete settings")
                : tr("Sur ce serveur", "On this server")}
          </span>
        </div>
        <p className="mt-2 text-sm text-arctic-600">
          {storageMode === "firebase"
            ? tr("Les photos et documents sont envoyés dans Firebase Storage. Le serveur ne les garde plus.", "Photos and documents are sent to Firebase Storage. The server no longer keeps them.")
            : storageMode === "s3"
            ? tr("Les photos des produits sont envoyées dans votre espace de stockage externe (Cloudflare R2, AWS S3 ou Supabase). Le serveur ne les garde plus.", "Product photos are sent to your external storage (Cloudflare R2, AWS S3 or Supabase). The server no longer keeps them.")
            : storageMode === "incomplete"
              ? tr(`Un espace de stockage est indiqué, mais il manque : ${storageMissing.join(", ")}. En attendant, les photos restent enregistrées sur ce serveur.`, `A storage space is set, but this is missing: ${storageMissing.join(", ")}. Until then, photos stay on this server.`)
              : tr("Les photos des produits sont enregistrées sur ce serveur. Pour les placer dans un stockage externe (Cloudflare R2, par exemple), remplissez les réglages STORAGE_S3_*.", "Product photos are saved on this server. To keep them in external storage (Cloudflare R2, for example), fill in the STORAGE_S3_* settings.")}
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
            {whatsappLive ? tr("● Actif (Cloud API)", "● Live (Cloud API)") : tr("● Mode simulé", "● Stub mode")}
          </span>
        </div>
        <p className="mt-2 text-sm text-arctic-600">
          {whatsappLive
            ? tr("Les messages sortants passent par l'API WhatsApp Cloud de Meta.", "Outbound messages go through Meta's WhatsApp Cloud API.")
            : tr("Renseignez WHATSAPP_TOKEN et WHATSAPP_PHONE_NUMBER_ID dans le fichier .env pour passer en réel. En attendant, les messages sortants sont enregistrés mais pas envoyés.", "Set WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID in your .env file to go live. Until then, outbound messages are logged + recorded but not sent.")}
        </p>
        <div className="mt-4 space-y-2 text-sm">
          <div>
            <span className="font-semibold text-arctic-800">{tr("Adresse du webhook :", "Webhook URL:")}</span>{" "}
            <code className="rounded bg-arctic-200/65 px-1.5 py-0.5 text-xs">
              {process.env.NEXT_PUBLIC_APP_URL || "https://your-domain"}/api/whatsapp/webhook
            </code>
          </div>
          <div>
            <span className="font-semibold text-arctic-800">{tr("Jeton de vérification :", "Verify token:")}</span> {tr("défini dans", "set in")}{" "}
            <code className="rounded bg-arctic-200/65 px-1.5 py-0.5 text-xs">WHATSAPP_VERIFY_TOKEN</code>{" "}
            {tr("et à reporter dans le tableau de bord Meta.", "and match it in the Meta dashboard.")}
          </div>
          <div className="pt-2">
            <a href="/dashboard/bot" className="btn-primary text-xs">
              {tr("Configurer l'Assistant WhatsApp Cloud API & IA Gemini", "Set up the WhatsApp Cloud API assistant & Gemini AI")}
            </a>
          </div>
        </div>
      </div>

      <DangerZone shopName={shopName} />
    </div>
  );
}
