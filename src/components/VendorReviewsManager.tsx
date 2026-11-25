"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import ProductPlaceholder from "@/components/ProductPlaceholder";
import { usePublicLang } from "@/components/PublicLanguageProvider";

export type VendorReviewItem = {
  id: string;
  productId: string;
  customerName: string;
  rating: number;
  comment: string;
  reply: string;
  createdAt: string;
  product?: {
    id: string;
    name: string;
    imageUrl: string;
  } | null;
};

type ProductOption = {
  id: string;
  name: string;
};

export default function VendorReviewsManager({
  reviews: externalReviews,
  onReviewsChange,
  products = [],
  selectedProductId = "",
  onSelectProductId,
  showFilters = false,
  linkProductToDashboard = false,
}: {
  reviews: VendorReviewItem[];
  onReviewsChange?: (next: VendorReviewItem[]) => void;
  products?: ProductOption[];
  selectedProductId?: string;
  onSelectProductId?: (productId: string) => void;
  showFilters?: boolean;
  linkProductToDashboard?: boolean;
}) {
  const { locale, tr } = usePublicLang();
  const [internalReviews, setInternalReviews] = useState<VendorReviewItem[]>(externalReviews);
  const reviews = onReviewsChange ? externalReviews : internalReviews;

  const [replyFilter, setReplyFilter] = useState<"all" | "unanswered">("all");
  const [ratingFilter, setRatingFilter] = useState<number>(0);
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  function updateReviews(next: VendorReviewItem[]) {
    if (onReviewsChange) {
      onReviewsChange(next);
    } else {
      setInternalReviews(next);
    }
  }

  const filtered = useMemo(() => {
    return reviews.filter((r) => {
      if (selectedProductId && r.productId !== selectedProductId) return false;
      if (replyFilter === "unanswered" && r.reply.trim() !== "") return false;
      if (ratingFilter > 0 && r.rating !== ratingFilter) return false;
      return true;
    });
  }, [reviews, selectedProductId, replyFilter, ratingFilter]);

  const unansweredCount = useMemo(
    () =>
      reviews.filter(
        (r) => (!selectedProductId || r.productId === selectedProductId) && r.reply.trim() === "",
      ).length,
    [reviews, selectedProductId],
  );

  function startReply(rev: VendorReviewItem) {
    setActionError("");
    setEditingReplyId(rev.id);
    setReplyDraft(rev.reply || "");
  }

  async function saveReply(reviewId: string) {
    setSavingId(reviewId);
    setActionError("");
    try {
      const res = await fetch(`/api/reviews/${reviewId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reply: replyDraft.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionError(data.error || tr("Impossible d’enregistrer la réponse.", "Could not save reply."));
        return;
      }
      const nextReply = data.review?.reply ?? replyDraft.trim();
      updateReviews(reviews.map((r) => (r.id === reviewId ? { ...r, reply: nextReply } : r)));
      setEditingReplyId(null);
      setReplyDraft("");
    } catch {
      setActionError(tr("Erreur réseau. Réessayez.", "Network error. Please try again."));
    } finally {
      setSavingId(null);
    }
  }

  async function deleteReview(rev: VendorReviewItem) {
    if (
      !confirm(
        tr(
          `Supprimer l’avis de « ${rev.customerName} » ?`,
          `Delete the review from "${rev.customerName}"?`,
        ),
      )
    ) {
      return;
    }
    setDeletingId(rev.id);
    setActionError("");
    try {
      const res = await fetch(`/api/reviews/${rev.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionError(data.error || tr("Impossible de supprimer l’avis.", "Could not delete review."));
        return;
      }
      updateReviews(reviews.filter((r) => r.id !== rev.id));
    } catch {
      setActionError(tr("Erreur réseau. Réessayez.", "Network error. Please try again."));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-3">
      {showFilters && (
        <div className="flex flex-wrap items-center gap-2 pb-1">
          {products.length > 0 && onSelectProductId && (
            <select
              value={selectedProductId}
              onChange={(e) => onSelectProductId(e.target.value)}
              className="input !w-auto max-w-[220px] text-xs font-medium"
            >
              <option value="">{tr("Tous les produits", "All products")}</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}

          <div className="flex items-center rounded-lg border border-arctic-300/50 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setReplyFilter("all")}
              className={`rounded-md px-2.5 py-1 font-semibold transition ${
                replyFilter === "all" ? "bg-arctic-800 text-white" : "text-arctic-600 hover:text-arctic-900"
              }`}
            >
              {tr("Tous", "All")}
            </button>
            <button
              type="button"
              onClick={() => setReplyFilter("unanswered")}
              className={`rounded-md px-2.5 py-1 font-semibold transition ${
                replyFilter === "unanswered" ? "bg-arctic-800 text-white" : "text-arctic-600 hover:text-arctic-900"
              }`}
            >
              {tr("Sans réponse", "Needs reply")} ({unansweredCount})
            </button>
          </div>

          <select
            value={ratingFilter}
            onChange={(e) => setRatingFilter(Number(e.target.value))}
            className="input !w-auto text-xs font-medium"
          >
            <option value={0}>{tr("Toutes les notes", "All ratings")}</option>
            {[5, 4, 3, 2, 1].map((star) => (
              <option key={star} value={star}>
                {"★".repeat(star)} ({star}/5)
              </option>
            ))}
          </select>
        </div>
      )}

      {actionError && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{actionError}</p>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-shape-md border border-arctic-300/40 bg-arctic-100/40 px-4 py-6 text-center text-sm text-arctic-600">
          {reviews.length === 0
            ? tr(
                "Aucun avis client pour le moment. Les avis publiés sur vos fiches produits apparaîtront ici.",
                "No customer reviews yet. Reviews submitted on your product pages will show up here.",
              )
            : tr("Aucun avis ne correspond à ces filtres.", "No reviews match these filters.")}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((rev) => {
            const isEditing = editingReplyId === rev.id;
            const prod = rev.product;
            return (
              <div
                key={rev.id}
                className="rounded-shape-md border border-arctic-300/45 bg-white/80 p-3.5 text-sm shadow-2xs space-y-2.5"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {prod && (
                      <div className="h-9 w-9 shrink-0 overflow-hidden rounded-md bg-arctic-200/65">
                        {prod.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={prod.imageUrl} alt={prod.name} className="h-full w-full object-cover" />
                        ) : (
                          <ProductPlaceholder name={prod.name} size="sm" />
                        )}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-semibold text-arctic-900">{rev.customerName}</span>
                        <span className="text-xs font-medium text-amber-500" aria-label={`${rev.rating}/5`}>
                          {"★".repeat(rev.rating)}
                          <span className="text-arctic-300">{"★".repeat(Math.max(0, 5 - rev.rating))}</span>
                        </span>
                        <span className="text-[11px] text-arctic-500">
                          {new Date(rev.createdAt).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US")}
                        </span>
                      </div>
                      {prod && (
                        <div className="text-xs text-arctic-600 truncate">
                          {tr("Produit :", "Product:")}{" "}
                          {linkProductToDashboard ? (
                            <Link
                              href={`/dashboard/products?reviewProduct=${encodeURIComponent(prod.id)}`}
                              className="font-medium text-brand-dark hover:underline"
                            >
                              {prod.name}
                            </Link>
                          ) : onSelectProductId && !selectedProductId ? (
                            <button
                              type="button"
                              onClick={() => onSelectProductId(prod.id)}
                              className="font-medium text-brand-dark hover:underline"
                            >
                              {prod.name}
                            </button>
                          ) : (
                            <span className="font-medium text-arctic-800">{prod.name}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {!isEditing && (
                      <button
                        type="button"
                        onClick={() => startReply(rev)}
                        className="btn-ghost !px-2.5 !py-1 text-xs"
                      >
                        {rev.reply
                          ? tr("Modifier la réponse", "Edit reply")
                          : tr("Répondre", "Reply")}
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={deletingId === rev.id}
                      onClick={() => void deleteReview(rev)}
                      className="btn-danger !px-2 !py-1 text-xs"
                      title={tr("Supprimer cet avis", "Delete this review")}
                    >
                      {deletingId === rev.id ? "…" : "✕"}
                    </button>
                  </div>
                </div>

                {rev.comment ? (
                  <p className="text-xs leading-relaxed text-arctic-800 whitespace-pre-wrap">{rev.comment}</p>
                ) : (
                  <p className="text-xs italic text-arctic-500">
                    {tr("Note attribuée sans commentaire écrit.", "Star rating left without a written comment.")}
                  </p>
                )}

                {rev.reply && !isEditing && (
                  <div className="rounded-r-md border-l-2 border-emerald-600 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                      {tr("Votre réponse (visible sur la boutique)", "Your reply (public on storefront)")}
                    </span>
                    <p className="mt-0.5 whitespace-pre-wrap">{rev.reply}</p>
                  </div>
                )}

                {isEditing && (
                  <div className="space-y-2 rounded-lg border border-arctic-300/60 bg-arctic-100/50 p-2.5">
                    <label className="block text-[11px] font-semibold text-arctic-700">
                      {tr("Votre réponse publique au client", "Your public reply to the customer")}
                    </label>
                    <textarea
                      rows={2}
                      value={replyDraft}
                      onChange={(e) => setReplyDraft(e.target.value)}
                      placeholder={tr(
                        "Ex. : Merci beaucoup pour votre confiance ! À très bientôt…",
                        "e.g. Thank you so much for your order! Hope to see you again…",
                      )}
                      className="input text-xs min-h-[56px]"
                    />
                    <div className="flex justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingReplyId(null);
                          setReplyDraft("");
                        }}
                        className="btn-ghost !px-2.5 !py-1 text-xs"
                      >
                        {tr("Annuler", "Cancel")}
                      </button>
                      <button
                        type="button"
                        disabled={savingId === rev.id}
                        onClick={() => void saveReply(rev.id)}
                        className="btn-primary !px-3 !py-1 text-xs"
                      >
                        {savingId === rev.id
                          ? tr("Enregistrement…", "Saving…")
                          : tr("Publier la réponse", "Save reply")}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
