"use client";

import { usePublicLang } from "@/components/PublicLanguageProvider";

/**
 * WhatsApp delivery log — surfaces read receipts.
 *
 * Outbound messages carry a status that Meta's webhook upgrades over time:
 * sent → delivered → read (or failed). We render WhatsApp-style ticks so a
 * vendor can see "the customer read it ✓✓" right next to what was sent.
 */

type Msg = {
  id: string;
  contact: string;
  body: string;
  status: string;
  createdAt: Date | string;
};

function Ticks({ status }: { status: string }) {
  const { tr } = usePublicLang();
  const map: Record<string, { glyph: string; cls: string; label: string }> = {
    sent: { glyph: "✓", cls: "text-arctic-400", label: tr("Envoyé", "Sent") },
    delivered: { glyph: "✓✓", cls: "text-arctic-500", label: tr("Distribué", "Delivered") },
    read: { glyph: "✓✓", cls: "text-sky-500", label: tr("Lu", "Read") },
    failed: { glyph: "⚠", cls: "text-red-500", label: tr("Échec", "Failed") },
    received: { glyph: "↩", cls: "text-arctic-400", label: tr("Reçu", "Received") },
    stubbed: { glyph: "•", cls: "text-arctic-300", label: tr("Simulé", "Stub") },
  };
  const m = map[status] || map.stubbed;
  return (
    <span className={"inline-flex items-center gap-1 text-xs font-semibold " + m.cls} title={m.label}>
      <span aria-hidden>{m.glyph}</span>
      <span className="font-normal">{m.label}</span>
    </span>
  );
}

export default function DeliveryLog({ messages }: { messages: Msg[] }) {
  const { tr } = usePublicLang();

  if (messages.length === 0) {
    return (
      <div className="card p-4">
        <h2 className="font-bold text-arctic-900">
          {tr("Journal d'envoi WhatsApp", "WhatsApp delivery")}
        </h2>
        <p className="mt-1 text-sm text-arctic-600">
          {tr(
            "Dès que vous envoyez des messages sur WhatsApp, les accusés de réception et de lecture (✓✓) s'affichent ici. En mode simulation, ils restent marqués « Simulé ».",
            "Once you send messages over WhatsApp, delivery and read receipts (✓✓) show up here. In stub mode they stay marked “Stub”.",
          )}
        </p>
      </div>
    );
  }
  return (
    <div className="card p-4">
      <h2 className="font-bold text-arctic-900">
        {tr("Journal d'envoi WhatsApp", "WhatsApp delivery")}
      </h2>
      <p className="mt-0.5 mb-3 text-sm text-arctic-600">
        {tr(
          `${messages.length} dernier${messages.length === 1 ? "" : "s"} message${messages.length === 1 ? "" : "s"} sortant${messages.length === 1 ? "" : "s"} et leurs accusés de réception.`,
          `Last ${messages.length} outbound message${messages.length === 1 ? "" : "s"} and their receipts.`,
        )}
      </p>
      <ul className="divide-y divide-arctic-400/20 rounded-lg border border-arctic-400/20">
        {messages.map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-3 px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm text-arctic-800">{m.body}</p>
              <p className="text-xs text-arctic-500">
                {tr("vers", "to")} {m.contact}
              </p>
            </div>
            <Ticks status={m.status} />
          </li>
        ))}
      </ul>
    </div>
  );
}
