import { type NextRequest, NextResponse } from "next/server";

const CANONICAL_WEB_HOST = "yummy-go.com";

// A service worker and its caches belong to exactly one origin. Serving both
// www.yummy-go.com and yummy-go.com as independent 200 responses splits users
// across two unrelated offline installations. Canonicalize while online so a
// visit through either hostname prepares the same origin for future outages.
export function proxy(request: NextRequest) {
  if (request.nextUrl.hostname.toLowerCase() !== `www.${CANONICAL_WEB_HOST}`) {
    return NextResponse.next();
  }

  const canonicalUrl = request.nextUrl.clone();
  canonicalUrl.protocol = "https:";
  canonicalUrl.hostname = CANONICAL_WEB_HOST;
  canonicalUrl.port = "";
  return NextResponse.redirect(canonicalUrl, 308);
}

export const config = {
  matcher: "/:path*",
};
