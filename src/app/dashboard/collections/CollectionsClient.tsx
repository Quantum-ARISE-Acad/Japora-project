"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatMoney, slugify } from "@/lib/utils";
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
  imageUrl?: string;
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
  const [productsState, setProductsState] = useState<ProductSummary[]>(allProducts);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    setCollections(initialCollections);
  }, [initialCollections]);

  useEffect(() => {
    setProductsState(allProducts);
  }, [allProducts]);

  const appBaseUrl = typeof window !== "undefined" ? window.location.origin : "https://japora.app";

  function openCreate() {
    setName("");
    setSlug("");
    setSlugTouched(false);
    setDescription("");
    setImageUrl("");
    setSelectedProductIds([]);
    setProductSearch("");
    setEditingId(null);
    setError("");
    setOpen(true);
  }

  function openEdit(c: Collection) {
    setName(c.name);
    setSlug(c.slug);
    setSlugTouched(true);
    setDescription(c.description);
    setImageUrl(c.imageUrl || "");
    setSelectedProductIds(c.products.map((p) => p.id));
    setProductSearch("");
    setEditingId(c.id);
    setError("");
    setOpen(true);
  }

  async function handleCollectionImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError("L'image de la collection ne doit pas dépasser 10 Mo.");
      return;
    }
    setUploadingImage(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "collections");
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        setError(data.error || "Échec du téléversement de l'image.");
      } else {
        setImageUrl(data.url);
      }
    } catch {
      setError("Erreur réseau lors du téléversement de l'image.");
    } finally {
      setUploadingImage(false);
      e.target.value = "";
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Veuillez saisir un nom pour la collection.");
      return;
    }
    setSaving(true);
    setError("");

    const url = editingId ? `/api/collections/${editingId}` : "/api/collections";
    const method = editingId ? "PATCH" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim() || undefined,
          description: description.trim(),
          imageUrl: imageUrl.trim(),
          productIds: selectedProductIds,
        }),
      });
      const data = await res.json().catch(() => ({}));
      setSaving(false);

      if (!res.ok) {
        setError(data.error || "Erreur lors de l'enregistrement de la collection.");
        return;
      }

      if (data.collection) {
        const returnedProducts = Array.isArray(data.collection.products)
          ? data.collection.products
          : productsState.filter((p) => selectedProductIds.includes(p.id));

        const normalized: Collection = {
          id: data.collection.id,
          name: data.collection.name,
          slug: data.collection.slug,
          description: data.collection.description || "",
          imageUrl: data.collection.imageUrl || imageUrl.trim() || "",
          productCount: returnedProducts.length,
          products: returnedProducts,
        };

        if (editingId) {
          setCollections((prev) =>
            prev.map((c) => {
              if (c.id === editingId) return normalized;
              // Remove products that were moved to the edited collection
              const remaining = c.products.filter((p) => !selectedProductIds.includes(p.id));
              return { ...c, products: remaining, productCount: remaining.length };
            }),
          );
        } else {
          setCollections((prev) => [
            normalized,
            ...prev.map((c) => {
              const remaining = c.products.filter((p) => !selectedProductIds.includes(p.id));
              return { ...c, products: remaining, productCount: remaining.length };
            }),
          ]);
        }

        // Update local product collectionId mapping
        setProductsState((prev) =>
          prev.map((p) => {
            if (selectedProductIds.includes(p.id)) {
              return { ...p, collectionId: normalized.id };
            }
            if (editingId && p.collectionId === editingId) {
              return { ...p, collectionId: null };
            }
            return p;
          }),
        );
      }

      setOpen(false);
      router.refresh();
    } catch {
      setSaving(false);
      setError("Erreur réseau lors de l'enregistrement de la collection.");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Voulez-vous vraiment supprimer cette collection ? (Les produits ne seront pas supprimés)")) return;
    const res = await fetch(`/api/collections/${id}`, { method: "DELETE" });
    if (res.ok) {
      setCollections((list) => list.filter((c) => c.id !== id));
      setProductsState((prev) =>
        prev.map((p) => (p.collectionId === id ? { ...p, collectionId: null } : p)),
      );
      router.refresh();
    }
  }

  function toggleProduct(productId: string) {
    setSelectedProductIds((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId],
    );
  }

  function copyLink(c: Collection) {
    const url = `${appBaseUrl}/c/${shopSlug}/collection/${c.slug}`;
    navigator.clipboard.writeText(url);
    setCopiedId(c.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const filteredModalProducts = productsState.filter((p) =>
    !productSearch.trim() ? true : p.name.toLowerCase().includes(productSearch.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-arctic-100 px-3 py-1 text-xs font-semibold text-arctic-700">
            {collections.length} collection{collections.length > 1 ? "s" : ""} active{collections.length > 1 ? "s" : ""}
          </span>
          <Link
            href={`/c/${shopSlug}`}
            target="_blank"
            className="text-xs font-semibold text-brand-dark hover:underline"
          >
            Voir ma boutique ↗
          </Link>
        </div>
        <button onClick={openCreate} className="btn-primary">
          + Nouvelle collection
        </button>
      </div>

      {collections.length === 0 ? (
        <div className="card p-12 text-center text-arctic-600 space-y-3">
          <span className="text-4xl">📁</span>
          <h3 className="text-base font-bold text-arctic-800">Aucune collection créée</h3>
          <p className="text-sm max-w-md mx-auto">
            Créez votre première collection pour regrouper vos articles par thème (ex: Nouveautés, Promotions, Best-sellers) et les afficher en vitrine sur votre boutique.
          </p>
          <button onClick={openCreate} className="btn-primary mt-2">
            + Créer ma première collection
          </button>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {collections.map((c) => {
            const coverImage = c.imageUrl || c.products.find((p) => p.imageUrl)?.imageUrl;
            return (
              <div
                key={c.id}
                className="card overflow-hidden flex flex-col justify-between transition hover:shadow-ambient"
              >
                {/* Collection visual header */}
                <div className="relative h-28 bg-gradient-to-r from-brand-dark via-brand to-emerald-600 p-4 text-white flex items-end justify-between overflow-hidden">
                  {coverImage && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={coverImage}
                      alt={c.name}
                      className="absolute inset-0 h-full w-full object-cover opacity-35 mix-blend-overlay"
                    />
                  )}
                  <div className="relative z-10 min-w-0">
                    <span className="inline-block rounded-full bg-white/20 backdrop-blur-sm px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/90">
                      Collection · /{c.slug}
                    </span>
                    <h3 className="mt-1 text-lg font-bold text-white truncate">{c.name}</h3>
                  </div>
                  <span className="relative z-10 shrink-0 rounded-full bg-white text-brand-dark px-3 py-1 text-xs font-bold shadow-sm">
                    {c.productCount} produit{c.productCount > 1 ? "s" : ""}
                  </span>
                </div>

                <div className="p-5 space-y-4 flex-1 flex flex-col justify-between">
                  <div>
                    {c.description ? (
                      <p className="text-xs text-arctic-600 line-clamp-2">{c.description}</p>
                    ) : (
                      <p className="text-xs italic text-arctic-400">Aucune description</p>
                    )}

                    {/* Products thumbnails */}
                    {c.products.length > 0 ? (
                      <div className="mt-4">
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-arctic-500 mb-2">
                          Produits inclus
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {c.products.slice(0, 6).map((p) => (
                            <div
                              key={p.id}
                              className="group relative flex items-center gap-2 rounded-lg border border-arctic-300/50 bg-arctic-50 pr-2.5 overflow-hidden"
                              title={`${p.name} — ${formatMoney(p.priceCents, currency)}`}
                            >
                              <div className="h-10 w-10 shrink-0 overflow-hidden bg-arctic-100">
                                {p.imageUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" />
                                ) : (
                                  <ProductPlaceholder name={p.name} size="sm" />
                                )}
                              </div>
                              <div className="max-w-[110px]">
                                <div className="truncate text-xs font-medium text-arctic-900">{p.name}</div>
                                <div className="text-[10px] font-semibold text-brand-dark">
                                  {formatMoney(p.priceCents, currency)}
                                </div>
                              </div>
                            </div>
                          ))}
                          {c.products.length > 6 && (
                            <div className="grid h-10 px-3 place-items-center rounded-lg bg-arctic-200 text-xs font-bold text-arctic-700">
                              +{c.products.length - 6} autres
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 rounded-lg border border-dashed border-arctic-300 bg-arctic-50/60 p-3 text-center">
                        <p className="text-xs text-arctic-500">Aucun produit dans cette collection.</p>
                        <button
                          type="button"
                          onClick={() => openEdit(c)}
                          className="mt-1.5 text-xs font-semibold text-brand-dark hover:underline"
                        >
                          + Ajouter des produits maintenant
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-arctic-300/40 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/c/${shopSlug}/collection/${c.slug}`}
                        target="_blank"
                        className="text-xs font-semibold text-brand-dark hover:underline flex items-center gap-1"
                      >
                        Voir sur la boutique ↗
                      </Link>
                      <button
                        type="button"
                        onClick={() => copyLink(c)}
                        className="text-xs font-medium text-arctic-600 hover:text-arctic-900"
                      >
                        {copiedId === c.id ? "✓ Lien copié !" : "📋 Copier le lien"}
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button onClick={() => openEdit(c)} className="btn-ghost text-xs !py-1.5 px-3">
                        ✏️ Produits / Modifier
                      </button>
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="btn-danger text-xs !py-1.5 px-2.5"
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-arctic-900/50 backdrop-blur-xs p-4">
          <div className="card w-full max-w-xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between border-b border-arctic-300/40 bg-arctic-50 px-5 py-3.5">
              <div>
                <h3 className="font-bold text-arctic-900">
                  {editingId ? "Modifier la collection & ses produits" : "Créer une nouvelle collection"}
                </h3>
                <p className="text-xs text-arctic-500">
                  Regroupez vos produits et affichez-les en vitrine sur votre boutique.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-arctic-500 hover:bg-arctic-200/60 hover:text-arctic-800"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="max-h-[80vh] space-y-4 overflow-y-auto p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">Nom de la collection *</label>
                  <input
                    className="input"
                    placeholder="Ex: Nouveautés Été, Promotions..."
                    value={name}
                    onChange={(e) => {
                      const val = e.target.value;
                      setName(val);
                      if (!slugTouched) {
                        setSlug(slugify(val));
                      }
                    }}
                    required
                  />
                </div>

                <div>
                  <label className="label">Identifiant URL (slug)</label>
                  <input
                    className="input font-mono text-xs"
                    placeholder="Ex: nouveautes-ete"
                    value={slug}
                    onChange={(e) => {
                      setSlugTouched(true);
                      setSlug(slugify(e.target.value));
                    }}
                  />
                </div>
              </div>

              <div>
                <label className="label">Description (affichée en haut de la collection)</label>
                <textarea
                  className="input min-h-[64px]"
                  placeholder="Présentez cette sélection à vos clients..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div>
                <label className="label">Image de couverture (Firebase Storage)</label>
                <div className="flex flex-wrap items-center gap-3">
                  {imageUrl && (
                    <div className="relative h-14 w-20 overflow-hidden rounded-lg border border-arctic-300 bg-arctic-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imageUrl} alt="Aperçu couverture" className="h-full w-full object-cover" />
                    </div>
                  )}
                  <label className="btn-ghost cursor-pointer text-xs !py-2 px-3">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleCollectionImageUpload}
                      disabled={uploadingImage}
                      className="hidden"
                    />
                    {uploadingImage
                      ? "Téléversement Firebase…"
                      : imageUrl
                        ? "📷 Changer l'image"
                        : "📷 Ajouter une image de couverture"}
                  </label>
                  {imageUrl && (
                    <button
                      type="button"
                      onClick={() => setImageUrl("")}
                      className="text-xs font-medium text-red-600 hover:underline"
                    >
                      Retirer
                    </button>
                  )}
                </div>
              </div>

              {/* Product selector */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="label !mb-0">
                    Produits dans cette collection ({selectedProductIds.length} sélectionné{selectedProductIds.length > 1 ? "s" : ""})
                  </label>
                  {productsState.length > 0 && (
                    <div className="flex items-center gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => setSelectedProductIds(filteredModalProducts.map((p) => p.id))}
                        className="font-semibold text-brand-dark hover:underline"
                      >
                        Tout sélectionner
                      </button>
                      <span className="text-arctic-300">|</span>
                      <button
                        type="button"
                        onClick={() => setSelectedProductIds([])}
                        className="font-medium text-arctic-500 hover:underline"
                      >
                        Tout désélectionner
                      </button>
                    </div>
                  )}
                </div>

                {productsState.length > 3 && (
                  <input
                    type="text"
                    className="input text-xs !py-1.5"
                    placeholder="🔍 Rechercher un produit à ajouter..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                  />
                )}

                <div className="max-h-56 space-y-1.5 overflow-y-auto rounded-xl border border-arctic-300/50 bg-arctic-50/60 p-2.5 text-xs">
                  {productsState.length === 0 ? (
                    <div className="p-4 text-center text-arctic-500">
                      Aucun produit dans votre catalogue.{" "}
                      <Link href="/dashboard/products" className="font-semibold text-brand-dark underline">
                        Créez d&apos;abord un produit
                      </Link>
                      .
                    </div>
                  ) : filteredModalProducts.length === 0 ? (
                    <p className="p-3 text-center text-arctic-400">Aucun produit ne correspond à votre recherche.</p>
                  ) : (
                    filteredModalProducts.map((p) => {
                      const checked = selectedProductIds.includes(p.id);
                      const otherCol =
                        p.collectionId && p.collectionId !== editingId
                          ? collections.find((c) => c.id === p.collectionId)
                          : null;

                      return (
                        <label
                          key={p.id}
                          className={`flex cursor-pointer items-center justify-between rounded-lg border p-2 transition ${
                            checked
                              ? "border-brand bg-brand-light/25 shadow-2xs"
                              : "border-transparent bg-white hover:border-arctic-300/60"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleProduct(p.id)}
                              className="h-4 w-4 rounded text-brand focus:ring-brand"
                            />
                            <div className="h-9 w-9 shrink-0 overflow-hidden rounded-md border border-arctic-200 bg-arctic-100">
                              {p.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" />
                              ) : (
                                <ProductPlaceholder name={p.name} size="sm" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="truncate font-semibold text-arctic-900">{p.name}</div>
                              {otherCol && (
                                <div className="text-[10px] text-amber-700">
                                  Actuellement dans : {otherCol.name}
                                </div>
                              )}
                            </div>
                          </div>
                          <span className="shrink-0 font-bold text-arctic-800 ml-2">
                            {formatMoney(p.priceCents, currency)}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700">
                  ⚠️ {error}
                </div>
              )}

              <div className="flex justify-end gap-2 border-t border-arctic-200 pt-3">
                <button type="button" onClick={() => setOpen(false)} className="btn-ghost">
                  Annuler
                </button>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? "Enregistrement…" : editingId ? "Enregistrer les modifications" : "Créer la collection"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
