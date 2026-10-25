import Link from "next/link";
import { PublicShell } from "@/components/public-shell";
import { FancyTitle } from "@/components/ui";
import { LottieSticker } from "@/components/motion/lottie-sticker";

/** Unmatched URLs render outside the route groups, so this brings its own chrome. */
export default function NotFound() {
  return (
    <PublicShell>
      <div className="container-page max-w-lg py-24 text-center">
        <LottieSticker src="/lottie/robot-dance.json" className="mx-auto h-40 w-40" />
        <p className="hand mb-2 -rotate-2 text-2xl text-[var(--fest-pink-text)]">404, wrong address. The robot is still dancing though.</p>
        <FancyTitle>Lost the party?</FancyTitle>
        <p className="muted mt-3">This page doesn&apos;t exist or you don&apos;t have access to it.</p>
        <Link href="/" className="btn btn-primary mt-6">Back to home</Link>
      </div>
    </PublicShell>
  );
}
