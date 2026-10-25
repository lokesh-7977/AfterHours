import type { ReactNode } from "react";
import { PageTransition } from "@/components/motion/page-transition";

/** Re-mounts on every navigation, so each page plays its entrance. */
export default function Template({ children }: { children: ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
