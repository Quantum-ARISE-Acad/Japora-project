"use client";

import Link from "next/link";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";
import { usePublicLang } from "@/components/PublicLanguageProvider";

export default function PrivacyPage() {
  const { tr } = usePublicLang();

  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12">
        <div className="glass glass-edge rounded-shape-xl p-6 sm:p-10">
          <header className="border-b border-arctic-200/70 pb-6">
            <span className="a-eyebrow">
              {tr("Protection des Données", "Data Protection")}
            </span>
            <h1 className="a-display-sm mt-1 text-arctic-900">
              {tr("Politique de Confidentialité", "Privacy Policy")}
            </h1>
            <p className="mt-1 text-xs text-arctic-600">
              {tr(
                "Dernière mise à jour : Novembre 2026",
                "Last updated: November 2026"
              )}
            </p>
          </header>

          <div className="mt-6 space-y-6 text-arctic-700">
            <Notice>
              {tr(
                "Chez Japora, la confidentialité des données de vos clients et de votre commerce est une priorité absolue. Vous restez propriétaire de votre fichier client.",
                "At Japora, the privacy of your customers' and business data is a top priority. You retain full ownership of your customer records."
              )}
            </Notice>

            <Section title={tr("Qui sommes-nous ?", "Who We Are")}>
              <p>
                {tr(
                  "Japora est une plateforme permettant aux commerçants (« Vendeurs ») de partager leurs catalogues produits, d'automatiser leurs discussions et de gérer les commandes reçues sur WhatsApp.",
                  "Japora is a platform enabling merchants ('Sellers') to share their product catalogs, automate chats, and manage orders received on WhatsApp."
                )}
              </p>
            </Section>

            <Section title={tr("Données collectées", "Data We Collect")}>
              <ul className="ml-5 list-disc space-y-1.5 text-xs sm:text-sm">
                <li>
                  <strong>{tr("Données de compte :", "Account data:")}</strong>{" "}
                  {tr(
                    "email, mot de passe haché (bcrypt), nom de boutique, devise, numéro WhatsApp.",
                    "email, hashed password (bcrypt), shop name, currency, WhatsApp number."
                  )}
                </li>
                <li>
                  <strong>
                    {tr("Données catalogue :", "Catalog data:")}
                  </strong>{" "}
                  {tr(
                    "photos, titres, prix, descriptions, tailles et stocks que vous mettez en ligne.",
                    "photos, titles, prices, descriptions, sizes, and stock levels you publish."
                  )}
                </li>
                <li>
                  <strong>
                    {tr(
                      "Données de commandes & CRM :",
                      "Order & CRM data:"
                    )}
                  </strong>{" "}
                  {tr(
                    "nom du client, numéro de téléphone, articles commandés, consentement marketing explicite et historique.",
                    "customer name, phone number, ordered items, explicit marketing consent, and history."
                  )}
                </li>
                <li>
                  <strong>
                    {tr("Journaux techniques :", "Technical logs:")}
                  </strong>{" "}
                  {tr(
                    "adresse IP (uniquement pour la protection anti-abus et le rate-limiting).",
                    "IP address (strictly for anti-abuse protection and rate-limiting)."
                  )}
                </li>
              </ul>
            </Section>

            <Section
              title={tr("Pourquoi nous les collectons", "Why We Collect It")}
            >
              <ul className="ml-5 list-disc space-y-1.5 text-xs sm:text-sm">
                <li>
                  {tr(
                    "Pour afficher votre vitrine en ligne et traiter vos commandes.",
                    "To display your online storefront and process your orders."
                  )}
                </li>
                <li>
                  {tr(
                    "Pour authentifier votre session en toute sécurité.",
                    "To authenticate your session securely."
                  )}
                </li>
                <li>
                  {tr(
                    "Pour envoyer vos notifications de commandes et le bilan quotidien de 18h.",
                    "To send your order notifications and the 6 PM daily digest."
                  )}
                </li>
                <li>
                  {tr(
                    "Pour prévenir la fraude et respecter le consentement marketing des clients.",
                    "To prevent fraud and honor customer marketing consent."
                  )}
                </li>
              </ul>
            </Section>

            <Section
              title={tr(
                "Sous-traitants et partenaires techniques",
                "Subprocessors and Technical Partners"
              )}
            >
              <p>
                {tr(
                  "Vos données ne sont partagées qu'avec les infrastructures strictement nécessaires au service : hébergement sécurisé, base de données PostgreSQL, stockage d'images (S3/R2), API officielle WhatsApp Cloud et passerelles de paiement Mobile Money (PayGate Global, CinetPay, Flutterwave, Paystack, M-Pesa). ",
                  "Your data is shared only with infrastructure strictly necessary for the service: secure hosting, PostgreSQL database, image storage (S3/R2), official WhatsApp Cloud API, and Mobile Money payment gateways (PayGate Global, CinetPay, Flutterwave, Paystack, M-Pesa). "
                )}
                <strong>
                  {tr(
                    "Nous ne vendons jamais vos données personnelles.",
                    "We never sell your personal data."
                  )}
                </strong>
              </p>
            </Section>

            <Section
              title={tr(
                "Vos droits (Export & Suppression)",
                "Your Rights (Export & Deletion)"
              )}
            >
              <ul className="ml-5 list-disc space-y-1.5 text-xs sm:text-sm">
                <li>
                  <strong>{tr("Exporter", "Export")}</strong>{" "}
                  {tr(
                    "l'intégralité de vos données au format JSON ou CSV depuis ",
                    "all of your data in JSON or CSV format from "
                  )}
                  <Link
                    href="/dashboard/settings"
                    className="font-semibold text-brand-dark underline"
                  >
                    {tr("vos paramètres", "your settings")}
                  </Link>
                  .
                </li>
                <li>
                  <strong>{tr("Supprimer", "Delete")}</strong>{" "}
                  {tr(
                    "votre compte et vos données depuis la même page.",
                    "your account and data from the same page."
                  )}
                </li>
                <li>
                  <strong>{tr("Modifier", "Update")}</strong>{" "}
                  {tr(
                    "vos informations et préférences de consentement à tout moment.",
                    "your information and consent preferences at any time."
                  )}
                </li>
              </ul>
            </Section>

            <Section
              title={tr("Sécurité & Contact", "Security & Contact")}
            >
              <p>
                {tr(
                  "Les mots de passe sont chiffrés avec bcrypt, les sessions utilisent des jetons JWT signés en cookies HTTP-only et toutes les connexions sont chiffrées en HTTPS. Pour toute question relative à la sécurité ou à vos données : ",
                  "Passwords are encrypted with bcrypt, sessions use signed JWT tokens in HTTP-only cookies, and all connections are encrypted over HTTPS. For any security or data inquiry: "
                )}
                <a
                  className="font-semibold text-brand-dark underline"
                  href="mailto:security@japora.app"
                >
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
