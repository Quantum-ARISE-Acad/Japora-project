import { NextResponse } from "next/server";
import { createSession } from "@/lib/session";
import { setUnifiedCookie } from "@/lib/unified-auth";
import { syncClerkUserToVendor } from "@/lib/clerk-vendor-sync";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    let clerkId: string | null =
      typeof body.clerkId === "string" && body.clerkId.trim()
        ? body.clerkId.trim()
        : null;
    let email: string =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    let firstName: string | null =
      typeof body.firstName === "string" ? body.firstName.trim() : null;
    let lastName: string | null =
      typeof body.lastName === "string" ? body.lastName.trim() : null;
    let name: string =
      typeof body.name === "string" ? body.name.trim() : "";
    let avatarUrl: string | null =
      typeof body.avatarUrl === "string" ? body.avatarUrl.trim() : null;
    let shopName: string =
      typeof body.shopName === "string" ? body.shopName.trim() : "";
    let shopSlug: string =
      typeof body.shopSlug === "string" ? body.shopSlug.trim() : "";
    let whatsappNumber: string =
      typeof body.whatsappNumber === "string" ? body.whatsappNumber.trim() : "";
    let momoNumber: string =
      typeof body.momoNumber === "string" ? body.momoNumber.trim() : "";
    let currency: string =
      typeof body.currency === "string" && body.currency.trim()
        ? body.currency.trim()
        : "XOF";
    let language: string =
      typeof body.language === "string" && body.language.trim()
        ? body.language.trim()
        : "fr";
    let category: string =
      typeof body.category === "string" ? body.category.trim() : "";
    let region: string =
      typeof body.region === "string" ? body.region.trim() : "";
    const password: string | null =
      typeof body.password === "string" && body.password ? body.password : null;
    let authProvider: "google" | "clerk_email" | "local" =
      body.authProvider === "google" ? "google" : "clerk_email";
    let isGoogleOneClick = Boolean(body.isGoogleOneClick);

    // Enrich with server-verified Clerk user data if Clerk is active
    if (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
      try {
        const { auth, currentUser } = await import("@clerk/nextjs/server");
        const clerkAuth = await auth();
        if (clerkAuth?.userId) {
          clerkId = clerkAuth.userId;
          const clerkUser = await currentUser();
          if (clerkUser) {
            if (!email) {
              email =
                clerkUser.emailAddresses?.[0]?.emailAddress
                  ?.trim()
                  .toLowerCase() || "";
            }
            if (!firstName && clerkUser.firstName) {
              firstName = clerkUser.firstName;
            }
            if (!lastName && clerkUser.lastName) {
              lastName = clerkUser.lastName;
            }
            if (!name) {
              name = [clerkUser.firstName, clerkUser.lastName]
                .filter(Boolean)
                .join(" ")
                .trim();
            }
            if (!avatarUrl && clerkUser.imageUrl) {
              avatarUrl = clerkUser.imageUrl;
            }

            const hasGoogle =
              Array.isArray(clerkUser.externalAccounts) &&
              clerkUser.externalAccounts.some((acc) =>
                String(acc.provider || "").includes("google"),
              );
            if (hasGoogle) {
              authProvider = "google";
              if (!shopName) {
                isGoogleOneClick = true;
              }
            }

            const unsafe = (clerkUser.unsafeMetadata || {}) as Record<
              string,
              unknown
            >;
            if (!shopName && typeof unsafe.shopName === "string") {
              shopName = unsafe.shopName.trim();
            }
            if (!whatsappNumber && typeof unsafe.whatsappNumber === "string") {
              whatsappNumber = unsafe.whatsappNumber.trim();
            }
            if (
              (!currency || currency === "XOF") &&
              typeof unsafe.currency === "string"
            ) {
              currency = unsafe.currency.trim();
            }
            if (
              (!language || language === "fr") &&
              typeof unsafe.language === "string"
            ) {
              language = unsafe.language.trim();
            }
            if (!category && typeof unsafe.category === "string") {
              category = unsafe.category.trim();
            }
            if (!region && typeof unsafe.region === "string") {
              region = unsafe.region.trim();
            }
          }
        }
      } catch (err) {
        console.warn("[clerk-sync] server Clerk lookup warning:", err);
      }
    }

    if (!email) {
      return NextResponse.json(
        { error: "Une adresse email est requise pour synchroniser le compte." },
        { status: 400 },
      );
    }

    const { vendor, isNewAccount, needsOnboarding } =
      await syncClerkUserToVendor({
        clerkId,
        email,
        name,
        firstName,
        lastName,
        avatarUrl,
        shopName: shopName || null,
        shopSlug: shopSlug || null,
        whatsappNumber: whatsappNumber || null,
        momoNumber: momoNumber || null,
        currency,
        language,
        category: category || null,
        region: region || null,
        password,
        authProvider,
        isGoogleOneClick,
        completeOnboarding: Boolean(shopName) && !isGoogleOneClick,
      });

    // Establish HTTP-only session cookie + unified cookie so all APIs work seamlessly
    await createSession({
      vendorId: vendor.id,
      email: vendor.email,
    });

    await setUnifiedCookie({
      sub: vendor.email,
      email: vendor.email,
      name: vendor.shopName || name || undefined,
      phone: vendor.whatsappNumber || undefined,
      role: "VENDOR",
      originApp: "japora",
    });

    return NextResponse.json({
      ok: true,
      role: "seller",
      vendorId: vendor.id,
      shopName: vendor.shopName,
      shopSlug: vendor.shopSlug,
      isNewAccount,
      needsOnboarding,
    });
  } catch (err: any) {
    console.error("[clerk-sync error]", err);
    return NextResponse.json(
      { error: err.message || "Échec de la synchronisation du compte." },
      { status: 500 },
    );
  }
}
