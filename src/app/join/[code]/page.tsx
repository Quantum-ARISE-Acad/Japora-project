import Link from "next/link";
import { notFound } from "next/navigation";
import { getCooperativeByCode } from "@/lib/cooperative";
import { getCurrentVendor } from "@/lib/auth";
import { regionLabel } from "@/lib/regions";
import JoinButton from "./JoinButton";
import { getServerTr } from "@/lib/public-locale";

export const dynamic = "force-dynamic";

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const tr = await getServerTr();
  const { code } = await params;
  const coop = await getCooperativeByCode(code);
  if (!coop) notFound();

  const vendor = await getCurrentVendor();

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm a-fade-in">
        <Link href="/" className="group mb-8 flex items-center justify-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-shape-md bg-arctic-800 text-lg font-black text-arctic-50">J</span>
          <span className="a-title-md tracking-[-0.01em] text-arctic-900">Japora</span>
        </Link>

        <div className="glass glass-edge rounded-shape-xl p-6 text-center">
          <p className="a-label-md text-arctic-500">{tr("Vous êtes invité à rejoindre", "You are invited to join")}</p>
          <h1 className="a-headline-sm mt-1 text-arctic-900">{coop.name}</h1>
          {coop.region && <p className="a-body-sm text-arctic-600">{regionLabel(coop.region)}</p>}
          <p className="mt-2 a-body-sm text-arctic-600">
            {coop.memberCount > 1
              ? tr(`${coop.memberCount} boutiques vendent déjà sur WhatsApp avec Japora.`, `${coop.memberCount} shops already sell on WhatsApp with Japora.`)
              : tr(`${coop.memberCount} boutique vend déjà sur WhatsApp avec Japora.`, `${coop.memberCount} shop already sells on WhatsApp with Japora.`)}
          </p>

          <div className="mt-6 space-y-3 text-left">
            {vendor ? (
              <JoinButton code={coop.joinCode} coopName={coop.name} />
            ) : (
              <>
                <Link href={`/start?coop=${coop.joinCode}`} className="btn-primary block w-full text-center">
                  {tr("Créer ma boutique et rejoindre", "Create my shop and join")}
                </Link>
                <Link
                  href={`/login?coop=${coop.joinCode}`}
                  className="btn-ghost block w-full text-center"
                >
                  {tr("J'ai déjà une boutique Japora", "I already have a Japora shop")}
                </Link>
              </>
            )}
            <p className="a-label-md text-center text-arctic-500">
              {tr("Gratuit pour commencer. Aucune application à installer : Japora fonctionne avec votre WhatsApp habituel.", "Free to start. Nothing to install: Japora works with your usual WhatsApp.")}
            </p>
          </div>
        </div>

        <p className="mt-4 text-center a-label-md text-arctic-500">
          {tr("Code d'adhésion :", "Membership code:")} <span className="font-semibold text-arctic-700">{coop.joinCode}</span>
        </p>
      </div>
    </div>
  );
}
