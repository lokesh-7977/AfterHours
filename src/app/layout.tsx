import type { Metadata, Viewport } from "next";
import { Geist, Instrument_Serif, Kalam } from "next/font/google";
import Script from "next/script";
import { ANNOUNCEMENT, ANNOUNCEMENT_STORAGE_KEY, SITE } from "@/config/site";
import { siteUrl } from "@/lib/site-url";
import "./globals.css";

/** Interface and body text: a slim, neutral grotesk. */
const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

/** Headlines: an editorial serif; its italic carries the coloured accent phrases. */
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

/** Handwritten notes (an Indian Type Foundry face), used sparingly as annotations. */
const kalam = Kalam({
  variable: "--font-kalam",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  // Relative OG/canonical URLs resolve against the deployment's own origin.
  metadataBase: new URL(siteUrl()),
  title: { default: SITE.title, template: "%s · AfterHours" },
  description: SITE.description,
  applicationName: SITE.name,
  creator: SITE.name,
  publisher: SITE.name,
  category: "events",
  formatDetection: { telephone: false, email: false, address: false },
  openGraph: {
    type: "website",
    siteName: SITE.name,
    locale: "en_IN",
    title: SITE.title,
    description: SITE.description,
    images: [{ url: "/images/hyd/house-party.jpg", width: 1600, height: 1067, alt: "Friends dancing with their hands up at a house party" }],
  },
  twitter: { card: "summary_large_image", title: SITE.title, description: SITE.description, images: ["/images/hyd/house-party.jpg"] },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f4f2" },
    { media: "(prefers-color-scheme: dark)", color: "#151413" },
  ],
};

/**
 * Runs before first paint: applies a saved theme, hides an already-dismissed announcement
 * (no layout shift), and flags motion so GSAP intros start hidden (no flash).
 */
const THEME_SCRIPT = `try{var d=document.documentElement,t=localStorage.getItem("theme");if(t==="light"||t==="dark")d.dataset.theme=t;if(localStorage.getItem(${JSON.stringify(ANNOUNCEMENT_STORAGE_KEY)})===${JSON.stringify(ANNOUNCEMENT?.id ?? "")})d.classList.add("ann-dismissed")}catch(e){}if(!matchMedia("(prefers-reduced-motion: reduce)").matches)document.documentElement.classList.add("motion")`;

/** Section layouts add their own chrome via PublicShell (announcement, navbar, footer). */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${geist.variable} ${instrumentSerif.variable} ${kalam.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <Script id="theme-script" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
