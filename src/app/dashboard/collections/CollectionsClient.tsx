"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatMoney } from "@/lib/utils";
import Glyph from "@/components/Glyph";
import ProductPlaceholder from "@/components/ProductPlaceholder";

type ProductSummary = {
  id: string;
  name: string;
  priceCents: number;
  imageUrl?: string;
  stock?: number;
  collectionId?: string | null;
};

type Collection = {
  id: string;
  name: string;
  slug: string;
  description: string;
  productCount: number;
  products: { id: string; name: string; priceCents: number; imageUrl?: string; stock?: number }[];
};

export default function CollectionsClient({
  initialCollections,
  allProducts,
  shopSlug,
  currency,
}: {
  initialCollections: Collection[];
  allProducts: ProductSummary[];
  shopSlug: string;
  currency: string;
}) {
  const router = useRouter();
  const [collections, setCollections] = useState<Collection[]>(initialCollections);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const appBaseUrl = typeof window !== "undefined" ? window.location.origin : "https://japora.app";

  function openCreate() {
    setName("");
    setSlug("");
    setDescription("");
    setSelectedProductIds([]);
    setEditingId(null);
    setError("");
    setOpen(true);
  }

  function openEdit(c: Collection) {
    setName(c.name);
    setSlug(c.slug);
    setDescription(c.description);
    setSelectedProductIds(c.products.map((p) => p.id));
    setEditingId(c.id);
    setError("");
    setOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const url = editingId ? `/api/collections/${editingId}` : "/api/collections";
    const method = editingId ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        slug: slug.trim() || undefined,
        description: description.trim(),
        productIds: selectedProductIds,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);

    if (!res.ok) {
      setError(data.error || "Erreur lors de l'enregistrement de la collection.");
      return;
    }

    setOpen(false);
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("Voulez-vous vraiment supprimer cette collection ? (Les produits ne seront pas supprimés)")) return;
    const res = await fetch(`/api/collections/${id}`, { method: "DELETE" });
    if (res.ok) {
      setCollections((list) => list.filter((c) => c.id !== id));
      router.refresh();
    }
  }

  function toggleProduct(productId: string) {
    setSelectedProductIds((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId],
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <span className="text-sm text-arctic-600 font-medium">
          {collections.length} collection{collections.length > 1 ? "s" : ""}
        </span>
        <button onClick={openCreate} className="btn-primary">
          + Nouvelle collection
        </button>
      </div>

      {collections.length === 0 ? (
        <div className="card p-12 text-center text-arctic-600 space-y-3">
          <span className="text-4xl">📁</span>
          <h3 className="text-base font-bold text-arctic-800">Aucune collection créée</h3>
          <p className="text-sm max-w-md mx-auto">
            Créez votre première collection pour regrouper des articles saisonniers ou des promotions et partager un lien ciblé à vos clients.
          </p>
          <button onClick={openCreate} className="btn-primary mt-2">
            + Créer une collection
          </button>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {collections.map((c) => {
            const publicUrl = `${appBaseUrl}/c/${shopSlug}/collection/${c.slug}`;
            return (
              <div key={c.id} className="card p-5 space-y-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-lg font-bold text-arctic-900">{c.name}</h3>
                      <span className="text-xs font-mono text-arctic-500">/{c.slug}</span>
                    </div>
                    <span className="rounded-full bg-arctic-100 px-2.5 py-0.5 text-xs font-semibold text-arctic-700">
                      {c.productCount} produit{c.productCount > 1 ? "s" : ""}
                    </span>
                  </div>

                  {c.description && (
                    <p className="mt-2 text-xs text-arctic-600 line-clamp-2">{c.description}</p>
                  )}

                  {/* Products thumbnails */}
                  {c.products.length > 0 ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {c.products.slice(0, 6).map((p) => (
                        <div
                          key={p.id}
                          className="h-12 w-12 rounded-shape-md overflow-hidden border border-arctic-300/40 bg-arctic-100"
                          title={p.name}
                        >
                          {p.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" />
                          ) : (
                            <ProductPlaceholder name={p.name} size="sm" />
                          )}
                        </div>
                      ))}
                      {c.products.length > 6 && (
                        <div className="grid h-12 w-12 place-items-center rounded-shape-md bg-arctic-200 text-xs font-bold text-arctic-700">
                          +{c.products.length - 6}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="mt-3 text-xs italic text-arctic-400">Aucun produit dans cette collection.</p>
                  )}
                </div>

                <div className="pt-3 border-t border-arctic-300/40 flex items-center justify-between gap-2">
                  <Link
                    href={`/c/${shopSlug}/collection/${c.slug}`}
                    target="_blank"
                    className="text-xs font-semibold text-brand-dark hover:underline flex items-center gap-1"
                  >
                    Lien public ↗
                  </Link>

                  <div className="flex items-center gap-1.5">
                    <button onClick={() => openEdit(c)} className="btn-ghost text-xs !py-1 px-3">
                      Modifier
                    </button>
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="btn-danger text-xs !py-1 px-2.5"
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      {open && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-arctic-900/40 p-4">
          <div className="card w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between border-b border-arctic-300/40 px-5 py-3">
              <h3 className="font-bold text-arctic-900">
                {editingId ? "Modifier la collection" : "Nouvelle collection"}
              </h3>
              <button onClick={() => setOpen(false)} className="text-arctic-500 hover:text-arctic-800">
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="max-h-[75vh] space-y-4 overflow-y-auto p-5">
              <div>
                <label className="label">Nom de la collection *</label>
                <input
                  className="input"
                  placeholder="Ex: Nouveautés Été, Promotions..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="label">Identifiant URL (slug, optionnel)</label>
                <input
                  className="input font-mono text-xs"
                  placeholder="Ex: nouveautes-ete"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                />
              </div>

              <div>
                <label className="label">Description (optionnelle)</label>
                <textarea
                  className="input min-h-[60px]"
                  placeholder="Présentation de la sélection..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              {/* Product selector */}
              <div>
                <label className="label">Produits à inclure ({selectedProductIds.length} sélectionnés)</label>
                <div className="max-h-44 space-y-1.5 overflow-y-auto rounded-lg border border-arctic-300/40 bg-arctic-50/50 p-2.5 text-xs">
                  {allProducts.length === 0 ? (
                    <p className="text-arctic-400">Aucun produit disponible.</p>
                  ) : (
                    allProducts.map((p) => {
                      const checked = selectedProductIds.includes(p.id);
                      return (
                        <label
                          key={p.id}
                          className="flex cursor-pointer items-center justify-between rounded p-1.5 hover:bg-white"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleProduct(p.id)}
                              className="h-4 w-4 rounded text-brand"
                            />
                            <span className="truncate font-medium text-arctic-800">{p.name}</span>
                          </div>
                          <span className="font-semibold text-arctic-700 ml-2">
                            {formatMoney(p.priceCents, currency)}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              {error && <p className="rounded bg-red-50 p-2 text-xs text-red-600">{error}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setOpen(false)} className="btn-ghost">
                  Annuler
                </button>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? "Enregistrement…" : editingId ? "Enregistrer" : "Créer la collection"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
