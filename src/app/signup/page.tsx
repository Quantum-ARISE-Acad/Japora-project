import CustomSignUp from "@/components/auth/CustomSignUp";
import { phoneSignupEnabled } from "@/lib/otp";

export const dynamic = "force-dynamic";

/**
 * Japora is a WhatsApp-first product, so the sign-up is ordered that way:
 * WhatsApp, then the phone number, then email and Google as further options.
 *
 * The WhatsApp route (/start -> /api/auth/otp/*) is fully built but ships
 * disabled until JAPORA_ENABLE_PHONE_SIGNUP=1 and a Meta Authentication
 * template is live — otherwise a vendor waits for a code that never arrives.
 * We pass the flag down rather than advertising a door that does not open.
 */
export default function SignupPage() {
  return <CustomSignUp whatsappSignupEnabled={phoneSignupEnabled()} />;
}
