/**
 * Lightweight structured logger. Emits JSON lines for any log aggregator
 * (Axiom, Datadog, Loki, Logflare, Vector...). Designed as a drop-in for a
 * heavier library (pino, Sentry) later — call sites stay the same.
 *
 *   logger.info("order.created", { vendorId, orderId, totalCents });
 *   logger.error("upload.storage_error", { error: String(e) });
 *
 * Levels are filtered by LOG_LEVEL (default "info" in prod, "debug" in dev).
 */

type Level = "debug" | "info" | "warn" | "error";
type Context = Record<string, unknown>;

const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function activeLevel(): Level {
  const env = process.env.LOG_LEVEL?.toLowerCase();
  if (env === "debug" || env === "info" || env === "warn" || env === "error") return env;
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

function emit(level: Level, msg: string, ctx?: Context) {
  if (ORDER[level] < ORDER[activeLevel()]) return;
  const payload = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...(ctx ?? {}),
  };
  const line = JSON.stringify(payload);
  if (level === "error" || level === "warn") {
    console.error(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug: (msg: string, ctx?: Context) => emit("debug", msg, ctx),
  info: (msg: string, ctx?: Context) => emit("info", msg, ctx),
  warn: (msg: string, ctx?: Context) => emit("warn", msg, ctx),
  error: (msg: string, ctx?: Context) => emit("error", msg, ctx),
};
