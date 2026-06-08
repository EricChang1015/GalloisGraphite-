import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

/**
 * Edge proxy (formerly known as Next.js "middleware").
 *
 * Route guards:
 *  - `/(app)/*`   needs an authenticated user
 *  - `/admin/*`   needs role = admin or super_admin
 *  - `/(auth)/*`  redirects to /dashboard if already authenticated
 *
 * Authoritative authorization still relies on Supabase RLS — this proxy is
 * for UX (redirects).
 */
export async function proxy(request: NextRequest) {
  const { response, user, supabase } = await updateSession(request);
  const { pathname } = request.nextUrl;

  // Pages that should redirect already-authed users away to /dashboard.
  // /reset-password is intentionally EXCLUDED — recovery flow lands here
  // with a freshly-established session and must be allowed through.
  const isAuthRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/verify") ||
    pathname.startsWith("/forgot-password");

  const isAppRoute =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/market") ||
    pathname.startsWith("/listings") ||
    pathname.startsWith("/inquiries") ||
    pathname.startsWith("/orders") ||
    pathname.startsWith("/messages") ||
    pathname.startsWith("/settings");

  const isAdminRoute = pathname.startsWith("/admin");

  if (isAuthRoute && user) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if ((isAppRoute || isAdminRoute) && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (isAdminRoute && user && supabase) {
    const { data } = await supabase
      .from("profiles")
      .select("role, status")
      .eq("id", user.id)
      .single<{ role: string; status: string }>();

    if (
      !data ||
      data.status === "frozen" ||
      (data.role !== "admin" && data.role !== "super_admin")
    ) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - api (route handlers manage their own auth)
     * - _next/static, _next/image
     * - favicon and public assets
     */
    "/((?!api|auth/callback|_next/static|_next/image|favicon.ico|images/|.*\\..*).*)",
  ],
};
