import { afterEach, describe, expect, it, vi } from "vitest";
import { loadProductMenuImages, normalizeProductMenuImageBlob } from "./product-menu-images";
import type { MenuCategory, MenuProduct } from "./product-menu-utils";

const thumbnail = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j1ioAAAAASUVORK5CYII=";

function item(id: string, imageFilename = `${id}.jpg`, originalId?: string): MenuProduct {
  return {
    id, originalId, imageFilename, number: 1, name: id, secondaryName: "", categoryId: "food", categoryName: "Food",
    type: "normal", prices: [], options: [],
  };
}

function categories(items: MenuProduct[]): MenuCategory[] {
  return [{ id: "food", name: "Food", items }];
}

afterEach(() => vi.useRealTimers());

describe("product menu photo response normalization", () => {
  it.each(["", "application/octet-stream"])("recovers a real PNG delivered with MIME '%s' without changing its bytes", async (type) => {
    const bytes = Uint8Array.from(atob(thumbnail.split(",")[1]), (character) => character.charCodeAt(0));
    const source = new Blob([bytes], { type });
    const normalized = await normalizeProductMenuImageBlob(source);
    expect(normalized.type).toBe("image/png");
    expect(normalized.size).toBe(source.size);
    expect(await normalized.arrayBuffer()).toEqual(await source.arrayBuffer());
  });

  it.each([
    { bytes: [0xff, 0xd8, 0xff, 0xe0], type: "image/jpeg" },
    { bytes: Array.from("RIFF0000WEBPVP8 ", (character) => character.charCodeAt(0)), type: "image/webp" },
  ])("restores $type metadata for binary image responses before browser decoding", async ({ bytes, type }) => {
    const result = await normalizeProductMenuImageBlob(new Blob([new Uint8Array(bytes)], { type: "application/octet-stream" }));
    expect(result.type).toBe(type);
  });

  it("keeps declared image responses for browser decoding and dimension validation", async () => {
    const source = new Blob(["Browser must still validate these bytes"], { type: "image/jpeg" });
    expect(await normalizeProductMenuImageBlob(source)).toBe(source);
  });

  it.each(["text/html", "application/json", "text/plain", "application/pdf", "", "application/octet-stream"])(
    "rejects an HTML error body delivered as '%s'",
    async (type) => {
      await expect(normalizeProductMenuImageBlob(new Blob(["<!DOCTYPE html><title>Login required</title>"], { type }))).rejects.toThrow();
    },
  );

  it("rejects empty responses even when the MIME says image", async () => {
    await expect(normalizeProductMenuImageBlob(new Blob([], { type: "image/png" }))).rejects.toThrow();
  });
});

describe("product menu photo loading", () => {
  it("attempts every dish photo and deduplicates repeated filenames", async () => {
    const loadImage = vi.fn(async () => { throw new Error("Missing photo"); });
    const result = await loadProductMenuImages(categories([
      item("a"), item("b"), item("c"), item("same-a", "a.jpg"), item("no-photo", ""),
    ]), loadImage);
    expect(loadImage.mock.calls).toHaveLength(3);
    expect(result.omissions).toBe(5);
    expect(Object.keys(result.images)).toEqual([]);
  });

  it("reuses preview photos across matching files and original IDs without loading again", async () => {
    const loadImage = vi.fn(async () => { throw new Error("Should use cache"); });
    const result = await loadProductMenuImages(categories([
      item("first", "shared.jpg"), item("second", "shared.jpg"), item("continued", "other.jpg", "original"),
    ]), loadImage, { existingImages: { second: thumbnail, original: thumbnail } });
    expect(loadImage).not.toHaveBeenCalled();
    expect(result.images).toEqual({ first: thumbnail, second: thumbnail, continued: thumbnail, original: thumbnail });
    expect(result.omissions).toBe(0);
  });

  it("rejects URL caches and non-image response blobs instead of exporting them as photos", async () => {
    const loadImage = vi.fn(async () => new Blob(["Login required"], { type: "text/html" }));
    const result = await loadProductMenuImages(categories([item("a")]), loadImage, {
      existingImages: { a: "https://example.com/photo.jpg" },
    });
    expect(loadImage).toHaveBeenCalledOnce();
    expect(result.omissions).toBe(1);
    expect(result.images.a).toBeUndefined();
  });

  it("counts only the preview subset and reports progress for missing as well as cached photos", async () => {
    const onProgress = vi.fn();
    const loadImage = vi.fn(async () => { throw new Error("Should not load unconsidered photos"); });
    const result = await loadProductMenuImages(categories([
      item("missing", ""), item("cached"), item("not-loaded"),
    ]), loadImage, { maxProducts: 2, existingImages: { cached: thumbnail }, onProgress });
    expect(loadImage).not.toHaveBeenCalled();
    expect(result.omissions).toBe(1);
    expect(result.images.cached).toBe(thumbnail);
    expect(result.images["not-loaded"]).toBeUndefined();
    expect(onProgress).toHaveBeenLastCalledWith(2, 2);
  });

  it("keeps at most four concurrent requests active", async () => {
    const release: (() => void)[] = [];
    let active = 0;
    let maximum = 0;
    const loadImage = vi.fn(async () => {
      active += 1;
      maximum = Math.max(maximum, active);
      await new Promise<void>((resolve) => release.push(resolve));
      active -= 1;
      return new Blob(["Unavailable"], { type: "application/json" });
    });
    const pending = loadProductMenuImages(categories(Array.from({ length: 7 }, (_, index) => item(String(index)))), loadImage);
    await vi.waitFor(() => expect(release).toHaveLength(4));
    release[0]();
    await vi.waitFor(() => expect(release).toHaveLength(5));
    release.slice(1).forEach((resolve) => resolve());
    await vi.waitFor(() => expect(release).toHaveLength(7));
    release.slice(5).forEach((resolve) => resolve());
    expect((await pending).omissions).toBe(7);
    expect(maximum).toBe(4);
  });

  it("finishes after a request timeout and ignores a later response", async () => {
    vi.useFakeTimers();
    let finishRequest: ((blob: Blob) => void) | undefined;
    const pending = loadProductMenuImages(categories([item("slow")]), () => new Promise((resolve) => { finishRequest = resolve; }));
    await vi.advanceTimersByTimeAsync(8000);
    const result = await pending;
    expect(result.omissions).toBe(1);
    expect(result.images.slow).toBeUndefined();
    finishRequest?.(new Blob(["late"], { type: "image/jpeg" }));
    await vi.runAllTimersAsync();
    expect(result.images.slow).toBeUndefined();
  });

  it("retries failed photos on a later attempt while sharing duplicate file requests within each attempt", async () => {
    const loadImage = vi.fn(async () => { throw new Error("Temporary storage failure"); });
    const source = categories([item("first", "same.jpg"), item("second", "same.jpg")]);
    const first = await loadProductMenuImages(source, loadImage);
    expect(first.omissions).toBe(2);
    expect(loadImage).toHaveBeenCalledOnce();
    const second = await loadProductMenuImages(source, loadImage, { existingImages: first.images });
    expect(second.omissions).toBe(2);
    expect(loadImage).toHaveBeenCalledTimes(2);
  });
});
