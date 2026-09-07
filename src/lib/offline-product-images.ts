// Shared by the native menu warmer and the service worker. Keep signed query
// parameters and product identity; only Next's width/quality variants collapse.
export const OFFLINE_PRODUCT_IMAGE_CACHE = "yummy-uploaded-images";
const UPLOADED_IMAGE_PATH = /\/(?:uploaded|uploads|products)\//;

export function isOfflineProductImage(url: URL) {
  if (!/^https?:$/.test(url.protocol)) return false;
  if (UPLOADED_IMAGE_PATH.test(url.pathname)) return true;
  if (url.pathname !== "/_next/image") return false;
  const source = url.searchParams.get("url");
  return Boolean(source && UPLOADED_IMAGE_PATH.test(source));
}

export function offlineProductImageKey(request: Request) {
  const url = new URL(request.url);
  if (url.pathname !== "/_next/image" || !isOfflineProductImage(url)) return request.url;
  return `${url.origin}/_next/image?url=${encodeURIComponent(url.searchParams.get("url") || "")}`;
}

export function isCacheableProductImage(response: Response | undefined): response is Response {
  // Cross-origin image elements use no-cors, yielding an opaque response (status 0).
  // CacheFirst otherwise accepts only 200 and silently drops those pictures.
  return Boolean(response && ((response.status === 0 && response.type === "opaque") ||
    (response.status === 200 && response.headers.get("content-type")?.toLowerCase().startsWith("image/"))));
}

export async function warmOfflineProductImage(
  source: string,
  cache: Pick<Cache, "match" | "put">,
  fetchImage: typeof fetch = fetch,
) {
  try {
    const url = new URL(source);
    // Data/colour/API URLs are not product downloads. Do not send credentials
    // to an image host or warm arbitrary endpoints from cached response fields.
    if (!isOfflineProductImage(url) || url.pathname === "/_next/image") return false;
    const request = new Request(url, { mode: "no-cors", credentials: "omit" });
    if (isCacheableProductImage(await cache.match(request, { ignoreVary: true }))) return true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetchImage(request, { signal: controller.signal });
      if (!isCacheableProductImage(response)) return false;
      await cache.put(request, response);
      return true;
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return false;
  }
}
