import { optionalBoolean, optionalNumber, optionalString } from "@/lib/values";
import type { CartItem, CartOrder } from "@/services/pos";
import {
  cartItemActionUuid,
  cartItemQty,
  cartItemStatus,
  cartItemTotal,
  cartSummary,
} from "./cart-readers";

export interface FullBillPaymentEligibilityInput {
  currentOrderUuid: string | null;
  grandTotal: number;
  historyItemCount: number;
  newOrderItemCount: number;
  waitingItemCount: number;
}

export function canPayFullBill({
  currentOrderUuid,
  grandTotal,
  historyItemCount,
  newOrderItemCount,
  waitingItemCount,
}: FullBillPaymentEligibilityInput) {
  return Boolean(
    currentOrderUuid &&
      (historyItemCount > 0 || waitingItemCount > 0) &&
      newOrderItemCount === 0 &&
      grandTotal > 0,
  );
}

export function isSplitPaymentEligibleItem(item: CartItem) {
  const status = cartItemStatus(item);
  return Boolean(cartItemActionUuid(item) && status !== 1 && status !== 9);
}

export function splitItemGrossTotal(item: CartItem) {
  const grossTotal = optionalNumber(item.detail?.gross_total);
  if (grossTotal !== null) return grossTotal;

  const baseLineTotal = optionalNumber(item.detail?.base_line_total);
  const toppingLineTotal = optionalNumber(item.detail?.topping_line_total);
  if (baseLineTotal !== null || toppingLineTotal !== null) {
    return (baseLineTotal ?? 0) + (toppingLineTotal ?? 0);
  }

  return cartItemTotal(item);
}

export function splitPaymentSelection(
  orders: CartOrder[],
  selectedItemUuids: Set<string>,
) {
  if (!selectedItemUuids.size) return null;

  for (const order of orders) {
    const selectedItems = (order.items ?? []).filter((item) => {
      const itemUuid = cartItemActionUuid(item);
      return Boolean(itemUuid && selectedItemUuids.has(itemUuid));
    });
    const orderUuid = optionalString(order.order_uuid);
    if (!orderUuid || selectedItems.length === 0) continue;

    const subtotal = selectedItems.reduce(
      (sum, item) => sum + splitItemGrossTotal(item),
      0,
    );
    const totalDiscount = selectedItems.reduce(
      (sum, item) =>
        sum + (optionalNumber(item.detail?.order_it_discount_amount) ?? 0),
      0,
    );
    const netTotal = subtotal - totalDiscount;
    const serviceRate =
      optionalNumber(order.service_charge_rate, order.charge_name) ?? 0;
    const taxRate =
      optionalNumber(order.vat_rate, order.totals?.vat_rate, order.vat_name) ??
      0;
    const serviceTotal = optionalBoolean(order.service_enabled)
      ? netTotal * (serviceRate / 100)
      : 0;
    const tax = optionalBoolean(order.vat_enabled)
      ? (netTotal + serviceTotal) * (taxRate / 100)
      : 0;
    const grandTotal = netTotal + serviceTotal + tax;
    const orderQty = selectedItems.reduce(
      (sum, item) => sum + cartItemQty(item),
      0,
    );
    const itemUuids = selectedItems
      .map(cartItemActionUuid)
      .filter((uuid): uuid is string => Boolean(uuid));
    const selectedOrder: CartOrder = {
      ...order,
      items: selectedItems,
      sum_detail_total: subtotal,
      sum_discount_total: totalDiscount,
      sum_grand_total: grandTotal,
      sum_service_total: serviceTotal,
      sum_vat_total: tax,
      totals: {
        ...order.totals,
        order_discount_amount: 0,
        order_grand_total: grandTotal,
        order_item_discount_amount: totalDiscount,
        order_qty: orderQty,
        order_service_amount: serviceTotal,
        order_subtotal: subtotal,
        order_total: subtotal,
        order_vat_amount: tax,
      },
    };
    const summary: ReturnType<typeof cartSummary> = {
      detailTotal: subtotal,
      discountTotal: totalDiscount,
      grandTotal,
      itemDiscount: totalDiscount,
      orderDiscount: 0,
      orderGrandTotal: grandTotal,
      orderQty,
      orderService: serviceTotal,
      orderTotal: subtotal,
      orderVat: tax,
      serviceRate,
      serviceTotal,
      subtotal,
      sumGrandTotal: grandTotal,
      tax,
      taxRate,
      toppingTotal: null,
      vatTotal: tax,
    };

    return {
      itemUuids,
      orderUuid,
      orders: [selectedOrder],
      summary,
    };
  }

  return null;
}

export function pruneSelectedItemUuids(
  selectedItemUuids: Set<string>,
  eligibleItemUuids: Array<string | null | undefined>,
) {
  const eligibleUuids = new Set(
    eligibleItemUuids.filter((uuid): uuid is string => Boolean(uuid)),
  );
  let changed = false;
  const next = new Set<string>();

  selectedItemUuids.forEach((uuid) => {
    if (eligibleUuids.has(uuid)) {
      next.add(uuid);
    } else {
      changed = true;
    }
  });

  return changed ? next : selectedItemUuids;
}

export function cartDisplaySummary(
  fullSummary: ReturnType<typeof cartSummary>,
  splitSummary?: ReturnType<typeof cartSummary> | null,
) {
  return splitSummary ?? fullSummary;
}
