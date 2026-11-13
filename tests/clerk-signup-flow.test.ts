import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeE164Phone,
  isAlreadyVerifiedError,
  isSessionExistsError,
  isOAuthContinuation,
  buildSignUpCreatePayload,
  buildAutoFillMissingFieldsPayload,
  determineNextSignUpStep,
  verifySignUpOtpAndAdvance,
  verifySignInOtpAndAdvance,
} from "../src/lib/clerk-signup-flow";
import { getStoreSetupStatus } from "../src/lib/onboarding";

describe("Clerk SignUp Flow & State-Transition Regression Tests", () => {
  test("buildSignUpCreatePayload never passes phoneNumber to Clerk during email signup even if whatsappNumber is present", () => {
    const payload = buildSignUpCreatePayload({
      method: "email",
      email: "merchant@example.com",
      phone: "",
      password: "Password123!",
      name: "Amina Diallo",
      shopName: "Amina Mode",
      whatsappNumber: "+22890123456",
      currency: "XOF",
    });

    assert.equal(payload.emailAddress, "merchant@example.com");
    assert.equal(payload.password, "Password123!");
    assert.equal(payload.phoneNumber, undefined);
    assert.equal(payload.firstName, undefined);
    assert.equal(payload.lastName, undefined);
    assert.deepEqual(payload.unsafeMetadata, {
      role: "seller",
      currency: "XOF",
      name: "Amina Diallo",
      shopName: "Amina Mode",
      whatsappNumber: "+22890123456",
    });
  });

  test("buildSignUpCreatePayload normalizes phoneNumber to E.164 and omits emailAddress during phone signup", () => {
    const payload = buildSignUpCreatePayload({
      method: "phone",
      email: "",
      phone: "90 12 34 56",
      password: "Password123!",
      name: "Koffi",
    });

    assert.equal(payload.phoneNumber, "+22890123456");
    assert.equal(payload.emailAddress, undefined);
    assert.equal(
      (payload.unsafeMetadata as Record<string, unknown>).whatsappNumber,
      "+22890123456",
    );
  });

  test("isOAuthContinuation returns false for normal email/phone signups and true only for verified/transferable externalAccount", () => {
    const emailSignUp = {
      status: "missing_requirements",
      emailAddress: "merchant@example.com",
      unverifiedFields: ["email_address"],
      verifications: {
        emailAddress: { status: "unverified" },
        externalAccount: { status: null },
      },
    };
    assert.equal(isOAuthContinuation(emailSignUp), false);

    const oauthSignUp = {
      status: "missing_requirements",
      emailAddress: "merchant@gmail.com",
      verifications: {
        externalAccount: { status: "verified" },
      },
    };
    assert.equal(isOAuthContinuation(oauthSignUp), true);
  });

  test("verifySignUpOtpAndAdvance completes cleanly on first email OTP verification when Clerk status becomes complete", async () => {
    let calls = 0;
    const signUp = {
      status: "missing_requirements",
      emailAddress: "merchant@example.com",
      unverifiedFields: ["email_address"],
      missingFields: [],
      verifications: {
        emailAddress: { status: "unverified" },
      },
      attemptEmailAddressVerification: async ({ code }: { code: string }) => {
        calls++;
        assert.equal(code, "123456");
        return {
          status: "complete",
          createdSessionId: "sess_abc123",
          unverifiedFields: [],
          missingFields: [],
          verifications: {
            emailAddress: { status: "verified" },
          },
        };
      },
    };

    const result = await verifySignUpOtpAndAdvance(signUp, "email", "123456");

    assert.equal(calls, 1);
    assert.deepEqual(result.action, {
      type: "complete",
      sessionId: "sess_abc123",
    });
  });

  test("verifySignUpOtpAndAdvance does NOT call attemptEmailAddressVerification a second time if email is already verified", async () => {
    let attemptCalls = 0;
    let updatedPayload: Record<string, unknown> | null = null;

    const signUpAlreadyVerifiedEmail = {
      status: "missing_requirements",
      emailAddress: "merchant@example.com",
      unverifiedFields: [],
      missingFields: ["first_name", "last_name"],
      verifications: {
        emailAddress: { status: "verified" },
      },
      attemptEmailAddressVerification: async () => {
        attemptCalls++;
        throw new Error("Should not be called when already verified");
      },
      update: async (payload: Record<string, unknown>) => {
        updatedPayload = payload;
        return {
          status: "complete",
          createdSessionId: "sess_completed_after_update",
          unverifiedFields: [],
          missingFields: [],
          verifications: {
            emailAddress: { status: "verified" },
          },
        };
      },
    };

    const result = await verifySignUpOtpAndAdvance(
      signUpAlreadyVerifiedEmail,
      "email",
      "123456",
      { name: "Amina Diallo", email: "merchant@example.com" },
    );

    assert.equal(attemptCalls, 0);
    assert.deepEqual(updatedPayload, {
      firstName: "Amina",
      lastName: "Diallo",
    });
    assert.deepEqual(result.action, {
      type: "complete",
      sessionId: "sess_completed_after_update",
    });
  });

  test("verifySignUpOtpAndAdvance recovers gracefully if Clerk throws 'Verification has already been verified' on retry click", async () => {
    const alreadyVerifiedClerkError = {
      errors: [
        {
          code: "verification_already_verified",
          message: "already verified",
          longMessage: "Verification has already been verified.",
        },
      ],
    };

    const signUp = {
      status: "complete",
      createdSessionId: "sess_recovered_123",
      verifications: {
        emailAddress: { status: "unverified" },
      },
      attemptEmailAddressVerification: async () => {
        throw alreadyVerifiedClerkError;
      },
    };

    const result = await verifySignUpOtpAndAdvance(signUp, "email", "123456");
    assert.deepEqual(result.action, {
      type: "complete",
      sessionId: "sess_recovered_123",
    });
  });

  test("country-aware phone parsing defaults local Togo input to +228 and validates international E.164", () => {
    assert.equal(normalizeE164Phone("90 12 34 56", "TG"), "+22890123456");
    assert.equal(normalizeE164Phone("+228 90 12 34 56", "US"), "+22890123456");
    assert.equal(normalizeE164Phone("not a phone", "TG"), "");
    assert.equal(normalizeE164Phone("90 12 34", "TG"), "");
  });

  test("sign-in OTP advances to a second verification factor rather than reporting a failed code", async () => {
    let prepared = false;
    const signIn = {
      status: "needs_first_factor",
      attemptFirstFactor: async () => ({
        status: "needs_second_factor",
        supportedSecondFactors: [{
          strategy: "phone_code",
          phoneNumberId: "phone_factor_1",
          safeIdentifier: "+228******56",
        }],
        prepareSecondFactor: async ({ phoneNumberId }: { phoneNumberId: string }) => {
          assert.equal(phoneNumberId, "phone_factor_1");
          prepared = true;
        },
      }),
    };

    const result = await verifySignInOtpAndAdvance(signIn, "email_code", "123456");
    assert.equal(prepared, true);
    assert.deepEqual(result.action, {
      type: "verify_second_factor",
      strategy: "phone_code",
      factorId: "phone_factor_1",
      target: "+228******56",
    });
  });

  test("already-verified sign-in OTP reloads the latest Clerk state without resubmitting the code", async () => {
    let attempts = 0;
    const latest = { status: "complete", createdSessionId: "sess_after_reload" };
    const signIn = {
      status: "needs_first_factor",
      attemptFirstFactor: async () => {
        attempts++;
        throw { errors: [{ code: "verification_already_verified" }] };
      },
      reload: async () => latest,
    };

    const result = await verifySignInOtpAndAdvance(signIn, "email_code", "123456");
    assert.equal(attempts, 1);
    assert.deepEqual(result.action, { type: "complete", sessionId: "sess_after_reload" });
  });

  test("signup keeps explicit additional Clerk requirements instead of asking for another OTP", () => {
    assert.deepEqual(
      determineNextSignUpStep({
        status: "missing_requirements",
        unverifiedFields: [],
        missingFields: [],
        verifications: { emailAddress: { status: "verified" } },
      }),
      { type: "additional_verification", requirements: [] },
    );
  });

  test("verifySignUpOtpAndAdvance transitions to verify_phone only when phone_number is genuinely in unverifiedFields", async () => {
    let preparedPhoneStrategy = "";
    const preparePhoneNumberVerification = async ({ strategy }: { strategy: string }) => {
      preparedPhoneStrategy = strategy;
      return {};
    };

    const signUp = {
      status: "missing_requirements",
      unverifiedFields: ["email_address", "phone_number"],
      missingFields: [],
      verifications: {
        emailAddress: { status: "unverified" },
        phoneNumber: { status: "unverified" },
      },
      attemptEmailAddressVerification: async () => ({
        status: "missing_requirements",
        unverifiedFields: ["phone_number"],
        missingFields: [],
        verifications: {
          emailAddress: { status: "verified" },
          phoneNumber: { status: "unverified" },
        },
        preparePhoneNumberVerification,
      }),
      preparePhoneNumberVerification,
    };

    const result = await verifySignUpOtpAndAdvance(signUp, "email", "654321");

    assert.deepEqual(result.action, { type: "verify_phone" });
    assert.equal(preparedPhoneStrategy, "phone_code");
  });

  test("error classifiers, E.164 normalization, and auto-fill missing fields work accurately", () => {
    assert.equal(
      isAlreadyVerifiedError({
        errors: [{ code: "verification_already_verified", message: "Already verified" }],
      }),
      true,
    );
    assert.equal(
      isAlreadyVerifiedError(new Error("Verification has already been verified.")),
      true,
    );
    assert.equal(
      isSessionExistsError({
        errors: [{ code: "session_exists", message: "You're already signed in" }],
      }),
      true,
    );
    assert.equal(normalizeE164Phone("228 90-12-34-56"), "+22890123456");

    assert.deepEqual(
      determineNextSignUpStep({
        status: "complete",
        createdSessionId: "sess_1",
      }),
      { type: "complete", sessionId: "sess_1" },
    );

    const payload = buildAutoFillMissingFieldsPayload(
      {
        missingFields: ["first_name", "last_name", "username"],
        emailAddress: "amina@japora.com",
      },
      { name: "Amina", email: "amina@japora.com" },
    );

    assert.equal(payload?.firstName, "Amina");
    assert.equal(payload?.lastName, "Vendor");
    assert.match(String(payload?.username), /^amina_\d{4}$/);
  });

  test("treats newly provisioned Vendor defaults ('My Shop' and sandbox '15556449932') as incomplete Store Setup", () => {
    const status = getStoreSetupStatus({
      shopName: "My Shop",
      whatsappNumber: "15556449932",
      region: "",
      category: "",
    });

    assert.equal(status.complete, false);
    assert.deepEqual(status.missingFields, [
      "shopName",
      "whatsappNumber",
      "region",
      "category",
    ]);
  });
});
