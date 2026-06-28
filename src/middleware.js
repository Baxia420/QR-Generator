import { NextResponse } from "next/server";

export function middleware(request) {
  // Only protect /admin routes
  if (!request.nextUrl.pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  const adminPassword = process.env.ADMIN_PASSWORD;

  // If no password is set, skip auth (dev convenience)
  if (!adminPassword) {
    return NextResponse.next();
  }

  const authHeader = request.headers.get("authorization");

  if (authHeader) {
    const [scheme, encoded] = authHeader.split(" ");

    if (scheme === "Basic" && encoded) {
      const decoded = atob(encoded);
      const [, password] = decoded.split(":");

      if (password === adminPassword) {
        return NextResponse.next();
      }
    }
  }

  // Return 401 with WWW-Authenticate header to trigger browser's Basic Auth prompt
  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="QR Admin"',
    },
  });
}

export const config = {
  matcher: ["/admin/:path*"],
};
