import { NextRequest, NextResponse } from "next/server";
import { checkWhatsAppNumber } from "@/lib/whatsapp-number";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentVendor } from "@/lib/auth";
import { slugify, digitsOnly } from "@/lib/utils";
import { LANG_NAMES, type Lang } from "@/lib/i18n";
import { validateUiPrefsPatch } from "@/lib/uiPrefs";
import {
  parseWhatsAppAssistantConfig,
  sanitizeWhatsAppAssistantPatch,
} from "@/lib/whatsapp-config";
import { recordVendorActivity } from "@/lib/clerk-vendor-sync";

const LANG_KEYS = new Set(Object.keys(LANG_NAMES) as Lang[]);

export async function GET() {
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const prefs =
    vendor.uiPrefs && typeof vendor.uiPrefs === "object" && !Array.isArray(vendor.uiPrefs)
      ? (vendor.uiPrefs as Record<string, unknown>)
      : {};

  return NextResponse.json({
    ok: true,
    vendor: {
      shopName: vendor.shopName,
      shopSlug: vendor.shopSlug,
      whatsappNumber: vendor.whatsappNumber,
      momoNumber: vendor.momoNumber,
      whatsappPhoneNumberId: vendor.whatsappPhoneNumberId || "",
      currency: vendor.currency,
      tagline: vendor.tagline,
      region: vendor.region,
      category: vendor.category,
      language: vendor.language,
      bio: vendor.bio,
      avatarUrl: vendor.avatarUrl,
      isPublic: vendor.isPublic,
      wholesaleEnabled: vendor.wholesaleEnabled,
      deliveryEnabled: vendor.deliveryEnabled,
      deliveryFeeCents: vendor.deliveryFeeCents,
      deliveryZones: vendor.deliveryZones,
      onboardedAt: vendor.onboardedAt,
      shopTheme: typeof prefs.shopTheme === "string" ? prefs.shopTheme : "arctic",
      fedapayConfig: prefs.fedapayConfig ?? null,
      whatsappAssistant: parseWhatsAppAssistantConfig(vendor.uiPrefs),
    },
  });
}

export async function PATCH(req: NextRequest) {
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};

  if (typeof b.shopName === "string" && b.shopName.trim()) {
    data.shopName = b.shopName.trim().slice(0, 120);
  }
  if (typeof b.tagline === "string") {
    data.tagline = b.tagline.trim().slice(0, 450);
  }
  if (typeof b.whatsappNumber === "string") {
    // The country code is required: without it the shop's WhatsApp links and QR code
    // open the wrong number (see src/lib/whatsapp-number.ts).
    const wa = checkWhatsAppNumber(b.whatsappNumber);
    if (!wa.ok) {
      return NextResponse.json({ error: wa.error, field: "whatsappNumber" }, { status: 400 });
    }
    data.whatsappNumber = wa.digits;
  }
  // Mobile-money payee number for USSD/dial-code payments — digits only; empty
  // string clears it (pay surface then falls back to whatsappNumber).
  if (typeof b.momoNumber === "string") {
    data.momoNumber = digitsOnly(b.momoNumber);
  }
  // Meta Cloud API phone_number_id — digits only; empty string clears it.
  const forceClaimPhoneNumberId = Boolean(b.forceClaimPhoneNumberId);
  if (typeof b.whatsappPhoneNumberId === "string") {
    const v = b.whatsappPhoneNumberId.trim();
    const cleaned = v ? digitsOnly(v) : null;
    if (cleaned) {
      const takenPhoneId = await prisma.vendor.findFirst({
        where: { whatsappPhoneNumberId: cleaned, NOT: { id: vendor.id } },
        select: { id: true, shopName: true, shopSlug: true, email: true },
      });
      if (takenPhoneId && !forceClaimPhoneNumberId) {
        return NextResponse.json(
          {
            error: `Ce Phone Number ID WhatsApp (${cleaned}) est déjà utilisé par la boutique « ${takenPhoneId.shopName} » (/c/${takenPhoneId.shopSlug}). Voulez-vous le transférer et l'associer à votre boutique actuelle ?`,
            conflictCode: "WHATSAPP_PHONE_ID_TAKEN",
            existingShopName: takenPhoneId.shopName,
            existingShopSlug: takenPhoneId.shopSlug,
            phoneNumberId: cleaned,
          },
          { status: 409 },
        );
      }
    }
    data.whatsappPhoneNumberId = cleaned;
  }
  if (typeof b.currency === "string" && b.currency.trim()) {
    data.currency = b.currency.trim().toUpperCase().slice(0, 3);
  }
  if (typeof b.shopSlug === "string" && b.shopSlug.trim()) {
    const slug = slugify(b.shopSlug);
    const taken = await prisma.vendor.findFirst({
      where: { shopSlug: slug, NOT: { id: vendor.id } },
    });
    if (taken) {
      return NextResponse.json({ error: "Ce lien de boutique (/c/" + slug + ") est déjà utilisé." }, { status: 409 });
    }
    data.shopSlug = slug;
  }

  if (typeof b.region === "string") {
    data.region = b.region.trim().slice(0, 100);
  }
  if (typeof b.category === "string") {
    data.category = b.category.trim().slice(0, 100);
  }
  if (typeof b.language === "string") {
    const l = b.language.trim();
    if (l === "" || LANG_KEYS.has(l as Lang)) {
      data.language = l || "fr";
    } else {
      data.language = "fr";
    }
  }
  if (typeof b.bio === "string") {
    const bio = b.bio.trim();
    if (bio.length > 1000) {
      return NextResponse.json({ error: "La biographie est trop longue (1000 caractères max)." }, { status: 400 });
    }
    data.bio = bio;
  }
  if (typeof b.avatarUrl === "string") {
    const url = b.avatarUrl.trim();
    if (url) {
      const isRelativeUpload = url.startsWith("/");
      const isDataImage = /^data:image\//i.test(url);
      if (!isRelativeUpload && !isDataImage) {
        try {
          const parsed = new URL(url);
          if (!/^https?:$/.test(parsed.protocol)) throw new Error("bad_scheme");
        } catch {
          return NextResponse.json(
            { error: "Le logo doit être une image téléversée (/uploads/...) ou une URL http(s)." },
            { status: 400 },
          );
        }
      }
    }
    data.avatarUrl = url;
  }
  if (typeof b.isPublic === "boolean") data.isPublic = b.isPublic;
  if (typeof b.wholesaleEnabled === "boolean") data.wholesaleEnabled = b.wholesaleEnabled;
  if (typeof b.deliveryEnabled === "boolean") data.deliveryEnabled = b.deliveryEnabled;
  if (typeof b.deliveryFeeCents === "number" && Number.isFinite(b.deliveryFeeCents)) {
    data.deliveryFeeCents = Math.max(0, Math.round(b.deliveryFeeCents));
  }
  if (typeof b.deliveryZones === "string") {
    data.deliveryZones = b.deliveryZones.trim().slice(0, 900);
  }

  // Mark vendor as onboarded when completing onboarding or saving main profile settings
  if (b.completeOnboarding === true || (typeof b.shopName === "string" && !vendor.onboardedAt)) {
    data.onboardedAt = new Date();
  }
  if (b.resetOnboarding === true) {
    data.onboardedAt = null;
  }

  // Away message + business hours (the bot reads these).
  if (typeof b.awayMessage === "string") data.awayMessage = b.awayMessage.slice(0, 500);
  if (b.businessHours && typeof b.businessHours === "object" && !Array.isArray(b.businessHours)) {
    const h = b.businessHours as Record<string, unknown>;
    data.businessHours = {
      enabled: Boolean(h.enabled),
      days: Array.isArray(h.days)
        ? h.days.map(Number).filter((n: number) => n >= 0 && n <= 6)
        : [],
      open: typeof h.open === "string" ? h.open : "08:00",
      close: typeof h.close === "string" ? h.close : "20:00",
    };
  }
  if (typeof b.tzOffsetMinutes === "number" && Number.isFinite(b.tzOffsetMinutes)) {
    data.tzOffsetMinutes = Math.max(-720, Math.min(840, Math.round(b.tzOffsetMinutes)));
  }

  const currentUiPrefs =
    vendor.uiPrefs && typeof vendor.uiPrefs === "object" && !Array.isArray(vendor.uiPrefs)
      ? { ...(vendor.uiPrefs as Record<string, unknown>) }
      : {};
  let uiPrefsChanged = false;

  // Aurora customization — merge over existing prefs so callers can patch
  // a single slider without re-sending the whole shape.
  if (b.uiPrefs !== undefined) {
    const patch = validateUiPrefsPatch(b.uiPrefs);
    if (!patch) {
      return NextResponse.json({ error: "Invalid uiPrefs payload." }, { status: 400 });
    }
    Object.assign(currentUiPrefs, patch);
    uiPrefsChanged = true;
  }

  if (typeof b.shopTheme === "string" && b.shopTheme.trim()) {
    currentUiPrefs.shopTheme = b.shopTheme.trim();
    uiPrefsChanged = true;
  }

  if (b.fedapayConfig && typeof b.fedapayConfig === "object" && !Array.isArray(b.fedapayConfig)) {
    const fc = b.fedapayConfig as Record<string, unknown>;
    const existingFc =
      currentUiPrefs.fedapayConfig && typeof currentUiPrefs.fedapayConfig === "object"
        ? (currentUiPrefs.fedapayConfig as Record<string, unknown>)
        : {};
    const env: "sandbox" | "live" = fc.environment === "live" ? "live" : "sandbox";

    const cleanKey = (val: unknown, fallback: unknown) => {
      if (typeof val === "string") {
        const trimmed = val.trim();
        if (trimmed.includes("••••")) return typeof fallback === "string" ? fallback : "";
        return trimmed;
      }
      return typeof fallback === "string" ? fallback : "";
    };

    const sandboxPublicKey = cleanKey(
      fc.sandboxPublicKey !== undefined ? fc.sandboxPublicKey : env === "sandbox" ? fc.publicKey : undefined,
      existingFc.sandboxPublicKey ?? (typeof existingFc.publicKey === "string" && existingFc.publicKey.startsWith("pk_sandbox_") ? existingFc.publicKey : ""),
    );
    const sandboxSecretKey = cleanKey(
      fc.sandboxSecretKey !== undefined ? fc.sandboxSecretKey : env === "sandbox" ? fc.secretKey : undefined,
      existingFc.sandboxSecretKey ?? (typeof existingFc.secretKey === "string" && existingFc.secretKey.startsWith("sk_sandbox_") ? existingFc.secretKey : ""),
    );
    const livePublicKey = cleanKey(
      fc.livePublicKey !== undefined ? fc.livePublicKey : env === "live" ? fc.publicKey : undefined,
      existingFc.livePublicKey ?? (typeof existingFc.publicKey === "string" && existingFc.publicKey.startsWith("pk_live_") ? existingFc.publicKey : ""),
    );
    const liveSecretKey = cleanKey(
      fc.liveSecretKey !== undefined ? fc.liveSecretKey : env === "live" ? fc.secretKey : undefined,
      existingFc.liveSecretKey ?? (typeof existingFc.secretKey === "string" && existingFc.secretKey.startsWith("sk_live_") ? existingFc.secretKey : ""),
    );

    currentUiPrefs.fedapayConfig = {
      environment: env,
      publicKey: env === "live" ? livePublicKey : sandboxPublicKey,
      secretKey: env === "live" ? liveSecretKey : sandboxSecretKey,
      sandboxPublicKey,
      sandboxSecretKey,
      livePublicKey,
      liveSecretKey,
      webhookSecret: cleanKey(fc.webhookSecret, existingFc.webhookSecret ?? ""),
      enabled: typeof fc.enabled === "boolean" ? fc.enabled : true,
    };
    uiPrefsChanged = true;
  }

  // WhatsApp & Gemini AI assistant settings — merged into uiPrefs.whatsappAssistant
  if (b.whatsappAssistant !== undefined) {
    const waPatch = sanitizeWhatsAppAssistantPatch(b.whatsappAssistant, currentUiPrefs);
    currentUiPrefs.whatsappAssistant = waPatch;
    uiPrefsChanged = true;
  }

  if (uiPrefsChanged) {
    data.uiPrefs = currentUiPrefs;
  }

  if (typeof data.whatsappPhoneNumberId === "string" && data.whatsappPhoneNumberId) {
    await prisma.vendor.updateMany({
      where: {
        whatsappPhoneNumberId: data.whatsappPhoneNumberId,
        id: { not: vendor.id },
      },
      data: { whatsappPhoneNumberId: null },
    });
  }

  const updated = await prisma.vendor.update({ where: { id: vendor.id }, data });

  await recordVendorActivity({
    vendorId: updated.id,
    type:
      b.completeOnboarding === true
        ? "shop.onboarding.completed"
        : "shop.settings.updated",
    subjectType: "vendor",
    subjectId: updated.id,
    data: {
      shopName: updated.shopName,
      shopSlug: updated.shopSlug,
      currency: updated.currency,
      language: updated.language,
      region: updated.region,
      category: updated.category,
      whatsappNumber: updated.whatsappNumber,
      momoNumber: updated.momoNumber,
      onboardedAt: updated.onboardedAt?.toISOString() ?? null,
    },
  });

  try {
    revalidatePath("/dashboard", "layout");
    revalidatePath("/dashboard/settings");
    revalidatePath(`/c/${updated.shopSlug}`);
    if (vendor.shopSlug !== updated.shopSlug) {
      revalidatePath(`/c/${vendor.shopSlug}`);
    }
  } catch {
    // ignore revalidation errors in non-request contexts
  }

  return NextResponse.json({
    ok: true,
    vendor: {
      shopName: updated.shopName,
      shopSlug: updated.shopSlug,
      whatsappNumber: updated.whatsappNumber,
      momoNumber: updated.momoNumber,
      whatsappPhoneNumberId: updated.whatsappPhoneNumberId || "",
      currency: updated.currency,
      tagline: updated.tagline,
      region: updated.region,
      category: updated.category,
      language: updated.language,
      bio: updated.bio,
      avatarUrl: updated.avatarUrl,
      isPublic: updated.isPublic,
      wholesaleEnabled: updated.wholesaleEnabled,
      deliveryEnabled: updated.deliveryEnabled,
      deliveryFeeCents: updated.deliveryFeeCents,
      deliveryZones: updated.deliveryZones,
      onboardedAt: updated.onboardedAt,
      whatsappAssistant: parseWhatsAppAssistantConfig(updated.uiPrefs),
    },
  });
}
