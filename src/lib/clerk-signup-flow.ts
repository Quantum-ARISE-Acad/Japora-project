/**
 * Pure, testable state-transition helpers for Clerk custom SignUp & SignIn flows.
 *
 * Ensures strict separation between:
 *   1. Clerk Authentication (Email OTP, Phone OTP, or Google OAuth)
 *   2. Clerk Session activation (`setActive`)
 *   3. Server-side Vendor provisioning (`POST /api/auth/clerk-sync`)
 *   4. Post-authentication Store Setup on `/dashboard`
 */

// Use the `core` entry with explicit metadata: the default entry's bundled
// metadata resolves to `undefined` under CJS/tsx interop, which made every
// phone number normalize to "" (and silently broke phone OTP payloads).
import { parsePhoneNumberFromString, type CountryCode, type MetadataJson } from "libphonenumber-js/core";
import phoneMetadata from "libphonenumber-js/metadata.min.json";

/**
 * Clerk SignUp/SignIn/User resources, read duck-typed: Clerk's resource classes
 * differ between the legacy and Signal APIs, and the tests drive these helpers
 * with plain objects. Kept as one documented escape hatch instead of scattered `any`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ClerkResource = any;

export type SignUpMethod = "email" | "phone";
export type VerificationStep = "email" | "phone" | null;

export function normalizeE164Phone(
  raw: string | null | undefined,
  defaultCountry: CountryCode = "TG",
): string {
  const input = (raw ?? "").trim();
  if (!input) return "";
  try {
    const parsed = parsePhoneNumberFromString(input, defaultCountry, phoneMetadata as unknown as MetadataJson);
    return parsed?.isValid() ? parsed.number : "";
  } catch {
    return "";
  }
}

export function extractClerkError(err: unknown, fallback: string): string {
  if (err && typeof err === "object") {
    const clerkErr = err as {
      errors?: Array<{ code?: string; longMessage?: string; message?: string }>;
      message?: string;
    };
    const first = clerkErr.errors?.[0];
    if (typeof first?.longMessage === "string" && first.longMessage.trim()) {
      return first.longMessage.trim();
    }
    if (typeof first?.message === "string" && first.message.trim()) {
      return first.message.trim();
    }
    if (typeof clerkErr.message === "string" && clerkErr.message.trim()) {
      return clerkErr.message.trim();
    }
  }
  return fallback;
}

export function getClerkErrorCode(err: unknown): string {
  if (err && typeof err === "object") {
    const clerkErr = err as {
      errors?: Array<{ code?: string }>;
      code?: string;
    };
    const code = clerkErr.errors?.[0]?.code || clerkErr.code;
    if (typeof code === "string") return code.trim().toLowerCase();
  }
  return "";
}

/**
 * Detects Clerk's "verification_already_verified" / "already been verified"
 * error so repeated button clicks or retries advance instead of failing.
 */
export function isAlreadyVerifiedError(err: unknown): boolean {
  const code = getClerkErrorCode(err);
  if (code === "verification_already_verified" || code === "already_verified") {
    return true;
  }
  const msg = extractClerkError(err, "").toLowerCase();
  return msg.includes("already been verified") || msg.includes("already verified");
}

/**
 * Detects Clerk's "session_exists" / "already signed in" error so the client
 * can immediately sync the active session and redirect to `/dashboard`.
 */
export function isSessionExistsError(err: unknown): boolean {
  const code = getClerkErrorCode(err);
  if (code === "session_exists" || code === "identifier_already_signed_in") {
    return true;
  }
  const msg = extractClerkError(err, "").toLowerCase();
  return msg.includes("already signed in") || msg.includes("session already exists");
}

/**
 * Returns true ONLY when the Clerk SignUp resource is continuing from an
 * external OAuth provider (`externalAccount` verified or transferable).
 * Never returns true for standard email/phone signups.
 */
export function isOAuthContinuation(signUp: ClerkResource): boolean {
  if (!signUp || signUp.status !== "missing_requirements") return false;
  const extStatus = signUp.verifications?.externalAccount?.status;
  return extStatus === "verified" || extStatus === "transferable";
}

export interface SignUpFormInput {
  method: SignUpMethod;
  email: string;
  phone: string;
  password?: string;
  name?: string;
  shopName?: string;
  whatsappNumber?: string;
  currency?: string;
}

/**
 * Builds the `signUp.create()` payload for the chosen authentication method.
 *
 * CRITICAL:
 * - For `method === "email"`, `phoneNumber` is NEVER passed to `signUp.create()`.
 *   Any store `whatsappNumber` is stored only in `unsafeMetadata.whatsappNumber`
 *   so Clerk does not require a second SMS verification factor during email signup.
 * - For `method === "phone"`, `phoneNumber` is normalized to E.164 and `emailAddress`
 *   is omitted unless later requested by Clerk's `missingFields`.
 * - `firstName` / `lastName` are omitted from initial `signUp.create()` because
 *   Clerk instances with `first_name` disabled reject them with `form_param_unknown`;
 *   if a Clerk instance requires them in `missingFields`, `buildAutoFillMissingFieldsPayload`
 *   supplies them automatically.
 */
export function buildSignUpCreatePayload(input: SignUpFormInput): Record<string, unknown> {
  const trimmedName = (input.name ?? "").trim();
  const trimmedShopName = (input.shopName ?? "").trim();
  const formattedWa = normalizeE164Phone(input.whatsappNumber || input.phone);
  const currency = (input.currency ?? "XOF").trim() || "XOF";

  const unsafeMetadata: Record<string, unknown> = {
    role: "seller",
    currency,
  };
  if (trimmedName) unsafeMetadata.name = trimmedName;
  if (trimmedShopName) unsafeMetadata.shopName = trimmedShopName;
  if (formattedWa) unsafeMetadata.whatsappNumber = formattedWa;

  const payload: Record<string, unknown> = {
    unsafeMetadata,
  };

  if (input.method === "phone") {
    const e164Phone = normalizeE164Phone(input.phone || input.whatsappNumber);
    if (e164Phone) payload.phoneNumber = e164Phone;
  } else {
    const trimmedEmail = (input.email ?? "").trim();
    if (trimmedEmail) payload.emailAddress = trimmedEmail;
  }

  if (input.password && input.password.length > 0) {
    payload.password = input.password;
  }

  return payload;
}

/**
 * Builds a `signUp.update()` payload for fields in `signUp.missingFields` that
 * can be satisfied automatically from the form state (e.g. `first_name`,
 * `last_name`, `username`, `password`, `email_address`, `phone_number`).
 */
export function buildAutoFillMissingFieldsPayload(
  signUp: ClerkResource,
  input: Partial<SignUpFormInput>,
): Record<string, unknown> | null {
  const missing: string[] = Array.isArray(signUp?.missingFields) ? signUp.missingFields : [];
  if (missing.length === 0) return null;

  const trimmedName = (input.name ?? "").trim();
  const email = (input.email ?? signUp?.emailAddress ?? "").trim();
  const phone = normalizeE164Phone(input.phone || input.whatsappNumber || signUp?.phoneNumber);
  const update: Record<string, unknown> = {};

  if (missing.includes("first_name")) {
    const first =
      trimmedName.split(/\s+/)[0] ||
      (email ? email.split("@")[0].replace(/[^a-zA-Z0-9]/g, "") : "") ||
      "Merchant";
    update.firstName = first;
  }

  if (missing.includes("last_name")) {
    const parts = trimmedName.split(/\s+/).slice(1).join(" ");
    update.lastName = parts || "Vendor";
  }

  if (missing.includes("username")) {
    const base =
      (email ? email.split("@")[0] : "") ||
      trimmedName ||
      (phone ? `user_${phone.replace(/\D/g, "").slice(-6)}` : "merchant");
    const cleanBase = base.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 16) || "merchant";
    const suffix = Math.floor(1000 + Math.random() * 9000);
    update.username = `${cleanBase}_${suffix}`;
  }

  if (missing.includes("password") && input.password && !signUp?.hasPassword) {
    update.password = input.password;
  }

  if (
    missing.includes("email_address") &&
    email &&
    signUp?.verifications?.emailAddress?.status !== "verified"
  ) {
    update.emailAddress = email;
  }

  if (
    missing.includes("phone_number") &&
    phone &&
    signUp?.verifications?.phoneNumber?.status !== "verified"
  ) {
    update.phoneNumber = phone;
  }

  return Object.keys(update).length > 0 ? update : null;
}

export type NextSignUpAction =
  | { type: "complete"; sessionId: string }
  | { type: "verify_email" }
  | { type: "verify_phone" }
  | { type: "missing_fields"; missingFields: string[] }
  | { type: "additional_verification"; requirements: string[] }
  | { type: "incomplete"; unverifiedFields: string[]; missingFields: string[] };

/**
 * Determines the exact next step for a Clerk `SignUp` resource.
 */
export function determineNextSignUpStep(signUp: ClerkResource): NextSignUpAction {
  if (!signUp) {
    return { type: "incomplete", unverifiedFields: [], missingFields: [] };
  }

  if (signUp.status === "complete" && signUp.createdSessionId) {
    return { type: "complete", sessionId: String(signUp.createdSessionId) };
  }

  const unverified: string[] = Array.isArray(signUp.unverifiedFields)
    ? signUp.unverifiedFields
    : [];
  const missing: string[] = Array.isArray(signUp.missingFields)
    ? signUp.missingFields
    : [];

  const emailVerified = signUp.verifications?.emailAddress?.status === "verified";
  const phoneVerified = signUp.verifications?.phoneNumber?.status === "verified";

  // 1. If email_address is in unverifiedFields (or email-only signup not yet verified)
  const needsEmailVerify =
    !emailVerified &&
    (unverified.includes("email_address") ||
      (Boolean(signUp.emailAddress) && unverified.length === 0 && !signUp.phoneNumber));

  if (needsEmailVerify) {
    return { type: "verify_email" };
  }

  // 2. If phone_number is explicitly in unverifiedFields (or phone-only signup not yet verified)
  const needsPhoneVerify =
    !phoneVerified &&
    (unverified.includes("phone_number") ||
      (Boolean(signUp.phoneNumber) && unverified.length === 0 && !signUp.emailAddress));

  if (needsPhoneVerify) {
    return { type: "verify_phone" };
  }

  // 3. If Clerk requires additional missing fields before completing
  if (missing.length > 0) {
    return { type: "missing_fields", missingFields: missing };
  }

  if (signUp.status === "missing_requirements" || unverified.length > 0) {
    return { type: "additional_verification", requirements: unverified };
  }

  return {
    type: "incomplete",
    unverifiedFields: unverified,
    missingFields: missing,
  };
}

export interface VerifyOtpTransitionResult {
  signUp: ClerkResource;
  action: NextSignUpAction;
  prepareError?: string;
}

/**
 * Executes OTP verification idempotently and advances the Clerk SignUp state:
 * - Never calls `attemptEmailAddressVerification` if `emailAddress` is already verified.
 * - Never calls `attemptPhoneNumberVerification` if `phoneNumber` is already verified.
 * - Gracefully handles Clerk's "already verified" error if triggered by a retry/double-click.
 * - Auto-fills derivable `missingFields` (`first_name`, `last_name`, `username`, etc.).
 * - Prepares the next verification factor if another factor is still required.
 */
export async function verifySignUpOtpAndAdvance(
  signUp: ClerkResource,
  step: "email" | "phone",
  code: string,
  formInput?: Partial<SignUpFormInput>,
): Promise<VerifyOtpTransitionResult> {
  let current = signUp;

  // 1. If already complete, return complete immediately without re-verifying
  if (current?.status === "complete" && current?.createdSessionId) {
    return {
      signUp: current,
      action: { type: "complete", sessionId: String(current.createdSessionId) },
    };
  }

  // 2. Attempt verification only if the current factor is not yet verified
  if (step === "email") {
    const alreadyVerified = current?.verifications?.emailAddress?.status === "verified";
    if (!alreadyVerified) {
      try {
        current = await signUp.attemptEmailAddressVerification({ code });
      } catch (err: unknown) {
        if (!isAlreadyVerifiedError(err)) {
          throw err;
        }
        current = typeof current?.reload === "function" ? await current.reload() : current;
      }
    }
  } else {
    const alreadyVerified = current?.verifications?.phoneNumber?.status === "verified";
    if (!alreadyVerified) {
      try {
        current = await signUp.attemptPhoneNumberVerification({ code });
      } catch (err: unknown) {
        if (!isAlreadyVerifiedError(err)) {
          throw err;
        }
        current = typeof current?.reload === "function" ? await current.reload() : current;
      }
    }
  }

  // 3. If missingFields can be auto-satisfied from form context, update SignUp now
  if (current?.status !== "complete" && formInput && typeof signUp?.update === "function") {
    const autoPayload = buildAutoFillMissingFieldsPayload(current, formInput);
    if (autoPayload) {
      try {
        current = await (current.update ?? signUp.update).call(current, autoPayload);
      } catch {
        // Keep `current` and let determineNextSignUpStep surface any remaining fields
      }
    }
  }

  // 4. Determine the next step after verification
  const action = determineNextSignUpStep(current);

  if (action.type === "verify_email" && step !== "email") {
    try {
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
    } catch (err: unknown) {
      return {
        signUp: current,
        action,
        prepareError: extractClerkError(err, "Impossible d'envoyer le code email."),
      };
    }
  } else if (action.type === "verify_phone" && step !== "phone") {
    try {
      await signUp.preparePhoneNumberVerification({ strategy: "phone_code" });
    } catch (err: unknown) {
      return {
        signUp: current,
        action,
        prepareError: extractClerkError(err, "Impossible d'envoyer le code SMS."),
      };
    }
  }

  return { signUp: current, action };
}

export type SignInOtpAction =
  | { type: "complete"; sessionId: string }
  | { type: "verify_second_factor"; strategy: "email_code" | "phone_code"; factorId: string; target: string }
  | { type: "additional_verification"; requirements: string[] }
  | { type: "incomplete"; status: string };

export async function verifySignInOtpAndAdvance(
  signIn: ClerkResource,
  strategy: "email_code" | "phone_code",
  code: string,
  options: { secondFactor?: boolean } = {},
): Promise<{ signIn: ClerkResource; action: SignInOtpAction }> {
  let current = signIn;

  if (current?.status === "complete" && current?.createdSessionId) {
    return { signIn: current, action: { type: "complete", sessionId: String(current.createdSessionId) } };
  }

  const attempt = options.secondFactor ? current?.attemptSecondFactor : current?.attemptFirstFactor;
  if (typeof attempt !== "function") {
    return {
      signIn: current,
      action: { type: "incomplete", status: String(current?.status ?? "unknown") },
    };
  }

  try {
    current = await attempt.call(current, { strategy, code });
  } catch (err: unknown) {
    if (!isAlreadyVerifiedError(err)) throw err;
    current = typeof current?.reload === "function" ? await current.reload() : current;
  }

  if (current?.status === "complete" && current?.createdSessionId) {
    return { signIn: current, action: { type: "complete", sessionId: String(current.createdSessionId) } };
  }

  if (!options.secondFactor && current?.status === "needs_second_factor") {
    const factors: ClerkResource[] = Array.isArray(current.supportedSecondFactors)
      ? current.supportedSecondFactors
      : [];
    const factor = factors.find(
      (candidate) =>
        candidate.strategy === "email_code" && typeof candidate.emailAddressId === "string",
    ) ?? factors.find(
      (candidate) =>
        candidate.strategy === "phone_code" && typeof candidate.phoneNumberId === "string",
    );

    if (factor) {
      const secondStrategy = factor.strategy as "email_code" | "phone_code";
      const factorId = secondStrategy === "email_code" ? factor.emailAddressId : factor.phoneNumberId;
      const identifierKey = secondStrategy === "email_code" ? "emailAddressId" : "phoneNumberId";
      await current.prepareSecondFactor({ strategy: secondStrategy, [identifierKey]: factorId });
      return {
        signIn: current,
        action: {
          type: "verify_second_factor",
          strategy: secondStrategy,
          factorId,
          target: String(factor.safeIdentifier ?? ""),
        },
      };
    }

    return {
      signIn: current,
      action: {
        type: "additional_verification",
        requirements: factors.map((candidate) => String(candidate.strategy ?? "unknown")),
      },
    };
  }

  const verificationStatus = options.secondFactor
    ? current?.secondFactorVerification?.status
    : current?.firstFactorVerification?.status;
  if (verificationStatus === "verified" || current?.status === "needs_second_factor") {
    return {
      signIn: current,
      action: { type: "additional_verification", requirements: [String(current.status)] },
    };
  }

  return { signIn: current, action: { type: "incomplete", status: String(current?.status ?? "unknown") } };
}

