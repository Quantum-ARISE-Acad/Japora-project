import Link from "next/link";

export const metadata = { title: "Terms of Service — Japora" };

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-arctic-600 hover:text-brand-dark">
        ← Back to Japora
      </Link>

      <article className="prose-content space-y-6 text-arctic-700">
        <header>
          <h1 className="text-3xl font-extrabold text-arctic-900">Terms of Service</h1>
          <p className="text-sm text-arctic-500">Last updated: today</p>
        </header>

        <Notice>
          This template covers the essentials but is <strong>not legal advice</strong>. Have a
          lawyer review before you take payment from real users.
        </Notice>

        <Section title="1. The deal">
          <p>
            Japora (&ldquo;we&rdquo;, &ldquo;us&rdquo;) provides a hosted catalog + order
            management tool for businesses that sell via WhatsApp. By creating an account
            (&ldquo;Account&rdquo;) you agree to these terms.
          </p>
        </Section>

        <Section title="2. Your account">
          <p>You must be at least 18 and provide accurate information. You&apos;re responsible for everything that happens under your account, including keeping your password safe and your contact info current.</p>
        </Section>

        <Section title="3. What you sell">
          <p>You — not Japora — sell the products listed in your catalog. You&apos;re responsible for the legality, accuracy, quality, safety, and lawful sale of your goods or services. You agree not to use Japora for anything illegal, infringing, hateful, or otherwise prohibited.</p>
        </Section>

        <Section title="4. Subscription, trial, and payment">
          <p>New accounts get a free trial; details are shown at checkout. After the trial you&apos;ll be billed at the rate displayed when you subscribed, until you cancel. You can cancel any time in the billing portal — cancellations stop the next charge but don&apos;t refund the current period.</p>
        </Section>

        <Section title="5. Acceptable use">
          <p>Don&apos;t abuse the service: no spamming, no scraping, no attempting to break our systems, no impersonation, no malware, no circumventing rate limits.</p>
        </Section>

        <Section title="6. Your content">
          <p>You keep ownership of the content you upload (product photos, descriptions, customer data). You grant us a limited licence to host and display it solely so we can run the service for you. We don&apos;t sell your data.</p>
        </Section>

        <Section title="7. Privacy">
          <p>
            Our processing of personal data is described in our{" "}
            <Link href="/privacy" className="font-semibold text-brand-dark underline">Privacy Policy</Link>.
          </p>
        </Section>

        <Section title="8. Termination">
          <p>You can delete your account any time from your dashboard. We can suspend or terminate accounts that violate these terms or pose a security or legal risk.</p>
        </Section>

        <Section title="9. Warranty disclaimer">
          <p>The service is provided &ldquo;as is&rdquo; without warranties. We aim for high uptime but can&apos;t promise the service will be uninterrupted, error-free, or perfectly secure.</p>
        </Section>

        <Section title="10. Liability">
          <p>To the maximum extent allowed by law, our total liability for any claim is limited to the amount you paid us in the 12 months before the claim.</p>
        </Section>

        <Section title="11. Changes">
          <p>We may update these terms; meaningful changes will be announced by email and in-app. Continuing to use Japora after a change means you accept the new terms.</p>
        </Section>

        <Section title="12. Contact">
          <p>Questions? Email <a className="font-semibold text-brand-dark underline" href="mailto:hello@japora.app">hello@japora.app</a>.</p>
        </Section>
      </article>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-lg font-bold text-arctic-900">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed">{children}</div>
    </section>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      {children}
    </div>
  );
}
