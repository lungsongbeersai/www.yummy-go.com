import { roundLak } from "@/lib/pos/lak-money";
import { calculateVat } from "@/lib/pos/vat";
import type { OfflineMasterIndex } from "./master-index";
import { openOrderForTable, visibleItemsForOrder } from "./order-state";
import type { OfflineOrderItem, OfflineOrderState } from "./types";
import { OfflineCartDataUnavailableError } from "./cart-data-error";

// The offline cart, rendered in the exact shape `GET /api/v1/posAll/fetch_cart`
// returns, so every existing reader — cart-readers, payment-dialog-utils,
// customer display — keeps working untouched. The arithmetic mirrors the Local
// Printer Agent's localCartResponse, and VAT goes through the same
// `src/lib/pos/vat.ts` the online payment dialog uses, which is itself kept in
// step with `back-end/api/v1/shared/vat-calculation.js`. One formula, three
// callers: nothing here may invent its own rounding.

export interface OfflineCartLine {
  order_item_uuid: string;
  order_it_uuid: string;
  prod_uuid: string;
  pro_detail_uuid: string;
  prod_name: string;
  title: string;
  prod_status_imge: number;
  prod_image: string;
  qty: number;
  total: number;
  detail: {
    order_it_qty: number;
    unit_price: number;
    base_line_total: number;
    topping_unit_total: number;
    topping_line_total: number;
    gross_total: number;
    order_it_discount_type: string;
    order_it_discount_value: number;
    order_it_discount_amount: number;
    net_total: number;
    order_it_status: number;
    order_it_note: string;
    affects_total: boolean;
  };
  toppings: OfflineOrderItem["toppings"];
}

export interface OfflineCartOrder {
  order_uuid: string;
  order_invoice: string;
  table_uuid_fk: string | null;
  order_discount_type: string;
  order_discount_value: number;
  service_charge_rate: number;
  vat_rate: number;
  vat_status: number | null;
  items: OfflineCartLine[];
  totals: Record<string, number>;
  sum_detail_total: number;
  sum_topping_total: number;
  sum_discount_total: number;
  sum_service_total: number;
  sum_vat_total: number;
  service_charge_amount: number;
  vat_amount: number;
  amount_before_vat: number;
  grand_total: number;
  sum_grand_total: number;
}

export interface OfflineCartResponse {
  status: string;
  message: string;
  offline: true;
  orders: OfflineCartOrder[];
  data: OfflineCartOrder[];
  totals?: Record<string, number>;
}

function money(value: number) {
  return roundLak(Number(value) || 0);
}

function discountAmount(base: number, type: string, value: number) {
  const code = String(type || "").toUpperCase();
  if (code === "PCT" || code === "1") return money((base * value) / 100);
  if (code === "AMT" || code === "2") return money(value);
  return 0;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

function storedMoney(value: unknown): number | null {
  if (value === null || value === undefined || value === "" || typeof value === "boolean") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function lineFor(item: OfflineOrderItem, master: OfflineMasterIndex) {
  const snapshot = item.snapshot ?? {};
  const savedDetail = record(snapshot.detail);
  const menu = master.details.get(item.prodDetailUuid);
  const savedPrice = storedMoney(savedDetail.unit_price);
  const price = savedPrice ?? menu?.price;
  const productName = String(snapshot.title || snapshot.prod_name || menu?.productName || "").trim();
  // A missing lookup is unknown, not a free item. Do not produce a successful
  // zero-valued cart, and never use another line's price to repair this one.
  if (price === undefined || !Number.isFinite(price) || price < 0 || !productName) {
    throw new OfflineCartDataUnavailableError();
  }
  const detail = {
    prodUuid: String(snapshot.prod_uuid || menu?.prodUuid || ""),
    productName,
    productImage: String(snapshot.prod_image ?? menu?.productImage ?? ""),
    productHasImage: Number(snapshot.prod_status_imge ?? menu?.productHasImage ?? 0),
  };
  const toppingUnitTotal = item.toppings.reduce((sum, topping) => {
    const price = topping.topping_price ?? master.toppingPrices.get(topping.prod_topping_uuid_fk);
    if (price === undefined || !Number.isFinite(price) || price < 0) throw new OfflineCartDataUnavailableError();
    return sum + price * (topping.topping_qty ?? 1);
  }, 0);
  const unitPrice = money(price);
  const sameQuantity = Number(savedDetail.order_it_qty) === item.quantity;
  const sameDiscount = String(savedDetail.order_it_discount_type ?? "").toUpperCase() === item.discountType &&
    Number(savedDetail.order_it_discount_value ?? 0) === item.discountValue;
  // Preserve Backend promotion/set arithmetic on an unchanged cached line.
  const baseTotal = sameQuantity ? storedMoney(savedDetail.base_line_total) ?? money(unitPrice * item.quantity) : money(unitPrice * item.quantity);
  const toppingTotal = money(toppingUnitTotal * item.quantity);
  const gross = sameQuantity ? storedMoney(savedDetail.gross_total) ?? money(baseTotal + toppingTotal) : money(baseTotal + toppingTotal);
  const itemDiscount = sameQuantity && sameDiscount
    ? storedMoney(savedDetail.order_it_discount_amount) ?? discountAmount(gross, item.discountType, item.discountValue)
    : discountAmount(gross, item.discountType, item.discountValue);
  const total = money(Math.max(gross - itemDiscount, 0));
  const affectsTotal = savedDetail.affects_total !== false && item.status !== 0;
  return { detail, unitPrice, baseTotal, toppingUnitTotal, toppingTotal, gross, itemDiscount, total, affectsTotal, savedDetail };
}

export function projectOfflineCartOrder(
  state: OfflineOrderState,
  orderUuid: string,
  master: OfflineMasterIndex,
): OfflineCartOrder | null {
  const order = state.orders.get(orderUuid);
  if (!order) return null;

  let grossSubtotal = 0;
  let itemDiscountTotal = 0;
  let baseSubtotal = 0;
  let toppingSubtotal = 0;
  const items = visibleItemsForOrder(state, orderUuid).map((item) => {
    const line = lineFor(item, master);
    if (line.affectsTotal) {
      grossSubtotal += line.gross;
      itemDiscountTotal += line.itemDiscount;
      baseSubtotal += line.baseTotal;
      toppingSubtotal += line.toppingTotal;
    }
    return {
      ...item.snapshot,
      order_item_uuid: item.orderItemUuid,
      order_it_uuid: item.orderItemUuid,
      prod_uuid: line.detail?.prodUuid ?? "",
      pro_detail_uuid: item.prodDetailUuid,
      prod_name: line.detail?.productName ?? "",
      title: line.detail.productName,
      prod_status_imge: line.detail?.productHasImage ?? 0,
      prod_image: line.detail?.productImage ?? "",
      qty: item.quantity,
      total: line.total,
      detail: {
        ...line.savedDetail,
        order_it_qty: item.quantity,
        unit_price: line.unitPrice,
        base_line_total: line.baseTotal,
        topping_unit_total: line.toppingUnitTotal,
        topping_line_total: line.toppingTotal,
        gross_total: line.gross,
        order_it_discount_type: item.discountType,
        order_it_discount_value: item.discountValue,
        order_it_discount_amount: line.itemDiscount,
        net_total: line.total,
        order_it_status: item.status,
        order_it_note: item.note,
        affects_total: line.affectsTotal,
      },
      toppings: item.toppings.map((topping) => ({
        ...topping,
        topping_qty_per_unit: topping.topping_qty,
        topping_total_qty: topping.topping_qty * item.quantity,
        topping_line_total: money((topping.topping_price ?? master.toppingPrices.get(topping.prod_topping_uuid_fk) ?? 0) * topping.topping_qty * item.quantity),
      })),
    } satisfies OfflineCartLine;
  });

  const subtotal = money(Math.max(grossSubtotal - itemDiscountTotal, 0));
  const orderDiscount = discountAmount(subtotal, order.discountType, order.discountValue);
  const afterDiscount = money(Math.max(subtotal - orderDiscount, 0));
  const serviceAmount = money((afterDiscount * order.serviceRate) / 100);
  const vat = calculateVat({
    taxableAmount: afterDiscount + serviceAmount,
    vatStatus: order.vatStatus,
    vatRate: order.vatRate,
    roundMoney: money,
  });

  return {
    ...order.snapshot,
    order_uuid: order.orderUuid,
    order_invoice: String(order.snapshot?.order_invoice ?? ""),
    table_uuid_fk: order.tableUuid,
    order_discount_type: order.discountType,
    order_discount_value: order.discountValue,
    service_charge_rate: order.serviceRate,
    vat_rate: order.vatRate,
    vat_status: order.vatStatus,
    items,
    totals: {
      total: vat.totalAfterVat,
      subtotal,
      order_total: money(grossSubtotal),
      order_subtotal: afterDiscount,
      order_item_discount_amount: money(itemDiscountTotal),
      order_discount_amount: orderDiscount,
      order_service_amount: serviceAmount,
      order_amount_before_vat: vat.amountBeforeVat,
      order_vat_amount: vat.vatAmount,
      order_grand_total: vat.totalAfterVat,
    },
    sum_detail_total: money(baseSubtotal),
    sum_topping_total: money(toppingSubtotal),
    sum_discount_total: money(itemDiscountTotal + orderDiscount),
    sum_service_total: serviceAmount,
    sum_vat_total: vat.vatAmount,
    service_charge_amount: serviceAmount,
    vat_amount: vat.vatAmount,
    amount_before_vat: vat.amountBeforeVat,
    grand_total: vat.totalAfterVat,
    sum_grand_total: vat.totalAfterVat,
  };
}

export function projectOfflineCart(
  state: OfflineOrderState,
  params: { order_uuid?: string; table_uuid?: string },
  master: OfflineMasterIndex,
): OfflineCartResponse {
  const orderUuid = params.order_uuid ||
    (params.table_uuid ? openOrderForTable(state, params.table_uuid)?.orderUuid : undefined);
  const order = orderUuid ? projectOfflineCartOrder(state, orderUuid, master) : null;
  if (!order) return { status: "success", message: "ok", offline: true, orders: [], data: [] };
  return {
    status: "success",
    message: "ok",
    offline: true,
    orders: [order],
    data: [order],
    totals: order.totals,
  };
}
