import Link from "next/link";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";

export const metadata = { title: "Politique de Confidentialité (Privacy Policy) — Japora" };

export default function PrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />

      <main className="mx-auto max-w-4xl flex-1 px-4 py-12 w-full">
        <div className="glass glass-edge rounded-shape-xl p-6 sm:p-10">
          <header className="border-b border-arctic-200/70 pb-6">
            <span className="a-eyebrow">Protection des Données</span>
            <h1 className="a-display-sm mt-1 text-arctic-900">
              Politique de Confidentialité (Privacy Policy)
            </h1>
            <p className="mt-1 text-xs text-arctic-500">
              Dernière mise à jour : Novembre 2026
            </p>
          </header>

          <div className="mt-6 space-y-6 text-arctic-700">
            <Notice>
              Chez Japora, la confidentialité des données de vos clients et de votre commerce est une priorité absolue. Vous restez propriétaire de votre fichier client.
            </Notice>

            <Section title="Qui sommes-nous ?">
              <p>
                Japora est une plateforme permettant aux commerçants (« Vendeurs ») de partager leurs catalogues produits, d&apos;automatiser leurs discussions et de gérer les commandes reçues sur WhatsApp.
              </p>
            </Section>

            <Section title="Données collectées">
              <ul className="ml-5 list-disc space-y-1.5 text-xs sm:text-sm">
                <li>
                  <strong>Données de compte :</strong> email, mot de passe haché (bcrypt), nom de boutique, devise, numéro WhatsApp.
                </li>
                <li>
                  <strong>Données catalogue :</strong> photos, titres, prix, descriptions, tailles et stocks que vous mettez en ligne.
                </li>
                <li>
                  <strong>Données de commandes &amp; CRM :</strong> nom du client, numéro de téléphone, articles commandés, consentement marketing explicite et historique.
                </li>
                <li>
                  <strong>Journaux techniques :</strong> adresse IP (uniquement pour la protection anti-abus et le rate-limiting).
                </li>
              </ul>
            </Section>

            <Section title="Pourquoi nous les collectons">
              <ul className="ml-5 list-disc space-y-1.5 text-xs sm:text-sm">
                <li>Pour afficher votre vitrine en ligne et traiter vos commandes.</li>
                <li>Pour authentifier votre session en toute sécurité.</li>
                <li>Pour envoyer vos notifications de commandes et le bilan quotidien de 18h.</li>
                <li>Pour prévenir la fraude et respecter le consentement marketing des clients.</li>
              </ul>
            </Section>

            <Section title="Sous-traitants et partenaires techniques">
              <p>
                Vos données ne sont partagées qu&apos;avec les infrastructures strictement nécessaires au service : hébergement sécurisé, base de données PostgreSQL, stockage d&apos;images (S3/R2), API officielle WhatsApp Cloud et passerelles de paiement Mobile Money (PayGate Global, CinetPay, Flutterwave, Paystack, M-Pesa).{" "}
                <strong>Nous ne vendons jamais vos données personnelles.</strong>
              </p>
            </Section>

            <Section title="Vos droits (Export & Suppression)">
              <ul className="ml-5 list-disc space-y-1.5 text-xs sm:text-sm">
                <li>
                  <strong>Exporter</strong> l&apos;intégralité de vos données au format JSON ou CSV depuis{" "}
                  <Link href="/dashboard/settings" className="font-semibold text-brand-dark underline">
                    vos paramètres
                  </Link>
                  .
                </li>
                <li>
                  <strong>Supprimer</strong> votre compte et vos données depuis la même page.
                </li>
                <li>
                  <strong>Modifier</strong> vos informations et préférences de consentement à tout moment.
                </li>
              </ul>
            </Section>

            <Section title="Sécurité & Contact">
              <p>
                Les mots de passe sont chiffrés avec bcrypt, les sessions utilisent des jetons JWT signés en cookies HTTP-only et toutes les connexions sont chiffrées en HTTPS. Pour toute question relative à la sécurité ou à vos données :{" "}
                <a className="font-semibold text-brand-dark underline" href="mailto:security@japora.app">
                  security@japora.app
                </a>
                .
              </p>
            </Section>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-1.5 font-display text-base font-bold text-arctic-900">
        {title}
      </h2>
      <div className="space-y-2 text-xs sm:text-sm leading-relaxed">{children}</div>
    </section>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-shape-lg border border-amber-300/70 bg-amber-50 p-4 text-xs sm:text-sm text-amber-900">
      {children}
    </div>
  );
}
