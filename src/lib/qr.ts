/**
 * QR codes — Japora's offline → online bridge.
 *
 * A market-stall vendor prints their catalog QR, sticks it on the table, and a
 * passer-by scans straight into the shop. Complements WhatsApp's click-to-chat
 * with something you can put on paper.
 *
 * SVG output (scales to any print size, crisp on cheap printers). The `qrcode`
 * package is pure JS; we import it lazily so a missing install degrades to a
 * clear error instead of breaking the build.
 */
import { logger } from "./logger";

export type QrOptions = {
  /** Module ("dot") colour. Defaults to Arctic slate. */
  dark?: string;
  /** Background. Defaults to transparent. */
  light?: string;
  /** Quiet-zone margin in modules. Defaults to the QR standard of 4 modules. */
  margin?: number;
  /** Explicit SVG dimensions so renderers do not fall back to 300×150. */
  width?: number;
  /** Error-correction level. "M" balances density vs. scan-resilience. */
  ecc?: "L" | "M" | "Q" | "H";
};

export async function renderQrSvg(data: string, opts: QrOptions = {}): Promise<string> {
  const value = (data || "").trim();
  if (!value) throw new Error("QR data is empty");

  let QR: typeof import("qrcode");
  try {
    QR = await import("qrcode");
  } catch (e) {
    logger.error("qr.module_unavailable", {
      hint: "Run: pnpm add qrcode",
      error: e instanceof Error ? e.message : String(e),
    });
    throw new Error("QR generator unavailable");
  }

  return QR.toString(value, {
    type: "svg",
    errorCorrectionLevel: opts.ecc ?? "M",
    margin: opts.margin ?? 4,
    width: opts.width ?? 256,
    color: {
      dark: opts.dark ?? "#111827",
      light: opts.light ?? "#ffffff",
    },
  });
}
