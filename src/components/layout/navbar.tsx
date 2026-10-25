import { connection } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { getSessionUser } from "@/lib/auth-guards";
import { isAdminRole } from "@/modules/auth/roles";
import { unreadNotificationCount } from "@/modules/notifications/notification.service";
import { logger } from "@/lib/logger";
import { ANNOUNCEMENT } from "@/config/site";
import { AfterHoursLogo } from "@/components/branding/afterhours-logo";
import { AnnouncementBar } from "./announcement-bar";
import { AccountActions, DesktopNav, MobileMenu, type NavAccount } from "./nav-menu";

function HeaderFrame({ children }: { children?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--color-line)] bg-[color-mix(in_srgb,var(--color-canvas)_85%,transparent)] backdrop-blur-md">
      <div className="container-page relative flex h-16 items-center justify-between gap-4 md:h-[4.5rem]">
        <AfterHoursLogo />
        {children}
      </div>
    </header>
  );
}

export function NavbarFallback() {
  return <HeaderFrame />;
}

async function loadAccount(): Promise<NavAccount> {
  // Navigation must keep rendering if the session store is unreachable: degrade to signed-out.
  const user = await getSessionUser().catch((err) => {
    unstable_rethrow(err); // prerender/dynamic signals are framework control flow, not failures
    logger.error("header.session_failed", { err });
    return null;
  });
  if (!user) return { kind: "guest" };
  if (isAdminRole(user.role)) return { kind: "admin" };
  const unread = await unreadNotificationCount(user.id).catch((err) => {
    unstable_rethrow(err);
    return 0;
  });
  return { kind: "participant", firstName: user.name.split(" ")[0] ?? user.name, unread };
}

/** Reads the session, so it streams behind PublicShell's Suspense boundary. */
export async function Navbar({ announcement }: { announcement: boolean }) {
  // Request-time only: the session (and any failure logging) must never run during prerender.
  await connection();
  const account = await loadAccount();
  return (
    <>
      {announcement && ANNOUNCEMENT ? <AnnouncementBar {...ANNOUNCEMENT} /> : null}
      <HeaderFrame>
        <DesktopNav />
        <AccountActions account={account} />
        <MobileMenu account={account} />
      </HeaderFrame>
    </>
  );
}

/**
 * Fully static navbar for the marketing landing page: no session lookup, no database, no
 * request data, so the page prerenders and paints instantly. Visitors get the guest actions.
 */
export function StaticNavbar() {
  const guest: NavAccount = { kind: "guest" };
  return (
    <>
      {ANNOUNCEMENT ? <AnnouncementBar {...ANNOUNCEMENT} /> : null}
      <HeaderFrame>
        <DesktopNav />
        <AccountActions account={guest} />
        <MobileMenu account={guest} />
      </HeaderFrame>
    </>
  );
}
