import Link from "next/link";
import { LogIn, UserPlus } from "lucide-react";
import { AfterHoursIcon } from "@/components/branding/afterhours-icon";
import { ConfettiLink } from "@/components/motion/confetti-link";
import { LottieSticker } from "@/components/motion/lottie-sticker";

const GLOWS = [
  { c: "var(--fest-pink)", s: "18rem", l: "-6%", t: "-30%" },
  { c: "var(--fest-marigold)", s: "14rem", l: "62%", t: "55%" },
  { c: "var(--color-primary)", s: "20rem", l: "78%", t: "-35%" },
  { c: "var(--fest-peacock)", s: "12rem", l: "30%", t: "70%" },
] as const;

export function FinalCta() {
  return (
    <section aria-labelledby="cta-title" className="section pt-14 md:pt-20">
      <div className="container-page">
        <div data-reveal className="relative isolate overflow-hidden rounded-[2rem] bg-[var(--color-dark-section)] px-5 py-12 sm:px-12 sm:py-16 text-[#f5f4f2] sm:px-12 md:py-24">
          {GLOWS.map((g, i) => (
            <span key={i} data-float aria-hidden className="absolute -z-10 rounded-full opacity-35 blur-3xl" style={{ background: g.c, width: g.s, height: g.s, left: g.l, top: g.t }} />
          ))}
          <AfterHoursIcon variant="mono" className="pointer-events-none absolute -bottom-24 -left-20 -z-10 h-80 w-80 text-white/[0.05] md:h-[28rem] md:w-[28rem]" />
          <LottieSticker src="/lottie/gift.json" className="absolute right-6 top-6 hidden h-20 w-20 lg:block" />
          <div className="relative mx-auto flex max-w-2xl flex-col items-center text-center md:mx-0 md:items-start md:text-left">
            <p className="hand -rotate-2 text-2xl text-[var(--fest-marigold)]">see you there?</p>
            <h2 id="cta-title" data-split className="display mt-2 text-[clamp(2.1rem,1.5rem+2.8vw,3.75rem)]">
              Your next great <span className="text-festival accent">story</span> starts here.
            </h2>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-[#d4d1cc]">Discover experiences, meet new people, and make the most of your time with AfterHours.</p>
            <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <ConfettiLink prefetch={false} href="/register" className="btn btn-primary btn-lg">
                <UserPlus aria-hidden className="h-4 w-4" />
                Create an Account
              </ConfettiLink>
              <Link prefetch={false} href="/login" className="btn btn-lg border-white/25 bg-transparent text-[#f5f4f2] hover:border-white hover:bg-white/5">
                <LogIn aria-hidden className="h-4 w-4" />
                Log in
              </Link>
            </div>
          </div>
          {/* Phones: centred under the buttons. Desktop: dancing beside the copy. */}
          <LottieSticker src="/lottie/robot-dance.json" className="mx-auto mt-6 h-40 w-40 md:mx-0 lg:absolute lg:right-16 lg:top-1/2 lg:mt-0 lg:h-72 lg:w-72 lg:-translate-y-1/2" />
        </div>
      </div>
    </section>
  );
}
