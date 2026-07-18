import type { Metadata } from "next";
import "@fontsource/poppins/500.css";
import "@fontsource/poppins/600.css";
import "@fontsource/poppins/700.css";
import "@fontsource/poppins/800.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "./globals.css";

const siteUrl = "https://www.pharmacieplus.cm";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Pharmacie+ — Le logiciel de gestion pour pharmacies en zone CEMAC",
    template: "%s — Pharmacie+",
  },
  description:
    "Pharmacie+ est le SaaS de gestion d'officine pensé pour l'Afrique Centrale : stock en temps réel, ordonnances sécurisées, paiement Mobile Money, dashboard complet. Installable comme une application, même sur connexion instable.",
  keywords: [
    "logiciel gestion pharmacie",
    "logiciel pharmacie Cameroun",
    "SaaS pharmacie CEMAC",
    "gestion stock pharmacie",
    "mobile money pharmacie",
    "ordonnance en ligne Cameroun",
    "pharmacie en ligne Afrique Centrale",
  ],
  authors: [{ name: "Pharmacie+" }],
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: siteUrl,
    siteName: "Pharmacie+",
    title: "Pharmacie+ — Le logiciel de gestion pour pharmacies en zone CEMAC",
    description:
      "Stock en temps réel, ordonnances sécurisées, paiement Mobile Money : le SaaS de gestion d'officine conçu pour l'Afrique Centrale.",
    images: [
      {
        url: "/branding/logo-card-green.png",
        width: 900,
        height: 900,
        alt: "Pharmacie+",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Pharmacie+ — Le logiciel de gestion pour pharmacies en zone CEMAC",
    description:
      "Stock en temps réel, ordonnances sécurisées, paiement Mobile Money : le SaaS de gestion d'officine conçu pour l'Afrique Centrale.",
    images: ["/branding/logo-card-green.png"],
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/icons/apple-touch-icon.png",
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: siteUrl,
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: "Pharmacie+",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Android, iOS, Web (PWA)",
      description:
        "SaaS multi-tenant de gestion de pharmacie pour la zone CEMAC : stock en temps réel, ordonnances sécurisées, paiement Mobile Money, dashboard, PWA installable.",
      url: siteUrl,
      image: siteUrl + "/branding/logo-card-green.png",
      offers: {
        "@type": "Offer",
        priceCurrency: "XAF",
        availability: "https://schema.org/InStock",
      },
    },
    {
      "@type": "Organization",
      name: "Pharmacie+",
      url: siteUrl,
      logo: siteUrl + "/branding/logo-full.png",
      areaServed: {
        "@type": "AdministrativeArea",
        name: "Zone CEMAC",
      },
    },
  ],
};

const themeInitScript = `
(function() {
  try {
    var stored = localStorage.getItem('pharmacieplus-theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var dark = stored ? stored === 'dark' : prefersDark;
    if (dark) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const umamiWebsiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;

  return (
    <html lang="fr" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {umamiWebsiteId && (
          <script
            defer
            src="https://cloud.umami.is/script.js"
            data-website-id={umamiWebsiteId}
          />
        )}
      </head>
      <body className="min-h-full flex flex-col bg-white text-[var(--color-ink)] font-sans">
        {children}
      </body>
    </html>
  );
}
