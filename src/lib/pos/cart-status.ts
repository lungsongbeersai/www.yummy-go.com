/**
 * Shared "is this order item canceled / served" decision rules for the two
 * independent CartItem status readers: public-pos/order/cart-domain.ts and
 * pos/table-selection/cart-readers.ts (P3.3).
 *
 * Each side keeps its own status-code / status-text extraction from
 * CartItem — they intentionally read different field sets (table-selection
 * also falls back to item.status/item.order_status; see cart-readers.ts) —
 * only the final "given this code and this lowercased text, is it
 * canceled/served" decision is deduped here.
 *
 * isCanceledCartStatus() is a true merge: both trees used the exact same
 * status code (9) and the exact same cancel-word list, so this is
 * behavior-identical on both sides.
 *
 * "Served" text matching genuinely diverges between the two surfaces (found
 * while diffing, not something this batch should silently unify): the
 * public customer menu also matches the Lao word "ເສີບ" as a substring
 * (asserted by public-pos/order/utils.test.ts), while the staff table view
 * only matches the literal English word "served" as an exact string. Kept
 * as two named rules so neither surface's output changes.
 */

const CANCELED_STATUS_CODE = 9;
const SERVED_STATUS_CODE = 4;

const CANCEL_TEXT_MATCHES = ["cancel", "canceled", "cancelled", "ຍົກເລີກ"];

export function isCanceledCartStatus(
  statusCode: number | null,
  statusText: string,
) {
  return (
    statusCode === CANCELED_STATUS_CODE ||
    CANCEL_TEXT_MATCHES.some((word) => statusText.includes(word))
  );
}

export function isServedCartStatusFlexible(
  statusCode: number | null,
  statusText: string,
) {
  return (
    statusCode === SERVED_STATUS_CODE ||
    statusText.includes("served") ||
    statusText.includes("ເສີບ")
  );
}

export function isServedCartStatusExact(
  statusCode: number | null,
  statusText: string,
) {
  return statusCode === SERVED_STATUS_CODE || statusText === "served";
}
