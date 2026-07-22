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
      product.pro_detail_sprice,
      product.prod_set_price,
      product.prod_price,
    ) ?? 0
  );
}

export function productOptionCount(product: CateProductItem) {
  return Math.max(
    0,
    optionalNumber(
      product.count_option_enabled,
      product.count_option_all,
    ) ?? 0,
  );
}

export function productToppingCount(product: CateProductItem) {
  return Math.max(0, optionalNumber(product.count_topping_enabled) ?? 0);
}

export function productCardPrice(
  product: CateProductItem,
  activeSort: ProductSortStatus,
): ProductCardPrice {
  const productStatusSort =
    optionalNumber(product.status_sort_fk) ?? activeSort;
  const exactPrice =
    productStatusSort === ProductSortStatus.SET
      ? optionalNumber(
          product.prod_set_price,
          product.prod_price,
          product.pro_detail_sprice,
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
  const minPrice = optionalNumber(product.min_price);
  const maxPrice = optionalNumber(product.max_price);
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

export function productPriceFromDetail(detail?: ProdDetail | null) {
  return optionalNumber(detail?.pro_detail_sprice, detail?.price) ?? 0;
}

export function getModalBasePrice(
  product: ProdItem | null,
  detail: ProdDetail | null | undefined,
  mode: ProductModalMode,
) {
  return mode === "set"
    ? (optionalNumber(product?.prod_set_price) ?? 0)
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
