import { redirect } from "next/navigation";
import StartClient from "./StartClient";
import { phoneSignupEnabled } from "@/lib/otp";

export const dynamic = "force-dynamic";

/**
 * Phone sign-up sends its code over WhatsApp, which is not connected yet.
 * Until JAPORA_ENABLE_PHONE_SIGNUP=1, send people to the email sign-up so
 * nobody waits for a code that never comes.
 */
export default async function StartPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!phoneSignupEnabled()) {
    const sp = await searchParams;
    const qs = new URLSearchParams();
    for (const key of ["ref", "coop"]) {
      const v = sp[key];
      if (typeof v === "string" && v) qs.set(key, v);
    }
    redirect(qs.size ? `/signup?${qs.toString()}` : "/signup");
  }
  return <StartClient />;
}
