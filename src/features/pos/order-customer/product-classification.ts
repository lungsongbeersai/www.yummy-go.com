import { type CateProductItem, type ProdDetail, type ProdItem } from "@/services/pos";
import { optionalNumber, optionalString } from "@/lib/values";
import {
  getProductBlockedState,
  isKnownModalProductCore,
} from "@/lib/pos/product-classification";
import {
  ProductSortStatus,
  type ProductActionState,
  type ProductModalMode,
  type Translate,
} from "./menu-structure";
import { isDetailAvailable } from "./product-availability";
import { isToppingAvailable } from "./topping-selection";

// P3.3: getProductBlockedState is byte-identical to public-pos/order's copy
// and now lives in src/lib/pos/product-classification.ts; re-exported here
// unchanged so the ~9 importers of this module don't need to change.
export { getProductBlockedState };

export function hasPromo(product: CateProductItem) {
  const promoState = String(product.promo_state ?? "")
    .trim()
    .toUpperCase();
  return Boolean(
    promoState && promoState !== "NONE" && product.promo_expired !== true,
  );
}

// Diffing against public-pos/order/product-domain.ts's isKnownModalProduct
// found the same 6 conditions, differing only in this hasPromo(product)
// call — which itself has a whitespace-trim divergence between the two
// trees (see the shared module's file comment). isKnownModalProductCore
// takes that as an explicit parameter so this wrapper's own behavior is
// unchanged.
function isKnownModalProduct(
  product: CateProductItem,
  activeSort: ProductSortStatus,
) {
  return isKnownModalProductCore(product, activeSort, hasPromo(product));
}

export function productBlockedLabel(
  blockedState: ReturnType<typeof getProductBlockedState>,
  product: CateProductItem,
  t: Translate,
) {
  if (blockedState === "promotion-ended") return t("pos.promotionEnded");
  if (blockedState === "sold-out")
    return optionalString(product.sold_out_msg) ?? t("pos.outOfStock");
  return "";
}

export function productNeedsModal(
  product: CateProductItem,
  item: ProdItem,
  activeSort: ProductSortStatus,
) {
  const enabledDetails = (item.details ?? []).filter(isDetailAvailable);
  const enabledToppings = (item.toppings ?? []).filter(isToppingAvailable);
  return (
    !canDirectAddFromList(product, activeSort) ||
    isKnownModalProduct(product, activeSort) ||
    enabledDetails.length > 1 ||
    enabledToppings.length > 0
  );
}

export function canDirectAddFromList(
  product: CateProductItem,
  activeSort: ProductSortStatus,
) {
  const detailUuid = optionalString(product.pro_detail_uuid);
  const price = optionalNumber(product.pro_detail_sprice, product.prod_price);
  const productStatusSort =
    optionalNumber(product.status_sort_fk) ?? activeSort;
  const enabledOptionCount = optionalNumber(product.count_option_enabled) ?? 1;
  const allOptionCount = optionalNumber(product.count_option_all) ?? 1;

  return (
    Boolean(detailUuid) &&
    price !== null &&
    price > 0 &&
    product.has_options !== true &&
    enabledOptionCount <= 1 &&
    allOptionCount <= 1 &&
    (optionalNumber(product.count_topping_enabled) ?? 0) <= 0 &&
    productStatusSort !== ProductSortStatus.SET &&
    productStatusSort !== ProductSortStatus.PROMOTION &&
    !hasPromo(product) &&
    !getProductBlockedState(product, activeSort)
  );
}

export function getProductActionState(
  product: CateProductItem,
  activeSort: ProductSortStatus,
): ProductActionState {
  if (getProductBlockedState(product, activeSort)) return "blocked";
  if (isKnownModalProduct(product, activeSort)) return "choose";
  if (canDirectAddFromList(product, activeSort)) return "add";
  return "view";
}

export function productActionLabel(
  actionState: ProductActionState,
  product: CateProductItem,
  activeSort: ProductSortStatus,
  t: Translate,
) {
  if (actionState === "blocked")
    return productBlockedLabel(
      getProductBlockedState(product, activeSort),
      product,
      t,
    );
  if (actionState === "choose") return t("pos.chooseOptions");
  if (actionState === "view") return t("pos.viewDetails");
  return t("pos.addItem");
}

export function getProductModalMode(
  activeSort: ProductSortStatus,
  product?: ProdItem | null,
): ProductModalMode {
  if (activeSort === ProductSortStatus.PROMOTION) return "promotion";
  if (activeSort === ProductSortStatus.SET) return "set";

  const productStatus = optionalNumber(product?.status_sort_fk);
  if (productStatus === ProductSortStatus.PROMOTION) return "promotion";
  if (productStatus === ProductSortStatus.SET) return "set";

  const typeGroup = String(product?.type_group ?? "").toLowerCase();
  if (typeGroup.includes("promo")) return "promotion";
  if (
    typeGroup.includes("set") ||
    (optionalNumber(product?.prod_set_price) ?? 0) > 0
  )
    return "set";
  return "normal";
}

export function productModeLabel(
  mode: ProductModalMode,
  product: ProdItem,
  t: Translate,
) {
  if (product.type_group) return product.type_group;
  if (mode === "promotion") return t("pos.menuPromotion");
  if (mode === "set") return t("pos.menuSet");
  return t("pos.menuNormal");
}

export function getPromoLabel(
  detail: ProdDetail | null | undefined,
  t: Translate,
) {
  const buy = optionalNumber(detail?.pro_detail_cus_qtyBuy) ?? 0;
  const free = optionalNumber(detail?.pro_detail_cus_qtyFree) ?? 0;

  if (buy > 0 && free > 0)
    return `${t("pos.buyShort")} ${buy} ${t("pos.freeShort")} ${free}`;
  if (free > 0) return `${t("pos.freeShort")} ${free}`;
  return t("pos.promotion");
}
