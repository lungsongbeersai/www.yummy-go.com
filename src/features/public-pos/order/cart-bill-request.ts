import type { CartItem, CartOrder, FetchCartStatusRule } from "@/services/pos";
import { getOrderItemUuid, isCanceledCartItem, isConfirmableCartItem } from "./cart-domain";

function explicitNumber(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function isSubmittedStatus(value: unknown) {
  const status = explicitNumber(value);
  // Status 1 is already confirmed by the customer, while awaiting staff.
  return status === 1 || status === 2 || status === 3 || status === 4;
}

function hasOnlySubmittedGroupStatuses(item: CartItem) {
  if (item.order_it_statuses === undefined) return true;
  if (!Array.isArray(item.order_it_statuses) || !item.order_it_statuses.length) return false;
  // Merged SET / promotion rows must not hide a draft or an unknown child.
  return item.order_it_statuses.some(isSubmittedStatus) &&
    item.order_it_statuses.every((status) => explicitNumber(status) === 9 || isSubmittedStatus(status));
}

export function canRequestBillFromCart(
  cart: readonly CartOrder[],
  statusRule: FetchCartStatusRule | null,
): boolean {
  let hasSubmittedItem = false;
  for (const order of cart) {
    for (const item of order.items ?? []) {
      // Deposit withdrawals are history rows, rather than live order items.
      if (item.is_deposit_redemption || isCanceledCartItem(item)) continue;
      if (!String(order.order_uuid ?? "").trim() || !getOrderItemUuid(item) || isConfirmableCartItem(item, statusRule)) return false;

      const status = item.detail?.order_it_status !== undefined
        ? item.detail.order_it_status
        : item.order_it_status;
      const rawQuantity = item.detail?.order_it_qty !== undefined
        ? item.detail.order_it_qty
        : item.qty !== undefined ? item.qty : item.quantity;
      const quantity = explicitNumber(rawQuantity);
      if (!isSubmittedStatus(status) || quantity === null || quantity <= 0 || !hasOnlySubmittedGroupStatuses(item)) return false;
      hasSubmittedItem = true;
    }
  }
  return hasSubmittedItem;
}
