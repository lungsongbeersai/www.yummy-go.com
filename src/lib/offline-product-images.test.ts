import { afterEach, describe, expect, it, vi } from "vitest";
import { isCacheableProductImage, isOfflineProductImage, offlineProductImageKey, warmOfflineProductImage } from "./offline-product-images";

const SOURCE = "https://images.example.test/shop/products/rice.png?version=2";
function opaque() {
  const response = new Response(null);
  Object.defineProperties(response, { status: { value: 0 }, type: { value: "opaque" } });
  return response;
}

describe("offline product images", () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it("works in WebViews without AbortSignal.timeout", async () => {
    vi.spyOn(AbortSignal, "timeout").mockImplementation(() => { throw new Error("unsupported"); });
    await expect(warmOfflineProductImage(SOURCE, { match: vi.fn(), put: vi.fn() }, vi.fn().mockResolvedValue(opaque()))).resolves.toBe(true);
  });

  it("accepts real image responses and opaque CDN images, not errors or HTML", () => {
    expect(isCacheableProductImage(opaque())).toBe(true);
    expect(isCacheableProductImage(new Response("png", { headers: { "content-type": "image/png" } }))).toBe(true);
    expect(isCacheableProductImage(new Response("not found", { status: 404 }))).toBe(false);
    expect(isCacheableProductImage(new Response("login", { headers: { "content-type": "text/html" } }))).toBe(false);
    expect(isCacheableProductImage(Response.error())).toBe(false);
  });

  it("shares cached width variants but never another product or signed source", () => {
    const request = (source: string, width: number) => new Request(`https://pos.example.test/_next/image?url=${encodeURIComponent(source)}&w=${width}&q=75`);
    expect(offlineProductImageKey(request(SOURCE, 640))).toBe(offlineProductImageKey(request(SOURCE, 48)));
    expect(offlineProductImageKey(request(SOURCE, 640))).not.toBe(offlineProductImageKey(request(SOURCE.replace("rice", "bios"), 640)));
    expect(offlineProductImageKey(request(SOURCE, 640))).not.toBe(offlineProductImageKey(request(SOURCE.replace("version=2", "version=3"), 640)));
    expect(offlineProductImageKey(new Request(SOURCE))).toBe(SOURCE);
  });

  it("warms direct images before acknowledgement and reuses them with different Vary headers", async () => {
    const gate = Promise.withResolvers<void>();
    let saved = false;
    const cache = { match: vi.fn().mockResolvedValue(undefined), put: vi.fn(async () => { await gate.promise; saved = true; }) };
    const fetchImage = vi.fn().mockResolvedValue(opaque());
    const warm = warmOfflineProductImage(SOURCE, cache, fetchImage);
    await vi.waitFor(() => expect(cache.put).toHaveBeenCalledOnce());
    expect(saved).toBe(false);
    expect(fetchImage.mock.calls[0][0]).toMatchObject({ url: SOURCE, mode: "no-cors", credentials: "omit" });
    gate.resolve();
    await expect(warm).resolves.toBe(true);
    cache.match.mockResolvedValue(opaque());
    await expect(warmOfflineProductImage(SOURCE, cache, fetchImage)).resolves.toBe(true);
    expect(fetchImage).toHaveBeenCalledOnce();
    expect(cache.match).toHaveBeenLastCalledWith(expect.any(Request), { ignoreVary: true });
  });

  it.each(["#fff", "data:image/png;base64,xx", "https://api.example.test/api/v1/posAll/payment", "file:///products/photo.png"])("does not fetch %s", async (source) => {
    const fetchImage = vi.fn();
    await expect(warmOfflineProductImage(source, { match: vi.fn(), put: vi.fn() }, fetchImage)).resolves.toBe(false);
    expect(fetchImage).not.toHaveBeenCalled();
  });

  it("does not report a stored image after a network or quota failure", async () => {
    const cache = { match: vi.fn(), put: vi.fn().mockRejectedValue(new Error("quota")) };
    await expect(warmOfflineProductImage(SOURCE, cache, vi.fn().mockRejectedValue(new Error("offline")))).resolves.toBe(false);
    await expect(warmOfflineProductImage(SOURCE, cache, vi.fn().mockResolvedValue(opaque()))).resolves.toBe(false);
    expect(isOfflineProductImage(new URL(SOURCE))).toBe(true);
  });
});
