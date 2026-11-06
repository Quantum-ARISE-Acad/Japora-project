/**
 * WhatsApp delivery log — surfaces read receipts.
 *
 * Outbound messages carry a status that Meta's webhook upgrades over time:
 * sent → delivered → read (or failed). We render WhatsApp-style ticks so a
 * vendor can see "the customer read it ✓✓" right next to what was sent.
 * Server component — reads straight from the WhatsAppMessage log.
 */

type Msg = {
  id: string;
  contact: string;
  body: string;
  status: string;
  createdAt: Date;
};

function Ticks({ status }: { status: string }) {
  // sent = ✓, delivered = ✓✓ (grey), read = ✓✓ (blue), failed = !, else clock.
  const map: Record<string, { glyph: string; cls: string; label: string }> = {
    sent: { glyph: "✓", cls: "text-arctic-400", label: "Sent" },
    delivered: { glyph: "✓✓", cls: "text-arctic-500", label: "Delivered" },
    read: { glyph: "✓✓", cls: "text-sky-500", label: "Read" },
    failed: { glyph: "⚠", cls: "text-red-500", label: "Failed" },
    received: { glyph: "↩", cls: "text-arctic-400", label: "Received" },
    stubbed: { glyph: "•", cls: "text-arctic-300", label: "Stub" },
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
  if (messages.length === 0) {
    return (
      <div className="card p-4">
        <h2 className="font-bold text-arctic-900">WhatsApp delivery</h2>
        <p className="mt-1 text-sm text-arctic-600">
          Once you send messages over WhatsApp, delivery and read receipts (✓✓) show up here.
          {" "}In stub mode they stay marked “Stub”.
        </p>
      </div>
    );
  }
  return (
    <div className="card p-4">
      <h2 className="font-bold text-arctic-900">WhatsApp delivery</h2>
      <p className="mt-0.5 mb-3 text-sm text-arctic-600">
        Last {messages.length} outbound message{messages.length === 1 ? "" : "s"} and their receipts.
      </p>
      <ul className="divide-y divide-arctic-400/20 rounded-lg border border-arctic-400/20">
        {messages.map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-3 px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm text-arctic-800">{m.body}</p>
              <p className="text-xs text-arctic-500">to {m.contact}</p>
            </div>
            <Ticks status={m.status} />
          </li>
        ))}
      </ul>
    </div>
  );
}
