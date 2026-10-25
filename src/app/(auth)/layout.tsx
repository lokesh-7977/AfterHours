import type { ReactNode } from "react";
import { PublicShell } from "@/components/public-shell";

/** Static chrome (no session or database lookup), same as the landing page, so these pages paint instantly. */
export default function Layout({ children }: { children: ReactNode }) {
  return <PublicShell session={false}>{children}</PublicShell>;
}
