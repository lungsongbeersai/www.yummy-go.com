import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function imagesWithBase(base: string) {
  vi.stubEnv("NEXT_PUBLIC_BASE_URL", base);
  vi.resetModules();
  return import("./image");
}

describe("product image URLs", () => {
  it.each(["", "https://api.example.com/", "https://api.example.com/backend///"])(
    "resolves complete local storage paths without duplicating folders with base '%s'",
    async (base) => {
      const { getProductImageUrl } = await imagesWithBase(base);
      const expected = `${base.replace(/\/+$/, "")}/uploaded/products/food.jpg`;
      expect(getProductImageUrl("/uploaded/products/food.jpg")).toBe(expected);
      expect(getProductImageUrl("uploaded/products/food.jpg")).toBe(expected);
      expect(getProductImageUrl("/uploaded/products/specials/food.jpg")).toBe(
        `${base.replace(/\/+$/, "")}/uploaded/products/specials/food.jpg`,
      );
    },
  );

  it.each(["", "https://api.example.com/"])("keeps plain and slash-prefixed filename behavior with base '%s'", async (base) => {
    const { getProductImageUrl } = await imagesWithBase(base);
    const expected = `${base.replace(/\/+$/, "")}/uploaded/products/food.jpg`;
    expect(getProductImageUrl("food.jpg")).toBe(expected);
    expect(getProductImageUrl("/food.jpg")).toBe(expected);
  });

  it("preserves absolute storage URLs, colors, and missing-image values", async () => {
    const { getProductImageUrl } = await imagesWithBase("https://api.example.com");
    const storageUrl = "https://media.example.com/products/food.jpg?signature=example";
    expect(getProductImageUrl(storageUrl)).toBe(storageUrl);
    expect(getProductImageUrl("http://media.example.com/food.jpg")).toBe("http://media.example.com/food.jpg");
    expect(getProductImageUrl("#008060")).toBe("#008060");
    expect(getProductImageUrl("")).toBe("");
  });
});
