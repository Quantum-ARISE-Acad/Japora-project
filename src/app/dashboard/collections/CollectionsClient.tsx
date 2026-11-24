"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatMoney, slugify } from "@/lib/utils";
import ProductPlaceholder from "@/components/ProductPlaceholder";
import { usePublicLang } from "@/components/PublicLanguageProvider";

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
  const { tr } = usePublicLang();
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
      setError(tr("L'image de la collection ne doit pas dépasser 10 Mo.", "The collection image must not be larger than 10 MB."));
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
        setError(data.error || tr("Échec du téléversement de l'image.", "Image upload failed."));
      } else {
        setImageUrl(data.url);
      }
    } catch {
      setError(tr("Erreur réseau lors du téléversement de l'image.", "Network error while uploading the image."));
    } finally {
      setUploadingImage(false);
      e.target.value = "";
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError(tr("Veuillez saisir un nom pour la collection.", "Please enter a collection name."));
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
        setError(data.error || tr("Erreur lors de l’enregistrement de la collection.", "Could not save the collection."));
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
      setError(tr("Erreur réseau lors de l’enregistrement de la collection.", "Network error while saving the collection."));
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(tr(
      "Voulez-vous vraiment supprimer cette collection ? Les produits ne seront pas supprimés.",
      "Are you sure you want to delete this collection? Its products will not be deleted.",
    ))) return;
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
    const url = `${window.location.origin}/c/${shopSlug}/collection/${c.slug}`;
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
            {collections.length} {tr("collection", "collection")}{collections.length > 1 ? "s" : ""} {tr("active", "active")}
          </span>
          <Link
            href={`/c/${shopSlug}`}
            target="_blank"
            className="text-xs font-semibold text-brand-dark hover:underline"
          >
            {tr("Voir ma boutique", "View my shop")} ↗
          </Link>
        </div>
        <button onClick={openCreate} className="btn-primary">
          + {tr("Nouvelle collection", "New collection")}
        </button>
      </div>

      {collections.length === 0 ? (
        <div className="card p-12 text-center text-arctic-600 space-y-3">
          <span className="text-4xl">📁</span>
          <h3 className="text-base font-bold text-arctic-800">{tr("Aucune collection créée", "No collections created")}</h3>
          <p className="text-sm max-w-md mx-auto">
            {tr(
              "Créez votre première collection pour regrouper vos articles par thème (ex. : nouveautés, promotions, meilleures ventes) et les afficher sur votre boutique.",
              "Create your first collection to group products by theme (e.g. new arrivals, promotions, best sellers) and feature them in your shop.",
            )}
          </p>
          <button onClick={openCreate} className="btn-primary mt-2">
            + {tr("Créer ma première collection", "Create my first collection")}
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
                      {tr("Collection", "Collection")} · /{c.slug}
                    </span>
                    <h3 className="mt-1 text-lg font-bold text-white truncate">{c.name}</h3>
                  </div>
                  <span className="relative z-10 shrink-0 rounded-full bg-white text-brand-dark px-3 py-1 text-xs font-bold shadow-sm">
                    {c.productCount} {tr(c.productCount === 1 ? "produit" : "produits", c.productCount === 1 ? "product" : "products")}
                  </span>
                </div>

                <div className="p-5 space-y-4 flex-1 flex flex-col justify-between">
                  <div>
                    {c.description ? (
                      <p className="text-xs text-arctic-600 line-clamp-2">{c.description}</p>
                    ) : (
                      <p className="text-xs italic text-arctic-400">{tr("Aucune description", "No description")}</p>
                    )}

                    {/* Products thumbnails */}
                    {c.products.length > 0 ? (
                      <div className="mt-4">
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-arctic-500 mb-2">
                          {tr("Produits inclus", "Included products")}
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
                              +{c.products.length - 6} {tr("autres", "more")}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 rounded-lg border border-dashed border-arctic-300 bg-arctic-50/60 p-3 text-center">
                        <p className="text-xs text-arctic-500">{tr("Aucun produit dans cette collection.", "No products in this collection.")}</p>
                        <button
                          type="button"
                          onClick={() => openEdit(c)}
                          className="mt-1.5 text-xs font-semibold text-brand-dark hover:underline"
                        >
                          + {tr("Ajouter des produits maintenant", "Add products now")}
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
                        {tr("Voir sur la boutique", "View in shop")} ↗
                      </Link>
                      <button
                        type="button"
                        onClick={() => copyLink(c)}
                        className="text-xs font-medium text-arctic-600 hover:text-arctic-900"
                      >
                        {copiedId === c.id ? `✓ ${tr("Lien copié !", "Link copied!")}` : `📋 ${tr("Copier le lien", "Copy link")}`}
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button onClick={() => openEdit(c)} className="btn-ghost text-xs !py-1.5 px-3">
                        ✏️ {tr("Produits / Modifier", "Products / Edit")}
                      </button>
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="btn-danger text-xs !py-1.5 px-2.5"
                      >
                        {tr("Supprimer", "Delete")}
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
          <div className="card w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[92dvh]">
            <div className="flex items-center justify-between border-b border-arctic-300/40 bg-arctic-50 px-5 py-3.5 shrink-0">
              <div>
                <h3 className="font-bold text-arctic-900">
                  {editingId ? tr("Modifier la collection et ses produits", "Edit collection and products") : tr("Créer une nouvelle collection", "Create a new collection")}
                </h3>
                <p className="text-xs text-arctic-500">
                  {tr("Regroupez vos produits et affichez-les sur votre boutique.", "Group your products and feature them in your shop.")}
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

            <form onSubmit={handleSave} className="flex-1 max-h-[80dvh] space-y-4 overflow-y-auto overscroll-contain p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">{tr("Nom de la collection", "Collection name")} *</label>
                  <input
                    className="input"
                    placeholder={tr("Ex. : Nouveautés d’été, Promotions…", "E.g. Summer arrivals, Promotions…")}
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
                  <label className="label">{tr("Identifiant URL (slug)", "URL slug")}</label>
                  <input
                    className="input font-mono text-xs"
                    placeholder={tr("Ex. : nouveautes-ete", "E.g. summer-arrivals")}
                    value={slug}
                    onChange={(e) => {
                      setSlugTouched(true);
                      setSlug(slugify(e.target.value));
                    }}
                  />
                </div>
              </div>

              <div>
                <label className="label">{tr("Description (affichée en haut de la collection)", "Description (shown at the top of the collection)")}</label>
                <textarea
                  className="input min-h-[64px]"
                  placeholder={tr("Présentez cette sélection à vos clients…", "Introduce this selection to your customers…")}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div>
                <label className="label">
                  {tr("Image de couverture (Firebase Storage)", "Cover image (Firebase Storage)")}
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  {imageUrl && (
                    <div className="relative h-14 w-20 overflow-hidden rounded-lg border border-arctic-300 bg-arctic-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imageUrl} alt={tr("Aperçu couverture", "Cover preview")} className="h-full w-full object-cover" />
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
                      ? tr("Téléversement Firebase…", "Uploading to Firebase…")
                      : imageUrl
                        ? tr("📷 Changer l'image", "📷 Change image")
                        : tr("📷 Ajouter une image de couverture", "📷 Add cover image")}
                  </label>
                  {imageUrl && (
                    <button
                      type="button"
                      onClick={() => setImageUrl("")}
                      className="text-xs font-medium text-red-600 hover:underline"
                    >
                      {tr("Retirer", "Remove")}
                    </button>
                  )}
                </div>
              </div>

              {/* Product selector */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="label !mb-0">
                    {tr("Produits dans cette collection", "Products in this collection")} ({selectedProductIds.length} {tr(selectedProductIds.length > 1 ? "sélectionnés" : "sélectionné", selectedProductIds.length > 1 ? "selected" : "selected")})
                  </label>
                  {productsState.length > 0 && (
                    <div className="flex items-center gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => setSelectedProductIds(filteredModalProducts.map((p) => p.id))}
                        className="font-semibold text-brand-dark hover:underline"
                      >
                        {tr("Tout sélectionner", "Select all")}
                      </button>
                      <span className="text-arctic-300">|</span>
                      <button
                        type="button"
                        onClick={() => setSelectedProductIds([])}
                        className="font-medium text-arctic-500 hover:underline"
                      >
                        {tr("Tout désélectionner", "Deselect all")}
                      </button>
                    </div>
                  )}
                </div>

                {productsState.length > 3 && (
                  <input
                    type="text"
                    className="input text-xs !py-1.5"
                    placeholder={`🔍 ${tr("Rechercher un produit à ajouter…", "Search for a product to add…")}`}
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                  />
                )}

                <div className="max-h-56 space-y-1.5 overflow-y-auto rounded-xl border border-arctic-300/50 bg-arctic-50/60 p-2.5 text-xs">
                  {productsState.length === 0 ? (
                    <div className="p-4 text-center text-arctic-500">
                      {tr("Aucun produit dans votre catalogue.", "No products in your catalog.")}{" "}
                      <Link href="/dashboard/products" className="font-semibold text-brand-dark underline">
                        {tr("Créez d’abord un produit", "Create a product first")}
                      </Link>
                      .
                    </div>
                  ) : filteredModalProducts.length === 0 ? (
                    <p className="p-3 text-center text-arctic-400">{tr("Aucun produit ne correspond à votre recherche.", "No products match your search.")}</p>
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
                                  {tr("Actuellement dans", "Currently in")}: {otherCol.name}
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
                  {tr("Annuler", "Cancel")}
                </button>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving
                    ? tr("Enregistrement…", "Saving…")
                    : editingId
                      ? tr("Enregistrer les modifications", "Save changes")
                      : tr("Créer la collection", "Create collection")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
