"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Glyph from "@/components/Glyph";

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
  const [inviteMsg, setInviteMsg] = useState("");

  const appBaseUrl = typeof window !== "undefined" ? window.location.origin : "https://japora.app";
  const joinUrl = cooperative ? `${appBaseUrl}/join/${cooperative.joinCode}` : "";

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");

    const res = await fetch("/api/cooperative/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ joinCode: joinCodeInput.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setError(data.error || "Impossible de rejoindre la coopérative. Vérifiez le code.");
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
      setError(data.error || "Erreur lors de la création de la coopérative.");
      return;
    }
    router.refresh();
  }

  async function handleLeave() {
    if (!confirm("Êtes-vous sûr de vouloir quitter cette coopérative ?")) return;
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
    setInviteMsg("");

    const res = await fetch("/api/cooperative/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phones: invitePhones }),
    });
    const data = await res.json().catch(() => ({}));
    setInviteBusy(false);

    if (!res.ok) {
      setInviteMsg(data.error || "Échec de l'envoi des invitations.");
      return;
    }
    setInviteMsg(`✅ ${data.sent || 0} invitation(s) envoyée(s) sur WhatsApp !`);
    setInvitePhones("");
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
            className={`flex-1 rounded-shape-md py-2.5 text-xs font-semibold transition ${
              tab === "join" ? "bg-arctic-800 text-white shadow-sm" : "text-arctic-700 hover:text-arctic-900"
            }`}
          >
            Rejoindre avec un code
          </button>
          <button
            type="button"
            onClick={() => {
              setTab("create");
              setError("");
            }}
            className={`flex-1 rounded-shape-md py-2.5 text-xs font-semibold transition ${
              tab === "create" ? "bg-arctic-800 text-white shadow-sm" : "text-arctic-700 hover:text-arctic-900"
            }`}
          >
            Créer une coopérative
          </button>
        </div>

        {tab === "join" ? (
          <form onSubmit={handleJoin} className="card space-y-4 p-6 shadow-elev-1">
            <div>
              <h2 className="text-base font-bold text-arctic-900">Rejoindre une coopérative existante</h2>
              <p className="mt-1 text-xs text-arctic-600">
                Entrez le code d&apos;adhésion à 6 lettres fourni par le responsable de votre marché ou association.
              </p>
            </div>

            <div>
              <label className="label">Code d&apos;adhésion (6 caractères)</label>
              <input
                className="input font-mono uppercase tracking-widest text-lg font-bold text-center"
                placeholder="Ex: ABCXYZ"
                maxLength={8}
                value={joinCodeInput}
                onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                required
              />
            </div>

            {error && <p className="rounded-md bg-red-50 p-2.5 text-xs text-red-600">{error}</p>}

            <button type="submit" disabled={busy} className="btn-primary w-full py-2.5 text-sm">
              {busy ? "Vérification…" : "Rejoindre la coopérative"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleCreate} className="card space-y-4 p-6 shadow-elev-1">
            <div>
              <h2 className="text-base font-bold text-arctic-900">Créer votre association marchande</h2>
              <p className="mt-1 text-xs text-arctic-600">
                Vous obtiendrez un code d&apos;adhésion unique, un QR code et un poster imprimable pour inscrire tous les vendeurs de votre marché.
              </p>
            </div>

            <div>
              <label className="label">Nom de l&apos;association ou coopérative *</label>
              <input
                className="input"
                placeholder="Ex: Marché de Hanoukopé, Artisans de Lomé..."
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="label">Région / Ville</label>
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
              {busy ? "Création…" : "Créer et générer mon code"}
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
              Région : <strong>{cooperative.region || "Non spécifiée"}</strong> · {cooperative.memberCount} boutique{cooperative.memberCount > 1 ? "s" : ""} membre{cooperative.memberCount > 1 ? "s" : ""}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`/join/${cooperative.joinCode}/flyer`}
              target="_blank"
              rel="noreferrer"
              className="btn-ghost text-xs font-semibold gap-1.5"
            >
              📄 Affiche / Flyer imprimable
            </a>
            <button
              onClick={handleLeave}
              disabled={busy}
              className="btn-danger text-xs !py-1.5"
            >
              Quitter
            </button>
          </div>
        </div>

        {/* Join Code & Share Box */}
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-shape-lg border border-arctic-300/50 bg-arctic-100/50 p-4 sm:col-span-2 space-y-3">
            <div className="text-xs font-semibold text-arctic-700">Code d&apos;adhésion de la coopérative</div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-3xl font-black tracking-wider text-arctic-900">
                {cooperative.joinCode}
              </span>
              <button
                type="button"
                onClick={copyJoinLink}
                className="btn-ghost text-xs py-1 px-3"
              >
                {copied ? "Lien copié !" : "Copier le lien d'adhésion"}
              </button>
            </div>

            <p className="text-xs text-arctic-600">
              Partagez ce code ou ce lien avec les vendeurs de votre marché pour qu&apos;ils rejoignent votre groupe.
            </p>

            <div className="pt-1 flex flex-wrap gap-2">
              <a
                href={whatsappShareUrl}
                target="_blank"
                rel="noreferrer"
                className="btn-primary text-xs gap-1.5"
              >
                <Glyph name="chat" size={14} /> Inviter sur WhatsApp
              </a>
            </div>
          </div>

          {/* QR Code */}
          <div className="flex flex-col items-center justify-center rounded-shape-lg border border-arctic-300/50 bg-white p-4 text-center">
            {qrSvg ? (
              <div
                className="h-28 w-28"
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
            ) : (
              <div className="h-28 w-28 grid place-items-center bg-arctic-100 text-xs text-arctic-500">
                QR Code
              </div>
            )}
            <span className="mt-2 text-[11px] font-medium text-arctic-500">Scanner pour rejoindre</span>
          </div>
        </div>
      </div>

      {/* WhatsApp Invite Blaster (for Admins / Leaders) */}
      <div className="card p-6 space-y-3">
        <h3 className="text-sm font-bold text-arctic-900">Inviter des vendeurs par WhatsApp</h3>
        <p className="text-xs text-arctic-600">
          Entrez les numéros de téléphone des commerçants (séparés par des virgules ou retours à la ligne) pour leur envoyer directement l&apos;invitation avec le lien.
        </p>
        <form onSubmit={handleInvite} className="space-y-3">
          <textarea
            className="input min-h-[65px] font-mono text-xs"
            placeholder="Ex: +228 90 12 34 56, +228 91 23 45 67"
            value={invitePhones}
            onChange={(e) => setInvitePhones(e.target.value)}
          />
          {inviteMsg && <p className="text-xs font-semibold text-emerald-700">{inviteMsg}</p>}
          <button
            type="submit"
            disabled={inviteBusy || !invitePhones.trim()}
            className="btn-primary text-xs py-2 px-4"
          >
            {inviteBusy ? "Envoi en cours…" : "Envoyer les invitations WhatsApp"}
          </button>
        </form>
      </div>

      {/* Members Directory */}
      <div className="card overflow-hidden">
        <div className="border-b border-arctic-300/40 px-5 py-3.5 flex items-center justify-between">
          <h3 className="font-bold text-arctic-900 text-sm">
            Membres de la coopérative ({cooperative.members.length})
          </h3>
          <span className="text-xs text-arctic-500">Boutiques actives</span>
        </div>

        <div className="divide-y divide-arctic-300/30">
          {cooperative.members.map((m, idx) => (
            <div key={m.id} className="flex items-center justify-between p-4 hover:bg-arctic-50/50">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-arctic-200 text-xs font-bold text-arctic-800">
                  {m.shopName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="font-semibold text-sm text-arctic-900">{m.shopName}</div>
                  <div className="text-xs text-arctic-500">
                    Membre depuis le {new Date(m.joinedAt).toLocaleDateString()}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href={`/c/${m.shopSlug}`}
                  target="_blank"
                  className="btn-ghost text-xs !py-1 px-3"
                >
                  Voir catalogue ↗
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
