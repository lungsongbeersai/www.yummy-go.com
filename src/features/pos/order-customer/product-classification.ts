import { type CateProductItem, type ProdDetail, type ProdItem } from "@/services/pos";
import { optionalNumber, optionalString } from "@/lib/values";
import {
  getProductBlockedStateCore,
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

// Staff POS intentionally skips invalid numeric API values before applying
// route fallbacks; shared classification receives only these resolved values.
function staffProductStatusSort(
  product: CateProductItem,
  activeSort: ProductSortStatus,
) {
  return optionalNumber(product.statusSortFk) ?? activeSort;
}

export function getProductBlockedState(
  product: CateProductItem,
  activeSort: ProductSortStatus,
) {
  return getProductBlockedStateCore(
    product,
    staffProductStatusSort(product, activeSort),
  );
}

export function hasPromo(product: CateProductItem) {
  const promoState = String(product.promoState ?? "")
    .trim()
    .toUpperCase();
  return Boolean(
    promoState && promoState !== "NONE" && product.promoExpired !== true,
  );
}

function isKnownModalProduct(
  product: CateProductItem,
  activeSort: ProductSortStatus,
) {
  return isKnownModalProductCore({
    allOptionCount: optionalNumber(product.countOptionAll) ?? 1,
    enabledOptionCount:
      optionalNumber(product.countOptionEnabled) ?? 1,
    enabledToppingCount:
      optionalNumber(product.countToppingEnabled) ?? 0,
    hasOptions: product.hasOptions === true,
    hasPromo: hasPromo(product),
    productStatusSort: staffProductStatusSort(product, activeSort),
  });
}

export function productBlockedLabel(
  blockedState: ReturnType<typeof getProductBlockedState>,
  product: CateProductItem,
  t: Translate,
) {
  if (blockedState === "promotion-ended") return t("pos.promotionEnded");
  if (blockedState === "sold-out")
    return optionalString(product.soldOutMsg) ?? t("pos.outOfStock");
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
  const detailUuid = optionalString(product.proDetailUuid);
  const price = optionalNumber(product.proDetailSprice, product.prodPrice);
  const productStatusSort =
    optionalNumber(product.statusSortFk) ?? activeSort;
  const enabledOptionCount = optionalNumber(product.countOptionEnabled) ?? 1;
  const allOptionCount = optionalNumber(product.countOptionAll) ?? 1;

  return (
    Boolean(detailUuid) &&
    price !== null &&
    price > 0 &&
    product.hasOptions !== true &&
    enabledOptionCount <= 1 &&
    allOptionCount <= 1 &&
    (optionalNumber(product.countToppingEnabled) ?? 0) <= 0 &&
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

  const productStatus = optionalNumber(product?.statusSortFk);
  if (productStatus === ProductSortStatus.PROMOTION) return "promotion";
  if (productStatus === ProductSortStatus.SET) return "set";

  const typeGroup = String(product?.typeGroup ?? "").toLowerCase();
  if (typeGroup.includes("promo")) return "promotion";
  if (
    typeGroup.includes("set") ||
    (optionalNumber(product?.prodSetPrice) ?? 0) > 0
  )
    return "set";
  return "normal";
}

export function productModeLabel(
  mode: ProductModalMode,
  product: ProdItem,
  t: Translate,
) {
  if (product.typeGroup) return product.typeGroup;
  if (mode === "promotion") return t("pos.menuPromotion");
  if (mode === "set") return t("pos.menuSet");
  return t("pos.menuNormal");
}

export function getPromoLabel(
  detail: ProdDetail | null | undefined,
  t: Translate,
) {
  const buy = optionalNumber(detail?.proDetailCusQtyBuy) ?? 0;
  const free = optionalNumber(detail?.proDetailCusQtyFree) ?? 0;

  if (buy > 0 && free > 0)
    return `${t("pos.buyShort")} ${buy} ${t("pos.freeShort")} ${free}`;
  if (free > 0) return `${t("pos.freeShort")} ${free}`;
  return t("pos.promotion");
}
