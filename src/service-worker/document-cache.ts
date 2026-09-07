import { CORE_OFFLINE_SHELL_ROUTES, isOfflineShellRoute } from "../lib/offline-shell";

type DocumentCache = Pick<Cache, "match" | "put">;

export function documentCacheKey(request: Request) {
  const url = new URL(request.url);
  // Staff routes read table/search parameters on the client. Public QR tokens
  // are distinct documents and must never collapse into one cached page.
  if (isOfflineShellRoute(url.pathname) && url.pathname !== "/pos") url.search = "";
  return url.href;
}

export function isUsableDocument(response: Response | undefined): response is Response {
  return Boolean(response?.status === 200 &&
    response.headers.get("content-type")?.toLowerCase().includes("text/html") &&
    response.headers.get("x-yummy-offline-fallback") !== "1");
}

export async function cachedDocumentFallback(request: Request, cache: DocumentCache) {
  const url = new URL(request.url);
  const staffShell = isOfflineShellRoute(url.pathname) && url.pathname !== "/pos";
  // This cache contains only HTML. Next's RSC/prefetch Vary headers must not
  // prevent a warmed HTML document from answering a normal WebView navigation.
  const current = await cache.match(request, { ignoreSearch: staffShell, ignoreVary: true });
  if (isUsableDocument(current)) return current;

  const fallbackPaths = url.pathname === "/login" ? [] : staffShell ? ["/pos/tables", "/login"] : ["/login"];
  for (const path of fallbackPaths) {
    if (path === url.pathname) continue;
    const target = new URL(path, url.origin);
    const cached = await cache.match(target.href, { ignoreSearch: true, ignoreVary: true });
    // Redirect instead of rendering another route's Next payload at this URL.
    if (isUsableDocument(cached)) return Response.redirect(target.href, 302);
  }
  return undefined;
}

export async function warmOfflineDocuments(
  origin: string,
  routes: string[],
  cache: DocumentCache,
  fetchDocument: typeof fetch = fetch,
) {
  const paths = new Set<string>();
  for (const route of routes) {
    try {
      const url = new URL(route, origin);
      if (url.origin === origin && isOfflineShellRoute(url.pathname)) paths.add(url.pathname);
    } catch { /* A malformed message cannot request an arbitrary URL. */ }
  }
  const warmed = await Promise.all([...paths].map(async (path) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const request = new Request(new URL(path, origin), { headers: { Accept: "text/html" }, credentials: "same-origin" });
      const response = await fetchDocument(request, { cache: "no-store", signal: controller.signal });
      if (!isUsableDocument(response) || response.redirected) return null;
      // Await the write: an acknowledged warm must survive immediate navigation.
      // Never run the error fallback through this path and cache it as the POS.
      await cache.put(request, response);
      return path;
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }));
  return {
    ok: CORE_OFFLINE_SHELL_ROUTES.every((path) => warmed.includes(path)),
    warmed: warmed.filter((path): path is string => path !== null),
  };
}
