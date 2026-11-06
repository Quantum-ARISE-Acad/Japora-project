"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Member = { id: string; shopName: string; shopSlug: string; createdAt: string };
type Cooperative = {
  id: string;
  name: string;
  region: string;
  joinCode: string;
  isAdmin: boolean;
  memberCount: number;
  members: Member[];
};

export default function CooperativeCard({ cooperative }: { cooperative: Cooperative | null }) {
  return (
    <section className="card p-5">
      <div className="mb-1 flex items-center gap-2">
        <h2 className="font-bold text-arctic-900">Cooperative / market</h2>
        <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-dark">
          Grow together
        </span>
      </div>
      <p className="mb-4 text-sm text-arctic-600">
        Sell under a shared market banner — and sign up your whole association at once with one
        join link.
      </p>
      {cooperative ? <Joined coop={cooperative} /> : <NotJoined />}
    </section>
  );
}

/* ------------------------------ Not in a coop ----------------------------- */

function NotJoined() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [region, setRegion] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/cooperative", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, region }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error || "Could not create.");
    router.refresh();
  }

  async function join(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/cooperative/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error || "Could not join.");
    router.refresh();
  }

  return (
    <div className="grid gap-5 md:grid-cols-2">
      <form onSubmit={create} className="space-y-3">
        <h3 className="text-sm font-semibold text-arctic-800">Start a cooperative</h3>
        <div>
          <label className="label">Name</label>
          <input className="input" placeholder="Marché d'Adawlato" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className="label">Region (optional)</label>
          <input className="input" placeholder="Lomé, Togo" value={region} onChange={(e) => setRegion(e.target.value)} />
        </div>
        <button className="btn-primary" disabled={busy}>{busy ? "…" : "Create cooperative"}</button>
      </form>

      <form onSubmit={join} className="space-y-3 md:border-l md:border-arctic-400/30 md:pl-5">
        <h3 className="text-sm font-semibold text-arctic-800">Join with a code</h3>
        <div>
          <label className="label">Join code</label>
          <input
            className="input uppercase"
            placeholder="ABC123"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            required
          />
        </div>
        <button className="btn-ghost" disabled={busy}>{busy ? "…" : "Join"}</button>
      </form>

      {error && <p className="md:col-span-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}

/* -------------------------------- Joined ---------------------------------- */

function Joined({ coop }: { coop: Cooperative }) {
  const router = useRouter();
  const base = typeof window !== "undefined" ? window.location.origin : "";
  const joinUrl = `${base}/join/${coop.joinCode}`;

  const [copied, setCopied] = useState(false);
  const [phones, setPhones] = useState("");
  const [inviteMsg, setInviteMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  }

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setInviteMsg("");
    const res = await fetch("/api/cooperative/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phones }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setInviteMsg(data.error || "Could not send invites.");
    setInviteMsg(`Sent ${data.sent} of ${data.total} invite${data.total === 1 ? "" : "s"} over WhatsApp.`);
    setPhones("");
  }

  async function leave() {
    if (!confirm(`Leave ${coop.name}?`)) return;
    const res = await fetch("/api/cooperative/leave", { method: "POST" });
    if (res.ok) router.refresh();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-bold text-arctic-900">{coop.name}</p>
          {coop.region && <p className="text-sm text-arctic-600">{coop.region}</p>}
          <p className="mt-0.5 text-sm text-arctic-600">
            {coop.memberCount} {coop.memberCount === 1 ? "member" : "members"}
            {coop.isAdmin && " · you're the admin"}
          </p>
        </div>
        <button onClick={leave} className="btn-ghost !py-1 text-xs">Leave</button>
      </div>

      {/* Join link + QR */}
      <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <span className="a-label-md text-arctic-600">Invite link</span>
          <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="flex-1 truncate rounded-lg bg-arctic-200/65 px-3 py-2 text-sm text-arctic-800">{joinUrl}</code>
            <button onClick={copy} className="btn-primary whitespace-nowrap !py-2">{copied ? "Copied!" : "Copy"}</button>
          </div>
          <p className="mt-1 a-label-md text-arctic-500">
            Share in the market WhatsApp group. Code: <span className="font-semibold">{coop.joinCode}</span>
          </p>
          <a
            href={`/join/${coop.joinCode}/flyer`}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex a-label-md font-semibold text-brand-dark hover:underline"
          >
            Print a recruitment flyer ↗
          </a>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/qr?data=${encodeURIComponent(joinUrl)}`}
          alt="Join QR"
          className="h-28 w-28 self-start rounded-lg border border-arctic-400/30 bg-white p-1"
        />
      </div>

      {/* Bulk invite */}
      <form onSubmit={invite} className="space-y-2">
        <label className="label">Invite the whole market</label>
        <textarea
          className="input min-h-[80px]"
          placeholder="Paste phone numbers — one per line, or comma-separated.&#10;+228 90 00 00 00&#10;+228 91 11 11 11"
          value={phones}
          onChange={(e) => setPhones(e.target.value)}
        />
        <div className="flex items-center gap-3">
          <button className="btn-primary" disabled={busy || !phones.trim()}>
            {busy ? "Sending…" : "Send WhatsApp invites"}
          </button>
          {inviteMsg && <span className="text-sm text-arctic-600">{inviteMsg}</span>}
        </div>
      </form>

      {/* Roster */}
      {coop.members.length > 0 && (
        <div>
          <span className="a-label-md text-arctic-600">Members</span>
          <ul className="mt-1 divide-y divide-arctic-400/20 rounded-lg border border-arctic-400/20">
            {coop.members.map((m) => (
              <li key={m.id} className="flex items-center justify-between px-3 py-2">
                <span className="font-medium text-arctic-800">{m.shopName}</span>
                <a href={`/c/${m.shopSlug}`} target="_blank" rel="noreferrer" className="text-xs text-brand-dark hover:underline">
                  /c/{m.shopSlug} ↗
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
