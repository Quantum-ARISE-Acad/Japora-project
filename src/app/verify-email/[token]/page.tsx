import Link from "next/link";
import { prisma } from "@/lib/db";
import { hashToken } from "@/lib/token";
import { logger } from "@/lib/logger";

type Params = { params: Promise<{ token: string }> };

async function verify(token: string): Promise<
  | { ok: true; shopName: string }
  | { ok: false; reason: "invalid" | "expired" | "used" }
> {
  const record = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { vendor: true },
  });
  if (!record) return { ok: false, reason: "invalid" };
  if (record.usedAt) return { ok: false, reason: "used" };
  if (record.expiresAt < new Date()) return { ok: false, reason: "expired" };

  await prisma.$transaction([
    prisma.vendor.update({
      where: { id: record.vendorId },
      data: { emailVerifiedAt: record.vendor.emailVerifiedAt ?? new Date() },
    }),
    prisma.emailVerificationToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
  ]);

  logger.info("auth.verify.success", { vendorId: record.vendorId });
  return { ok: true, shopName: record.vendor.shopName };
}

export default async function VerifyEmailPage({ params }: Params) {
  const { token } = await params;
  const result = await verify(token);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm a-fade-in">
        <Link href="/" className="group mb-8 flex items-center justify-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-shape-md bg-arctic-800 text-lg font-black text-arctic-50 transition-transform duration-short ease-spring group-hover:rotate-6 group-hover:scale-105">J</span>
          <span className="a-title-md tracking-[-0.01em] text-arctic-900">Japora</span>
        </Link>

        <div className="glass glass-edge space-y-3 rounded-shape-xl p-6 text-center">
          {result.ok ? (
            <>
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-arctic-200/80 text-3xl backdrop-blur-glass-thin a-pulse">✅</div>
              <h1 className="a-headline-sm text-arctic-900">Email verified</h1>
              <p className="a-body-md text-arctic-700">
                {result.shopName} is ready.
              </p>
              <Link href="/dashboard" className="btn-primary w-full">
                Open dashboard
              </Link>
            </>
          ) : (
            <>
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-amber-100/80 text-3xl backdrop-blur-glass-thin">⚠️</div>
              <h1 className="a-headline-sm text-arctic-900">
                {result.reason === "used"
                  ? "Link already used"
                  : result.reason === "expired"
                    ? "Link expired"
                    : "Invalid link"}
              </h1>
              <p className="a-body-md text-arctic-700">
                {result.reason === "used"
                  ? "This verification link was already used. You're all set."
                  : "Sign in and we'll send you a fresh verification email."}
              </p>
              <Link href="/login" className="btn-ghost w-full">
                Go to sign in
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
