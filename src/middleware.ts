import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest, NextFetchEvent } from "next/server";

const VISITOR_COOKIE = "jp_vid"; // keep in sync with src/lib/ratelimit.ts (edge runtime: no shared import needed)

const isConfigured = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.startsWith("pk_")
);

// Clerk session JWTs live ~60s and are verified against this machine's clock
// (default tolerance: 5s). If the host clock drifts (e.g. NTP unavailable),
// every token looks expired, auth() returns no userId and /api/auth/clerk-sync
// answers 401. Allow a configurable tolerance; generous by default in dev only.
const clockSkewEnv = Number(process.env.CLERK_CLOCK_SKEW_MS);
const clockSkewInMs = Number.isFinite(clockSkewEnv) && clockSkewEnv > 0
  ? clockSkewEnv
  : process.env.NODE_ENV === "production"
    ? undefined
    : 10 * 60 * 1000;

const clerkHandler = isConfigured ? clerkMiddleware({ clockSkewInMs }) : null;

function withVisitorCookie(req: NextRequest, res: NextResponse | Response | undefined) {
  const out = (res ?? NextResponse.next()) as NextResponse;
  if (!req.cookies.get(VISITOR_COOKIE) && out.cookies) {
    out.cookies.set(VISITOR_COOKIE, crypto.randomUUID(), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production" && req.nextUrl.protocol === "https:",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return out;
}

export default function middleware(req: NextRequest, event: NextFetchEvent) {
  const res = handle(req, event);
  if (res instanceof Promise) return res.then((r) => withVisitorCookie(req, r as NextResponse));
  return withVisitorCookie(req, res as NextResponse);
}

function handle(req: NextRequest, event: NextFetchEvent) {
  const { pathname } = req.nextUrl;
  // Public webhook & public customer AI/tracking endpoints must NEVER be delayed
  // or rewritten by Clerk dev-browser middleware (Meta enforces a strict 5s timeout).
  if (
    pathname.startsWith("/api/whatsapp/webhook") ||
    pathname.startsWith("/api/ai/shop-chat") ||
    pathname.startsWith("/api/orders/track") ||
    pathname.startsWith("/api/orders/deal")
  ) {
    return NextResponse.next();
  }
  if (clerkHandler) {
    return clerkHandler(req, event);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
