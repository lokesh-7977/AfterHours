import type { ReactNode } from "react";
import { PublicShell } from "@/components/public-shell";

// Temporary: top-header chrome until the sidebar AppShell replaces it.
export default function Layout({ children }: { children: ReactNode }) {
  return <PublicShell>{children}</PublicShell>;
}
