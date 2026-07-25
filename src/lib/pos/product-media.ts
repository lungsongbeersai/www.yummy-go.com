import { ProductImageStatus } from "@/config/pos-constants";
import { getProductImageUrl } from "@/lib/image";
import { optionalNumber, optionalString } from "@/lib/values";
import type { CateProductItem, ProdItem } from "@/services/pos";

/**
 * Two independent product-media resolvers, one per surface (P3.3). They
 * were named identically (productMedia/productImageUrl + isHexColor) in
 * both trees but diffing byte-for-byte showed a genuine divergence, not
 * just a style difference:
 *  - staffProductMedia additionally resolves locally-uploaded images via
 *    getProductImageUrl (public-pos only ever shows already-remote http
 *    images) and recognizes 4/8-digit + whitespace-padded hex colors.
 *  - publicProductImageUrl/publicIsHexColor only match a stricter 3/6-digit
 *    hex pattern with no trimming.
 * Unifying either direction would change what image/color renders on one
 * of the two surfaces, so both are kept, side by side, under their own
 * names — only the trivial isRemoteUrl check is shared as-is.
 */

export type StaffProductMedia =
  | { type: "image"; src: string }
  | { type: "color"; color: string }
  | { type: "empty" };

export function isRemoteUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function staffIsHexColor(value?: string | null) {
  return Boolean(
    value &&
      /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(
        value.trim(),
      ),
  );
}

function staffProductImageSrc(value: string) {
  const src = value.trim();
  return isRemoteUrl(src) ? src : getProductImageUrl(src);
}

export function staffProductMedia(
  product: CateProductItem | ProdItem,
): StaffProductMedia {
  const image = optionalString(product.prodImage);
  const color = optionalString(product.prodColor, product.prodImage);
  const imageStatus = optionalNumber(product.prodStatusImge);

  if (
    imageStatus === ProductImageStatus.IMAGE &&
    image &&
    !staffIsHexColor(image)
  ) {
    return { type: "image", src: staffProductImageSrc(image) };
  }

  if (
    imageStatus === ProductImageStatus.COLOR &&
    color &&
    staffIsHexColor(color)
  ) {
    return { type: "color", color };
  }

  return { type: "empty" };
}

export function publicProductImageUrl(product: CateProductItem | ProdItem) {
  return product.prodStatusImge === ProductImageStatus.IMAGE &&
    product.prodImage?.startsWith("http")
    ? product.prodImage
    : "";
}

export function publicHasRemoteProductImage(
  product: CateProductItem | ProdItem,
) {
  return Boolean(publicProductImageUrl(product));
}

export function publicIsHexColor(value?: string) {
  return Boolean(value && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value));
}
