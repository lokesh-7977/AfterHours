import Image from "next/image";
import { Hi, Marker, SectionHeader } from "./section-header";

/**
 * Hyderabad moments in equal 4:3 tiles. Each photo is shown whole (never cropped) over a
 * blurred copy of itself that fills the tile. Captions name moods, not specific events.
 */
const MOMENTS = [
  { src: "/images/hyd/charminar.jpg", alt: "The Charminar against a blue sky", caption: "Old City evenings", color: "var(--fest-pink-text)" },
  { src: "/images/hyd/hyderabad-night.jpg", alt: "Hyderabad city lights reflected on the water at night", caption: "City lights", color: "var(--fest-peacock-text)" },
  { src: "/images/hyd/dj-woman.jpg", alt: "A woman playing a DJ set at night", caption: "Late-night sets", color: "var(--accent-text)" },
  { src: "/images/hyd/rooftop.jpg", alt: "Friends celebrating at a rooftop party", caption: "Rooftop sundowners", color: "var(--fest-saffron-text)" },
  { src: "/images/hyd/holi-crowd.jpg", alt: "A crowd throwing colour into the air at Holi", caption: "Holi bashes", color: "var(--fest-marigold-text)" },
  { src: "/images/hyd/party-cheer.jpg", alt: "Friends cheering together at a party", caption: "House parties", color: "var(--fest-pink-text)" },
] as const;

export function MomentsMosaic() {
  return (
    <section aria-labelledby="moments-title" className="section overflow-hidden bg-[var(--color-card)]">
      <div className="container-page">
        <SectionHeader
          id="moments-title"
          title={
            <>
              Moments worth <Marker tone="marigold">gathering</Marker> for.
            </>
          }
          lede={
            <>
              <Hi tone="pink">Old City evenings</Hi>, <Hi tone="saffron">rooftop sunsets</Hi> and <Hi tone="indigo">dance floors that go late</Hi>. This is the Hyderabad
              AfterHours experiences are built around.
            </>
          }
        />
        <ul data-stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
          {MOMENTS.map((m) => (
            <li key={m.src} className="group relative aspect-[4/3] overflow-hidden rounded-[1.5rem] bg-[var(--color-surface)]">
              <Image src={m.src} alt="" aria-hidden fill sizes="(min-width: 1024px) 20vw, 40vw" className="scale-110 object-cover blur-2xl saturate-150" />
              <Image
                src={m.src}
                alt={m.alt}
                fill
                sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                className="object-contain transition-transform duration-700 group-hover:scale-[1.03]"
              />
              <span className={`hand absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[var(--color-card)] px-3 py-0.5 text-lg shadow-md`} style={{ color: m.color }}>
                {m.caption}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
