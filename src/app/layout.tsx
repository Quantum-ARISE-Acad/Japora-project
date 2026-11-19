import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import InstallPrompt from "@/components/InstallPrompt";
import ThemeSync from "@/components/ThemeSync";
import ClerkAuthProvider from "@/components/auth/ClerkAuthProvider";
import { PublicLanguageProvider } from "@/components/PublicLanguageProvider";
import { getPublicLocale } from "@/lib/public-locale";


// Body / UI face — Inter, with the tabular-figure feature used by the ledger.
// Self-hosted variable woff2, latin subset (Seth's version, SIL OFL licenses in ./fonts):
// no network at build time. Characters outside the subset fall back to the system font.
const inter = localFont({
  src: "./fonts/Inter-Variable.woff2",
  weight: "100 900",
  style: "normal",
  variable: "--font-sans",
  display: "swap",
});

// Modern display face — Plus Jakarta Sans for crisp, contemporary headings.
const jakarta = localFont({
  src: "./fonts/PlusJakartaSans-Variable.woff2",
  weight: "200 800",
  style: "normal",
  variable: "--font-display",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getPublicLocale();
  return {
    title:
      locale === "fr"
        ? "Japora — Vendez sur WhatsApp. Encaissez. Développez votre activité."
        : "Japora — Sell on WhatsApp. Get paid. Grow your hustle.",
    description:
      locale === "fr"
        ? "Votre boutique WhatsApp, simplement gérée. Un bot répond aux questions de prix, T-Money et Flooz encaissent en ligne, et vous recevez un résumé chaque soir."
        : "Your WhatsApp shop, quietly handled. A bot answers price-checks. T-Money and Flooz settle inline. A summary lands every evening.",
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      title: "Japora",
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAFAF9" },
    { media: "(prefers-color-scheme: dark)", color: "#1A1714" },
  ],
};

// No-FOUC theme bootstrap: set the .dark class before paint from the persisted
// choice (cookie/localStorage) or the system preference. Inlined so it runs
// before first paint and never flashes the wrong theme.
const themeScript = `(function(){try{var t=localStorage.getItem('japora-theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}if(t==='dark'){document.documentElement.classList.add('dark');}}catch(e){}})();`;

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getPublicLocale();

  return (
    <html lang={locale} suppressHydrationWarning className={`${inter.variable} ${jakarta.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen font-sans antialiased">
        <ClerkAuthProvider>
          <PublicLanguageProvider initialLocale={locale}>
            <ThemeSync />
            {children}
            <InstallPrompt />
          </PublicLanguageProvider>
        </ClerkAuthProvider>
      </body>

    </html>
  );
}
