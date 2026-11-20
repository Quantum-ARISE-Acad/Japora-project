/**
 * Client-side asynchronous telemetry helper for Japora/WCatalog.
 * Uses navigator.sendBeacon with fetch keepalive fallback.
 * Manages sessionStorage session identity and client deduplication guards.
 */

export type FunnelStage = "visit" | "product_view" | "cart" | "ussd_intent" | "confirmed_order";



export interface TelemetryPayload {
  shopSlug: string;
  stage: FunnelStage;
  sessionId: string;
  productId?: string | null;
  orderId?: string | null;
  carrier?: "fedapay" | "cash" | "tmoney" | "flooz" | null;
  valueCents?: number;
}

const SESSION_KEY = "japora_sid";

export function getSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    let sid = window.sessionStorage.getItem(SESSION_KEY);
    if (!sid) {
      sid = typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : "sid_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      window.sessionStorage.setItem(SESSION_KEY, sid);
    }
    return sid;
  } catch {
    return "sid_fallback_" + Date.now();
  }
}

function sendBeaconPayload(payload: TelemetryPayload): boolean {
  if (typeof window === "undefined") return false;

  const jsonStr = JSON.stringify(payload);
  const endpoint = "/api/analytics/beacon";

  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([jsonStr], { type: "application/json" });
      const queued = navigator.sendBeacon(endpoint, blob);
      if (queued) return true;
    }
  } catch {
    // Ignore and fall through to fetch fallback
  }

  try {
    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: jsonStr,
      keepalive: true,
    }).catch(() => {});
    return true;
  } catch {
    return false;
  }
}

// In-memory sets to guard within current runtime lifecycle
const visitedShops = new Set<string>();
const cartShops = new Set<string>();
const viewedProducts = new Set<string>();
const intentOrders = new Set<string>();

/**
 * Stage 1: Track Catalog Visit (at most once per tab session for a shop)
 */
export function trackVisit(shopSlug: string): void {
  if (typeof window === "undefined" || !shopSlug) return;
  const sid = getSessionId();
  const sessionGuardKey = `japora_v_${shopSlug}_${sid}`;

  try {
    if (visitedShops.has(shopSlug) || window.sessionStorage.getItem(sessionGuardKey)) {
      return;
    }
    window.sessionStorage.setItem(sessionGuardKey, "1");
  } catch {}

  visitedShops.add(shopSlug);

  sendBeaconPayload({
    shopSlug,
    stage: "visit",
    sessionId: sid,
  });
}

/**
 * Stage 2: Track Product View (at most once per product per tab session)
 */
export function trackProductView(shopSlug: string, productId: string, valueCents?: number): void {
  if (typeof window === "undefined" || !shopSlug || !productId) return;
  const sid = getSessionId();
  const prodKey = `${shopSlug}_${productId}_${sid}`;

  try {
    if (viewedProducts.has(prodKey) || window.sessionStorage.getItem(`japora_pv_${prodKey}`)) {
      return;
    }
    window.sessionStorage.setItem(`japora_pv_${prodKey}`, "1");
  } catch {}

  viewedProducts.add(prodKey);

  sendBeaconPayload({
    shopSlug,
    stage: "product_view",
    sessionId: sid,
    productId,
    valueCents: valueCents && valueCents > 0 ? valueCents : undefined,
  });
}

/**
 * Stage 3: Track Cart Add (at most once per tab session)
 */
export function trackCart(shopSlug: string, valueCents?: number): void {
  if (typeof window === "undefined" || !shopSlug) return;
  const sid = getSessionId();
  const cartKey = `japora_c_${shopSlug}_${sid}`;

  try {
    if (cartShops.has(shopSlug) || window.sessionStorage.getItem(cartKey)) {
      return;
    }
    window.sessionStorage.setItem(cartKey, "1");
  } catch {}

  cartShops.add(shopSlug);

  sendBeaconPayload({
    shopSlug,
    stage: "cart",
    sessionId: sid,
    valueCents: valueCents && valueCents > 0 ? valueCents : undefined,
  });
}

/**
 * Stage 4: Track USSD/Flooz Payment Intent
 * Triggered only after successful order submission where T-Money or Flooz was chosen.
 * Deduplicated by orderId.
 */
export function trackPaymentIntent(
  shopSlug: string,
  orderId: string,
  carrier: "fedapay" | "cash" | "tmoney" | "flooz",
  valueCents?: number
): void {
  if (typeof window === "undefined" || !shopSlug || !orderId) return;
  const sid = getSessionId();
  const intentKey = `japora_pi_${orderId}`;

  try {
    if (intentOrders.has(orderId) || window.sessionStorage.getItem(intentKey)) {
      return;
    }
    window.sessionStorage.setItem(intentKey, "1");
  } catch {}

  intentOrders.add(orderId);

  sendBeaconPayload({
    shopSlug,
    stage: "ussd_intent",
    sessionId: sid,
    orderId,
    carrier,
    valueCents: valueCents && valueCents > 0 ? valueCents : undefined,
  });
}
