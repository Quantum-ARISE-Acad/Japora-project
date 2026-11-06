import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentVendor } from "@/lib/auth";
import { dispatchBroadcast } from "@/lib/broadcast";
import { logger } from "@/lib/logger";

type Params = { params: Promise<{ id: string }> };

/**
 * Fire-and-forget dispatch. We respond 200 immediately so the dashboard can
 * start polling for status changes; the dispatch itself runs on the server's
 * task queue. Any thrown error is logged but doesn't bubble back to the user.
 */
export async function POST(_req: NextRequest, { params }: Params) {
  const vendor = await getCurrentVendor();
  if (!vendor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const broadcast = await prisma.broadcast.findFirst({
    where: { id, vendorId: vendor.id },
    select: { id: true, status: true },
  });
  if (!broadcast) {
    return NextResponse.json({ error: "Broadcast not found." }, { status: 404 });
  }
  if (broadcast.status === "sending" || broadcast.status === "sent") {
    return NextResponse.json(
      { error: `Broadcast is already ${broadcast.status}.` },
      { status: 409 },
    );
  }

  // Fire-and-forget. Errors are logged inside dispatchBroadcast; this catch
  // is just to prevent an unhandled rejection if something throws before the
  // function's own try/catch is reached.
  void dispatchBroadcast(id).catch((e) => {
    logger.error("broadcast.dispatch_unhandled", {
      broadcastId: id,
      error: e instanceof Error ? e.message : String(e),
    });
  });

  return NextResponse.json({ ok: true });
}
