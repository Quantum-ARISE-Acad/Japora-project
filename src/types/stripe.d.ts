// Minimal ambient declaration for the Stripe SDK so the build doesn't
// require the package to be installed. Real types arrive when you run
// `pnpm add stripe` — at that point this shim is shadowed by the real
// package types.
declare module "stripe" {
  namespace Stripe {
    interface Checkout {
      sessions: { create: (params: unknown) => Promise<{ id: string; url: string | null }> };
    }
    interface BillingPortal {
      sessions: { create: (params: unknown) => Promise<{ url: string }> };
    }
    interface Customers {
      create: (params: unknown) => Promise<{ id: string }>;
    }
    interface Subscriptions {
      retrieve: (id: string) => Promise<unknown>;
    }
    interface Webhooks {
      constructEvent: (payload: string | Buffer, signature: string, secret: string) => { type: string; data: { object: unknown } };
    }
  }
  class Stripe {
    constructor(apiKey: string, options?: { apiVersion?: string });
    checkout: Stripe.Checkout;
    billingPortal: Stripe.BillingPortal;
    customers: Stripe.Customers;
    subscriptions: Stripe.Subscriptions;
    webhooks: Stripe.Webhooks;
  }
  export = Stripe;
}
