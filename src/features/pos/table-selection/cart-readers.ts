import { money } from "@/lib/format";
import {
  isCanceledCartStatus,
  isServedCartStatusExact,
} from "@/lib/pos/cart-status";
import { optionalNumber, optionalString } from "@/lib/values";
import { ProductImageStatus } from "@/config/pos-constants";
import type { CartItem, CartOrder, CartTopping, PosTable } from "@/services/pos";

const HEX_COLOR_PATTERN =
  /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export type CartItemMedia =
  | { type: "image"; src: string }
  | { type: "color"; color: string }
  | { type: "empty" };

export function formatQuantityValue(...values: unknown[]) {
  const value = optionalNumber(...values);
  return value === null ? null : String(value);
}

export function positiveNumber(...values: unknown[]) {
  const value = optionalNumber(...values);
  return value !== null && value > 0 ? value : null;
}

export function formatPositiveMoneyValue(...values: unknown[]) {
  const value = positiveNumber(...values);
  return value === null ? null : money(value);
}

export function formatPlainValue(...values: unknown[]) {
  const numberValue = optionalNumber(...values);
  if (numberValue !== null) return String(numberValue);
  return optionalString(...values);
}

export function differentNumber(left: number | null, right: number | null) {
  return left !== null && right !== null && left !== right;
}

export function formatRate(value: number | null) {
  if (value === null) return null;
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

export function cartOrders(cart: CartOrder | CartOrder[] | null) {
  if (!cart) return [];
  return Array.isArray(cart) ? cart : [cart];
}

export function cartOrderTableUuid(order: CartOrder) {
  return optionalString(order.table_uuid_fk, order.table_uuid);
}

export function cartOrderTableName(order: CartOrder) {
  return optionalString(
    order.table_name,
    order.table_name_la,
    order.table_name_eng,
  );
}

export function cartOrderBelongsToTable(order: CartOrder, table: PosTable) {
  const orderTableUuid = cartOrderTableUuid(order);
  if (orderTableUuid) return orderTableUuid === table.table_uuid;

  const orderTableName = cartOrderTableName(order);
  if (orderTableName) {
    return orderTableName.trim() === table.table_name.trim();
  }

  return true;
}

export function cartOrdersBelongToTable(orders: CartOrder[], table: PosTable) {
  return orders.every((order) => cartOrderBelongsToTable(order, table));
}

export function cartForTable(
  cart: CartOrder | CartOrder[] | null,
  tableUuid: string,
) {
  if (!cart || !tableUuid) return null;

  const orders = cartOrders(cart);
  const hasTableScopedOrders = orders.some((order) => cartOrderTableUuid(order));

  if (!hasTableScopedOrders) return cart;

  const matchingOrders = orders.filter(
    (order) => cartOrderTableUuid(order) === tableUuid,
  );

  if (!matchingOrders.length) return null;
  return Array.isArray(cart) ? matchingOrders : matchingOrders[0];
}

export function cartItemName(item: CartItem) {
  return String(
    item.prod_name ?? item.title ?? item.product_name ?? item.name ?? "-",
  );
}

export function cartItemDisplayName(title: string, sizeName: string | null) {
  if (!sizeName) return title.trim();

  const trimmedTitle = title.trim();
  const trimmedSize = sizeName.trim();
  const sizeSuffixes = [
    `(${trimmedSize})`,
    `（${trimmedSize}）`,
    `[${trimmedSize}]`,
  ];

  if (sizeSuffixes.some((suffix) => trimmedTitle.endsWith(suffix)))
    return trimmedTitle;

  return `${trimmedTitle} (${trimmedSize})`;
}

function isHexColor(value: string) {
  return HEX_COLOR_PATTERN.test(value.trim());
}

export function cartItemMedia(item: CartItem): CartItemMedia {
  const mediaValue = optionalString(
    item.prod_image,
    item.product_image,
    item.image,
  );
  if (!mediaValue) return { type: "empty" };

  const imageStatus = optionalNumber(
    item.prod_status_imge,
    item.prod_status_image,
    item.product_image_status,
    item.image_status,
  );
  const isColor =
    imageStatus === ProductImageStatus.COLOR || isHexColor(mediaValue);

  if (isColor) {
    return isHexColor(mediaValue)
      ? { type: "color", color: mediaValue }
      : { type: "empty" };
  }

  return { type: "image", src: mediaValue };
}

// backend ส่งจำนวนต่อสินค้าและยอดรวมของทั้งรายการมาแล้ว จึงไม่คูณ order_it_qty ซ้ำตอนแสดงผล
export function cartToppingDisplay(topping: CartTopping) {
  return {
    qty: optionalNumber(topping.topping_qty),
    total: positiveNumber(topping.topping_line_total, topping.topping_price),
  };
}

export function cartItemQty(item: CartItem) {
  return (
    optionalNumber(
      item.detail?.order_it_qty,
      item.detail?.total_receive_qty,
      item.qty,
      item.quantity,
      item.item_qty,
    ) ?? 1
  );
}

export function cartItemTotal(item: CartItem) {
  const explicitTotal = optionalNumber(
    item.detail?.net_total,
    item.detail?.gross_total,
    item.total,
    item.amount,
    item.line_total,
    item.subtotal,
  );
  if (explicitTotal !== null) return explicitTotal;
  const price =
    optionalNumber(
      item.detail?.unit_price,
      item.price,
      item.prod_price,
      item.product_price,
      item.pro_detail_sprice,
    ) ?? 0;
  return price * cartItemQty(item);
}

export function cartItemBaseUnitPrice(item: CartItem) {
  const qty = cartItemQty(item);
  const baseLineTotal = optionalNumber(item.detail?.base_line_total);
  if (baseLineTotal !== null && qty > 0) return baseLineTotal / qty;

  const grossTotal = optionalNumber(item.detail?.gross_total);
  const toppingLineTotal = optionalNumber(item.detail?.topping_line_total);
  if (grossTotal !== null && toppingLineTotal !== null && qty > 0) {
    return Math.max(0, grossTotal - toppingLineTotal) / qty;
  }

  return optionalNumber(
    item.detail?.unit_price,
    item.price,
    item.prod_price,
    item.product_price,
    item.pro_detail_sprice,
  );
}

export function cartItemDiscountMaxAmount(item: CartItem) {
  const grossTotal = optionalNumber(item.detail?.gross_total);
  if (grossTotal !== null) return Math.max(0, grossTotal);

  const baseLineTotal = optionalNumber(item.detail?.base_line_total);
  const toppingLineTotal = optionalNumber(item.detail?.topping_line_total);
  if (baseLineTotal !== null || toppingLineTotal !== null) {
    return Math.max(0, (baseLineTotal ?? 0) + (toppingLineTotal ?? 0));
  }

  return Math.max(0, cartItemTotal(item));
}

export function cartItemUuid(item: CartItem) {
  return optionalString(item.order_it_uuid, item.order_item_uuid);
}

export function cartItemActionUuid(item: CartItem) {
  return optionalString(item.order_it_uuid);
}

export function cartItemStatus(item: CartItem) {
  return optionalNumber(
    item.detail?.order_it_status,
    item.order_it_status,
    item.status,
    item.order_status,
  );
}

export function isWaitingCartItem(item: CartItem) {
  return cartItemStatus(item) === 0;
}

export function isNewOrderCartItem(item: CartItem) {
  return cartItemStatus(item) === 1;
}

export function isOrderHistoryCartItem(item: CartItem) {
  const status = cartItemStatus(item);
  return status === null || (status !== 0 && status !== 1);
}

export function newOrderTabItems(items: CartItem[]) {
  return [
    ...items.filter(isNewOrderCartItem),
    ...items.filter(isWaitingCartItem),
  ];
}

// P3.3: decisions shared with public-pos/order/cart-domain.ts in
// src/lib/pos/cart-status.ts — see that file's comment for why
// isServedCartItem uses the "exact" rule here (no Lao match, unlike the
// public menu) while isCanceledCartItem's rule is byte-identical on both
// sides. This file keeps its own status-code/text extraction unchanged.
export function isServedCartItem(item: CartItem) {
  const statusText =
    optionalString(item.detail?.order_it_status_text)?.toLowerCase() ?? "";
  return isServedCartStatusExact(cartItemStatus(item), statusText);
}

export function isCanceledCartItem(item: CartItem) {
  const statusText =
    optionalString(item.detail?.order_it_status_text)?.toLowerCase() ?? "";
  return isCanceledCartStatus(cartItemStatus(item), statusText);
}

export function cartItems(cart: CartOrder | CartOrder[] | null) {
  return cartOrders(cart).flatMap((order) => order.items ?? []);
}

// items ที่มาจาก order.items เป็น CartItem เสมอ (ไม่มี null/undefined หลุดมา)
// ชื่อฟังก์ชันนี้คงไว้เพื่อสื่อความหมาย "รายการที่แสดงผล" แม้จะไม่กรองอะไรจริง
export function visibleCartItems(cart: CartOrder | CartOrder[] | null) {
  return cartItems(cart);
}

export function cartOrderInvoice(orders: CartOrder[]) {
  for (const order of orders) {
    const invoice = optionalString(order.order_invoice);
    if (invoice) return invoice;
  }
  return null;
}

export function newOrderConfirmGroups(orders: CartOrder[]) {
  return orders
    .map((order) => ({
      orderUuid: optionalString(order.order_uuid),
      itemUuids: (order.items ?? [])
        .filter(isNewOrderCartItem)
        .map(cartItemUuid)
        .filter((uuid): uuid is string => Boolean(uuid)),
    }))
    .filter(
      (group) => Boolean(group.orderUuid) && group.itemUuids.length > 0,
    ) as {
    orderUuid: string;
    itemUuids: string[];
  }[];
}

export function cartItemsTotal(items: CartItem[]) {
  return items.reduce((sum, item) => sum + cartItemTotal(item), 0);
}

export function cartItemsQty(items: CartItem[]) {
  return items.reduce((sum, item) => sum + cartItemQty(item), 0);
}

export function sumOrderValue(
  orders: CartOrder[],
  selector: (order: CartOrder) => number | null,
) {
  let hasValue = false;
  const total = orders.reduce((sum, order) => {
    const value = selector(order);
    if (value === null) return sum;
    hasValue = true;
    return sum + value;
  }, 0);
  return hasValue ? total : null;
}

export function firstOrderValue(
  orders: CartOrder[],
  selector: (order: CartOrder) => number | null,
) {
  for (const order of orders) {
    const value = selector(order);
    if (value !== null) return value;
  }
  return null;
}

export function cartSummary(cart: CartOrder | CartOrder[] | null) {
  const orders = cartOrders(cart);
  const visibleItemsTotal = cartItemsTotal(visibleCartItems(cart));
  const detailTotal = sumOrderValue(orders, (order) =>
    optionalNumber(order.sum_detail_total),
  );
  const toppingTotal = sumOrderValue(orders, (order) =>
    optionalNumber(order.sum_topping_total),
  );
  const discountTotal = sumOrderValue(orders, (order) =>
    optionalNumber(order.sum_discount_total),
  );
  const orderService = sumOrderValue(orders, (order) =>
    optionalNumber(order.totals?.order_service_amount),
  );
  const serviceTotal =
    orderService ??
    sumOrderValue(orders, (order) => optionalNumber(order.sum_service_total)) ??
    sumOrderValue(orders, (order) =>
      optionalNumber(order.service_charge_amount),
    );
  const vatTotal = sumOrderValue(orders, (order) =>
    optionalNumber(order.sum_vat_total, order.vat_amount),
  );
  const sumGrandTotal = sumOrderValue(orders, (order) =>
    optionalNumber(order.sum_grand_total),
  );
  const orderQty = sumOrderValue(orders, (order) =>
    optionalNumber(order.totals?.order_qty),
  );
  const orderTotal = sumOrderValue(orders, (order) =>
    optionalNumber(order.totals?.order_total),
  );
  const orderDiscount = sumOrderValue(orders, (order) =>
    optionalNumber(order.totals?.order_discount_amount),
  );
  const itemDiscount = sumOrderValue(orders, (order) =>
    optionalNumber(order.totals?.order_item_discount_amount),
  );
  const orderVat = sumOrderValue(orders, (order) =>
    optionalNumber(order.totals?.order_vat_amount),
  );
  const orderGrandTotal = sumOrderValue(orders, (order) =>
    optionalNumber(order.totals?.order_grand_total),
  );
  const subtotal =
    sumOrderValue(orders, (order) =>
      optionalNumber(
        order.totals?.order_subtotal,
        order.totals?.subtotal,
        order.subtotal,
      ),
    ) ?? visibleItemsTotal;
  const tax = orderVat ?? vatTotal ?? 0;
  const grandTotal =
    orderGrandTotal ??
    sumGrandTotal ??
    sumOrderValue(orders, (order) =>
      optionalNumber(order.totals?.total, order.total),
    ) ??
    subtotal + tax;
  const taxRate = firstOrderValue(orders, (order) =>
    optionalNumber(order.vat_rate, order.totals?.vat_rate, order.vat_name),
  );
  const serviceRate = firstOrderValue(orders, (order) =>
    optionalNumber(order.service_charge_rate, order.charge_name),
  );

  return {
    detailTotal,
    discountTotal,
    grandTotal,
    itemDiscount,
    orderDiscount,
    orderGrandTotal,
    orderQty,
    orderService,
    orderTotal,
    orderVat,
    serviceTotal,
    serviceRate,
    subtotal,
    sumGrandTotal,
    tax,
    taxRate,
    toppingTotal,
    vatTotal,
  };
}

export function cartQuantityCount(cart: CartOrder | CartOrder[] | null) {
  return cartSummary(cart).orderQty ?? cartItemsQty(visibleCartItems(cart));
}

export function firstCartOrderUuid(orders: CartOrder[]) {
  for (const order of orders) {
    const orderUuid = optionalString(order.order_uuid);
    if (orderUuid) return orderUuid;
  }
  return null;
}

export function cartOrderUuidForItem(orders: CartOrder[], item: CartItem) {
  const itemUuid = cartItemActionUuid(item);
  if (!itemUuid) return null;

  for (const order of orders) {
    const orderUuid = optionalString(order.order_uuid);
    if (!orderUuid) continue;

    const hasItem = (order.items ?? []).some(
      (orderItem) => cartItemActionUuid(orderItem) === itemUuid,
    );
    if (hasItem) return orderUuid;
  }

  return null;
}
