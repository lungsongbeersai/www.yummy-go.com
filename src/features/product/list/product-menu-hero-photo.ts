import { normalizeMenuBackground } from "./product-menu-background";
import type { MenuProduct } from "./product-menu-utils";

export type ProductMenuHeroPhoto =
  | { mode: "auto" }
  | { mode: "product"; productId: string }
  | { mode: "image"; image: string };

export const DEFAULT_MENU_HERO_PHOTO: ProductMenuHeroPhoto = { mode: "auto" };

function photoSource(value: unknown): string | undefined {
  if (typeof value !== "string") return;
  const image = normalizeMenuBackground({ mode: "image", image: value });
  if (image.mode === "image") return image.image;
}

export function normalizeMenuHeroPhoto(input?: ProductMenuHeroPhoto): ProductMenuHeroPhoto {
  if (input?.mode === "product" && typeof input.productId === "string" && input.productId.trim()) {
    return { mode: "product", productId: input.productId.trim() };
  }
  if (input?.mode === "image" && typeof input.image === "string") {
    const background = normalizeMenuBackground({ mode: "image", image: input.image });
    if (background.mode === "image") return { mode: "image", image: background.image };
  }
  return DEFAULT_MENU_HERO_PHOTO;
}

function productPhoto(item: MenuProduct, images: Readonly<Record<string, string>>): { src: string; productId: string } | null {
  const productId = item.originalId ?? item.id;
  for (const id of new Set([productId, item.id])) {
    if (!Object.hasOwn(images, id)) continue;
    const src = photoSource(images[id]);
    if (src) return { src, productId };
  }
  return null;
}

/** Original-ID uploads win; otherwise the first valid source fragment wins. */
export function normalizeMenuPhotoOverrides(
  overrides: Readonly<Record<string, string>> | undefined,
  products: readonly MenuProduct[],
): Readonly<Record<string, string>> {
  const result = Object.create(null) as Record<string, string>;
  if (!overrides) return result;
  for (const item of products) {
    const productId = item.originalId ?? item.id;
    if (Object.hasOwn(result, productId)) continue;
    for (const id of new Set([productId, item.id])) {
      if (!Object.hasOwn(overrides, id)) continue;
      const src = photoSource(overrides[id]);
      if (src) {
        result[productId] = src;
        break;
      }
    }
  }
  return result;
}

/** A removed selection or missing photo falls back to the first usable product photo. */
export function resolveMenuHeroPhoto(
  input: ProductMenuHeroPhoto | undefined,
  products: readonly MenuProduct[],
  images: Readonly<Record<string, string>>,
): { src: string; productId?: string } | null {
  const selected = normalizeMenuHeroPhoto(input);
  if (selected.mode === "image") return { src: selected.image };
  if (selected.mode === "product") {
    for (const item of products) {
      if (item.id !== selected.productId && item.originalId !== selected.productId) continue;
      const photo = productPhoto(item, images);
      if (photo) return photo;
    }
  }
  for (const item of products) {
    const photo = productPhoto(item, images);
    if (photo) return photo;
  }
  return null;
}
