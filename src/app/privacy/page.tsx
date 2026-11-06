import Link from "next/link";

export const metadata = { title: "Privacy Policy — Japora" };

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-arctic-600 hover:text-brand-dark">
        ← Back to Japora
      </Link>

      <article className="space-y-6 text-arctic-700">
        <header>
          <h1 className="text-3xl font-extrabold text-arctic-900">Privacy Policy</h1>
          <p className="text-sm text-arctic-500">Last updated: today</p>
        </header>

        <Notice>
          This is a template. Adapt it to your jurisdiction (GDPR / CCPA / etc.) and have a lawyer
          review before launching publicly.
        </Notice>

        <Section title="Who we are">
          <p>
            Japora is a tool for businesses (&ldquo;Vendors&rdquo;) to share product catalogs and
            manage orders received via WhatsApp. This policy explains what data we handle and why.
          </p>
        </Section>

        <Section title="What we collect">
          <ul className="ml-5 list-disc space-y-1 text-sm">
            <li><strong>Account data:</strong> your email, hashed password, shop name, currency, WhatsApp number.</li>
            <li><strong>Product data:</strong> photos, names, prices, descriptions, sizes, stock levels you upload.</li>
            <li><strong>Order data:</strong> customer name, phone number, order items, notes, status timestamps.</li>
            <li><strong>Communication logs:</strong> emails we send you, WhatsApp messages sent via our integration.</li>
            <li><strong>Technical data:</strong> IP address (for rate-limiting + abuse prevention), basic request logs.</li>
          </ul>
        </Section>

        <Section title="Why we collect it">
          <ul className="ml-5 list-disc space-y-1 text-sm">
            <li>To run the service (display catalogs, process orders).</li>
            <li>To authenticate you and keep your account secure.</li>
            <li>To send transactional emails (verification, password reset, order alerts).</li>
            <li>To prevent abuse (rate-limit logs).</li>
            <li>To comply with legal obligations.</li>
          </ul>
        </Section>

        <Section title="Who we share data with">
          <p>Only with the processors needed to run the service:</p>
          <ul className="ml-5 list-disc space-y-1 text-sm">
            <li><strong>Hosting</strong> (e.g. Vercel/Railway/your chosen host).</li>
            <li><strong>Postgres database</strong> (Supabase / Neon / Railway / self-hosted).</li>
            <li><strong>Email delivery</strong> (Resend, when configured).</li>
            <li><strong>Object storage</strong> (Cloudflare R2 / AWS S3 / Supabase Storage, when configured).</li>
            <li><strong>WhatsApp</strong> (Meta Cloud API, when configured for outbound messages).</li>
            <li><strong>Payments</strong> (Stripe, when subscribed). We never see your full card details.</li>
          </ul>
          <p>We don&apos;t sell personal data.</p>
        </Section>

        <Section title="Your rights">
          <p>You can:</p>
          <ul className="ml-5 list-disc space-y-1 text-sm">
            <li><strong>Export</strong> all your data as JSON from <Link href="/dashboard/settings" className="font-semibold text-brand-dark underline">your settings</Link>.</li>
            <li><strong>Delete</strong> your account and associated data from the same page.</li>
            <li><strong>Correct</strong> any of your details directly in the dashboard.</li>
            <li><strong>Object</strong> to specific processing — email us.</li>
          </ul>
          <p>If you&apos;re in the EU/UK, you also have the right to lodge a complaint with your local data protection authority.</p>
        </Section>

        <Section title="Retention">
          <p>We keep account data for as long as your account is active. After deletion we retain a soft-deleted tombstone (so we can honour disputes and tax obligations) for up to 12 months, then hard-delete unless legally required to retain longer.</p>
        </Section>

        <Section title="Security">
          <p>Passwords are hashed with bcrypt. Sessions use signed cookies. Connections to our service are over HTTPS. We rate-limit sensitive endpoints. No system is perfect — report security issues to <a className="font-semibold text-brand-dark underline" href="mailto:security@japora.app">security@japora.app</a>.</p>
        </Section>

        <Section title="Contact">
          <p>Email <a className="font-semibold text-brand-dark underline" href="mailto:hello@japora.app">hello@japora.app</a>.</p>
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
