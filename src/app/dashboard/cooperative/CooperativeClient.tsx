"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Glyph from "@/components/Glyph";
import { COOPERATIVE_NAME_SUGGESTIONS, regionLabel } from "@/lib/regions";
import { cooperativeJoinPayload } from "@/lib/cooperative-client";
import { usePublicLang } from "@/components/PublicLanguageProvider";

type Member = {
  id: string;
  shopName: string;
  shopSlug: string;
  joinedAt: string;
};

type CooperativeData = {
  id: string;
  name: string;
  region: string;
  joinCode: string;
  isAdmin: boolean;
  memberCount: number;
  members: Member[];
};

type RegionOption = {
  slug: string;
  label: string;
  country: string;
};

export default function CooperativeClient({
  cooperative,
  qrSvg,
  regions,
}: {
  cooperative: CooperativeData | null;
  qrSvg: string;
  regions: RegionOption[];
}) {
  const { tr } = usePublicLang();
  const router = useRouter();

  // Mode for non-joined vendors
  const [tab, setTab] = useState<"join" | "create">("join");
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [createName, setCreateName] = useState("");
  const [createRegion, setCreateRegion] = useState(regions[0]?.slug || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  // Invite state for members
  const [invitePhones, setInvitePhones] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<{ tone: "success" | "info" | "error"; text: string } | null>(null);

  const appBaseUrl = typeof window !== "undefined" ? window.location.origin : "https://japora.app";
  const joinUrl = cooperative ? `${appBaseUrl}/join/${cooperative.joinCode}` : "";

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");

    const res = await fetch("/api/cooperative/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cooperativeJoinPayload(joinCodeInput)),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setError(data.error || tr("Impossible de rejoindre la coopérative. Vérifiez le code.", "Could not join the cooperative. Check the code."));
      return;
    }
    router.refresh();
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");

    const res = await fetch("/api/cooperative", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: createName.trim(), region: createRegion }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setError(data.error || tr("Erreur lors de la création de la coopérative.", "Error while creating the cooperative."));
      return;
    }
    router.refresh();
  }

  async function handleLeave() {
    if (!cooperative) return;
    const confirmation = cooperative.isAdmin
      ? "En quittant, l’administration sera transférée au membre actif le plus ancien. Si vous êtes le dernier membre actif, la coopérative sera supprimée. Continuer ?"
      : "Êtes-vous sûr de vouloir quitter cette coopérative ?";
    if (!confirm(confirmation)) return;
    setBusy(true);

    const res = await fetch("/api/cooperative/leave", { method: "POST" });
    setBusy(false);
    if (res.ok) {
      router.refresh();
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!invitePhones.trim()) return;

    setInviteBusy(true);
    setInviteMsg(null);

    const res = await fetch("/api/cooperative/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phones: invitePhones }),
    });
    const data = await res.json().catch(() => ({}));
    setInviteBusy(false);

    if (!res.ok) {
      setInviteMsg({ tone: "error", text: data.error || "Échec du traitement des invitations." });
      return;
    }

    const accepted = Number(data.acceptedByApi || 0);
    const simulated = Number(data.simulated || 0);
    const failed = Number(data.failed || 0);
    const notAttempted = Number(data.notAttempted || 0);
    const parts: string[] = [];
    if (accepted) parts.push(`WhatsApp a accepté ${accepted} invitation(s) par l’API`);
    if (simulated) parts.push(`${simulated} invitation(s) simulée(s), non envoyée(s)`);
    if (failed) parts.push(`${failed} échec(s)`);
    if (notAttempted) parts.push(`${notAttempted} numéro(s) non traité(s) (limite de 200)`);

    const tone = failed && !accepted && !simulated ? "error" : failed || simulated || notAttempted ? "info" : "success";
    const deliveryNote = accepted ? ". L’acceptation par l’API ne confirme pas la remise au téléphone." : "";
    setInviteMsg({ tone, text: `${parts.join(" · ") || "Aucune invitation traitée"}${deliveryNote}` });
    const numbersToRetry = [...(data.failedPhones || []), ...(data.notAttemptedPhones || [])];
    if (numbersToRetry.length) setInvitePhones(numbersToRetry.join("\n"));
    else if (accepted && !simulated) setInvitePhones("");
  }

  function copyJoinLink() {
    if (!joinUrl) return;
    navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Not in a cooperative
  if (!cooperative) {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <div className="flex rounded-shape-lg border border-arctic-300/40 bg-white/60 p-1 backdrop-blur-glass-thin">
          <button
            type="button"
            onClick={() => {
              setTab("join");
              setError("");
            }}
            className={`flex-1 rounded-shape-md py-2.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 ${
              tab === "join" ? "bg-arctic-800 text-arctic-50 shadow-sm" : "text-arctic-700 hover:bg-arctic-800 hover:text-arctic-50"
            }`}
          >
            {tr("Rejoindre avec un code", "Join with a code")}
          </button>
          <button
            type="button"
            onClick={() => {
              setTab("create");
              setError("");
            }}
            className={`flex-1 rounded-shape-md py-2.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 ${
              tab === "create" ? "bg-arctic-800 text-arctic-50 shadow-sm" : "text-arctic-700 hover:bg-arctic-800 hover:text-arctic-50"
            }`}
          >
            {tr("Créer une coopérative", "Create a cooperative")}
          </button>
        </div>

        {tab === "join" ? (
          <form onSubmit={handleJoin} className="card space-y-4 p-6 shadow-elev-1">
            <div>
              <h2 className="text-base font-bold text-arctic-900">{tr("Rejoindre une coopérative existante", "Join an existing cooperative")}</h2>
              <p className="mt-1 text-xs text-arctic-600">
                {tr("Entrez le code d'adhésion à 6 lettres fourni par le responsable de votre marché ou association.", "Enter the 6-letter membership code given by your market or association leader.")}
              </p>
            </div>

            <div>
              <label className="label">{tr("Code d'adhésion (6 caractères)", "Membership code (6 characters)")}</label>
              <input
                className="input font-mono uppercase tracking-widest text-lg font-bold text-center"
                placeholder={tr("Ex: ABCXYZ", "e.g. ABCXYZ")}
                maxLength={8}
                value={joinCodeInput}
                onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                required
              />
            </div>

            {error && <p className="rounded-md bg-red-50 p-2.5 text-xs text-red-600">{error}</p>}

            <button type="submit" disabled={busy} className="btn-primary w-full py-2.5 text-sm">
              {busy ? tr("Vérification…", "Checking…") : tr("Rejoindre la coopérative", "Join the cooperative")}
            </button>
          </form>
        ) : (
          <form onSubmit={handleCreate} className="card space-y-4 p-6 shadow-elev-1">
            <div>
              <h2 className="text-base font-bold text-arctic-900">{tr("Créer votre association marchande", "Create your traders' association")}</h2>
              <p className="mt-1 text-xs text-arctic-600">
                {tr("Vous obtiendrez un code d'adhésion unique, un QR code et un poster imprimable pour inscrire tous les vendeurs de votre marché.", "You will get a unique membership code, a QR code and a printable poster to sign up every vendor in your market.")}
              </p>
            </div>

            <div>
              <label className="label" htmlFor="cooperative-name">{tr("Nom de l'association ou coopérative *", "Association or cooperative name *")}</label>
              <input
                id="cooperative-name"
                className="input"
                list="cooperative-name-suggestions"
                placeholder={tr("Choisissez une suggestion ou saisissez un nom", "Pick a suggestion or type a name")}
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                required
              />
              <datalist id="cooperative-name-suggestions">
                {COOPERATIVE_NAME_SUGGESTIONS.map((name) => <option key={name} value={name} />)}
              </datalist>
            </div>

            <div>
              <label className="label">{tr("Région / Ville", "Region / City")}</label>
              <select
                className="input"
                value={createRegion}
                onChange={(e) => setCreateRegion(e.target.value)}
              >
                {regions.map((r) => (
                  <option key={r.slug} value={r.slug}>
                    {r.label} ({r.country})
                  </option>
                ))}
              </select>
            </div>

            {error && <p className="rounded-md bg-red-50 p-2.5 text-xs text-red-600">{error}</p>}

            <button type="submit" disabled={busy} className="btn-primary w-full py-2.5 text-sm">
              {busy ? tr("Création…", "Creating…") : tr("Créer et générer mon code", "Create and generate my code")}
            </button>
          </form>
        )}
      </div>
    );
  }

  // Already in a cooperative
  const shareText = `Rejoignez notre coopérative "${cooperative.name}" sur Japora pour vendre sur WhatsApp avec nous !\n\nLien d'adhésion : ${joinUrl}\nCode d'adhésion : ${cooperative.joinCode}`;
  const whatsappShareUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;

  return (
    <div className="space-y-6">
      {/* Header Info Card */}
      <div className="card relative overflow-hidden p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-extrabold text-arctic-900">{cooperative.name}</h2>
              {cooperative.isAdmin && (
                <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-bold text-brand-dark">
                  Admin
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-arctic-600">
              {tr("Région :", "Region:")} <strong>{cooperative.region ? regionLabel(cooperative.region) : tr("Non spécifiée", "Not specified")}</strong> ·{" "}
              {cooperative.memberCount > 1
                ? tr(`${cooperative.memberCount} boutiques membres`, `${cooperative.memberCount} member shops`)
                : tr(`${cooperative.memberCount} boutique membre`, `${cooperative.memberCount} member shop`)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`/join/${cooperative.joinCode}/flyer`}
              target="_blank"
              rel="noreferrer"
              className="btn-ghost text-xs font-semibold gap-1.5"
            >
              {tr("📄 Affiche / Flyer imprimable", "📄 Printable poster / flyer")}
            </a>
            <button
              onClick={handleLeave}
              disabled={busy}
              className="btn-danger text-xs !py-1.5"
            >
              {tr("Quitter", "Leave")}
            </button>
          </div>
        </div>

        {/* Join Code & Share Box */}
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-shape-lg border border-arctic-300/50 bg-arctic-100/50 p-4 sm:col-span-2 space-y-3">
            <div className="text-xs font-semibold text-arctic-700">{tr("Code d'adhésion de la coopérative", "Cooperative membership code")}</div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-3xl font-black tracking-wider text-arctic-900">
                {cooperative.joinCode}
              </span>
              <button
                type="button"
                onClick={copyJoinLink}
                className="btn-ghost text-xs py-1 px-3"
              >
                {copied ? tr("Lien copié !", "Link copied!") : tr("Copier le lien d'adhésion", "Copy the membership link")}
              </button>
            </div>

            <p className="text-xs text-arctic-600">
              {tr("Partagez ce code ou ce lien avec les vendeurs de votre marché pour qu'ils rejoignent votre groupe.", "Share this code or link with the vendors of your market so they join your group.")}
            </p>

            <div className="pt-1 flex flex-wrap gap-2">
              <a
                href={whatsappShareUrl}
                target="_blank"
                rel="noreferrer"
                className="btn-primary text-xs gap-1.5"
              >
                <Glyph name="chat" size={14} /> {tr("Inviter sur WhatsApp", "Invite on WhatsApp")}
              </a>
            </div>
          </div>

          {/* QR Code */}
          <div className="flex flex-col items-center justify-center rounded-shape-lg border border-arctic-300/50 p-4 text-center">
            {qrSvg ? (
              <div
                className="grid h-48 w-48 place-items-center rounded-md p-3 [&>svg]:h-full [&>svg]:w-full"
                style={{ backgroundColor: "#ffffff" }}
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
            ) : (
              <div className="grid h-48 w-48 place-items-center rounded-md bg-arctic-100 text-xs text-arctic-500">
                {tr("QR indisponible", "QR unavailable")}
              </div>
            )}
            <span className="mt-2 text-[11px] font-medium text-arctic-500">{tr("Scanner pour rejoindre", "Scan to join")}</span>
          </div>
        </div>
      </div>

      {/* WhatsApp Invite Blaster (for Admins / Leaders) */}
      <div className="card p-6 space-y-3">
        <h3 className="text-sm font-bold text-arctic-900">{tr("Inviter des vendeurs par WhatsApp", "Invite vendors by WhatsApp")}</h3>
        <p className="text-xs text-arctic-600">
          {tr("Entrez les numéros de téléphone des commerçants (séparés par des virgules ou retours à la ligne) pour leur envoyer directement l'invitation avec le lien.", "Enter the traders' phone numbers (separated by commas or new lines) to send them the invitation with the link directly.")}
        </p>
        <form onSubmit={handleInvite} className="space-y-3">
          <textarea
            className="input min-h-[65px] font-mono text-xs"
            placeholder={tr("Ex: +228 90 12 34 56, +228 91 23 45 67", "e.g. +228 90 12 34 56, +228 91 23 45 67")}
            value={invitePhones}
            onChange={(e) => setInvitePhones(e.target.value)}
          />
          {inviteMsg && (
            <p className={`text-xs font-semibold ${inviteMsg.tone === "success" ? "text-emerald-700 dark:text-emerald-300" : inviteMsg.tone === "error" ? "text-red-700 dark:text-red-300" : "text-amber-800 dark:text-amber-300"}`} role="status" aria-live="polite">
              {inviteMsg.text}
            </p>
          )}
          <button
            type="submit"
            disabled={inviteBusy || !invitePhones.trim()}
            className="btn-primary text-xs py-2 px-4"
          >
            {inviteBusy ? tr("Envoi en cours…", "Sending…") : tr("Envoyer les invitations WhatsApp", "Send the WhatsApp invitations")}
          </button>
        </form>
      </div>

      {/* Members Directory */}
      <div className="card overflow-hidden">
        <div className="border-b border-arctic-300/40 px-5 py-3.5 flex items-center justify-between">
          <h3 className="font-bold text-arctic-900 text-sm">
            {tr("Membres de la coopérative (", "Cooperative members (")}{cooperative.members.length})
          </h3>
          <span className="text-xs text-arctic-500">{tr("Boutiques actives", "Active shops")}</span>
        </div>

        <div className="divide-y divide-arctic-300/30">
          {cooperative.members.map((m) => (
            <div key={m.id} className="flex items-center justify-between p-4 hover:bg-arctic-50/50">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-arctic-200 text-xs font-bold text-arctic-800">
                  {m.shopName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="font-semibold text-sm text-arctic-900">{m.shopName}</div>
                  <div className="text-xs text-arctic-500">
                    {tr("Membre depuis le", "Member since")} {new Date(m.joinedAt).toLocaleDateString()}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href={`/c/${m.shopSlug}`}
                  target="_blank"
                  className="btn-ghost text-xs !py-1 px-3"
                >
                  {tr("Voir catalogue ↗", "View catalog ↗")}
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
