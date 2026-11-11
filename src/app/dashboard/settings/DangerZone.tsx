"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DangerZone({ shopName }: { shopName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function exportData() {
    // Trigger a download via a temporary <a>.
    const a = document.createElement("a");
    a.href = "/api/account/export";
    a.download = "";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  async function deleteAccount() {
    setDeleting(true);
    setError("");
    const res = await fetch("/api/account", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm }),
    });
    const data = await res.json().catch(() => ({}));
    setDeleting(false);
    if (!res.ok) {
      setError(data.error || "Could not delete account.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <>
      <div className="card border-red-200 p-5">
        <h2 className="text-sm font-semibold text-red-700">Danger zone</h2>
        <p className="mt-1 text-sm text-arctic-700">
          Export everything we hold for your shop, or close the account.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={exportData} className="btn-ghost">
            Export my data (.json)
          </button>
          <button onClick={() => setOpen(true)} className="btn-danger">
            Delete account
          </button>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-arctic-900/40 p-4">
          <div className="card w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-arctic-900">Delete account</h2>
            <p className="mt-2 text-sm text-arctic-700">
              This deactivates your shop and removes your products + orders from public view.
              Your data is kept in a tombstone for 12 months to honour disputes, then hard-deleted.
            </p>
            <p className="mt-3 text-sm font-medium text-arctic-800">
              Type your shop name to confirm:
            </p>
            <input
              className="input mt-1"
              placeholder={shopName}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            {error && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="btn-ghost">
                Cancel
              </button>
              <button
                onClick={deleteAccount}
                disabled={deleting || confirm !== shopName}
                className="btn-danger"
              >
                {deleting ? "Deleting…" : "Permanently delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
