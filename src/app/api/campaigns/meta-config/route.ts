import { NextResponse } from "next/server";
import { getCurrentVendor } from "@/lib/auth";
import {
  getVendorMetaConfig,
  saveVendorMetaConfig,
  verifyMetaAccessToken,
  type MetaEnvironment,
} from "@/lib/meta-marketing";

export const dynamic = "force-dynamic";

export async function GET() {
  const vendor = await getCurrentVendor();
  if (!vendor) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const config = await getVendorMetaConfig(vendor.id);
  return NextResponse.json({
    config: {
      ...config,
      hasAccessToken: Boolean(config.accessToken),
      maskedToken: config.accessToken
        ? `${config.accessToken.slice(0, 8)}••••••••${config.accessToken.slice(-4)}`
        : "",
    },
  });
}

export async function POST(req: Request) {
  const vendor = await getCurrentVendor();
  if (!vendor) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const environment: MetaEnvironment =
    body.environment === "live" ? "live" : "sandbox";

  const adAccountId =
    typeof body.adAccountId === "string" ? body.adAccountId : undefined;
  const pageId = typeof body.pageId === "string" ? body.pageId : undefined;
  const instagramActorId =
    typeof body.instagramActorId === "string" ? body.instagramActorId : undefined;
  const whatsappPhoneNumberId =
    typeof body.whatsappPhoneNumberId === "string"
      ? body.whatsappPhoneNumberId
      : undefined;
  const appId = typeof body.appId === "string" ? body.appId : undefined;
  const accessToken =
    typeof body.accessToken === "string" ? body.accessToken : undefined;
  const tokenType =
    body.tokenType === "USER_TOKEN" ||
    body.tokenType === "LONG_LIVED_TOKEN" ||
    body.tokenType === "SYSTEM_USER_TOKEN"
      ? body.tokenType
      : undefined;

  const updated = await saveVendorMetaConfig(vendor.id, {
    environment,
    adAccountId,
    pageId,
    instagramActorId,
    whatsappPhoneNumberId,
    appId,
    ...(accessToken !== undefined ? { accessToken } : {}),
    ...(tokenType ? { tokenType } : {}),
  });

  const verification = await verifyMetaAccessToken(
    updated.accessToken,
    updated.adAccountId,
  );

  return NextResponse.json({
    config: {
      ...updated,
      hasAccessToken: Boolean(updated.accessToken),
      maskedToken: updated.accessToken
        ? `${updated.accessToken.slice(0, 8)}••••••••${updated.accessToken.slice(-4)}`
        : "",
    },
    verification,
  });
}

