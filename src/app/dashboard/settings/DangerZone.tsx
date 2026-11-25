"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePublicLang } from "@/components/PublicLanguageProvider";
import { useClerk } from "@clerk/nextjs";
import { isClerkConfigured } from "@/components/auth/ClerkAuthProvider";

export default function DangerZone({ shopName }: { shopName: string }) {
  const { tr } = usePublicLang();
  const router = useRouter();
  const clerkActive = isClerkConfigured();
  let clerk: { signOut?: () => Promise<unknown> } | null = null;
  try {
    if (clerkActive) {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      clerk = useClerk();
    }
  } catch {
    clerk = null;
  }
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
      setError(data.error || tr("Impossible de supprimer le compte.", "Could not delete account."));
      return;
    }
    if (clerkActive && clerk?.signOut) {
      try {
        await clerk.signOut();
      } catch {
        // Ignore client signout error
      }
    }
    router.push("/");
    router.refresh();
  }

  return (
    <>
      <div className="card border-aurora-error/30 p-5">
        <h2 className="text-sm font-semibold text-aurora-error-text">{tr("Zone de danger", "Danger zone")}</h2>
        <p className="mt-1 text-sm text-arctic-700">
          {tr(
            "Exportez toutes les données de votre boutique, ou fermez le compte.",
            "Export everything we hold for your shop, or close the account.",
          )}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={exportData} className="btn-ghost">
            {tr("Exporter mes données (.json)", "Export my data (.json)")}
          </button>
          <button onClick={() => setOpen(true)} className="btn-danger">
            {tr("Supprimer le compte", "Delete account")}
          </button>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-arctic-900/40 p-4">
          <div className="card w-full max-w-md p-6 max-h-[90dvh] overflow-y-auto overscroll-contain">
            <h2 className="text-lg font-bold text-arctic-900">
              {tr("Supprimer le compte", "Delete account")}
            </h2>
            <p className="mt-2 text-sm text-arctic-700">
              {tr(
                "Cela désactive votre boutique et retire vos produits et commandes de la vue publique. Vos données sont conservées 12 mois en cas de litige, puis définitivement supprimées.",
                "This deactivates your shop and removes your products + orders from public view. Your data is kept in a tombstone for 12 months to honour disputes, then hard-deleted.",
              )}
            </p>
            <p className="mt-3 text-sm font-medium text-arctic-800">
              {tr("Saisissez le nom de votre boutique pour confirmer :", "Type your shop name to confirm:")}
            </p>
            <input
              className="input mt-1"
              placeholder={shopName}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            {error && (
              <p className="mt-3 rounded-lg bg-aurora-error-bg px-3 py-2 text-sm text-aurora-error-text">{error}</p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="btn-ghost">
                {tr("Annuler", "Cancel")}
              </button>
              <button
                onClick={deleteAccount}
                disabled={deleting || confirm !== shopName}
                className="btn-danger"
              >
                {deleting ? tr("Suppression…", "Deleting…") : tr("Supprimer définitivement", "Permanently delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
