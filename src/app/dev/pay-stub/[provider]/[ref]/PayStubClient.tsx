"use client";

import { useState } from "react";

export default function PayStubClient({
  providerRef,
  alreadyTerminal,
}: {
  providerRef: string;
  alreadyTerminal: boolean;
}) {
  const [busy, setBusy] = useState<"" | "success" | "failure" | "pending">("");
  const [result, setResult] = useState<string>("");

  async function act(action: "success" | "failure" | "pending") {
    setBusy(action);
    setResult("");
    const res = await fetch("/api/dev/simulate-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ providerRef, action }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy("");
    if (!res.ok) {
      setResult(data.error || "Simulation failed.");
      return;
    }
    if (data.already) {
      setResult(`Already ${data.status}. Nothing changed.`);
      return;
    }
    if (action === "success") {
      setResult("✅ Marked paid. Order + receivable updated. You can close this tab.");
    } else if (action === "failure") {
      setResult("❌ Marked failed. The vendor will see this in their order board.");
    } else {
      setResult("⏳ Still pending. Reload to see the next state.");
    }
  }

  if (alreadyTerminal) {
    return (
      <div className="rounded-lg bg-arctic-100 px-3 py-3 text-center text-sm text-arctic-600">
        This payment is already settled. Nothing to do here.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => act("success")}
          disabled={busy !== ""}
          className="rounded-lg bg-gold-fill px-3 py-2.5 text-sm font-semibold text-white hover:bg-gold-fill disabled:opacity-60"
        >
          {busy === "success" ? "…" : "✅ Pay"}
        </button>
        <button
          onClick={() => act("failure")}
          disabled={busy !== ""}
          className="rounded-lg bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-100 disabled:opacity-60"
        >
          {busy === "failure" ? "…" : "❌ Fail"}
        </button>
        <button
          onClick={() => act("pending")}
          disabled={busy !== ""}
          className="rounded-lg bg-arctic-100 px-3 py-2.5 text-sm font-semibold text-arctic-700 hover:bg-arctic-200 disabled:opacity-60"
        >
          {busy === "pending" ? "…" : "⏳ Pending"}
        </button>
      </div>
      {result && (
        <p className="rounded-lg bg-arctic-50 px-3 py-2 text-sm text-arctic-700">
          {result}
        </p>
      )}
    </div>
  );
}
