import { ProductSortStatus } from "@/config/pos-constants";
import type { CateProductItem } from "@/services/pos";

/**
 * Shared "is this product blocked?" / "does it look like a modal-worthy
 * product?" decisions for staff and public ordering.
 *
 * The two surfaces deliberately keep their own numeric coercion. Staff POS
 * skips empty, malformed, and non-finite values before falling back; public
 * ordering preserves direct Number(...) coercion. Callers resolve those
 * values before entering this core so both surfaces retain their legacy
 * behavior.
 *
 * hasPromo() is deliberately NOT here: the two trees' copies differ in a
 * whitespace-trim edge case on the free-text promo_state field (public-pos
 * doesn't trim, staff POS does), found while diffing byte-for-byte. Rather
 * than silently pick one, isKnownModalProductCore() below takes the
 * caller's own hasPromo(product) result as an input instead of calling
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

export function isPromotionEndedCore(
  product: CateProductItem,
  productStatusSort: number,
) {
  if (product.promo_expired !== true) return false;

  const promoState = String(product.promo_state ?? "")
    .trim()
    .toUpperCase();
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

export function getProductBlockedStateCore(
  product: CateProductItem,
  productStatusSort: number,
) {
  if (isPromotionEndedCore(product, productStatusSort))
    return "promotion-ended";
  if (isProductUnavailable(product)) return "sold-out";
  return null;
}

export function isKnownModalProductCore(
  {
    allOptionCount,
    enabledOptionCount,
    enabledToppingCount,
    hasOptions,
    hasPromo,
    productStatusSort,
  }: {
    allOptionCount: number;
    enabledOptionCount: number;
    enabledToppingCount: number;
    hasOptions: boolean;
    hasPromo: boolean;
    productStatusSort: number;
  },
) {
  return (
    hasOptions ||
    enabledOptionCount > 1 ||
    allOptionCount > 1 ||
    enabledToppingCount > 0 ||
    productStatusSort === ProductSortStatus.SET ||
    productStatusSort === ProductSortStatus.PROMOTION ||
    hasPromo
  );
}

export { isProductUnavailable };
