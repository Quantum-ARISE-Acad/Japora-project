import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import InstallPrompt from "@/components/InstallPrompt";
import ThemeSync from "@/components/ThemeSync";
import ClerkAuthProvider from "@/components/auth/ClerkAuthProvider";
import { PublicLanguageProvider } from "@/components/PublicLanguageProvider";


// Fonts are self-hosted (src/app/fonts, variable woff2, latin subset) so the
// build never depends on reaching Google Fonts — a failed fetch there breaks
// `next build` on Vercel.

// Body / UI face — Inter, with the tabular-figure feature used by the ledger.
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

export const metadata: Metadata = {
  title: "Japora — Sell on WhatsApp. Get paid. Grow your hustle.",
  description:
    "Your WhatsApp shop, quietly handled. A bot answers price-checks. T-Money and Flooz settle inline. A summary lands every evening.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Japora",
  },
};

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${jakarta.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen font-sans antialiased">
        <ClerkAuthProvider>
          <PublicLanguageProvider>
            <ThemeSync />
            {children}
            <InstallPrompt />
          </PublicLanguageProvider>
        </ClerkAuthProvider>
      </body>

    </html>
  );
}
