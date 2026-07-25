import { ProductImageStatus } from "@/config/pos-constants";
import { isRemoteUrl, staffProductMedia } from "@/lib/pos/product-media";
import { optionalNumber } from "@/lib/values";
import { type CateProductItem, type ProdItem } from "@/services/pos";
import type { ProductMedia } from "./menu-structure";

// P3.3: the actual resolver now lives in src/lib/pos/product-media.ts,
// alongside the public QR menu's diverging productImageUrl/isHexColor pair
// (they resolve local-vs-remote images and hex colors differently — see
// that file's comment). isRemoteUrl is byte-identical between the two
// trees and shared as-is.
export { isRemoteUrl };

export function productMedia(
  product: CateProductItem | ProdItem,
): ProductMedia {
  return staffProductMedia(product);
}

export function productImageStatus(...values: unknown[]): ProductImageStatus {
  const status = optionalNumber(...values);
  return status === ProductImageStatus.COLOR
    ? ProductImageStatus.COLOR
    : ProductImageStatus.IMAGE;
}
