import { NextRequest, NextResponse } from "next/server";
import { getCurrentVendor } from "@/lib/auth";
import { sendCustomerUpdate, sendWhatsAppTemplate } from "@/lib/whatsapp";

/**
 * Vendor-triggered customer update (the orders board "Update" action & Bot test button).
 * Routed through sendCustomerUpdate so it goes out FREE inside the customer's 24h
 * service window, falling back to Meta's pre-approved template when the 24h window is closed.
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

  const result = await sendCustomerUpdate({
    vendorId: vendor.id,
    to,
    body,
    orderId: b.orderId ?? null,
    templateName: typeof b.templateName === "string" ? b.templateName : undefined,
    languageCode: typeof b.languageCode === "string" ? b.languageCode : undefined,
  });

  // If free-form text failed (e.g. customer hasn't messaged the Meta Test Number in the last 24h),
  // automatically fall back to Meta's pre-approved sandbox template so the message still arrives!
  if (result.status === "failed" && !b.templateName) {
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

  return NextResponse.json({
    ok: result.status !== "failed",
    status: result.status,
    provider: result.provider,
    inWindow: result.inWindow, // true ⇒ sent free
    billable: result.billable,
    error: result.error,
  });
}
