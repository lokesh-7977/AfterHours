import type { Metadata } from "next";
import { SITE } from "@/config/site";
import { siteUrl } from "@/lib/site-url";
import { MotionRoot } from "@/components/motion/motion-root";
import { HeroSection } from "@/components/home/hero-section";
import { ExperienceMarquee } from "@/components/home/experience-marquee";
import { VibeReel } from "@/components/home/vibe-reel";
import { EventCategories } from "@/components/home/event-categories";
import { WhyAfterHours } from "@/components/home/why-afterhours";
import { HowItWorks } from "@/components/home/how-it-works";
import { MomentsMosaic } from "@/components/home/moments-mosaic";
import { AboutSection } from "@/components/home/about-section";
import { SafetySection } from "@/components/home/safety-section";
import { FaqSection } from "@/components/home/faq-section";
import { FinalCta } from "@/components/home/final-cta";

export const metadata: Metadata = {
  title: { absolute: SITE.title },
  description: SITE.description,
  keywords: ["AfterHours", "Hyderabad events", "house parties Hyderabad", "board game nights", "blind dates", "DJ nights", "dance classes", "open mics", "things to do in Hyderabad"],
  alternates: { canonical: "/" },
  openGraph: { url: "/", title: SITE.title, description: SITE.description, locale: "en_IN" },
  robots: { index: true, follow: true },
};

/** Factual structured data only: who AfterHours is and where the site lives. */
function JsonLd() {
  const url = siteUrl();
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", "@id": `${url}/#org`, name: SITE.name, url, logo: `${url}/icon.svg`, areaServed: { "@type": "City", name: "Hyderabad" } },
      { "@type": "WebSite", "@id": `${url}/#website`, name: SITE.name, url, description: SITE.description, publisher: { "@id": `${url}/#org` }, inLanguage: "en-IN" },
    ],
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

/**
 * Marketing home: fully static (no event data, no session, no API calls), so it prerenders and
 * paints instantly. Live events are on /events. All motion is driven by MotionRoot (GSAP).
 */
export default function HomePage() {
  return (
    <MotionRoot>
      <JsonLd />
      <HeroSection />
      <ExperienceMarquee />
      <VibeReel />
      <EventCategories />
      <WhyAfterHours />
      <HowItWorks />
      <MomentsMosaic />
      <AboutSection />
      <SafetySection />
      <FaqSection />
      <FinalCta />
    </MotionRoot>
  );
}
