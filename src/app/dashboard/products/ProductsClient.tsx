"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatMoney, parseSizes } from "@/lib/utils";
import { compressImage } from "@/lib/client-image";
import AssetDownloads from "./AssetDownloads";
import { AuroraIsoscout } from "@/components/aurora";
import ProductPlaceholder from "@/components/ProductPlaceholder";
import { usePublicLang } from "@/components/PublicLanguageProvider";

type Product = {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  /** Secret minimum price for automatic bargaining (vendor only). */
  minPriceCents?: number | null;
  imageUrl: string;
  sizes: string;
  stock: number;
  isActive: boolean;
  condition?: string;
  collectionId?: string | null;
};

type CollectionRef = {
  id: string;
  name: string;
  slug: string;
};

type FormState = {
  name: string;
  price: string;
  minPrice: string;
  description: string;
  sizes: string;
  stock: string;
  imageUrl: string;
  isActive: boolean;
  condition: string;
  collectionId: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  price: "",
  minPrice: "",
  description: "",
  sizes: "",
  stock: "0",
  imageUrl: "",
  isActive: true,
  condition: "new",
  collectionId: "",
};

export default function ProductsClient({
  initialProducts,
  collections = [],
  currency,
  shopSlug,
}: {
  initialProducts: Product[];
  collections?: CollectionRef[];
  currency: string;
  shopSlug: string;
}) {
  const router = useRouter();
  const { tr } = usePublicLang();
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");

  // Search, filter, view mode and sorting state
  const [searchQuery, setSearchQuery] = useState("");
  const [stockFilter, setStockFilter] = useState<"all" | "in_stock" | "low_stock" | "out_of_stock">("all");
  const [sortBy, setSortBy] = useState<"default" | "stock_asc" | "price_asc" | "price_desc">("default");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const filteredProducts = useMemo(() => {
    let list = [...products];

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          (p.condition && p.condition.toLowerCase().includes(q)),
      );
    }

    // Stock filter
    if (stockFilter === "in_stock") {
      list = list.filter((p) => p.stock > 0);
    } else if (stockFilter === "low_stock") {
      list = list.filter((p) => p.stock > 0 && p.stock <= 3);
    } else if (stockFilter === "out_of_stock") {
      list = list.filter((p) => p.stock === 0);
    }

    // Sort
    if (sortBy === "stock_asc") {
      list.sort((a, b) => a.stock - b.stock);
    } else if (sortBy === "price_asc") {
      list.sort((a, b) => a.priceCents - b.priceCents);
    } else if (sortBy === "price_desc") {
      list.sort((a, b) => b.priceCents - a.priceCents);
    }

    return list;
  }, [products, searchQuery, stockFilter, sortBy]);

  async function importFromWhatsApp() {
    setImporting(true);
    setImportMsg("");
    const res = await fetch("/api/products/import", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setImporting(false);
    if (!res.ok) {
      setImportMsg(data.error || tr("Impossible de joindre WhatsApp Business. Connectez-le d’abord.", "Couldn't reach WhatsApp Business. Connect it first."));
      return;
    }
    setImportMsg(tr(
      `${data.count} produit${data.count === 1 ? "" : "s"} importé${data.count === 1 ? "" : "s"} (${data.skipped} ignoré${data.skipped === 1 ? "" : "s"}).`,
      `Imported ${data.count} product${data.count === 1 ? "" : "s"} (${data.skipped} skipped).`,
    ));
    if (data.count > 0) await reload();
  }

  async function reload() {
    const res = await fetch("/api/products");
    if (res.ok) {
      const data = await res.json();
      setProducts(data.products);
    }
    router.refresh();
  }

  function openAdd() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setError("");
    setOpen(true);
  }

  function openEdit(p: Product) {
    setForm({
      name: p.name,
      price: (p.priceCents / 100).toString(),
      minPrice: p.minPriceCents ? (p.minPriceCents / 100).toString() : "",
      description: p.description,
      sizes: p.sizes,
      stock: p.stock.toString(),
      imageUrl: p.imageUrl,
      isActive: p.isActive,
      condition: p.condition || "new",
      collectionId: p.collectionId || "",
    });
    setEditingId(p.id);
    setError("");
    setOpen(true);
  }

  function duplicateProduct(p: Product) {
    setForm({
      name: `${p.name} (${tr("copie", "copy")})`,
      price: (p.priceCents / 100).toString(),
      minPrice: p.minPriceCents ? (p.minPriceCents / 100).toString() : "",
      description: p.description,
      sizes: p.sizes,
      stock: p.stock.toString(),
      imageUrl: p.imageUrl,
      isActive: true,
      condition: p.condition || "new",
      collectionId: p.collectionId || "",
    });
    setEditingId(null);
    setError("");
    setOpen(true);
  }

  async function quickAdjustStock(p: Product, delta: number) {
    const newStock = Math.max(0, p.stock + delta);
    setProducts((list) =>
      list.map((item) => (item.id === p.id ? { ...item, stock: newStock } : item)),
    );

    try {
      await fetch(`/api/products/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stock: newStock }),
      });
    } catch {
      await reload();
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const original = e.target.files?.[0];
    if (!original) return;
    setUploading(true);
    setError("");
    let toUpload: File = original;
    try {
      toUpload = await compressImage(original, { maxDim: 1200, quality: 0.82 });
    } catch {
      toUpload = original;
    }
    const fd = new FormData();
    fd.append("file", toUpload);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    setUploading(false);
    if (!res.ok) {
      setError(data.error || tr("Échec du téléversement.", "Upload failed"));
      return;
    }
    setForm((f) => ({ ...f, imageUrl: data.url }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const payload = {
      name: form.name.trim(),
      price: form.price,
      minPrice: form.minPrice.trim() || null,
      description: form.description.trim(),
      sizes: form.sizes.trim(),
      stock: parseInt(form.stock, 10) || 0,
      imageUrl: form.imageUrl.trim(),
      isActive: form.isActive,
      condition: form.condition,
      collectionId: form.collectionId || null,
    };

    const url = editingId ? `/api/products/${editingId}` : "/api/products";
    const method = editingId ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error || tr("Impossible d’enregistrer le produit.", "Could not save product."));
      return;
    }
    setOpen(false);
    await reload();
  }

  async function toggleActive(p: Product) {
    const res = await fetch(`/api/products/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !p.isActive }),
    });
    if (res.ok) {
      setProducts((all) =>
        all.map((item) => (item.id === p.id ? { ...item, isActive: !item.isActive } : item)),
      );
    }
  }

  async function remove(p: Product) {
    if (!confirm(tr(`Supprimer « ${p.name} » ?`, `Delete "${p.name}"?`))) return;
    const res = await fetch(`/api/products/${p.id}`, { method: "DELETE" });
    if (res.ok) {
      setProducts((all) => all.filter((item) => item.id !== p.id));
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="a-headline-md text-arctic-900">{tr("Produits", "Products")}</h1>
          <p className="text-sm text-arctic-600">
            {products.length} {tr(products.length === 1 ? "produit dans votre catalogue." : "produits dans votre catalogue.", products.length === 1 ? "product in your catalog." : "products in your catalog.")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={importFromWhatsApp}
            disabled={importing}
            className="btn-ghost text-xs font-semibold"
            title={tr("Importer les produits du catalogue Meta WhatsApp Cloud", "Import products from your Meta WhatsApp Cloud catalog")}
          >
            {importing ? tr("Importation…", "Importing…") : `⬇ ${tr("Importer depuis WhatsApp", "Import from WhatsApp")}`}
          </button>
          <button onClick={openAdd} className="btn-primary">
            + {tr("Ajouter un produit", "Add product")}
          </button>
        </div>
      </div>

      {importMsg && (
        <div className="rounded-shape-md bg-arctic-200/65 px-4 py-2 text-xs text-arctic-800">
          {importMsg}
        </div>
      )}

      {/* Filter and Search Toolbar */}
      <div className="card flex flex-wrap items-center justify-between gap-3 p-3">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <input
            className="input min-w-[200px] flex-1 text-sm"
            placeholder={tr("Rechercher par nom ou description…", "Search by name or description…")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <select
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value as typeof stockFilter)}
            className="input !w-auto text-xs font-medium"
          >
            <option value="all">{tr("Tous les stocks", "All stock levels")} ({products.length})</option>
            <option value="in_stock">{tr("En stock", "In stock")}</option>
            <option value="low_stock">{tr("Stock faible (≤ 3)", "Low stock (≤ 3)")}</option>
            <option value="out_of_stock">{tr("Épuisé (0)", "Out of stock (0)")}</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="input !w-auto text-xs font-medium"
          >
            <option value="default">{tr("Tri : date (récent)", "Sort: date (newest)")}</option>
            <option value="stock_asc">{tr("Stock (à réapprovisionner d’abord)", "Stock (restock first)")}</option>
            <option value="price_asc">{tr("Prix croissant", "Price: low to high")}</option>
            <option value="price_desc">{tr("Prix décroissant", "Price: high to low")}</option>
          </select>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center rounded-lg border border-arctic-300/40 p-0.5">
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
              viewMode === "grid" ? "bg-arctic-800 text-white" : "products-view-toggle-inactive text-arctic-600 hover:text-arctic-900"
            }`}
            title={tr("Vue en grille", "Grid view")}
          >
            {tr("Grille", "Grid")}
          </button>
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
              viewMode === "list" ? "bg-arctic-800 text-white" : "products-view-toggle-inactive text-arctic-600 hover:text-arctic-900"
            }`}
            title={tr("Vue en liste", "List view")}
          >
            {tr("Liste", "List")}
          </button>
        </div>
      </div>

      {products.length === 0 ? (
        <div className="glass glass-edge rounded-shape-lg p-6">
          <AuroraIsoscout
            variant="products"
            title={tr("Votre catalogue est vide", "Your shelf is empty")}
            body={tr(
              "Ajoutez votre premier produit — photo, prix, stock — pour activer votre catalogue. Vos clients le verront immédiatement et le bot répondra automatiquement aux questions sur les prix.",
              "Add your first item — photo, price, stock — and your catalog link starts working. Customers see it in seconds, the bot answers price questions automatically.",
            )}
            action={
              <button onClick={openAdd} className="btn-primary">
                + {tr("Ajouter un produit", "Add product")}
              </button>
            }
          />
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="card p-12 text-center text-arctic-600">
          <p className="text-sm">{tr("Aucun produit ne correspond à vos filtres.", "No products match your filters.")}</p>
          <button
            onClick={() => {
              setSearchQuery("");
              setStockFilter("all");
            }}
            className="btn-ghost mt-2 text-xs"
          >
            {tr("Réinitialiser les filtres", "Reset filters")}
          </button>
        </div>
      ) : viewMode === "grid" ? (
        /* GRID VIEW */
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {filteredProducts.map((p) => {
            const sizes = parseSizes(p.sizes);
            return (
              <div key={p.id} className="card group flex flex-col overflow-hidden">
                <div className="relative aspect-square bg-arctic-200/65">
                  {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" />
                  ) : (
                    <ProductPlaceholder name={p.name} size="md" />
                  )}

                  <div className="absolute left-2 top-2 flex flex-col gap-1">
                    {!p.isActive && (
                      <span className="rounded bg-arctic-900/80 px-2 py-0.5 text-xs font-semibold text-white">
                        {tr("Masqué", "Hidden")}
                      </span>
                    )}
                    {p.condition && p.condition !== "new" && (
                      <span className="rounded bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white capitalize backdrop-blur">
                        {p.condition === "used" ? "Occasion" : "Reconditionné"}
                      </span>
                    )}
                  </div>

                  <span
                    className={
                      "absolute right-2 top-2 rounded px-2 py-0.5 text-xs font-semibold " +
                      (p.stock === 0
                        ? "bg-red-600 text-white"
                        : p.stock <= 3
                          ? "bg-amber-500 text-white"
                          : "bg-white/90 text-arctic-800")
                    }
                  >
                    {p.stock === 0 ? tr("Épuisé", "Out of stock") : `${p.stock} ${tr("en stock", "in stock")}`}
                  </span>
                </div>

                <div className="flex flex-1 flex-col space-y-2 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold leading-tight text-arctic-900">{p.name}</h3>
                    <span className="whitespace-nowrap font-bold text-brand-dark">
                      {formatMoney(p.priceCents, currency)}
                    </span>
                  </div>

                  {/* Quick Stock Adjuster */}
                  <div className="flex items-center justify-between rounded-lg border border-arctic-300/40 bg-arctic-100/40 px-2 py-1 text-xs">
                    <span className="text-arctic-600">{tr("Stock :", "Stock:")}</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => quickAdjustStock(p, -1)}
                        className="grid h-6 w-6 place-items-center rounded bg-white font-bold shadow-xs hover:bg-arctic-200"
                        title={tr("Diminuer le stock", "Decrease stock")}
                      >
                        -
                      </button>
                      <span className="w-7 text-center font-bold">{p.stock}</span>
                      <button
                        type="button"
                        onClick={() => quickAdjustStock(p, 1)}
                        className="grid h-6 w-6 place-items-center rounded bg-white font-bold shadow-xs hover:bg-arctic-200"
                        title={tr("Augmenter le stock", "Increase stock")}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {sizes.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {sizes.map((s) => (
                        <span key={s} className="rounded bg-arctic-200/65 px-1.5 py-0.5 text-[11px] text-arctic-700">
                          {s}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-auto flex flex-wrap gap-1.5 pt-2">
                    <button onClick={() => openEdit(p)} className="btn-ghost flex-1 !py-1 text-xs">
                      {tr("Modifier", "Edit")}
                    </button>
                    <button
                      onClick={() => duplicateProduct(p)}
                      className="btn-ghost !py-1 text-xs"
                      title={tr("Dupliquer ce produit", "Duplicate this product")}
                    >
                      {tr("Copier", "Copy")}
                    </button>
                    <button
                      onClick={() => toggleActive(p)}
                      className="btn-ghost !py-1 text-xs"
                      title={p.isActive ? tr("Masquer", "Hide") : tr("Afficher", "Show")}
                    >
                      {p.isActive ? tr("Masquer", "Hide") : tr("Afficher", "Show")}
                    </button>
                    <button onClick={() => remove(p)} className="btn-danger !py-1 text-xs">
                      ✕
                    </button>
                  </div>

                  <AssetDownloads
                    productId={p.id}
                    productName={p.name}
                    priceText={formatMoney(p.priceCents, currency)}
                    shopSlug={shopSlug}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* LIST VIEW */
        <div className="card divide-y divide-arctic-300/40 overflow-hidden">
          {filteredProducts.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-4 p-4 hover:bg-arctic-50/50">
              <div className="flex items-center gap-3 min-w-[240px] flex-1">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-arctic-200/65">
                  {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" />
                  ) : (
                    <ProductPlaceholder name={p.name} size="sm" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-arctic-900 truncate">{p.name}</span>
                    {p.condition && p.condition !== "new" && (
                      <span className="rounded bg-arctic-200 px-1.5 py-0.2 text-[10px] font-semibold text-arctic-700">
                        {p.condition === "used" ? tr("Occasion", "Used") : tr("Reconditionné", "Refurbished")}
                      </span>
                    )}
                    {!p.isActive && (
                      <span className="rounded bg-arctic-300 px-1.5 py-0.2 text-[10px] text-arctic-600">
                        {tr("Masqué", "Hidden")}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-arctic-500 truncate">{p.description || tr("Sans description", "No description")}</div>
                </div>
              </div>

              {/* Price & Stock Adjustment */}
              <div className="flex items-center gap-6">
                <div className="font-bold text-brand-dark min-w-[80px] text-right">
                  {formatMoney(p.priceCents, currency)}
                </div>

                <div className="flex items-center gap-1.5 rounded-lg border border-arctic-300/40 px-2 py-1">
                  <button
                    type="button"
                    onClick={() => quickAdjustStock(p, -1)}
                    className="grid h-5 w-5 place-items-center rounded bg-arctic-100 text-xs font-bold hover:bg-arctic-200"
                  >
                    -
                  </button>
                  <span className="w-6 text-center text-xs font-bold">{p.stock}</span>
                  <button
                    type="button"
                    onClick={() => quickAdjustStock(p, 1)}
                    className="grid h-5 w-5 place-items-center rounded bg-arctic-100 text-xs font-bold hover:bg-arctic-200"
                  >
                    +
                  </button>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <button onClick={() => openEdit(p)} className="btn-ghost !py-1 text-xs">
                    {tr("Modifier", "Edit")}
                  </button>
                  <button onClick={() => duplicateProduct(p)} className="btn-ghost !py-1 text-xs" title={tr("Dupliquer", "Duplicate")}>
                    {tr("Copier", "Copy")}
                  </button>
                  <button onClick={() => toggleActive(p)} className="btn-ghost !py-1 text-xs">
                    {p.isActive ? tr("Masquer", "Hide") : tr("Afficher", "Show")}
                  </button>
                  <button onClick={() => remove(p)} className="btn-danger !py-1 text-xs">
                    {tr("Supprimer", "Delete")}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {open && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-arctic-900/40 p-4">
          <div className="card w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between border-b border-arctic-400/30 px-5 py-3">
              <h2 className="font-bold text-arctic-900">
                {editingId ? tr("Modifier le produit", "Edit product") : tr("Ajouter un produit", "Add product")}
              </h2>
              <button onClick={() => setOpen(false)} className="text-arctic-500 hover:text-arctic-800">
                ✕
              </button>
            </div>
            <form onSubmit={save} className="max-h-[75vh] space-y-4 overflow-y-auto p-5">
              <div className="flex gap-4">
                <div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-lg bg-arctic-200/65">
                  {form.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <ProductPlaceholder name={form.name || "P"} size="md" />
                  )}
                </div>
                <div className="flex-1">
                  <label className="label">{tr("Photo du produit", "Product photo")}</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={onFile}
                    className="block w-full text-sm text-arctic-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand/10 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-brand-dark hover:file:bg-brand/20"
                  />
                  {uploading && <p className="mt-1 text-xs text-arctic-600">{tr("Téléversement…", "Uploading…")}</p>}
                </div>
              </div>

              <div>
                <label className="label">{tr("Nom", "Name")}</label>
                <input
                  className="input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="product-price">
                    {tr("Prix affiché", "Shown price")} ({currency})
                  </label>
                  <input
                    id="product-price"
                    className="input"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="label" htmlFor="product-min-price">
                    {tr("Prix minimum (secret)", "Minimum price (secret)")} ({currency})
                  </label>
                  <input
                    id="product-min-price"
                    className="input"
                    inputMode="decimal"
                    placeholder={tr("Facultatif", "Optional")}
                    value={form.minPrice}
                    onChange={(e) => setForm({ ...form, minPrice: e.target.value })}
                    aria-describedby="product-min-price-help"
                  />
                </div>
                <p id="product-min-price-help" className="col-span-2 -mt-1 text-xs text-arctic-600">
                  {tr(
                    "Les clients voient seulement le prix affiché. Si vous indiquez un prix minimum, l’assistant WhatsApp marchande seul et accepte toute offre à partir de ce prix, sans jamais descendre en dessous. Sans prix minimum, chaque offre vous est envoyée pour validation.",
                    "Customers only see the shown price. With a minimum price, the WhatsApp assistant bargains on its own and accepts any offer from that price, never below it. Without one, every offer is sent to you for approval.",
                  )}
                </p>
                <div>
                  <label className="label" htmlFor="product-stock">
                    {tr("Quantité en stock", "Stock count")}
                  </label>
                  <input
                    id="product-stock"
                    className="input"
                    inputMode="numeric"
                    value={form.stock}
                    onChange={(e) => setForm({ ...form, stock: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="label">{tr("État du produit", "Product condition")}</label>
                  <select
                    className="input"
                    value={form.condition}
                    onChange={(e) => setForm({ ...form, condition: e.target.value })}
                  >
                    <option value="new">{tr("Neuf", "New")}</option>
                    <option value="used">{tr("Occasion", "Used")}</option>
                    <option value="refurbished">{tr("Reconditionné", "Refurbished")}</option>
                  </select>
                </div>

                <div>
                  <label className="label">{tr("Collection (facultative)", "Collection (optional)")}</label>
                  <select
                    className="input"
                    value={form.collectionId}
                    onChange={(e) => setForm({ ...form, collectionId: e.target.value })}
                  >
                    <option value="">— {tr("Aucune collection", "No collection")} —</option>
                    {collections.map((c) => (
                      <option key={c.id} value={c.id}>
                        📁 {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="label">{tr("Tailles / variantes (séparées par des virgules, facultatif)", "Sizes / variants (comma-separated, optional)")}</label>
                <input
                  className="input"
                  placeholder="S, M, L, XL"
                  value={form.sizes}
                  onChange={(e) => setForm({ ...form, sizes: e.target.value })}
                />
              </div>

              <div>
                <label className="label">{tr("Description (facultative)", "Description (optional)")}</label>
                <textarea
                  className="input min-h-[72px]"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-arctic-800">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="h-4 w-4 rounded border-arctic-400/45 text-brand focus:ring-brand"
                />
                {tr("Afficher dans le catalogue public", "Show in public catalog")}
              </label>

              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setOpen(false)} className="btn-ghost">
                  {tr("Annuler", "Cancel")}
                </button>
                <button className="btn-primary" disabled={saving || uploading}>
                  {saving
                    ? tr("Enregistrement…", "Saving…")
                    : editingId
                      ? tr("Enregistrer les modifications", "Save changes")
                      : tr("Ajouter le produit", "Add product")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
