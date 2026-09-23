import { type NextRequest, NextResponse } from "next/server";

const CANONICAL_WEB_HOST = "yummy-go.com";

// Keep authentication, cookies and browser storage on one canonical origin.
// Serving both hostnames independently would split the same user's app state.
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
