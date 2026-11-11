import { NextRequest } from "next/server";
import { logger } from "@/lib/logger";
import { processBroadcastQueue } from "@/lib/broadcast";

async function handle(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  const provided = req.nextUrl.searchParams.get("key") || req.headers.get("x-cron-key");
  if (!expected || provided !== expected) {
    logger.warn("cron.broadcasts.unauthorized", { hasProvided: Boolean(provided) });
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await processBroadcastQueue();
  logger.info("cron.broadcasts.done", result);
  return Response.json({ ok: true, ...result });
}

export const GET = handle;
export const POST = handle;
