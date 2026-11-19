import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { linkCartSessionToCustomer } from "@/lib/customers";
import { normalizePhone, isValidPhone } from "@/lib/otp";
import { rateLimit, getClientIp, tooManyRequests } from "@/lib/ratelimit";

const ALLOWED_CLIENT_STAGES = new Set(["visit", "product_view", "cart", "ussd_intent"]);

// cs

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = rateLimit({ key: `beacon:${ip}`, limit: 120, windowMs: 60_000 });
  if (!rl.allowed) {
    return tooManyRequests(rl);
  }

  let body: unknown;
  try {
    // navigator.sendBeacon can send as text or application/json blob
    const raw = await req.text();
    if (!raw) {
      return NextResponse.json({ error: "Empty payload" }, { status: 400 });
    }
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Malformed JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const {
    shopSlug,
    stage,
    sessionId,
    productId,
    orderId,
    carrier,
    valueCents,
    customerId,
    customerPhone,
  } = body as Record<string, unknown>;

  // 1. Validate stage: strictly client-allowed stages (no confirmed_order from browser)
  if (typeof stage !== "string" || !ALLOWED_CLIENT_STAGES.has(stage)) {
    return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
  }

  // 2. Validate shopSlug
  if (typeof shopSlug !== "string" || !shopSlug.trim()) {
    return NextResponse.json({ error: "Missing shopSlug" }, { status: 400 });
  }
  const cleanSlug = shopSlug.trim().toLowerCase();

  // 3. Validate sessionId
  if (typeof sessionId !== "string" || !sessionId.trim() || sessionId.length > 128) {
    return NextResponse.json({ error: "Invalid sessionId" }, { status: 400 });
  }
  const cleanSessionId = sessionId.trim();

  // 4. Derive vendorId server-side from shopSlug to prevent client spoofing
  const vendor = await prisma.vendor.findUnique({
    where: { shopSlug: cleanSlug },
    select: { id: true },
  });
  if (!vendor) {
    return NextResponse.json({ error: "Shop not found" }, { status: 404 });
  }

  // 5. Sanitize optional fields
  const cleanProductId = typeof productId === "string" && productId.trim() ? productId.trim().slice(0, 128) : null;
  const cleanOrderId = typeof orderId === "string" && orderId.trim() ? orderId.trim().slice(0, 128) : null;
  const cleanCarrier =
    carrier === "fedapay" || carrier === "cash" || carrier === "tmoney" || carrier === "flooz"
      ? carrier
      : null;
  const cleanCustomerId = typeof customerId === "string" && customerId.trim() ? customerId.trim().slice(0, 128) : null;
  const cleanCustomerPhone = typeof customerPhone === "string" && customerPhone.trim()
    ? normalizePhone(customerPhone)
    : null;
  const numValueCents = typeof valueCents === "number" && Number.isFinite(valueCents) && valueCents > 0
    ? Math.round(valueCents)
    : 0;

  if (cleanCustomerPhone && !isValidPhone(cleanCustomerPhone)) {
    return NextResponse.json({ error: "Invalid customerPhone" }, { status: 400 });
  }

  // 6. Server-side deduplication check before insert
  if (stage === "visit") {
    const exists = await prisma.funnelEvent.findFirst({
      where: { vendorId: vendor.id, stage: "visit", sessionId: cleanSessionId },
      select: { id: true },
    });
    if (exists) return new Response(null, { status: 204 });
  } else if (stage === "cart") {
    const exists = await prisma.funnelEvent.findFirst({
      where: { vendorId: vendor.id, stage: "cart", sessionId: cleanSessionId },
      select: { id: true },
    });
    if (exists) return new Response(null, { status: 204 });
  } else if (stage === "product_view" && cleanProductId) {
    const exists = await prisma.funnelEvent.findFirst({
      where: { vendorId: vendor.id, stage: "product_view", sessionId: cleanSessionId, productId: cleanProductId },
      select: { id: true },
    });
    if (exists) return new Response(null, { status: 204 });
  } else if (stage === "ussd_intent" && cleanOrderId) {
    const exists = await prisma.funnelEvent.findFirst({
      where: { vendorId: vendor.id, stage: "ussd_intent", orderId: cleanOrderId },
      select: { id: true },
    });
    if (exists) return new Response(null, { status: 204 });
  }

  // 7. Persist event
  const event = await prisma.funnelEvent.create({
    data: {
      vendorId: vendor.id,
      shopSlug: cleanSlug,
      stage,
      sessionId: cleanSessionId,
      productId: cleanProductId,
      orderId: cleanOrderId,
      carrier: cleanCarrier,
      valueCents: numValueCents,
      customerPhone: cleanCustomerPhone,
      customerId: cleanCustomerId,
    },
  });

  if (stage === "cart" || cleanCustomerId || cleanCustomerPhone) {
    await linkCartSessionToCustomer(prisma, vendor.id, cleanSessionId, {
      customerId: cleanCustomerId,
      customerPhone: cleanCustomerPhone,
    }).catch(() => {});

    if (event.customerId == null && cleanCustomerPhone) {
      const linked = await prisma.customer.findUnique({
        where: { vendorId_phone: { vendorId: vendor.id, phone: cleanCustomerPhone } },
        select: { id: true },
      });
      if (linked?.id) {
        await prisma.funnelEvent.update({
          where: { id: event.id },
          data: { customerId: linked.id },
        });
      }
    }
  }

  return new Response(null, { status: 204 });
}
