import { Suspense, type ReactNode } from "react";
import { Navbar, NavbarFallback, StaticNavbar } from "./layout/navbar";
import { Footer } from "./layout/footer";

/**
 * Chrome for every section: navbar (+ announcement on public pages) and footer.
 * `session={false}` (the marketing landing page) renders a static guest navbar with no
 * server lookups at all, so the page can be fully prerendered.
 */
export function PublicShell({ children, announcement = false, session = true }: { children: ReactNode; announcement?: boolean; session?: boolean }) {
  return (
    <div className="flex min-h-screen flex-col">
      {session ? (
        <Suspense fallback={<NavbarFallback />}>
          <Navbar announcement={announcement} />
        </Suspense>
      ) : (
        <StaticNavbar />
      )}
      <main id="main" className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
