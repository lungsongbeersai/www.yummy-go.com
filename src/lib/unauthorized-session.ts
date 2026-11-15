import { safeInternalRedirect } from "@/lib/safe-internal-redirect";

interface UnauthorizedSessionInput {
  currentToken: string | null | undefined;
  isLoggedIn: boolean;
  requestToken: string | null | undefined;
  status: number | undefined;
}

export function shouldLogoutForUnauthorized({
  currentToken,
  isLoggedIn,
  requestToken,
  status,
}: UnauthorizedSessionInput) {
  return Boolean(
    status === 401 &&
      isLoggedIn &&
      currentToken &&
      requestToken === currentToken,
  );
}
/** Preserve only the protected external-browser report handoff through login. */
export function unauthorizedLoginPath(pathname?: string, search = "") {
  if (pathname !== "/my_work/report" || (search && !search.startsWith("?")) ||
    /[\\#\p{Cc}\p{Cf}]/u.test(search) || /%5c/i.test(search)) return "/login";
  try {
    if (/[\\\p{Cc}\p{Cf}]/u.test(decodeURIComponent(search))) return "/login";
  } catch { return "/login"; }
  const target = pathname + search;
  if (safeInternalRedirect(target) !== target) return "/login";
  return `/login?redirect=${encodeURIComponent(target)}`;
}
