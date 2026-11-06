import { NextResponse } from "next/server";
import { destroySession } from "@/lib/session";
import { clearUnifiedCookie } from "@/lib/unified-auth";

export async function POST() {
  await destroySession();
  await clearUnifiedCookie();
  return NextResponse.json({ ok: true });
}

