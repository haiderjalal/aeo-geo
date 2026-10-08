import type { Metadata } from "next";
import { Bricolage_Grotesque, Instrument_Sans, IBM_Plex_Mono } from "next/font/google";
import { BRAND } from "@/lib/brand";
import "./globals.css";

/** Display voice: mechanical, slightly awkward, set huge and tight. */
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["600", "800"],
});

/** Body voice: contemporary grotesque, quiet enough to let the display lead. */
const instrument = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
});

/** Protocol voice: URLs, headers, status codes, anything a machine wrote. */
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const TITLE = `${BRAND.name} — ${BRAND.tagline}`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: BRAND.description,
  alternates: { canonical: "/" },
  openGraph: { title: TITLE, description: BRAND.description, url: "/", type: "website" },
  twitter: { card: "summary_large_image", title: TITLE, description: BRAND.description },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${bricolage.variable} ${instrument.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {children}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: BRAND.name,
              url: SITE_URL,
              applicationCategory: "DeveloperApplication",
              description: BRAND.description,
              offers: [
                { "@type": "Offer", name: "First page scan per browser", price: "0", priceCurrency: "USD" },
                { "@type": "Offer", name: "Additional AEO and GEO scan with WhatsApp report", price: "10", priceCurrency: "USD" },
              ],
            }),
          }}
        />
      </body>
    </html>
  );
}
