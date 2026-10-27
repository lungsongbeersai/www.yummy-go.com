import { type CateProductItem, type ProdDetail, type ProdItem } from "@/services/pos";
import { optionalNumber } from "@/lib/values";
import { readProductPrice } from "@/lib/product-price";
import {
  ProductSortStatus,
  type ProductCardPrice,
  type ProductModalMode,
} from "./menu-structure";
import { toppingPrice, type SelectedTopping } from "./topping-selection";

export function productPrice(product: CateProductItem | ProdItem) {
  return (
    readProductPrice(
      product.proDetailSprice,
      product.prodPrice,
    ) ?? Number.NaN
  );
}

export function productOptionCount(product: CateProductItem) {
  return Math.max(
    0,
    optionalNumber(
      product.countOptionEnabled,
      product.countOptionAll,
    ) ?? 0,
  );
}

export function productToppingCount(product: CateProductItem) {
  return Math.max(0, optionalNumber(product.countToppingEnabled) ?? 0);
}

export function productCardPrice(
  product: CateProductItem,
  activeSort: ProductSortStatus,
): ProductCardPrice {
  const productStatusSort =
    optionalNumber(product.statusSortFk) ?? activeSort;
  const exactPrice =
    productStatusSort === ProductSortStatus.SET
      ? readProductPrice(
          product.prodSetPrice,
          product.prodPrice,
          product.proDetailSprice,
        ) ?? Number.NaN
      : productPrice(product);

  if (
    productStatusSort === ProductSortStatus.SET ||
    productOptionCount(product) <= 1
  ) {
    return Number.isFinite(exactPrice) && exactPrice >= 0
      ? { kind: "exact", value: exactPrice }
      : { kind: "unavailable", value: null };
  }

  // The menu endpoint must provide branch-aware aggregates. Fetching every
  // product detail here would turn menu loading into an N+1 request pattern.
  const minPrice = readProductPrice(product.minPrice);
  const maxPrice = readProductPrice(product.maxPrice);
  if (minPrice === null) {
    return { kind: "variable", value: null };
  }
  if (maxPrice !== null && maxPrice === minPrice) {
    return { kind: "exact", value: minPrice };
  }
  if (maxPrice !== null && maxPrice < minPrice) {
    return { kind: "variable", value: null };
  }
  return { kind: "starting", value: minPrice };
}

// P3.3: NOT merged with public-pos/order/product-domain.ts's
// identically-named productPriceFromDetail/getModalBasePrice, despite the
// name collision — diffing found genuine, revenue-affecting divergence:
// - getModalBasePrice's "set" branch here only reads prodSetPrice
//   (rejecting an absent price); the public version falls back through
//   prodPrice and the detail price when prodSetPrice is missing.
// Unifying either would silently change a displayed/charged price on one
// surface, so both stay separate.
export function productPriceFromDetail(detail?: ProdDetail | null) {
  return readProductPrice(detail?.proDetailSprice, detail?.price) ?? Number.NaN;
}

export function getModalBasePrice(
  product: ProdItem | null,
  detail: ProdDetail | null | undefined,
  mode: ProductModalMode,
) {
  return mode === "set"
    ? (readProductPrice(product?.prodSetPrice) ?? Number.NaN)
    : productPriceFromDetail(detail);
}

export function getModalUnitPrice(
  product: ProdItem | null,
  detail: ProdDetail | null | undefined,
  toppings: SelectedTopping[],
  mode: ProductModalMode,
) {
  const basePrice = getModalBasePrice(product, detail, mode);
  return (
    basePrice +
    toppings.reduce(
      (sum, selected) => sum + toppingPrice(selected.topping) * selected.qty,
      0,
    )
  );
}
