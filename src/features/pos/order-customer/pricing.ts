import { type CateProductItem, type ProdDetail, type ProdItem } from "@/services/pos";
import { optionalNumber } from "@/lib/values";
import {
  ProductSortStatus,
  type ProductCardPrice,
  type ProductModalMode,
} from "./menu-structure";
import { toppingPrice, type SelectedTopping } from "./topping-selection";

export function productPrice(product: CateProductItem | ProdItem) {
  return (
    optionalNumber(
      product.proDetailSprice,
      product.prodSetPrice,
      product.prodPrice,
    ) ?? 0
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
      ? optionalNumber(
          product.prodSetPrice,
          product.prodPrice,
          product.proDetailSprice,
        ) ?? 0
      : productPrice(product);

  if (
    productStatusSort === ProductSortStatus.SET ||
    productOptionCount(product) <= 1
  ) {
    return exactPrice > 0
      ? { kind: "exact", value: exactPrice }
      : { kind: "unavailable", value: null };
  }

  // The menu endpoint must provide branch-aware aggregates. Fetching every
  // product detail here would turn menu loading into an N+1 request pattern.
  const minPrice = optionalNumber(product.minPrice);
  const maxPrice = optionalNumber(product.maxPrice);
  if (minPrice === null || minPrice <= 0) {
    return { kind: "variable", value: null };
  }
  if (maxPrice !== null && maxPrice > 0 && maxPrice === minPrice) {
    return { kind: "exact", value: minPrice };
  }
  if (maxPrice !== null && maxPrice > 0 && maxPrice < minPrice) {
    return { kind: "variable", value: null };
  }
  return { kind: "starting", value: minPrice };
}

// P3.3: NOT merged with public-pos/order/product-domain.ts's
// identically-named productPriceFromDetail/getModalBasePrice, despite the
// name collision — diffing found genuine, revenue-affecting divergence:
// - productPriceFromDetail: optionalNumber() here skips an empty-string
//   proDetailSprice and falls through to `price`; the public version's
//   `?? ` only skips null/undefined, so an empty string there short-circuits
//   to 0 instead of falling back.
// - getModalBasePrice's "set" branch here only reads prodSetPrice
//   (defaulting to 0 if absent); the public version falls back through
//   prodPrice and the detail price when prodSetPrice is missing.
// Unifying either would silently change a displayed/charged price on one
// surface, so both stay separate.
export function productPriceFromDetail(detail?: ProdDetail | null) {
  return optionalNumber(detail?.proDetailSprice, detail?.price) ?? 0;
}

export function getModalBasePrice(
  product: ProdItem | null,
  detail: ProdDetail | null | undefined,
  mode: ProductModalMode,
) {
  return mode === "set"
    ? (optionalNumber(product?.prodSetPrice) ?? 0)
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
