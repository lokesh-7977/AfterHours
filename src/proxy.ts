import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Optimistic redirect only: checks that a session cookie exists so signed-out
 * visitors land on the right login page. Real authorization happens on the
 * server for every page, action and API call.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = Boolean(getSessionCookie(request, { cookiePrefix: "afterhours" }));
  if (hasSession || pathname === "/admin/login") return NextResponse.next();

  if (pathname.startsWith("/admin")) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }
  const url = new URL("/login", request.url);
  url.searchParams.set("next", pathname + search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin/:path*", "/dashboard/:path*", "/my-events/:path*", "/my-passes/:path*", "/my-gallery/:path*", "/profile/:path*"],
};
