import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  SHOP_PICK_ALL,
  allShopsReply,
  buildShopPicker,
  isSharedBotNumber,
  matchShopsByName,
  parseShopPick,
  shopWhatsAppLink,
  wantsShopSwitch,
} from "../src/lib/shop-picker";

const shops = [
  { id: "v1", shopName: "Kofi Électro", shopSlug: "kofi-electro", description: "Téléphones et accessoires" },
  { id: "v2", shopName: "Ama Couture", shopSlug: "ama-couture", description: "" },
  { id: "v3", shopName: "Chez Yao", shopSlug: "chez-yao" },
];

describe("shop picker — shared Japora number", () => {
  test("the shared number is the server's WHATSAPP_PHONE_NUMBER_ID", () => {
    const env = { WHATSAPP_PHONE_NUMBER_ID: "123456" };
    assert.equal(isSharedBotNumber("123456", env), true);
    assert.equal(isSharedBotNumber("999999", env), false);
    assert.equal(isSharedBotNumber(undefined, env), false);
    assert.equal(isSharedBotNumber("123456", {}), false);
  });

  test("list replies are parsed, other text is not", () => {
    assert.equal(parseShopPick("japora-shop:kofi-electro"), "kofi-electro");
    assert.equal(parseShopPick(SHOP_PICK_ALL), "*");
    assert.equal(parseShopPick("Bonjour (kofi-electro)"), null);
    assert.equal(parseShopPick("japora-shop:../x"), null);
  });

  test("the customer can ask for another shop", () => {
    assert.equal(wantsShopSwitch("Je veux changer de boutique"), true);
    assert.equal(wantsShopSwitch("Boutiques"), true);
    assert.equal(wantsShopSwitch("Quelle boutique ?"), true);
    assert.equal(wantsShopSwitch("je veux des chaussures"), false);
  });

  test("a shop named in the message is found, accents ignored", () => {
    assert.deepEqual(matchShopsByName("Bonjour kofi electro !", shops).map((s) => s.id), ["v1"]);
    assert.deepEqual(matchShopsByName("salut ama-couture", shops).map((s) => s.id), ["v2"]);
    assert.deepEqual(matchShopsByName("bonjour", shops), []);
  });

  test("the list puts the named shop first and ends with every shop", () => {
    const p = buildShopPicker(shops, { text: "chez yao svp", origin: "https://japora.app/" });
    const rows = p.sections[0].rows;
    assert.equal(rows[0].id, "japora-shop:chez-yao");
    assert.equal(rows.at(-1)?.id, SHOP_PICK_ALL);
    assert.equal(rows.length, 4);
    assert.match(p.body, /Avec quelle boutique/);
    assert.match(p.textFallback, /https:\/\/japora\.app\/c\/kofi-electro/);
    assert.match(p.textFallback, /https:\/\/japora\.app\/marketplace/);
  });

  test("the list respects WhatsApp limits (10 rows, 24-character titles)", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      shopName: `Boutique au nom très très long numéro ${i}`,
      shopSlug: `b-${i}`,
    }));
    const rows = buildShopPicker(many, { origin: "https://x" }).sections[0].rows;
    assert.equal(rows.length, 10);
    assert.ok(rows.every((r) => r.title.length <= 24 && (r.description ?? "").length <= 72));
  });

  test("the directory reply links the marketplace", () => {
    assert.match(allShopsReply("https://japora.app"), /https:\/\/japora\.app\/marketplace/);
  });
});

describe("shop QR link", () => {
  test("uses the Japora bot number and carries the (slug) tag", () => {
    const l = shopWhatsAppLink({ shopName: "Kofi", shopSlug: "kofi", vendorNumber: "+228 90 11 22 33", botNumber: "22870000000" });
    assert.ok(l);
    assert.equal(l.viaJaporaNumber, true);
    assert.match(l.url, /^https:\/\/wa\.me\/22870000000\?text=/);
    assert.match(decodeURIComponent(l.url), /\(kofi\)/);
  });

  test("adds the tag to a custom message and falls back to the vendor number", () => {
    const l = shopWhatsAppLink({ shopName: "Kofi", shopSlug: "kofi", vendorNumber: "+228 90 11 22 33", prefill: "Salut !" });
    assert.ok(l);
    assert.equal(l.viaJaporaNumber, false);
    assert.match(l.url, /^https:\/\/wa\.me\/22890112233\?text=/);
    assert.equal(decodeURIComponent(l.url.split("text=")[1]), "Salut ! (kofi)");
  });

  test("no number at all gives no link", () => {
    assert.equal(shopWhatsAppLink({ shopName: "Kofi", shopSlug: "kofi" }), null);
  });
});
