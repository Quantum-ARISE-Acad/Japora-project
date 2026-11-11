/**
 * Japora share-ready asset renderer.
 *
 * Renders SVG markup for vendors to download and post on WhatsApp Status,
 * Instagram, and TikTok. Pure string templating — no native deps, runs at the
 * edge, and the SVG can be rasterised client-side later if needed.
 *
 * Brand: #16a34a (Japora green). All user-supplied text is xml-escaped to keep
 * the SVG valid and prevent injection (a hostile product name could otherwise
 * break the document or smuggle script).
 */

export type AssetOpts = {
  productName: string;
  priceLabel: string;
  shopName: string;
  shopUrl?: string;
  imageUrl?: string;
  tagline?: string;
};

const BRAND = "#16a34a";
const BRAND_DARK = "#15803d";
const INK = "#0f172a";
const PAPER = "#ffffff";
const MUTED = "#475569";

/** Escape a string for safe interpolation inside SVG text / attributes. */
function xmlEscape(value: string): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Truncate a string with an ellipsis so big names don't overflow the card. */
function truncate(value: string, max: number): string {
  const s = String(value ?? "");
  if (s.length <= max) return s;
  return s.slice(0, Math.max(0, max - 1)).trimEnd() + "…";
}

/**
 * Image block — uses xlink:href so older Instagram / WhatsApp viewers still
 * render the bitmap. preserveAspectRatio="xMidYMid slice" mimics CSS
 * `background-size: cover`.
 */
function imageBlock(opts: {
  href: string;
  x: number;
  y: number;
  w: number;
  h: number;
}): string {
  const { href, x, y, w, h } = opts;
  const safeHref = xmlEscape(href);
  return `<image x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice" href="${safeHref}" xlink:href="${safeHref}" />`;
}

function placeholderBlock(opts: {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
}): string {
  const { x, y, w, h, label } = opts;
  return `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#e2e8f0" />
    <text x="${x + w / 2}" y="${y + h / 2}" text-anchor="middle" dominant-baseline="middle"
      font-family="Inter, Helvetica, Arial, sans-serif" font-size="48" fill="${MUTED}">${xmlEscape(label)}</text>
  `;
}

/**
 * WhatsApp Status — 1080x1920. Image fills most of the canvas, a giant green
 * price chip sits in the lower third with the product name + shop watermark.
 */
export function renderStatusCard(opts: AssetOpts): string {
  const name = truncate(opts.productName, 40);
  const price = truncate(opts.priceLabel, 18);
  const shop = truncate(opts.shopName, 28);
  const tagline = truncate(opts.tagline || "Sell on WhatsApp", 36);
  const image = opts.imageUrl
    ? imageBlock({ href: opts.imageUrl, x: 0, y: 0, w: 1080, h: 1200 })
    : placeholderBlock({ x: 0, y: 0, w: 1080, h: 1200, label: "Japora" });

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
  width="1080" height="1920" viewBox="0 0 1080 1920">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${PAPER}" />
      <stop offset="1" stop-color="#f1f5f9" />
    </linearGradient>
    <linearGradient id="brand" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${BRAND}" />
      <stop offset="1" stop-color="${BRAND_DARK}" />
    </linearGradient>
  </defs>

  <rect x="0" y="0" width="1080" height="1920" fill="url(#bg)" />
  ${image}

  <!-- price card -->
  <rect x="60" y="1280" width="960" height="420" rx="48" fill="url(#brand)" />
  <text x="540" y="1430" text-anchor="middle"
    font-family="Inter, Helvetica, Arial, sans-serif" font-size="64" font-weight="600" fill="#dcfce7">${xmlEscape(name)}</text>
  <text x="540" y="1570" text-anchor="middle"
    font-family="Inter, Helvetica, Arial, sans-serif" font-size="96" font-weight="800" fill="${PAPER}" letter-spacing="-2">${xmlEscape(price)}</text>
  <text x="540" y="1660" text-anchor="middle"
    font-family="Inter, Helvetica, Arial, sans-serif" font-size="40" fill="#bbf7d0">${xmlEscape(tagline)}</text>

  <!-- shop watermark -->
  <text x="540" y="1820" text-anchor="middle"
    font-family="Inter, Helvetica, Arial, sans-serif" font-size="48" font-weight="700" fill="${INK}">${xmlEscape(shop)}</text>
  <text x="540" y="1872" text-anchor="middle"
    font-family="Inter, Helvetica, Arial, sans-serif" font-size="28" fill="${MUTED}">japora · ${xmlEscape(opts.shopUrl ? truncate(opts.shopUrl, 40) : "wa.me")}</text>
</svg>`;
}

/**
 * Instagram square — 1080x1080. Image on top half, price + shop band on bottom.
 */
export function renderInstagramSquare(opts: AssetOpts): string {
  const name = truncate(opts.productName, 34);
  const price = truncate(opts.priceLabel, 16);
  const shop = truncate(opts.shopName, 26);
  const tagline = truncate(opts.tagline || "Tap link in bio", 32);
  const image = opts.imageUrl
    ? imageBlock({ href: opts.imageUrl, x: 0, y: 0, w: 1080, h: 640 })
    : placeholderBlock({ x: 0, y: 0, w: 1080, h: 640, label: "Japora" });

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
  width="1080" height="1080" viewBox="0 0 1080 1080">
  <defs>
    <linearGradient id="brand" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${BRAND}" />
      <stop offset="1" stop-color="${BRAND_DARK}" />
    </linearGradient>
  </defs>

  <rect x="0" y="0" width="1080" height="1080" fill="${PAPER}" />
  ${image}

  <rect x="0" y="640" width="1080" height="440" fill="url(#brand)" />
  <text x="540" y="750" text-anchor="middle"
    font-family="Inter, Helvetica, Arial, sans-serif" font-size="56" font-weight="600" fill="#dcfce7">${xmlEscape(name)}</text>
  <text x="540" y="890" text-anchor="middle"
    font-family="Inter, Helvetica, Arial, sans-serif" font-size="88" font-weight="800" fill="${PAPER}" letter-spacing="-2">${xmlEscape(price)}</text>
  <text x="540" y="980" text-anchor="middle"
    font-family="Inter, Helvetica, Arial, sans-serif" font-size="36" fill="#bbf7d0">${xmlEscape(tagline)}</text>
  <text x="540" y="1040" text-anchor="middle"
    font-family="Inter, Helvetica, Arial, sans-serif" font-size="32" font-weight="700" fill="${PAPER}">${xmlEscape(shop)} · Japora</text>
</svg>`;
}

/**
 * TikTok vertical — 1080x1920. Bigger price, more bold typography, image
 * floats above with a clean shadow.
 */
export function renderTikTokVertical(opts: AssetOpts): string {
  const name = truncate(opts.productName, 36);
  const price = truncate(opts.priceLabel, 14);
  const shop = truncate(opts.shopName, 28);
  const tagline = truncate(opts.tagline || "Drop in DMs to order", 36);
  const image = opts.imageUrl
    ? imageBlock({ href: opts.imageUrl, x: 80, y: 200, w: 920, h: 920 })
    : placeholderBlock({ x: 80, y: 200, w: 920, h: 920, label: "Japora" });

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
  width="1080" height="1920" viewBox="0 0 1080 1920">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${INK}" />
      <stop offset="1" stop-color="#020617" />
    </linearGradient>
    <linearGradient id="brand" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${BRAND}" />
      <stop offset="1" stop-color="${BRAND_DARK}" />
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="20" stdDeviation="24" flood-color="#000" flood-opacity="0.45" />
    </filter>
  </defs>

  <rect x="0" y="0" width="1080" height="1920" fill="url(#bg)" />

  <text x="540" y="140" text-anchor="middle"
    font-family="Inter, Helvetica, Arial, sans-serif" font-size="48" font-weight="800" fill="${BRAND}" letter-spacing="6">JAPORA</text>

  <g filter="url(#shadow)">${image}</g>

  <text x="540" y="1260" text-anchor="middle"
    font-family="Inter, Helvetica, Arial, sans-serif" font-size="64" font-weight="700" fill="${PAPER}">${xmlEscape(name)}</text>

  <rect x="60" y="1340" width="960" height="380" rx="56" fill="url(#brand)" />
  <text x="540" y="1530" text-anchor="middle"
    font-family="Inter, Helvetica, Arial, sans-serif" font-size="110" font-weight="800" fill="${PAPER}" letter-spacing="-3">${xmlEscape(price)}</text>
  <text x="540" y="1640" text-anchor="middle"
    font-family="Inter, Helvetica, Arial, sans-serif" font-size="44" font-weight="600" fill="#dcfce7">${xmlEscape(tagline)}</text>

  <text x="540" y="1820" text-anchor="middle"
    font-family="Inter, Helvetica, Arial, sans-serif" font-size="44" font-weight="700" fill="${PAPER}">@${xmlEscape(shop)}</text>
  <text x="540" y="1872" text-anchor="middle"
    font-family="Inter, Helvetica, Arial, sans-serif" font-size="28" fill="#94a3b8">${xmlEscape(opts.shopUrl ? truncate(opts.shopUrl, 40) : "japora.market")}</text>
</svg>`;
}

export const ASSET_FORMATS = ["status", "ig", "tiktok"] as const;
export type AssetFormat = (typeof ASSET_FORMATS)[number];

export function isAssetFormat(value: string): value is AssetFormat {
  return (ASSET_FORMATS as readonly string[]).includes(value);
}
