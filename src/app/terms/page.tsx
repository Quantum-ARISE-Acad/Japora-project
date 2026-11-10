import Link from "next/link";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";

export const metadata = { title: "Conditions d'utilisation (Terms of Service) — Japora" };

export default function TermsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />

      <main className="mx-auto max-w-4xl flex-1 px-4 py-12 w-full">
        <div className="glass glass-edge rounded-shape-xl p-6 sm:p-10">
          <header className="border-b border-arctic-200/70 pb-6">
            <span className="a-eyebrow">Informations Légales</span>
            <h1 className="a-display-sm mt-1 text-arctic-900">
              Conditions Générales d&apos;Utilisation (Terms of Service)
            </h1>
            <p className="mt-1 text-xs text-arctic-500">
              Dernière mise à jour : Novembre 2026
            </p>
          </header>

          <div className="mt-6 space-y-6 text-arctic-700">
            <Notice>
              Ce document définit les règles d&apos;utilisation de la plateforme Japora pour les marchands et acheteurs mais ne constitue pas un conseil juridique personnalisé.
            </Notice>

            <Section title="1. Objet du service (The deal)">
              <p>
                Japora (« nous ») fournit une solution hébergée de catalogue en ligne, d&apos;automatisation WhatsApp et de gestion de commandes pour les commerçants qui vendent via WhatsApp. En créant un compte (« Compte »), vous acceptez les présentes conditions.
              </p>
            </Section>

            <Section title="2. Votre compte marchand (Your account)">
              <p>
                Vous devez avoir au moins 18 ans et fournir des informations exactes (numéro WhatsApp, nom de boutique, coordonnées). Vous êtes responsable de la sécurité de vos identifiants et de l&apos;activité exercée depuis votre boutique.
              </p>
            </Section>

            <Section title="3. Produits et ventes (What you sell)">
              <p>
                Vous — et non Japora — êtes le vendeur des articles référencés dans votre catalogue. Vous êtes responsable de la légalité, de la qualité, de la conformité et de la livraison des biens ou services proposés. Toute vente de produits illicites ou contrefaits est strictement interdite.
              </p>
            </Section>

            <Section title="4. Tarification, commissions et paiements">
              <p>
                Le mode Starter est gratuit. Pour les commandes encaissées via les rails de paiement intégrés de Japora (mode Pay-as-you-sell), une commission transparente de 3% (gratuite sous 2 000 FCFA et plafonnée à 1 000 FCFA par commande) s&apos;applique conformément à la page{" "}
                <Link href="/pricing" className="font-semibold text-brand-dark underline">
                  Tarifs
                </Link>
                .
              </p>
            </Section>

            <Section title="5. Utilisation acceptable (Acceptable use)">
              <p>
                Il est interdit d&apos;utiliser la plateforme pour l&apos;envoi de spam sur WhatsApp, l&apos;usurpation d&apos;identité, l&apos;extraction automatisée de données ou le contournement des limites de sécurité.
              </p>
            </Section>

            <Section title="6. Propriété de vos contenus">
              <p>
                Vous conservez l&apos;entière propriété de vos photos produits, descriptions et fichiers clients. Vous nous accordez uniquement le droit d&apos;héberger et d&apos;afficher ces éléments pour assurer le fonctionnement de votre boutique. Nous ne revendons jamais vos données.
              </p>
            </Section>

            <Section title="7. Protection des données (Privacy)">
              <p>
                Le traitement de vos données personnelles est détaillé dans notre{" "}
                <Link href="/privacy" className="font-semibold text-brand-dark underline">
                  Politique de Confidentialité
                </Link>
                .
              </p>
            </Section>

            <Section title="8. Résiliation et suppression">
              <p>
                Vous pouvez exporter vos données et supprimer votre compte à tout moment depuis les paramètres de votre tableau de bord. Nous pouvons suspendre tout compte ne respectant pas les présentes conditions.
              </p>
            </Section>

            <Section title="9. Contact">
              <p>
                Une question ? Contactez notre équipe à{" "}
                <a className="font-semibold text-brand-dark underline" href="mailto:hello@japora.app">
                  hello@japora.app
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
