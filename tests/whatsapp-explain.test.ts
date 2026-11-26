import { test } from "node:test";
import assert from "node:assert/strict";
import { explainWhatsAppOrAiError } from "../src/lib/whatsapp-config";

const cases: [string, Parameters<typeof explainWhatsAppOrAiError>[1]][] = [
  ["HTTP 400 API_KEY_INVALID", "gemini_ai"],
  ["429 RESOURCE_EXHAUSTED", "gemini_ai"],
  ["403 PERMISSION_DENIED", "gemini_ai"],
  ["timeout", "gemini_ai"],
  ["Code 190: Session has expired", "whatsapp_send"],
  ["131030 Recipient phone number not in allowed list", "whatsapp_status"],
  ["131047 Re-engagement message", "whatsapp_status"],
  ["Unsupported post request", "whatsapp_send"],
  ["133010 Account not registered", "whatsapp_send"],
  ["MISSING_CREDENTIALS", "whatsapp_send"],
  ["something else", "webhook_routing"],
  ["", "whatsapp_send"],
];

test("every WhatsApp/Gemini error is explained in French and in English", () => {
  for (const [raw, stage] of cases) {
    const e = explainWhatsAppOrAiError(raw, stage);
    for (const key of ["title", "message", "fixHint", "titleEn", "messageEn", "fixHintEn"] as const) {
      assert.ok(e[key].trim().length > 0, `${raw} / ${stage}: ${key} is empty`);
    }
    assert.notEqual(e.title, e.titleEn, `${raw}: the English title is not translated`);
    assert.notEqual(e.fixHint, e.fixHintEn, `${raw}: the English fix is not translated`);
  }
});
