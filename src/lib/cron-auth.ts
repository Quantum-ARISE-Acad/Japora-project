import type { NextRequest } from "next/server";

/**
 * Shared auth for /api/cron/* routes.
 *
 * Accepted credentials (any one of them must equal CRON_SECRET):
 *   - `Authorization: Bearer <CRON_SECRET>` — sent automatically by Vercel Cron
 *     when the CRON_SECRET env var is defined on the project.
 *   - `X-Cron-Key: <CRON_SECRET>` — external schedulers.
 *   - `?key=<CRON_SECRET>` — legacy / manual calls.
 */
export function isAuthorizedCron(req: NextRequest): { ok: boolean; hasProvided: boolean; hasExpected: boolean } {
  const expected = process.env.CRON_SECRET?.trim();
  const auth = req.headers.get("authorization");
  const bearer = auth?.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : null;
  const provided = bearer || req.headers.get("x-cron-key") || req.nextUrl.searchParams.get("key");

  return {
    ok: Boolean(expected) && provided === expected,
    hasProvided: Boolean(provided),
    hasExpected: Boolean(expected),
  };
}

