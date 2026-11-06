import { requireVendor } from "@/lib/auth";
import { getCooperativeForVendor } from "@/lib/cooperative";
import { REGIONS } from "@/lib/regions";
import { renderQrSvg } from "@/lib/qr";
import CooperativeClient from "./CooperativeClient";

export default async function CooperativePage() {
  const vendor = await requireVendor();
  const coop = await getCooperativeForVendor(vendor.id);

  let qrSvg = "";
  if (coop) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://japora.app";
    const joinUrl = `${appUrl}/join/${coop.joinCode}`;
    try {
      qrSvg = await renderQrSvg(joinUrl);
    } catch {
      qrSvg = "";
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="a-headline-md text-arctic-900">Coopérative & Association Marchande</h1>
        <p className="a-body-md mt-1 text-arctic-600">
          Développez votre réseau de vendeurs sur WhatsApp, partagez un code d&apos;adhésion commun et gagnez en visibilité.
        </p>
      </div>

      <CooperativeClient
        cooperative={
          coop
            ? {
                id: coop.id,
                name: coop.name,
                region: coop.region,
                joinCode: coop.joinCode,
                isAdmin: coop.isAdmin,
                memberCount: coop.memberCount,
                members: coop.members.map((m) => ({
                  id: m.id,
                  shopName: m.shopName,
                  shopSlug: m.shopSlug,
                  joinedAt: m.createdAt.toISOString(),
                })),
              }
            : null
        }
        qrSvg={qrSvg}
        regions={REGIONS}
      />
    </div>
  );
}
