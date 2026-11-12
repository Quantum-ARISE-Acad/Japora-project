"use client";

import React, { useState, useEffect, useCallback } from "react";

interface ReviewItem {
  id: string;
  customerName: string;
  rating: number;
  comment: string;
  reply: string;
  createdAt: string;
}

interface ProductReviewsProps {
  productId: string;
  productName: string;
}

export function ProductReviews({ productId, productName }: ProductReviewsProps) {
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [averageRating, setAverageRating] = useState(5.0);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form states
  const [customerName, setCustomerName] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchReviews = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/reviews?productId=${encodeURIComponent(productId)}`);
      if (res.ok) {
        const data = await res.json();
        setReviews(data.reviews || []);
        setCount(data.count || 0);
        setAverageRating(data.averageRating || 5.0);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    void fetchReviews();
  }, [fetchReviews]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!customerName.trim()) {
      setMessage({ type: "error", text: "Veuillez entrer votre nom." });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          customerName: customerName.trim(),
          rating,
          comment: comment.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Erreur lors de l'envoi." });
      } else {
        setMessage({ type: "success", text: "Merci ! Votre avis a été publié." });
        setCustomerName("");
        setComment("");
        setRating(5);
        setShowForm(false);
        fetchReviews();
      }
    } catch {
      setMessage({ type: "error", text: "Erreur réseau. Réessayez plus tard." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-6 border-t border-slate-200 dark:border-slate-800 pt-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <span>Avis clients</span>
            {count > 0 && (
              <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-medium">
                ★ {averageRating} ({count})
              </span>
            )}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {count === 0 ? "Soyez le premier à donner votre avis sur ce produit !" : `${count} avis vérifié${count > 1 ? "s" : ""}`}
          </p>
        </div>

        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="px-3 py-1.5 text-xs font-medium bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg hover:opacity-90 transition-opacity"
          >
            Donner mon avis
          </button>
        )}
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-6 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Note pour {productName}
            </span>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              Annuler
            </button>
          </div>

          {/* Star selector */}
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                className="text-xl transition-transform hover:scale-110 focus:outline-none"
              >
                {star <= rating ? "⭐" : "☆"}
              </button>
            ))}
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 ml-2">
              {rating}/5
            </span>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Votre prénom / nom
            </label>
            <input
              type="text"
              required
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Ex: Koffi A."
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Commentaire (optionnel)
            </label>
            <textarea
              rows={2}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Qualité, livraison, conformité..."
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          {message && (
            <p
              className={`text-xs ${
                message.type === "success" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
              }`}
            >
              {message.text}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? "Publication..." : "Publier l'avis"}
            </button>
          </div>
        </form>
      )}

      {/* Reviews list */}
      {loading ? (
        <div className="py-4 text-center text-xs text-slate-400">Chargement des avis...</div>
      ) : reviews.length === 0 ? (
        <p className="text-xs text-slate-400 italic py-2">Aucun avis pour l&apos;instant.</p>
      ) : (
        <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
          {reviews.map((rev) => (
            <div
              key={rev.id}
              className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/80 text-xs space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {rev.customerName}
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-amber-500">{"★".repeat(rev.rating)}</span>
                  <span className="text-[10px] text-slate-400 ml-1">
                    {new Date(rev.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
              {rev.comment && (
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{rev.comment}</p>
              )}
              {rev.reply && (
                <div className="mt-1.5 pl-2.5 border-l-2 border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 py-1 rounded-r text-[11px] text-emerald-900 dark:text-emerald-200">
                  <span className="font-semibold block text-[10px] uppercase text-emerald-700 dark:text-emerald-400">
                    Réponse du vendeur
                  </span>
                  {rev.reply}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
