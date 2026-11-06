import { requireVendor } from "@/lib/auth";
import { prisma } from "@/lib/db";
import BroadcastComposer from "./BroadcastComposer";

export const dynamic = "force-dynamic";

export default async function BroadcastsPage() {
  const vendor = await requireVendor();
  const broadcasts = await prisma.broadcast.findMany({
    where: { vendorId: vendor.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const dto = broadcasts.map((b) => ({
    id: b.id,
    body: b.body,
    segment: b.segment,
    status: b.status,
    targetCount: b.targetCount,
    sentCount: b.sentCount,
    createdAt: b.createdAt.toISOString(),
    sentAt: b.sentAt?.toISOString() ?? null,
  }));

  return <BroadcastComposer initialBroadcasts={dto} />;
}
