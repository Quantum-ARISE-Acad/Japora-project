import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { finalizeClerkAuthentication } from "../src/lib/clerk-auth-finalize";

describe("shared Clerk authentication finalization", () => {
  test("activates the Clerk session, verifies sync success, then redirects", async () => {
    const events: string[] = [];
    const router = {
      replace: (url: string) => events.push(`redirect:${url}`),
      refresh: () => events.push("refresh"),
    };
    const result = await finalizeClerkAuthentication({
      sessionId: "sess_signup_1",
      setActive: async ({ session }) => events.push(`activate:${session}`),
      fetcher: async () => {
        events.push("sync");
        return new Response(JSON.stringify({ ok: true, vendorId: "vendor_1" }), { status: 200 });
      },
      router,
      retryDelayMs: 0,
    });

    assert.deepEqual(events, ["activate:sess_signup_1", "sync", "redirect:/dashboard", "refresh"]);
    assert.deepEqual(result, { ok: true, vendorId: "vendor_1", shopSlug: undefined });
  });

  test("does not redirect when clerk-sync fails and exposes the server error", async () => {
    let redirected = false;
    await assert.rejects(
      finalizeClerkAuthentication({
        sessionId: "sess_2",
        setActive: async () => undefined,
        fetcher: async () => new Response(JSON.stringify({ error: "Vendor sync unavailable" }), { status: 500 }),
        router: {
          replace: () => { redirected = true; },
          refresh: () => { redirected = true; },
        },
        retryDelayMs: 0,
      }),
      /Vendor sync unavailable/,
    );
    assert.equal(redirected, false);
  });

  test("finalizes an already active session without starting another Clerk authentication attempt", async () => {
    let syncCalls = 0;
    let activationCalls = 0;
    let destination = "";
    await finalizeClerkAuthentication({
      fetcher: async () => {
        syncCalls++;
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      },
      setActive: async () => { activationCalls++; },
      router: {
        replace: (url: string) => { destination = url; },
        refresh: () => undefined,
      },
      retryDelayMs: 0,
    });

    assert.equal(syncCalls, 1);
    assert.equal(activationCalls, 0);
    assert.equal(destination, "/dashboard");
  });

  test("uses the same finalization sequence for Google OAuth callback sessions", async () => {
    const events: string[] = [];
    await finalizeClerkAuthentication({
      fetcher: async () => {
        events.push("sync-google-user");
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      },
      router: {
        replace: (url: string) => events.push(`redirect:${url}`),
        refresh: () => undefined,
      },
      retryDelayMs: 0,
    });
    assert.deepEqual(events, ["sync-google-user", "redirect:/dashboard"]);
  });
});
