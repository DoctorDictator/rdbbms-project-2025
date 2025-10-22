import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const pathname = url.pathname;
  const token = request.cookies.get("token")?.value;

  // allow internals, public assets and API
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname === "/favicon.ico" ||
    pathname.startsWith("/public") ||
    pathname.startsWith("/static")
  ) {
    return NextResponse.next();
  }

  const authPaths = ["/login", "/register"];
  const protectedRoots = [
    "/files",
    "/friends",
    "/shared",
    "/activities",
    "/favourites",
    "/trash",
  ];

  const isAuthPage = authPaths.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
  const isProtected = protectedRoots.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
  const isRoot = pathname === "/";

  // root: always public, never redirect
  if (isRoot) {
    return NextResponse.next();
  }

  // not logged in -> protect pages
  if (!token && isProtected) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // logged in user should not see auth pages
  if (token && isAuthPage) {
    return NextResponse.redirect(new URL("/files", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/", // root
    "/files/:path*",
    "/friends/:path*",
    "/shared/:path*",
    "/activities/:path*",
    "/favourites/:path*",
    "/trash/:path*",
    "/auth/:path*",
  ],
};
