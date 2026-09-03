import { roundLak } from "@/lib/pos/lak-money";
import { calculateVat } from "@/lib/pos/vat";
import type { OfflineMasterIndex } from "./master-index";
import { openOrderForTable, visibleItemsForOrder } from "./order-state";
import type { OfflineOrderItem, OfflineOrderState } from "./types";

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
  prod_status_imge: number;
  prod_image: string;
  qty: number;
  total: number;
  detail: {
    order_it_qty: number;
    unit_price: number;
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
  items: OfflineCartLine[];
  totals: Record<string, number>;
  sum_detail_total: number;
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

function lineFor(item: OfflineOrderItem, master: OfflineMasterIndex) {
  const detail = master.details.get(item.prodDetailUuid);
  const toppingUnitTotal = item.toppings.reduce((sum, topping) => {
    const price = topping.topping_price ||
      master.toppingPrices.get(topping.prod_topping_uuid_fk) || 0;
    return sum + price * (topping.topping_qty || 1);
  }, 0);
  const unitPrice = money((detail?.price ?? 0) + toppingUnitTotal);
  const gross = money(unitPrice * item.quantity);
  const itemDiscount = discountAmount(gross, item.discountType, item.discountValue);
  const total = money(Math.max(gross - itemDiscount, 0));
  return { detail, unitPrice, gross, itemDiscount, total };
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
  const items = visibleItemsForOrder(state, orderUuid).map((item) => {
    const line = lineFor(item, master);
    grossSubtotal += line.gross;
    itemDiscountTotal += line.itemDiscount;
    return {
      order_item_uuid: item.orderItemUuid,
      order_it_uuid: item.orderItemUuid,
      prod_uuid: line.detail?.prodUuid ?? "",
      pro_detail_uuid: item.prodDetailUuid,
      prod_name: line.detail?.productName ?? "",
      prod_status_imge: line.detail?.productHasImage ?? 0,
      prod_image: line.detail?.productImage ?? "",
      qty: item.quantity,
      total: line.total,
      detail: {
        order_it_qty: item.quantity,
        unit_price: line.unitPrice,
        net_total: line.total,
        order_it_status: item.status,
        order_it_note: item.note,
        affects_total: true,
      },
      toppings: item.toppings,
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
    order_uuid: order.orderUuid,
    order_invoice: "",
    table_uuid_fk: order.tableUuid,
    order_discount_type: order.discountType,
    order_discount_value: order.discountValue,
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
    sum_detail_total: subtotal,
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
