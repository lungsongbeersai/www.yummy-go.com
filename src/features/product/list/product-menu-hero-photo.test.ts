import { describe, expect, it } from "vitest";
import {
  DEFAULT_MENU_HERO_PHOTO,
  normalizeMenuHeroPhoto,
  normalizeMenuPhotoOverrides,
  resolveMenuHeroPhoto,
} from "./product-menu-hero-photo";
import type { MenuProduct } from "./product-menu-utils";

const firstPhoto = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j1ioAAAAASUVORK5CYII=";
const secondPhoto = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8zwAAAgEBAMVdT9kAAAAASUVORK5CYII=";

function product(id: string, originalId?: string): MenuProduct {
  return {
    id, originalId, number: 1, name: id, secondaryName: "", categoryId: "food", categoryName: "Food",
    imageFilename: `${originalId ?? id}.png`, type: "normal", prices: [], options: [],
  };
}

describe("menu hero photo selection", () => {
  it("defaults to automatic real product photos and trims selected IDs", () => {
    expect(DEFAULT_MENU_HERO_PHOTO).toEqual({ mode: "auto" });
    expect(normalizeMenuHeroPhoto()).toEqual({ mode: "auto" });
    expect(normalizeMenuHeroPhoto({ mode: "auto" })).toEqual({ mode: "auto" });
    expect(normalizeMenuHeroPhoto({ mode: "product", productId: "  chicken  " })).toEqual({ mode: "product", productId: "chicken" });
    expect(normalizeMenuHeroPhoto({ mode: "product", productId: " \n " })).toEqual({ mode: "auto" });
  });

  it("uses product order rather than cache order and skips products without usable photos", () => {
    const products = [product("missing"), product("rice"), product("chicken")];
    const images = { chicken: secondPhoto, rice: firstPhoto };
    expect(resolveMenuHeroPhoto(undefined, products, images)).toEqual({ src: firstPhoto, productId: "rice" });
    expect(resolveMenuHeroPhoto({ mode: "auto" }, [product("chicken"), product("rice")], images))
      .toEqual({ src: secondPhoto, productId: "chicken" });
  });

  it("uses the selected known product's photo even if another photo comes first", () => {
    expect(resolveMenuHeroPhoto({ mode: "product", productId: "chicken" }, [product("rice"), product("chicken")], {
      rice: firstPhoto, chicken: secondPhoto,
    })).toEqual({ src: secondPhoto, productId: "chicken" });
  });

  it.each(["removed", "missing-photo"])("falls back to a current real photo when selection '%s' is unavailable", (productId) => {
    expect(resolveMenuHeroPhoto({ mode: "product", productId }, [product("missing-photo"), product("rice")], {
      removed: secondPhoto, rice: firstPhoto,
    })).toEqual({ src: firstPhoto, productId: "rice" });
  });

  it("resolves continuation photos by original ID and returns stable source metadata", () => {
    const fragment = product("rice::part:2", "rice");
    expect(resolveMenuHeroPhoto({ mode: "auto" }, [fragment], { rice: firstPhoto })).toEqual({ src: firstPhoto, productId: "rice" });
    expect(resolveMenuHeroPhoto({ mode: "product", productId: "rice" }, [fragment], { rice: firstPhoto }))
      .toEqual({ src: firstPhoto, productId: "rice" });
    expect(resolveMenuHeroPhoto({ mode: "product", productId: fragment.id }, [fragment], { rice: firstPhoto }))
      .toEqual({ src: firstPhoto, productId: "rice" });
    expect(resolveMenuHeroPhoto({ mode: "auto" }, [fragment], { [fragment.id]: firstPhoto }))
      .toEqual({ src: firstPhoto, productId: "rice" });
  });

  it("returns no invented replacement when no provided product has a real cached photo", () => {
    expect(resolveMenuHeroPhoto(undefined, [product("missing")], { orphan: firstPhoto })).toBeNull();
    expect(resolveMenuHeroPhoto({ mode: "product", productId: "orphan" }, [], { orphan: firstPhoto })).toBeNull();
    expect(resolveMenuHeroPhoto({ mode: "auto" }, [], {})).toBeNull();
  });

  it("uses a safe uploaded image independently of the product cache", () => {
    expect(normalizeMenuHeroPhoto({ mode: "image", image: `  ${firstPhoto}\n` })).toEqual({ mode: "image", image: firstPhoto });
    expect(resolveMenuHeroPhoto({ mode: "image", image: firstPhoto }, [], {})).toEqual({ src: firstPhoto });
  });

  it.each([
    "https://example.com/food.jpg",
    "blob:https://example.com/temporary-id",
    "javascript:alert(1)",
    "data:text/html;base64,PHN2Zz4=",
    "data:image/svg+xml;base64,PHN2Zz4=",
    "data:image/png;base64,A",
  ])("rejects an unsafe image '%s' and falls back to a current product photo", (image) => {
    expect(normalizeMenuHeroPhoto({ mode: "image", image })).toEqual({ mode: "auto" });
    expect(resolveMenuHeroPhoto({ mode: "image", image }, [product("rice")], { rice: firstPhoto }))
      .toEqual({ src: firstPhoto, productId: "rice" });
  });

  it("ignores invalid cache entries before selecting a later usable photo", () => {
    expect(resolveMenuHeroPhoto(undefined, [product("invalid"), product("rice")], {
      invalid: "https://example.com/not-a-prepared-photo.jpg", rice: firstPhoto,
    })).toEqual({ src: firstPhoto, productId: "rice" });
  });

  it("ignores inherited cache entries", () => {
    const images = Object.create({ rice: firstPhoto }) as Record<string, string>;
    expect(resolveMenuHeroPhoto(undefined, [product("rice")], images)).toBeNull();
  });
});

describe("menu dish photo overrides", () => {
  it("keeps only current products' safe local uploads without changing source data", () => {
    const overrides = { rice: `  ${firstPhoto}\n`, removed: secondPhoto, external: "https://example.com/food.jpg" };
    const products = [product("rice"), product("external")];
    const snapshot = JSON.stringify({ overrides, products });
    expect(normalizeMenuPhotoOverrides(overrides, products)).toEqual({ rice: firstPhoto });
    expect(JSON.stringify({ overrides, products })).toBe(snapshot);
    expect(normalizeMenuPhotoOverrides(undefined, products)).toEqual({});
    expect(normalizeMenuPhotoOverrides(overrides, [])).toEqual({});
  });

  it("maps a source continuation's upload to the original product ID", () => {
    const fragment = product("rice::part:2", "rice");
    expect(normalizeMenuPhotoOverrides({ [fragment.id]: firstPhoto }, [fragment])).toEqual({ rice: firstPhoto });
    expect(normalizeMenuPhotoOverrides({ rice: firstPhoto }, [fragment])).toEqual({ rice: firstPhoto });
  });

  it("prefers original-ID uploads over fragment uploads and otherwise follows source order", () => {
    const first = product("rice::part:1", "rice");
    const second = product("rice::part:2", "rice");
    expect(normalizeMenuPhotoOverrides({ [second.id]: secondPhoto, [first.id]: firstPhoto }, [first, second]))
      .toEqual({ rice: firstPhoto });
    expect(normalizeMenuPhotoOverrides({ [first.id]: firstPhoto, rice: secondPhoto }, [first, second]))
      .toEqual({ rice: secondPhoto });
    expect(normalizeMenuPhotoOverrides({ [first.id]: "invalid", [second.id]: secondPhoto }, [first, second]))
      .toEqual({ rice: secondPhoto });
  });

  it.each([
    "https://example.com/food.jpg", "blob:https://example.com/temporary", "javascript:alert(1)",
    "data:image/svg+xml;base64,PHN2Zz4=", "data:text/html;base64,PHN2Zz4=", "data:image/png;base64,A",
  ])("rejects unsafe per-dish image '%s'", (image) => {
    expect(normalizeMenuPhotoOverrides({ rice: image }, [product("rice")])).toEqual({});
  });

  it("ignores inherited overrides and safely handles product IDs which overlap prototype names", () => {
    const inherited = Object.create({ rice: firstPhoto }) as Record<string, string>;
    expect(normalizeMenuPhotoOverrides(inherited, [product("rice")])).toEqual({});
    const source = Object.fromEntries([["__proto__", firstPhoto], ["constructor", secondPhoto]]);
    const result = normalizeMenuPhotoOverrides(source, [product("__proto__"), product("constructor")]);
    expect(Object.getPrototypeOf(result)).toBeNull();
    expect(Object.hasOwn(result, "__proto__")).toBe(true);
    expect(result["__proto__"]).toBe(firstPhoto);
    expect(result.constructor).toBe(secondPhoto);
  });
});
