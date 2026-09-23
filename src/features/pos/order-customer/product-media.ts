import { ProductImageStatus } from "@/config/pos-constants";
import {
  isRemoteUrl,
  shouldUnoptimizeProductImage,
  staffProductMedia,
} from "@/lib/pos/product-media";
import { optionalNumber } from "@/lib/values";
import { type CateProductItem, type ProdItem } from "@/services/pos";
import type { ProductMedia } from "./menu-structure";

// P3.3: the actual resolver now lives in src/lib/pos/product-media.ts,
// alongside the public QR menu's diverging productImageUrl/isHexColor pair
// (they resolve local-vs-remote images and hex colors differently — see
// that file's comment). URL handling and the optimizer allowlist are shared
// so the staff menu and cart cannot drift apart.
export { isRemoteUrl, shouldUnoptimizeProductImage };

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
