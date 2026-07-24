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
  const fallbackDetails: ProdDetail[] = fallback.proDetailUuid
    ? [
        {
          proDetailUuid: String(fallback.proDetailUuid),
          price,
          proDetailSprice: price,
          proDetailEnabled: 1,
          cutStock: 2,
        },
      ]
    : [];

  if (item?.prodUuid) {
    return {
      ...item,
      prodColor:
        optionalString(item.prodColor, fallback.prodColor) ?? undefined,
      prodImage: optionalString(item.prodImage, fallback.prodImage) ?? "",
      prodPrice: item.prodPrice ?? price,
      prodStatusImge: productImageStatus(
        item.prodStatusImge,
        fallback.prodStatusImge,
      ),
      details: item.details?.length ? item.details : fallbackDetails,
      toppings: item.toppings ?? [],
    };
  }

  return {
    prodUuid: fallback.prodUuid,
    prodName: fallback.prodName,
    prodColor: optionalString(fallback.prodColor) ?? undefined,
    prodImage: optionalString(fallback.prodImage) ?? "",
    prodPrice: price,
    prodStatusImge: productImageStatus(fallback.prodStatusImge),
    details: fallbackDetails,
    toppings: [],
  };
}

// P3.3: NOT merged with public-pos/order/product-domain.ts's
// identically-named isDetailAvailable/firstAvailableDetail, despite the
// name collision — diffing found genuine divergence: this isDetailAvailable
// additionally requires a proDetailUuid (via isDetailEnabled) and also
// checks the proDetailQtyStock field the public version never reads;
// firstAvailableDetail below returns null when nothing qualifies (see the
// "never falls back to an unavailable option" test), while the public
// version falls back to the first detail in array order even if
// unavailable. Unifying either would change which detail a caller adds to
// the cart, so both stay separate.
export function isDetailEnabled(detail?: ProdDetail | null) {
  if (!detail) return false;
  if (optionalNumber(detail.proDetailEnabled) === 2) return false;
  if (optionalNumber(detail.proDetailStatus) === 2) return false;

  return Boolean(optionalString(detail.proDetailUuid));
}

export function isDetailAvailable(detail?: ProdDetail | null) {
  if (!detail || !isDetailEnabled(detail)) return false;

  const cutStock = optionalNumber(detail.cutStock);
  const stock = optionalNumber(detail.qtyStock, detail.proDetailQtyStock);
  if (cutStock !== 2 && stock !== null && stock <= 0) return false;

  return true;
}

function detailSortValue(detail: ProdDetail) {
  const sort = optionalNumber(detail.proDetailSort);
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
