import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentVendor } from "@/lib/auth";
import { slugify, digitsOnly } from "@/lib/utils";
import { REGIONS, CATEGORIES } from "@/lib/regions";
import { LANG_NAMES, type Lang } from "@/lib/i18n";
import { validateUiPrefsPatch } from "@/lib/uiPrefs";
import {
  parseWhatsAppAssistantConfig,
  sanitizeWhatsAppAssistantPatch,
} from "@/lib/whatsapp-config";

const REGION_SLUGS = new Set(REGIONS.map((r) => r.slug));
const CATEGORY_SLUGS = new Set(CATEGORIES.map((c) => c.slug));
const LANG_KEYS = new Set(Object.keys(LANG_NAMES) as Lang[]);

export async function GET() {
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({
    ok: true,
    vendor: {
      shopName: vendor.shopName,
      shopSlug: vendor.shopSlug,
      whatsappNumber: vendor.whatsappNumber,
      whatsappPhoneNumberId: vendor.whatsappPhoneNumberId || "",
      currency: vendor.currency,
      tagline: vendor.tagline,
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
    data.shopName = b.shopName.trim();
  }
  if (typeof b.tagline === "string") data.tagline = b.tagline.trim();
  if (typeof b.whatsappNumber === "string") {
    data.whatsappNumber = digitsOnly(b.whatsappNumber);
  }
  // Mobile-money payee number for USSD/dial-code payments — digits only; empty
  // string clears it (pay surface then falls back to whatsappNumber).
  if (typeof b.momoNumber === "string") {
    data.momoNumber = digitsOnly(b.momoNumber);
  }
  // Meta Cloud API phone_number_id — digits only; empty string clears it.
  if (typeof b.whatsappPhoneNumberId === "string") {
    const v = b.whatsappPhoneNumberId.trim();
    const cleaned = v ? digitsOnly(v) : null;
    if (cleaned) {
      const takenPhoneId = await prisma.vendor.findFirst({
        where: { whatsappPhoneNumberId: cleaned, NOT: { id: vendor.id } },
      });
      if (takenPhoneId) {
        return NextResponse.json(
          { error: "Ce Phone Number ID WhatsApp est déjà associé à une autre boutique." },
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
      return NextResponse.json({ error: "That catalog link is already taken." }, { status: 409 });
    }
    data.shopSlug = slug;
  }

  // Japora profile fields — region/category/language are slug-validated against
  // the in-app taxonomy; bio is capped to 200 chars; avatarUrl must be empty
  // or a parseable URL; booleans are passed through.
  if (typeof b.region === "string") {
    const r = b.region.trim();
    if (r === "" || REGION_SLUGS.has(r)) {
      data.region = r;
    } else {
      return NextResponse.json({ error: "Unknown region." }, { status: 400 });
    }
  }
  if (typeof b.category === "string") {
    const c = b.category.trim();
    if (c === "" || CATEGORY_SLUGS.has(c)) {
      data.category = c;
    } else {
      return NextResponse.json({ error: "Unknown category." }, { status: 400 });
    }
  }
  if (typeof b.language === "string") {
    const l = b.language.trim();
    if (l === "" || LANG_KEYS.has(l as Lang)) {
      data.language = l || "en";
    } else {
      return NextResponse.json({ error: "Unsupported language." }, { status: 400 });
    }
  }
  if (typeof b.bio === "string") {
    const bio = b.bio.trim();
    if (bio.length > 200) {
      return NextResponse.json({ error: "Bio is too long (200 char max)." }, { status: 400 });
    }
    data.bio = bio;
  }
  if (typeof b.avatarUrl === "string") {
    const url = b.avatarUrl.trim();
    if (url) {
      const isRelativeUpload = url.startsWith("/");
      const isDataImage = /^data:image\/(png|jpe?g|webp|gif);base64,/i.test(url);
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
    data.deliveryZones = b.deliveryZones.trim().slice(0, 500);
  }

  // Away message + business hours (the bot reads these).
  if (typeof b.awayMessage === "string") data.awayMessage = b.awayMessage.slice(0, 300);
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
  return NextResponse.json({
    ok: true,
    vendor: {
      shopName: updated.shopName,
      shopSlug: updated.shopSlug,
      whatsappNumber: updated.whatsappNumber,
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
      whatsappAssistant: parseWhatsAppAssistantConfig(updated.uiPrefs),
    },
  });
}
