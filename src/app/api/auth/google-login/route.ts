import { NextResponse } from "next/server";

/**
 * Legacy demo Google login endpoint has been disabled.
 * All Google OAuth sign-in and sign-up flows use the real Clerk v7 Google OAuth
 * (`authenticateWithRedirect({ strategy: "oauth_google" })` -> `/sso-callback` -> `/api/auth/clerk-sync`).
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "Le mode démo est désactivé. Veuillez utiliser la connexion Google officielle via Clerk.",
    },
    { status: 410 },
  );
}
