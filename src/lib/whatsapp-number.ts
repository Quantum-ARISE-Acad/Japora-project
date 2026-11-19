/**
 * The vendor's WhatsApp number must carry its country code.
 *
 * A wa.me link reads the first digits as the country code: "93 58 64 24" typed
 * without +228 became wa.me/93586424, which WhatsApp opens as an Afghan (+93)
 * number that does not exist. So a number is accepted only when it starts with
 * "+" (or "00") and its length fits that country. It is stored as digits only
 * (wa.me format), e.g. "22893586424".
 */
import { parsePhoneNumberFromString, type MetadataJson } from "libphonenumber-js/core";
import phoneMetadata from "libphonenumber-js/metadata.min.json";

const metadata = phoneMetadata as unknown as MetadataJson;

export const WHATSAPP_NUMBER_EXAMPLE = "+228 90 12 34 56";

export type WhatsAppNumberCheck =
  | { ok: true; digits: string; e164: string }
  | { ok: false; error: string };

const HELP = `Écrivez le numéro avec l'indicatif du pays, par exemple ${WHATSAPP_NUMBER_EXAMPLE} pour le Togo.`;

/** Checks a number typed by a person. Without an explicit country code it is refused. */
export function checkWhatsAppNumber(input: string | null | undefined): WhatsAppNumberCheck {
  const compact = (input ?? "").trim().replace(/[\s().\-/]/g, "");
  if (!compact) {
    return { ok: false, error: `Le numéro WhatsApp est obligatoire. ${HELP}` };
  }
  let international: string;
  if (compact.startsWith("+")) international = compact;
  else if (compact.startsWith("00")) international = `+${compact.slice(2)}`;
  else {
    return {
      ok: false,
      error: `Commencez le numéro par + suivi de l'indicatif du pays, par exemple ${WHATSAPP_NUMBER_EXAMPLE} pour le Togo.`,
    };
  }

  if (!/^\+\d{6,15}$/.test(international)) {
    return { ok: false, error: `Ce numéro n'est pas valide. ${HELP}` };
  }
  try {
    const parsed = parsePhoneNumberFromString(international, metadata);
    if (parsed?.isPossible()) {
      return { ok: true, e164: parsed.number, digits: parsed.number.slice(1) };
    }
  } catch {
    // falls through to the error below
  }
  return {
    ok: false,
    error: `Ce numéro ne correspond pas à l'indicatif du pays saisi. ${HELP}`,
  };
}

/** Numbers already saved are digits only: valid when they begin with a real country code. */
export function isStoredWhatsAppNumberValid(stored: string | null | undefined): boolean {
  const digits = (stored ?? "").replace(/\D/g, "");
  return digits.length > 0 && checkWhatsAppNumber(`+${digits}`).ok;
}

/** What a form shows for a saved number: "+<digits>" when valid, the raw digits otherwise (to be fixed). */
export function formatStoredWhatsAppNumber(stored: string | null | undefined): string {
  const digits = (stored ?? "").replace(/\D/g, "");
  if (!digits) return "";
  return isStoredWhatsAppNumberValid(digits) ? `+${digits}` : digits;
}
