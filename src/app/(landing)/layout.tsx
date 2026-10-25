import type { ReactNode } from "react";
import { PublicShell } from "@/components/public-shell";

/** Marketing landing page: static chrome only (no session, no database), so "/" prerenders fully. */
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <PublicShell announcement session={false}>
      {children}
    </PublicShell>
  );
}
