import { getProductImageUrl } from "@/lib/image";
import { ProductImageStatus } from "@/config/pos-constants";
import { type CateProductItem, type ProdItem } from "@/services/pos";
import { optionalNumber, optionalString } from "@/lib/values";
import type { ProductMedia } from "./menu-structure";

export function productMedia(
  product: CateProductItem | ProdItem,
): ProductMedia {
  const image = optionalString(product.prod_image);
  const color = optionalString(product.prod_color, product.prod_image);
  const imageStatus = optionalNumber(product.prod_status_imge);

  if (imageStatus === ProductImageStatus.IMAGE && image && !isHexColor(image)) {
    return { type: "image", src: productImageSrc(image) };
  }

  if (imageStatus === ProductImageStatus.COLOR && color && isHexColor(color)) {
    return { type: "color", color };
  }

  return { type: "empty" };
}

export function productImageStatus(...values: unknown[]): ProductImageStatus {
  const status = optionalNumber(...values);
  return status === ProductImageStatus.COLOR
    ? ProductImageStatus.COLOR
    : ProductImageStatus.IMAGE;
}

function isHexColor(value?: string | null) {
  return Boolean(
    value &&
      /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(
        value.trim(),
      ),
  );
}

function productImageSrc(value: string) {
  const src = value.trim();
  return isRemoteUrl(src) ? src : getProductImageUrl(src);
}

export function isRemoteUrl(value: string) {
  return /^https?:\/\//i.test(value);
}
