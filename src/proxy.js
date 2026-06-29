import { NextResponse } from "next/server";

export function proxy(request) {
  // Only protect /admin routes
  if (!request.nextUrl.pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  const adminPassword = process.env.ADMIN_PASSWORD;

  // If no password is set, skip auth (dev convenience)
  if (!adminPassword) {
    return NextResponse.next();
  }

  // Check for session cookie
  const session = request.cookies.get("qr_admin_session");

  if (session?.value === "authenticated") {
    return NextResponse.next();
  }

  // Redirect to login page
  const loginUrl = new URL("/login", request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*"],
};
