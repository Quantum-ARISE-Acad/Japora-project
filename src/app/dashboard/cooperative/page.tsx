import { requireVendor } from "@/lib/auth";
import { getCooperativeForVendor } from "@/lib/cooperative";
import { REGIONS } from "@/lib/regions";
import { renderQrSvg } from "@/lib/qr";
import CooperativeClient from "./CooperativeClient";
import { getServerTr } from "@/lib/public-locale";

export default async function CooperativePage() {
  const tr = await getServerTr();
  const vendor = await requireVendor();
  const coop = await getCooperativeForVendor(vendor.id);

  let qrSvg = "";
  if (coop) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://japora.app";
    const joinUrl = `${appUrl}/join/${coop.joinCode}`;
    try {
      qrSvg = await renderQrSvg(joinUrl, {
        dark: "#111827",
        light: "#ffffff",
        margin: 4,
        width: 256,
        ecc: "M",
      });
    } catch {
      qrSvg = "";
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="a-headline-md text-arctic-900">{tr("Coopérative & Association Marchande", "Cooperative & traders' association")}</h1>
        <p className="a-body-md mt-1 text-arctic-600">
          {tr("Développez votre réseau de vendeurs sur WhatsApp, partagez un code d'adhésion commun et gagnez en visibilité.", "Grow your network of vendors on WhatsApp, share a common membership code and gain visibility.")}
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
