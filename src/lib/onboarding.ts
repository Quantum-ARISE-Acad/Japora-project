import { REGIONS, CATEGORIES, findRegion, findCategory } from "./regions";
import { digitsOnly } from "./utils";

export type StoreSetupField = "shopName" | "whatsappNumber" | "region" | "category";

export type StoreSetupCandidate = {
  shopName?: string | null;
  whatsappNumber?: string | null;
  region?: string | null;
  category?: string | null;
};

export type StoreSetupStatus = {
  complete: boolean;
  missingFields: StoreSetupField[];
};

const PLACEHOLDER_SHOP_NAMES = new Set(["my shop"]);
const PLACEHOLDER_WHATSAPP_DIGITS = new Set(["15556449932"]);

/**
 * Returns true if the shop name is missing, whitespace-only, or a provisioning
 * placeholder such as "My Shop".
 */
export function isPlaceholderShopName(shopName: string | null | undefined): boolean {
  const trimmed = (shopName ?? "").trim().toLowerCase();
  if (!trimmed) return true;
  return PLACEHOLDER_SHOP_NAMES.has(trimmed);
}

/**
 * Normalizes a user-supplied or stored WhatsApp phone number into E.164
 * (`+<digits>`) and digits-only form, validating ITU-T E.164 length (8..15 digits).
 */
export function normalizeWhatsAppNumber(input: string | null | undefined): {
  e164: string;
  digits: string;
  valid: boolean;
} {
  const raw = (input ?? "").trim();
  const digits = digitsOnly(raw);
  if (PLACEHOLDER_WHATSAPP_DIGITS.has(digits)) {
    return {
      e164: "",
      digits: "",
      valid: false,
    };
  }
  const valid = digits.length >= 8 && digits.length <= 15;
  return {
    e164: digits ? `+${digits}` : "",
    digits,
    valid,
  };
}

/**
 * Inspects a Vendor (or partial vendor shape) and reports whether mandatory
 * Store Setup is complete and which fields are still missing.
 */
export function getStoreSetupStatus(
  vendor: StoreSetupCandidate | null | undefined,
): StoreSetupStatus {
  if (!vendor) {
    return {
      complete: false,
      missingFields: ["shopName", "whatsappNumber", "region", "category"],
    };
  }

  const missingFields: StoreSetupField[] = [];

  if (isPlaceholderShopName(vendor.shopName)) {
    missingFields.push("shopName");
  }

  const wa = normalizeWhatsAppNumber(vendor.whatsappNumber);
  if (!wa.valid) {
    missingFields.push("whatsappNumber");
  }

  const regionSlug = (vendor.region ?? "").trim();
  if (!regionSlug || !findRegion(regionSlug)) {
    missingFields.push("region");
  }

  const categorySlug = (vendor.category ?? "").trim();
  if (!categorySlug || !findCategory(categorySlug)) {
    missingFields.push("category");
  }

  return {
    complete: missingFields.length === 0,
    missingFields,
  };
}

/**
 * Boolean convenience helper returning true only when the Vendor has a valid
 * non-placeholder `shopName`, valid `whatsappNumber`, valid `region`, and
 * valid `category`.
 */
export function isStoreSetupComplete(
  vendor: StoreSetupCandidate | null | undefined,
): boolean {
  return getStoreSetupStatus(vendor).complete;
}

export type StoreSetupValidationResult =
  | {
      ok: true;
      payload: {
        shopName: string;
        whatsappNumber: string;
        region: string;
        category: string;
      };
    }
  | {
      ok: false;
      field: StoreSetupField;
      error: string;
    };

/**
 * Validates and normalizes the 4 required Store Setup fields before sending
 * them to `PATCH /api/settings`.
 */
export function validateStoreSetupInput(
  input: StoreSetupCandidate,
): StoreSetupValidationResult {
  const shopName = (input.shopName ?? "").trim();
  if (!shopName || isPlaceholderShopName(shopName)) {
    return {
      ok: false,
      field: "shopName",
      error: "Please enter your real shop name (not 'My Shop').",
    };
  }

  const wa = normalizeWhatsAppNumber(input.whatsappNumber);
  if (!wa.valid) {
    return {
      ok: false,
      field: "whatsappNumber",
      error: "Please enter a valid WhatsApp number with country code (e.g. +22890123456).",
    };
  }

  const region = (input.region ?? "").trim();
  if (!region || !findRegion(region)) {
    return {
      ok: false,
      field: "region",
      error: "Please select your shop's region.",
    };
  }

  const category = (input.category ?? "").trim();
  if (!category || !findCategory(category)) {
    return {
      ok: false,
      field: "category",
      error: "Please select your shop's category.",
    };
  }

  return {
    ok: true,
    payload: {
      shopName,
      whatsappNumber: wa.e164,
      region,
      category,
    },
  };
}

export { REGIONS, CATEGORIES };

