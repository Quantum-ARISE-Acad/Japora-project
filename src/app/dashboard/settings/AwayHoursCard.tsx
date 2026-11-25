"use client";

import { useState } from "react";
import { usePublicLang } from "@/components/PublicLanguageProvider";

/**
 * Business hours + away message. When hours are on and the shop is closed, the
 * WhatsApp bot leads every reply with the away message — so customers know
 * when to expect a response. tzOffsetMinutes is captured from the browser so
 * "open now" reflects the vendor's local wall clock (Togo = GMT = 0).
 */

type Hours = { enabled?: boolean; days?: number[]; open?: string; close?: string };

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

export default function AwayHoursCard({
  initial,
}: {
  initial: { awayMessage: string; businessHours: Hours };
}) {
  const { tr } = usePublicLang();
  const [awayMessage, setAwayMessage] = useState(initial.awayMessage || "");
  const [enabled, setEnabled] = useState(Boolean(initial.businessHours?.enabled));
  const [open, setOpen] = useState(initial.businessHours?.open || "08:00");
  const [close, setClose] = useState(initial.businessHours?.close || "20:00");
  const [days, setDays] = useState<number[]>(
    initial.businessHours?.days && initial.businessHours.days.length
      ? initial.businessHours.days
      : [1, 2, 3, 4, 5, 6],
  );
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState("");

  function toggleDay(d: number) {
    setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort()));
  }

  async function save() {
    setSaving(true);
    setError("");
    const tzOffsetMinutes = -new Date().getTimezoneOffset();
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        awayMessage,
        businessHours: { enabled, days, open, close },
        tzOffsetMinutes,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error || tr("Impossible d'enregistrer.", "Could not save."));
      return;
    }
    setSavedAt(Date.now());
    setTimeout(() => setSavedAt(null), 2000);
  }

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-arctic-900">
            {tr("Horaires & message d'absence", "Hours & away message")}
          </h2>
          <p className="mt-1 text-sm text-arctic-600">
            {tr(
              "En dehors de vos horaires d'ouverture, l'assistant commence sa réponse par ce message pour prévenir les clients.",
              "Outside your hours, the bot opens with this message so customers know when you're back.",
            )}
          </p>
        </div>
        {savedAt && (
          <span className="rounded-full bg-arctic-200/70 px-2 py-0.5 a-label-md text-arctic-900">
            {tr("Enregistré", "Saved")}
          </span>
        )}
      </div>

      <div className="mt-4 space-y-4">
        <div>
          <label htmlFor="awayhourscard-1" className="label">{tr("Message d'absence", "Away message")}</label>
          <textarea id="awayhourscard-1"
            className="input min-h-[64px]"
            placeholder={tr(
              "Merci ! Nous sommes actuellement fermés — nous vous répondrons dès demain matin.",
              "Merci ! We're closed now — we'll reply first thing tomorrow.",
            )}
            value={awayMessage}
            onChange={(e) => setAwayMessage(e.target.value)}
            maxLength={300}
          />
        </div>

        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-6 w-6 shrink-0 rounded-shape-xs border-arctic-400/45 text-brand focus:ring-brand"
          />
          <span className="a-label-md text-arctic-800">
            {tr("Activer les horaires d'ouverture", "Set business hours")}
          </span>
        </label>

        {enabled && (
          <div className="space-y-3 rounded-shape-md border border-arctic-400/30 bg-arctic-100/40 p-3">
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-arctic-800">
                {tr("Ouverture", "Open")}
                <input type="time" className="input !min-h-0 w-32 py-1.5" value={open} onChange={(e) => setOpen(e.target.value)} />
              </label>
              <label className="flex items-center gap-2 text-sm text-arctic-800">
                {tr("Fermeture", "Close")}
                <input type="time" className="input !min-h-0 w-32 py-1.5" value={close} onChange={(e) => setClose(e.target.value)} />
              </label>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {DAY_LABELS.map((lbl, d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDay(d)}
                  className={
                    "h-9 w-9 rounded-full text-sm font-semibold transition " +
                    (days.includes(d)
                      ? "bg-arctic-800 text-arctic-50"
                      : "border border-arctic-400/45 bg-white/70 text-arctic-700 hover:bg-arctic-100/70")
                  }
                  aria-pressed={days.includes(d)}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <p className="rounded-shape-md border border-aurora-error/30/70 bg-aurora-error-bg/80 px-3 py-2 a-body-sm text-aurora-error-text">{error}</p>
        )}

        <button onClick={save} disabled={saving} className="btn-primary">
          {saving ? tr("Enregistrement…", "Saving…") : tr("Enregistrer les horaires", "Save hours")}
        </button>
      </div>
    </div>
  );
}
