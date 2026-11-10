"use client";

import Link from "next/link";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";
import { usePublicLang } from "@/components/PublicLanguageProvider";

export default function TermsPage() {
  const { tr } = usePublicLang();

  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />

      <main className="mx-auto max-w-4xl flex-1 px-4 py-12 w-full">
        <div className="glass glass-edge rounded-shape-xl p-6 sm:p-10">
          <header className="border-b border-arctic-200/70 pb-6">
            <span className="a-eyebrow">
              {tr("Informations Légales", "Legal Information")}
            </span>
            <h1 className="a-display-sm mt-1 text-arctic-900">
              {tr(
                "Conditions Générales d'Utilisation",
                "Terms of Service"
              )}
            </h1>
            <p className="mt-1 text-xs text-arctic-500">
              {tr(
                "Dernière mise à jour : Novembre 2026",
                "Last updated: November 2026"
              )}
            </p>
          </header>

          <div className="mt-6 space-y-6 text-arctic-700">
            <Notice>
              {tr(
                "Ce document définit les règles d'utilisation de la plateforme Japora pour les marchands et acheteurs mais ne constitue pas un conseil juridique personnalisé.",
                "This document defines the rules for using the Japora platform for merchants and buyers and does not constitute personalized legal advice."
              )}
            </Notice>

            <Section
              title={tr("1. Objet du service", "1. Purpose of the Service")}
            >
              <p>
                {tr(
                  "Japora (« nous ») fournit une solution hébergée de catalogue en ligne, d'automatisation WhatsApp et de gestion de commandes pour les commerçants qui vendent via WhatsApp. En créant un compte (« Compte »), vous acceptez les présentes conditions.",
                  "Japora ('we') provides a hosted online catalog, WhatsApp automation, and order management solution for merchants selling via WhatsApp. By creating an account ('Account'), you agree to these terms."
                )}
              </p>
            </Section>

            <Section
              title={tr("2. Votre compte marchand", "2. Your Merchant Account")}
            >
              <p>
                {tr(
                  "Vous devez avoir au moins 18 ans et fournir des informations exactes (numéro WhatsApp, nom de boutique, coordonnées). Vous êtes responsable de la sécurité de vos identifiants et de l'activité exercée depuis votre boutique.",
                  "You must be at least 18 years old and provide accurate information (WhatsApp number, shop name, contact details). You are responsible for keeping your credentials secure and for all activity under your shop."
                )}
              </p>
            </Section>

            <Section
              title={tr("3. Produits et ventes", "3. Products and Sales")}
            >
              <p>
                {tr(
                  "Vous — et non Japora — êtes le vendeur des articles référencés dans votre catalogue. Vous êtes responsable de la légalité, de la qualité, de la conformité et de la livraison des biens ou services proposés. Toute vente de produits illicites ou contrefaits est strictement interdite.",
                  "You — and not Japora — are the seller of the items listed in your catalog. You are responsible for the legality, quality, compliance, and delivery of the goods or services offered. Selling illegal or counterfeit goods is strictly prohibited."
                )}
              </p>
            </Section>

            <Section
              title={tr(
                "4. Paiements et transactions",
                "4. Payments and Transactions"
              )}
            >
              <p>
                {tr(
                  "Japora facilite la création de commandes et les encaissements via WhatsApp et les solutions Mobile Money locales (T-Money, Flooz, Wave, Orange Money, MTN MoMo, M-Pesa).",
                  "Japora facilitates order creation and collections via WhatsApp and local Mobile Money rails (T-Money, Flooz, Wave, Orange Money, MTN MoMo, M-Pesa)."
                )}
              </p>
            </Section>

            <Section
              title={tr("5. Utilisation acceptable", "5. Acceptable Use")}
            >
              <p>
                {tr(
                  "Il est interdit d'utiliser la plateforme pour l'envoi de spam sur WhatsApp, l'usurpation d'identité, l'extraction automatisée de données ou le contournement des limites de sécurité.",
                  "Using the platform to send spam on WhatsApp, impersonate others, scrape data automatically, or bypass security limits is strictly prohibited."
                )}
              </p>
            </Section>

            <Section
              title={tr("6. Propriété de vos contenus", "6. Ownership of Your Content")}
            >
              <p>
                {tr(
                  "Vous conservez l'entière propriété de vos photos produits, descriptions et fichiers clients. Vous nous accordez uniquement le droit d'héberger et d'afficher ces éléments pour assurer le fonctionnement de votre boutique. Nous ne revendons jamais vos données.",
                  "You retain full ownership of your product photos, descriptions, and customer lists. You grant us only the right to host and display these items to operate your storefront. We never sell your data."
                )}
              </p>
            </Section>

            <Section
              title={tr("7. Protection des données", "7. Data Protection")}
            >
              <p>
                {tr(
                  "Le traitement de vos données personnelles est détaillé dans notre ",
                  "How we process your personal data is detailed in our "
                )}
                <Link
                  href="/privacy"
                  className="font-semibold text-brand-dark underline"
                >
                  {tr("Politique de Confidentialité", "Privacy Policy")}
                </Link>
                .
              </p>
            </Section>

            <Section
              title={tr(
                "8. Résiliation et suppression",
                "8. Termination and Deletion"
              )}
            >
              <p>
                {tr(
                  "Vous pouvez exporter vos données et supprimer votre compte à tout moment depuis les paramètres de votre tableau de bord. Nous pouvons suspendre tout compte ne respectant pas les présentes conditions.",
                  "You can export your data and delete your account at any time from your dashboard settings. We may suspend any account that violates these terms."
                )}
              </p>
            </Section>

            <Section title={tr("9. Contact", "9. Contact")}>
              <p>
                {tr(
                  "Une question ? Contactez notre équipe à ",
                  "Have a question? Contact our team at "
                )}
                <a
                  className="font-semibold text-brand-dark underline"
                  href="mailto:hello@japora.app"
                >
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

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-1.5 font-display text-base font-bold text-arctic-900">
        {title}
      </h2>
      <div className="space-y-2 text-xs sm:text-sm leading-relaxed">
        {children}
      </div>
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
