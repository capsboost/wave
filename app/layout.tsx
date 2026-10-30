import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Outfit, JetBrains_Mono } from "next/font/google";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { AuthModal } from "@/components/auth/AuthModal";
import { AnalyticsTracker } from "@/components/layout/AnalyticsTracker";
import { ProgressSyncProvider } from "@/components/providers/ProgressSyncProvider";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-sans",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-body",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#020204",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://waveanime.me";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "WAVE ANIME | Watch Anime Online Free in HD (English Sub & Dub)",
    template: "%s | Wave Anime",
  },
  description:
    "Stream thousands of anime series and movies online free in high definition. Watch English Subbed and Dubbed anime without intrusive ads. The premier alternative to Aniwave, HiAnime, and Animepahe.",
  keywords: [
    "watch anime online free",
    "anime streaming",
    "english subbed anime",
    "english dubbed anime",
    "aniwave alternative",
    "hianime alternative",
    "animepahe",
    "9anime",
    "reanime",
    "animekai",
    "hd anime episodes",
    "simulcast anime",
    "anime release schedule",
    "free anime online",
  ],
  authors: [{ name: "Wave Anime" }],
  creator: "Wave Anime",
  publisher: "Wave Anime",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "Wave Anime",
    title: "WAVE ANIME | Watch Anime Online Free in HD",
    description:
      "Next-generation anime streaming platform with English Sub & Dub, real-time release schedules, and zero intrusive ads.",
    images: [
      {
        url: `${siteUrl}/logo.svg`,
        width: 360,
        height: 80,
        alt: "Wave Anime",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "WAVE ANIME | Watch Anime Online Free in HD",
    description:
      "Stream anime in HD with English Sub & Dub. Fast, beautiful, and ad-free.",
    images: [`${siteUrl}/logo.svg`],
    creator: "@waveanime",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Wave Anime",
  url: siteUrl,
  description:
    "Stream anime online free in HD with English subtitles and dubbing. Fast, ad-free alternative to Aniwave, HiAnime, and Animepahe.",
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${siteUrl}/search?q={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`dark ${spaceGrotesk.variable} ${outfit.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
      </head>
      <body className="min-h-dvh flex flex-col font-body bg-background text-foreground">
        <QueryProvider>
          <Navbar />
          <AuthModal />
          <AnalyticsTracker />
          <ProgressSyncProvider />
          <main className="flex-1">{children}</main>
          <Footer />
        </QueryProvider>
      </body>
    </html>
  );
}
