import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/session";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      clerkId,
      email,
      role = "seller",
      name = "",
      shopName = "",
      whatsappNumber = "",
      currency = "XOF",
      category = "",
      phone = "",
    } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Japora is dedicated to vendors: always resolve or create a Vendor account
    let vendor = null;
    if (clerkId) {
      vendor = await (prisma.vendor as any).findFirst({
        where: {
          OR: [
            { clerkId: clerkId },
            { email: cleanEmail },
          ],
        },
      });
    } else {
      vendor = await prisma.vendor.findUnique({
        where: { email: cleanEmail },
      });
    }

    if (!vendor) {
      // Create new seller / vendor
      const baseName = shopName.trim() || name.trim() || cleanEmail.split("@")[0];
      let baseSlug = slugify(baseName) || "shop";
      
      // Ensure slug uniqueness
      let slug = baseSlug;
      let counter = 1;
      while (await prisma.vendor.findUnique({ where: { shopSlug: slug } })) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }

      const now = new Date();
      const trialEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      vendor = await prisma.vendor.create({
        data: {
          ...(clerkId ? { clerkId } : {}),
          email: cleanEmail,
          passwordHash: "clerk_managed_auth",
          shopName: baseName,
          shopSlug: slug,
          whatsappNumber: whatsappNumber.trim(),
          currency: currency || "XOF",
          category: category || "",
          subscriptionStatus: "trialing",
          trialEndsAt: trialEnd,
          emailVerifiedAt: now,
        } as any,
      });
    } else if (clerkId && !(vendor as any).clerkId) {
      // Link existing vendor with clerkId
      vendor = await (prisma.vendor as any).update({
        where: { id: vendor.id },
        data: { clerkId },
      });
    }

    // Establish session cookie so dashboard and all existing APIs work seamlessly
    await createSession({
      vendorId: vendor.id,
      email: vendor.email,
    });

    return NextResponse.json({
      ok: true,
      role: "seller",
      vendorId: vendor.id,
      shopSlug: vendor.shopSlug,
    });
  } catch (err: any) {
    console.error("[clerk-sync error]", err);
    return NextResponse.json({ error: err.message || "Sync failed" }, { status: 500 });
  }
}
