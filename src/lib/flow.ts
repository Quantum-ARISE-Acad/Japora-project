/**
 * WhatsApp Flows — in-chat checkout.
 *
 * A Flow is a multi-screen form that runs *inside* WhatsApp: the customer picks
 * a product, quantity, and gives delivery details without ever leaving the
 * chat — the real "never leave WhatsApp" promise. Meta hosts the UI; our server
 * supplies the screen data and receives the completion payload.
 *
 * This module builds the Flow JSON (the screen definition you publish in the
 * Meta Flow Builder) and shapes the completion payload our endpoint consumes.
 *
 * The remaining Connect step (needs Meta creds): publish this JSON as a Flow,
 * set the endpoint to /api/whatsapp/flow, and enable request encryption (Meta
 * encrypts the data-exchange with your RSA public key). Our endpoint already
 * handles the decrypted/plaintext shape; wiring the RSA layer is the last mile.
 */
import { formatMoney } from "./utils";

export type FlowProduct = {
  id: string;
  name: string;
  priceCents: number;
  sizes: string;
  stock: number;
};

/**
 * Build the Flow JSON for a vendor's checkout. Three screens:
 *   PRODUCT  → choose item + size + qty
 *   DETAILS  → name + phone + delivery address
 *   REVIEW   → summary → "Place order" (completes the Flow)
 */
export function buildCheckoutFlowJson(opts: {
  shopName: string;
  currency: string;
  products: FlowProduct[];
}) {
  const inStock = opts.products.filter((p) => p.stock > 0).slice(0, 30);
  return {
    version: "5.0",
    screens: [
      {
        id: "PRODUCT",
        title: `${opts.shopName} — order`,
        data: {},
        layout: {
          type: "SingleColumnLayout",
          children: [
            {
              type: "Dropdown",
              label: "Product",
              name: "product",
              required: true,
              "data-source": inStock.map((p) => ({
                id: p.id,
                title: `${p.name} — ${formatMoney(p.priceCents, opts.currency)}`,
              })),
            },
            { type: "TextInput", label: "Size (optional)", name: "size", required: false },
            { type: "TextInput", label: "Quantity", name: "qty", "input-type": "number", required: true },
            {
              type: "Footer",
              label: "Continue",
              "on-click-action": { name: "navigate", next: { type: "screen", name: "DETAILS" } },
            },
          ],
        },
      },
      {
        id: "DETAILS",
        title: "Your details",
        layout: {
          type: "SingleColumnLayout",
          children: [
            { type: "TextInput", label: "Your name", name: "name", required: true },
            { type: "TextInput", label: "Phone", name: "phone", "input-type": "phone", required: true },
            { type: "TextArea", label: "Delivery address", name: "address", required: false },
            {
              type: "Footer",
              label: "Review order",
              "on-click-action": { name: "navigate", next: { type: "screen", name: "REVIEW" } },
            },
          ],
        },
      },
      {
        id: "REVIEW",
        title: "Confirm",
        terminal: true,
        layout: {
          type: "SingleColumnLayout",
          children: [
            { type: "TextBody", text: "Tap below to send your order. The shop confirms on WhatsApp." },
            {
              type: "Footer",
              label: "Place order",
              "on-click-action": {
                name: "complete",
                payload: {
                  product: "${data.product}",
                  size: "${data.size}",
                  qty: "${data.qty}",
                  name: "${data.name}",
                  phone: "${data.phone}",
                  address: "${data.address}",
                },
              },
            },
          ],
        },
      },
    ],
  };
}

export type FlowCompletion = {
  flowToken?: string;
  vendorId?: string;
  product?: string; // product id
  size?: string;
  qty?: string | number;
  name?: string;
  phone?: string;
  address?: string;
};
