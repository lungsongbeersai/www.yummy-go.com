import { type CateProductItem, type ProdDetail, type ProdItem } from "@/services/pos";
import { optionalNumber, optionalString } from "@/lib/values";
import type { ProductModalMode } from "./menu-structure";
import { productImageStatus } from "./product-media";
import { productPrice } from "./pricing";

export function normalizeProdItem(
  item: ProdItem | null | undefined,
  fallback: CateProductItem,
): ProdItem {
  const price = productPrice(fallback);
  const fallbackDetails: ProdDetail[] = fallback.pro_detail_uuid
    ? [
        {
          pro_detail_uuid: String(fallback.pro_detail_uuid),
          price,
          pro_detail_sprice: price,
          pro_detail_enabled: 1,
          cut_stock: 2,
        },
      ]
    : [];

  if (item?.prod_uuid) {
    return {
      ...item,
      prod_color:
        optionalString(item.prod_color, fallback.prod_color) ?? undefined,
      prod_image: optionalString(item.prod_image, fallback.prod_image) ?? "",
      prod_price: item.prod_price ?? price,
      prod_status_imge: productImageStatus(
        item.prod_status_imge,
        fallback.prod_status_imge,
      ),
      details: item.details?.length ? item.details : fallbackDetails,
      toppings: item.toppings ?? [],
    };
  }

  return {
    prod_uuid: fallback.prod_uuid,
    prod_name: fallback.prod_name,
    prod_color: optionalString(fallback.prod_color) ?? undefined,
    prod_image: optionalString(fallback.prod_image) ?? "",
    prod_price: price,
    prod_status_imge: productImageStatus(fallback.prod_status_imge),
    details: fallbackDetails,
    toppings: [],
  };
}

export function isDetailEnabled(detail?: ProdDetail | null) {
  if (!detail) return false;
  if (optionalNumber(detail.pro_detail_enabled) === 2) return false;
  if (optionalNumber(detail.pro_detail_status) === 2) return false;

  return Boolean(optionalString(detail.pro_detail_uuid));
}

export function isDetailAvailable(detail?: ProdDetail | null) {
  if (!detail || !isDetailEnabled(detail)) return false;

  const cutStock = optionalNumber(detail.cut_stock);
  const stock = optionalNumber(detail.qty_stock, detail.pro_detail_qty_stock);
  if (cutStock !== 2 && stock !== null && stock <= 0) return false;

  return true;
}

function detailSortValue(detail: ProdDetail) {
  const sort = optionalNumber(detail.pro_detail_sort);
  return sort !== null && sort > 0 ? sort : null;
}

function sortProductDetails(details: ProdDetail[]) {
  return details.sort((left, right) => {
    const leftSort = detailSortValue(left);
    const rightSort = detailSortValue(right);
    if (leftSort === null && rightSort === null) return 0;
    if (leftSort === null) return 1;
    if (rightSort === null) return -1;
    return leftSort - rightSort;
  });
}

export function enabledProductDetails(product?: ProdItem | null) {
  return sortProductDetails((product?.details ?? []).filter(isDetailEnabled));
}

export function availableProductDetails(product?: ProdItem | null) {
  return sortProductDetails((product?.details ?? []).filter(isDetailAvailable));
}

export function firstAvailableDetail(
  product?: ProdItem | null,
  mode: ProductModalMode = "normal",
) {
  const details =
    mode === "set"
      ? enabledProductDetails(product)
      : availableProductDetails(product);
  return details[0] ?? null;
}
