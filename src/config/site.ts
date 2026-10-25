/** Brand copy and navigation shared by the public chrome and metadata. */
export const SITE = {
  name: "AfterHours",
  title: "AfterHours — Discover Events, Meet People, Make Memories",
  description:
    "Discover upcoming AfterHours events, explore new experiences, and find opportunities to connect with people who share your interests.",
  tagline: "Discover experiences. Meet people. Make memories.",
} as const;

/**
 * Announcement shown above the navbar on public pages. Change `id` when the message
 * changes so people who dismissed the previous one see the new one. Set to null to hide.
 */
export const ANNOUNCEMENT: { id: string; message: string; href: string } | null = {
  id: "welcome-2026",
  message: "Your next great experience starts here. Join AfterHours in Hyderabad.",
  href: "/register",
};
export const ANNOUNCEMENT_STORAGE_KEY = "afterhours-announcement-dismissed";

/** In-page sections only: the landing page links out to nothing but log in and sign up. */
export const MAIN_NAV = [
  { label: "Discover", href: "/#discover" },
  { label: "How it works", href: "/#how-it-works" },
  { label: "About", href: "/#about" },
  { label: "FAQ", href: "/#faq" },
] as const;

export type FestivalTone = "marigold" | "pink" | "peacock" | "saffron" | "indigo";

/** Browse-by-experience tiles on the landing page (showcase cards, not links). */
export const EXPERIENCES: { label: string; blurb: string; image: string; alt: string; tone: FestivalTone; icon: "party" | "dice" | "heart" | "music" | "dance" | "mic" }[] = [
  { label: "House Parties", blurb: "Good music, better people, someone's living room", image: "/images/hyd/house-party.jpg", alt: "Friends dancing with their hands up at a house party", tone: "pink", icon: "party" },
  { label: "Board Game Nights", blurb: "Ludo, Catan, cards and friendly trash talk", image: "/images/hyd/card-night.jpg", alt: "Friends playing cards around a table with snacks", tone: "marigold", icon: "dice" },
  { label: "Blind Dates", blurb: "Coffee, a conversation and a little nerve", image: "/images/hyd/coffee-date.jpg", alt: "Two people talking over coffee at an outdoor cafe", tone: "saffron", icon: "heart" },
  { label: "DJ & Music Nights", blurb: "Sets, gigs and late nights across the city", image: "/images/hyd/dj-night.jpg", alt: "A DJ playing to a crowd under purple stage lights", tone: "indigo", icon: "music" },
  { label: "Dance Floors & Classes", blurb: "Bollywood, salsa, hip-hop or just freestyle", image: "/images/hyd/dance-class.jpg", alt: "A group dance class mid-move in a bright studio", tone: "peacock", icon: "dance" },
  { label: "Open Mics", blurb: "Songs, poetry and stand-up from new voices", image: "/images/hyd/open-mic.jpg", alt: "Three musicians playing live in a cosy venue", tone: "pink", icon: "mic" },
];

/** Background / foreground pairs for each festival tone. `text` is safe for coloured words. */
export const TONE_STYLES: Record<FestivalTone, { soft: string; solid: string; onSolid: string; text: string }> = {
  marigold: { soft: "var(--fest-marigold-soft)", solid: "var(--fest-marigold)", onSolid: "#171717", text: "var(--fest-marigold-text)" },
  pink: { soft: "var(--fest-pink-soft)", solid: "var(--fest-pink)", onSolid: "#ffffff", text: "var(--fest-pink-text)" },
  peacock: { soft: "var(--fest-peacock-soft)", solid: "var(--fest-peacock)", onSolid: "#ffffff", text: "var(--fest-peacock-text)" },
  saffron: { soft: "var(--fest-saffron-soft)", solid: "var(--fest-saffron)", onSolid: "#171717", text: "var(--fest-saffron-text)" },
  indigo: { soft: "var(--color-accent-soft)", solid: "var(--color-primary)", onSolid: "#ffffff", text: "var(--accent-text)" },
};
