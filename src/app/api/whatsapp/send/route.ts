import { NextRequest, NextResponse } from "next/server";
import { getCurrentVendor } from "@/lib/auth";
import { sendCustomerUpdate, sendWhatsAppTemplate } from "@/lib/whatsapp";

/**
 * Vendor-triggered customer update (the orders board "Update" action & Bot test button).
 * Supports optional unsaved credentials (`whatsappAccessToken`, `whatsappPhoneNumberId`)
 * so the merchant can test their Cloud API configuration directly on the Bot page
 * before or while saving.
 */
export async function POST(req: NextRequest) {
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const to = String(b.to || "").trim();
  const body = String(b.body || "").trim();
  if (!to || !body) {
    return NextResponse.json({ error: "Recipient and message are required." }, { status: 400 });
  }

  const overrideToken =
    typeof b.whatsappAccessToken === "string" && b.whatsappAccessToken.trim()
      ? b.whatsappAccessToken.trim()
      : undefined;
  const overridePhoneNumberId =
    typeof b.whatsappPhoneNumberId === "string" && b.whatsappPhoneNumberId.trim()
      ? b.whatsappPhoneNumberId.trim()
      : undefined;

  const result = await sendCustomerUpdate({
    vendorId: vendor.id,
    to,
    body,
    orderId: b.orderId ?? null,
    templateName: typeof b.templateName === "string" ? b.templateName : undefined,
    languageCode: typeof b.languageCode === "string" ? b.languageCode : undefined,
    overrideToken,
    overridePhoneNumberId,
  });

  // If free-form text failed because the 24h customer window is closed (and NOT
  // because of a 401 Invalid OAuth Token), fall back to Meta's pre-approved sandbox template.
  const isAuthError = Boolean(
    result.error && (result.error.includes("401") || result.error.includes('"code":190')),
  );
  if (result.status === "failed" && !b.templateName && !isAuthError) {
    const todayStr = new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const tplResult = await sendWhatsAppTemplate({
      vendorId: vendor.id,
      to,
      templateName: "jaspers_market_order_confirmation_v1",
      languageCode: "en_US",
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: vendor.shopName || "Japora Shop" },
            { type: "text", text: b.orderId ? String(b.orderId).slice(-6).toUpperCase() : "JAPORA-AI" },
            { type: "text", text: todayStr },
          ],
        },
      ],
      orderId: b.orderId ?? null,
      overrideToken,
      overridePhoneNumberId,
    });
    if (tplResult.status !== "failed") {
      return NextResponse.json({
        ok: true,
        status: tplResult.status,
        provider: tplResult.provider,
        inWindow: false,
        billable: true,
      });
    }
  }

  let friendlyError = result.error;
  if (isAuthError) {
    friendlyError =
      "Token Meta Cloud API expiré ou invalide (Code 190 / 401). Générez un nouveau Access Token dans Meta for Developers → WhatsApp → API Setup, collez-le dans le champ « Meta Cloud API Access Token » ci-dessus, puis enregistrez.";
  }

  return NextResponse.json({
    ok: result.status !== "failed",
    status: result.status,
    provider: result.provider,
    inWindow: result.inWindow, // true ⇒ sent free
    billable: result.billable,
    error: friendlyError,
  });
}
