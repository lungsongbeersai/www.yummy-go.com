import type { CartItem } from "@/services/pos";
import type { CartItemAction } from "./types";
import { cartItemActionUuid, cartItemRemovalActions } from "./cart-readers";

export class CartItemActionUnavailableError extends Error {}

// Resolve by persisted identity only: another product row must never be used
// as a replacement when the original item has disappeared.
export function currentCartItemAction(items: CartItem[], uuid: string, action: CartItemAction) {
  const item = items.find((entry) => cartItemActionUuid(entry) === uuid);
  if (!item) return null;
  const permissions = cartItemRemovalActions(item, action === "delete");
  return (action === "delete" ? permissions.canDelete : permissions.canCancel) ? item : null;
}

export function isMissingCartItemError(error: unknown) {
  return error instanceof Error && /ບໍ່ພົບ order item(?:\s|:|$)/.test(error.message);
}
