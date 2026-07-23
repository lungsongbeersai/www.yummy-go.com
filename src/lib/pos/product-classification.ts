import { ProductSortStatus } from "@/config/pos-constants";
import type { CateProductItem } from "@/services/pos";

/**
 * Shared "is this product blocked?" / "does it look like a modal-worthy
 * product?" rules, deduped from pos/order-customer/product-classification.ts
 * and public-pos/order/product-domain.ts, which mirrored this logic
 * near-verbatim (P3.3).
 *
 * hasPromo() is deliberately NOT here: the two trees' copies differ in a
 * whitespace-trim edge case on the free-text promo_state field (public-pos
 * doesn't trim, staff POS does), found while diffing byte-for-byte. Rather
 * than silently pick one, isKnownModalProductCore() below takes the
 * caller's own hasPromo(product) result as a parameter instead of calling
 * hasPromo itself, so this file never has to choose between the two.
 *
 * canDirectAddFromList, productNeedsModal, getProductActionState's own
 * shell, getProductModalMode, productModeLabel, getPromoLabel,
 * productBlockedLabel, isDetailAvailable/firstAvailableDetail, and
 * getModalBasePrice/productPriceFromDetail were all diffed and found to
 * genuinely diverge (different price/stock thresholds, extra guard
 * conditions, missing fallback fields, different i18n wiring) — each stays
 * defined in its own tree. See the diff notes in those files.
 */

function isPromotionEnded(
  product: CateProductItem,
  activeStatusSortFk: number,
) {
  if (product.promo_expired !== true) return false;

  const promoState = String(product.promo_state ?? "")
    .trim()
    .toUpperCase();
  const productStatusSort = Number(
    product.status_sort_fk ?? activeStatusSortFk,
  );
  return (
    productStatusSort === ProductSortStatus.PROMOTION ||
    Boolean(promoState && promoState !== "NONE") ||
    Boolean(String(product.promo_msg ?? "").trim())
  );
}

function isProductUnavailable(product: CateProductItem) {
  return (
    product.can_add === false ||
    product.sold_out_manual === true ||
    product.stock_available === false ||
    product.stock_sold_out === true
  );
}

export function getProductBlockedState(
  product: CateProductItem,
  activeStatusSortFk: number,
) {
  if (isPromotionEnded(product, activeStatusSortFk)) return "promotion-ended";
  if (isProductUnavailable(product)) return "sold-out";
  return null;
}

// hasPromoValue is supplied by the caller's own hasPromo(product) — see the
// file comment above for why this isn't called internally.
export function isKnownModalProductCore(
  product: CateProductItem,
  activeStatusSortFk: number,
  hasPromoValue: boolean,
) {
  const productStatusSort = Number(
    product.status_sort_fk ?? activeStatusSortFk,
  );
  return (
    product.has_options === true ||
    Number(product.count_option_enabled ?? 1) > 1 ||
    Number(product.count_option_all ?? 1) > 1 ||
    Number(product.count_topping_enabled ?? 0) > 0 ||
    productStatusSort === ProductSortStatus.SET ||
    productStatusSort === ProductSortStatus.PROMOTION ||
    hasPromoValue
  );
}

// Kept exported for API compatibility: public-pos/order/product-domain.ts
// used to define + export these two directly.
export { isPromotionEnded, isProductUnavailable };
