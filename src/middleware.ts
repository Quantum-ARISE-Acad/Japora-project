import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest, NextFetchEvent } from "next/server";

const isConfigured = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.startsWith("pk_")
);

const clerkHandler = isConfigured ? clerkMiddleware() : null;

export default function middleware(req: NextRequest, event: NextFetchEvent) {
  const { pathname } = req.nextUrl;
  // Public webhook & public customer AI/tracking endpoints must NEVER be delayed
  // or rewritten by Clerk dev-browser middleware (Meta enforces a strict 5s timeout).
  if (
    pathname.startsWith("/api/cron/") ||
    pathname.startsWith("/api/whatsapp/webhook") ||
    pathname.startsWith("/api/payments/webhook") ||
    pathname.startsWith("/api/payments/fedapay/callback") ||
    pathname.startsWith("/api/payments/checkout") ||
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
