import { optionalBoolean, optionalNumber, optionalString } from "@/lib/values";
import type { CartItem, CartOrder, SplitBillItemQuantity } from "@/services/pos";
import {
  cartItemActionUuid,
  cartItemQty,
  cartItemStatus,
  cartItemTotal,
  cartSummary,
} from "./cart-readers";

// uuid ของรายการ -> จำนวนที่เลือกแยกจ่าย (1..จำนวนเต็มของรายการนั้น)
export type SplitItemQuantities = Map<string, number>;

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

function scaleAmount(value: number | null | undefined, ratio: number) {
  return value === null || value === undefined ? undefined : value * ratio;
}

// เลือกจ่ายแค่บางส่วนของจำนวนในรายการ (เช่น เบียร์ 10 ขวด จ่ายก่อน 2 ขวด) — สเกลทุกช่อง
// ยอด/จำนวนใน detail ด้วยอัตราส่วนเดียวกัน (selectedQty/fullQty) เพื่อให้ reader อื่น ๆ
// (cartItemTotal, cartItemBaseUnitPrice, splitItemGrossTotal) อ่านค่าที่ถูกต้องต่อโดยไม่ต้องแก้ตัวมันเอง
// เพราะราคาต่อหน่วย (unit_price) ไม่ถูกแตะ ส่วน qty กับยอดรวมสเกลไปด้วยกันเสมอ
function proratedSplitItem(item: CartItem, selectedQty: number): CartItem {
  const fullQty = cartItemQty(item);
  if (selectedQty >= fullQty || fullQty <= 0) return item;

  const ratio = selectedQty / fullQty;
  const detail = item.detail;
  if (!detail) return { ...item, qty: selectedQty };

  return {
    ...item,
    detail: {
      ...detail,
      order_it_qty: selectedQty,
      total_receive_qty:
        detail.total_receive_qty !== undefined
          ? selectedQty
          : detail.total_receive_qty,
      gross_total: scaleAmount(detail.gross_total, ratio),
      net_total: scaleAmount(detail.net_total, ratio),
      base_line_total: scaleAmount(detail.base_line_total, ratio),
      topping_line_total: scaleAmount(detail.topping_line_total, ratio),
      order_it_discount_amount: scaleAmount(
        detail.order_it_discount_amount,
        ratio,
      ),
    },
  };
}

export function splitPaymentSelection(
  orders: CartOrder[],
  selectedItemQuantities: SplitItemQuantities,
) {
  if (!selectedItemQuantities.size) return null;

  for (const order of orders) {
    const selectedItems = (order.items ?? [])
      .filter((item) => {
        const itemUuid = cartItemActionUuid(item);
        return Boolean(itemUuid && selectedItemQuantities.has(itemUuid));
      })
      .map((item) => {
        const itemUuid = cartItemActionUuid(item);
        const selectedQty = itemUuid
          ? (selectedItemQuantities.get(itemUuid) ?? cartItemQty(item))
          : cartItemQty(item);
        return proratedSplitItem(item, selectedQty);
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
    // ต่อ backend คือคู่ { order_it_uuid: จำนวนที่แยกจ่าย } หนึ่งคู่ต่อหนึ่ง element
    // ไม่ใช่ object เดียวรวมกันหลาย uuid — อ่านจำนวนจาก selectedItems ที่ prorate แล้ว
    // (cartItemQty จะได้ค่าที่ถูก clamp/scale ไว้แล้วจาก proratedSplitItem ด้านบน)
    const orderItemUuids: SplitBillItemQuantity[] = selectedItems
      .map((item) => {
        const uuid = cartItemActionUuid(item);
        return uuid ? { [uuid]: cartItemQty(item) } : null;
      })
      .filter((entry): entry is SplitBillItemQuantity => entry !== null);
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
      orderItemUuids,
      orderUuid,
      orders: [selectedOrder],
      summary,
    };
  }

  return null;
}

// ตัดรายการที่หลุดจากบิลออก และ clamp จำนวนที่ติ๊กไว้ไม่ให้เกินจำนวนเต็มปัจจุบันของรายการนั้น
// (เผื่อจำนวนของรายการถูกแก้จากที่อื่นระหว่างที่ติ๊กเลือกไว้สำหรับแยกบิลอยู่)
export function pruneSelectedItemQuantities(
  selectedItemQuantities: SplitItemQuantities,
  eligibleItems: CartItem[],
) {
  const eligibleQtyByUuid = new Map<string, number>();
  eligibleItems.forEach((item) => {
    const uuid = cartItemActionUuid(item);
    if (uuid) eligibleQtyByUuid.set(uuid, cartItemQty(item));
  });
  let changed = false;
  const next = new Map<string, number>();

  selectedItemQuantities.forEach((qty, uuid) => {
    const fullQty = eligibleQtyByUuid.get(uuid);
    if (fullQty === undefined) {
      changed = true;
      return;
    }
    const clamped = Math.min(Math.max(qty, 1), fullQty);
    if (clamped !== qty) changed = true;
    next.set(uuid, clamped);
  });

  return changed ? next : selectedItemQuantities;
}

export function cartDisplaySummary(
  fullSummary: ReturnType<typeof cartSummary>,
  splitSummary?: ReturnType<typeof cartSummary> | null,
) {
  return splitSummary ?? fullSummary;
}
