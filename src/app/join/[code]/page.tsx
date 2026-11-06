import Link from "next/link";
import { notFound } from "next/navigation";
import { getCooperativeByCode } from "@/lib/cooperative";
import { getCurrentVendor } from "@/lib/auth";
import JoinButton from "./JoinButton";

export const dynamic = "force-dynamic";

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
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
          <p className="a-label-md text-arctic-500">You&apos;re invited to join</p>
          <h1 className="a-headline-sm mt-1 text-arctic-900">{coop.name}</h1>
          {coop.region && <p className="a-body-sm text-arctic-600">{coop.region}</p>}
          <p className="mt-2 a-body-sm text-arctic-600">
            {coop.memberCount} {coop.memberCount === 1 ? "shop" : "shops"} already selling on WhatsApp
            with Japora.
          </p>

          <div className="mt-6 space-y-3 text-left">
            {vendor ? (
              <JoinButton code={coop.joinCode} coopName={coop.name} />
            ) : (
              <>
                <Link href={`/start?coop=${coop.joinCode}`} className="btn-primary block w-full text-center">
                  Set up my shop &amp; join
                </Link>
                <Link
                  href={`/login?coop=${coop.joinCode}`}
                  className="btn-ghost block w-full text-center"
                >
                  I already have a Japora shop
                </Link>
              </>
            )}
            <p className="a-label-md text-center text-arctic-500">
              Free to start. No app to install — it runs on the WhatsApp you already use.
            </p>
          </div>
        </div>

        <p className="mt-4 text-center a-label-md text-arctic-500">
          Join code: <span className="font-semibold text-arctic-700">{coop.joinCode}</span>
        </p>
      </div>
    </div>
  );
}
