import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentVendor } from "@/lib/auth";
import {
  isSegment,
  segmentRecipients,
  type BroadcastSegment,
} from "@/lib/broadcast";

const MAX_BODY_LEN = 1000;

export async function GET(req: NextRequest) {
  const vendor = await getCurrentVendor();
  if (!vendor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Side route: recipient counts for the composer's live segment chips.
  // Living here keeps it discoverable and avoids an extra route file.
  const segment = req.nextUrl.searchParams.get("recipientsFor");
  if (segment) {
    if (!isSegment(segment)) {
      return NextResponse.json({ error: "Invalid segment." }, { status: 400 });
    }
    const recipients = await segmentRecipients(
      vendor.id,
      segment as BroadcastSegment,
    );
    return NextResponse.json({ segment, count: recipients.length });
  }

  const broadcasts = await prisma.broadcast.findMany({
    where: { vendorId: vendor.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ broadcasts });
}

export async function POST(req: NextRequest) {
  const vendor = await getCurrentVendor();
  if (!vendor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const text = String(body.body ?? "").trim();
  if (!text) {
    return NextResponse.json(
      { error: "Broadcast message is required." },
      { status: 400 },
    );
  }
  if (text.length > MAX_BODY_LEN) {
    return NextResponse.json(
      { error: `Message must be ${MAX_BODY_LEN} characters or fewer.` },
      { status: 400 },
    );
  }

  const segmentRaw = String(body.segment ?? "all");
  if (!isSegment(segmentRaw)) {
    return NextResponse.json({ error: "Invalid segment." }, { status: 400 });
  }
  const segment = segmentRaw as BroadcastSegment;

  // Snapshot the count at draft time for display — dispatch re-resolves
  // recipients so the live count drives the actual fan-out.
  const recipients = await segmentRecipients(vendor.id, segment);

  const broadcast = await prisma.broadcast.create({
    data: {
      vendorId: vendor.id,
      body: text,
      segment,
      targetCount: recipients.length,
      status: "draft",
    },
  });

  return NextResponse.json({
    id: broadcast.id,
    targetCount: broadcast.targetCount,
  });
}
