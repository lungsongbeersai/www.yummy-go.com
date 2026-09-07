import { describe, expect, it, vi } from "vitest";
import { cachedDocumentFallback, documentCacheKey, isUsableDocument, warmOfflineDocuments } from "./document-cache";
import { CORE_OFFLINE_SHELL_ROUTES } from "../lib/offline-shell";

const ORIGIN = "https://pos.test";
const html = () => new Response("<!doctype html><html>POS</html>", { headers: { "Content-Type": "text/html", Vary: "RSC, Next-Router-Prefetch" } });

function memoryCache() {
  const entries = new Map<string, Response>();
  const cache = {
    async match(request: RequestInfo, options?: CacheQueryOptions) {
      const url = new URL(typeof request === "string" ? request : request.url);
      for (const [key, response] of entries) {
        const candidate = new URL(key);
        if (options?.ignoreSearch ? candidate.origin !== url.origin || candidate.pathname !== url.pathname : key !== url.href) continue;
        // Model the failure of a warm request vs. WebView navigation Vary match.
        if (response.headers.has("vary") && !options?.ignoreVary) continue;
        return response.clone();
      }
      return undefined;
    },
    async put(request: RequestInfo, response: Response) {
      entries.set(typeof request === "string" ? request : request.url, response.clone());
    },
  };
  return { cache, entries };
}

describe("offline HTML documents", () => {
  it("normalizes only staff document cache keys, keeping public QR identities distinct", () => {
    expect(documentCacheKey(new Request(`${ORIGIN}/pos/order?table_uuid=T03`))).toBe(`${ORIGIN}/pos/order`);
    expect(documentCacheKey(new Request(`${ORIGIN}/pos?t=one`))).toBe(`${ORIGIN}/pos?t=one`);
    expect(documentCacheKey(new Request(`${ORIGIN}/pos?t=two`))).toBe(`${ORIGIN}/pos?t=two`);
  });
  it("opens the warmed staff shell with table parameters despite RSC Vary headers", async () => {
    const { cache, entries } = memoryCache();
    entries.set(`${ORIGIN}/pos/order`, html());
    const response = await cachedDocumentFallback(new Request(`${ORIGIN}/pos/order?table_uuid=T03`), cache);
    expect(await response?.text()).toContain("POS");
    expect(response?.status).toBe(200);
  });

  it("uses the cached table screen on cold start even if root and login were not cached", async () => {
    const { cache, entries } = memoryCache();
    entries.set(`${ORIGIN}/pos/tables`, html());
    const result = await cachedDocumentFallback(new Request(`${ORIGIN}/`), cache);
    expect(result?.status).toBe(302);
    expect(result?.headers.get("location")).toBe(`${ORIGIN}/pos/tables`);
  });

  it("does not bounce an uncached login back to the protected POS in a redirect loop", async () => {
    const { cache, entries } = memoryCache();
    entries.set(`${ORIGIN}/pos/tables`, html());
    expect(await cachedDocumentFallback(new Request(`${ORIGIN}/login`), cache)).toBeUndefined();
  });

  it("does not reuse another public QR token's document or redirect it to staff POS", async () => {
    const { cache, entries } = memoryCache();
    entries.set(`${ORIGIN}/pos?t=old`, html());
    entries.set(`${ORIGIN}/pos/tables`, html());
    expect(await cachedDocumentFallback(new Request(`${ORIGIN}/pos?t=new`), cache)).toBeUndefined();
  });

  it("warms the actual core HTML documents and acknowledges only after their writes", async () => {
    const { cache, entries } = memoryCache();
    const fetcher = vi.fn().mockImplementation(async () => html());
    const result = await warmOfflineDocuments(ORIGIN, [...CORE_OFFLINE_SHELL_ROUTES], cache, fetcher);
    expect(result.ok).toBe(true);
    expect(entries.size).toBe(3);
    expect(fetcher.mock.calls[0][0].headers.get("Accept")).toBe("text/html");
  });

  it.each([
    () => new Response("server error", { status: 500, headers: { "Content-Type": "text/html" } }),
    () => new Response("RSC payload", { headers: { "Content-Type": "text/x-component" } }),
    () => new Response("fallback", { headers: { "Content-Type": "text/html", "x-yummy-offline-fallback": "1" } }),
  ])("does not replace a working shell with an error, RSC, or synthetic fallback", async (invalid) => {
    const { cache, entries } = memoryCache();
    entries.set(`${ORIGIN}/pos/order`, html());
    const result = await warmOfflineDocuments(ORIGIN, [...CORE_OFFLINE_SHELL_ROUTES], cache, vi.fn().mockResolvedValue(invalid()));
    expect(result.ok).toBe(false);
    expect(entries.size).toBe(1);
    expect(await entries.get(`${ORIGIN}/pos/order`)?.text()).toContain("POS");
    expect(isUsableDocument(invalid())).toBe(false);
  });

  it("leaves cached shells intact on network failure and can retry later", async () => {
    const { cache, entries } = memoryCache();
    const fetcher = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    expect((await warmOfflineDocuments(ORIGIN, [...CORE_OFFLINE_SHELL_ROUTES], cache, fetcher)).ok).toBe(false);
    expect(entries.size).toBe(0);
    fetcher.mockImplementation(async () => html());
    expect((await warmOfflineDocuments(ORIGIN, [...CORE_OFFLINE_SHELL_ROUTES], cache, fetcher)).ok).toBe(true);
  });

  it("does not report ready when the cache write fails", async () => {
    const { cache } = memoryCache();
    vi.spyOn(cache, "put").mockRejectedValue(new Error("quota"));
    expect((await warmOfflineDocuments(ORIGIN, [...CORE_OFFLINE_SHELL_ROUTES], cache, vi.fn().mockImplementation(async () => html()))).ok).toBe(false);
  });

  it("never warms arbitrary external URLs, API endpoints or unknown pages", async () => {
    const { cache } = memoryCache();
    const fetcher = vi.fn();
    await warmOfflineDocuments(ORIGIN, ["https://elsewhere.test/login", "/api/v1/sales/delete", "/unknown", "http://["], cache, fetcher);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
