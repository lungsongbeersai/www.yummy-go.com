// Local order state rebuilt from the Dexie outbox. This mirrors the shape the
// Local Printer Agent keeps in SQLite (`local_orders` / `local_order_items`) so
// the two offline engines agree on what an order is; Android has no Agent, so
// this is the only place that state exists there.

export const OFFLINE_ITEM_STATUS = {
  WAITING: 1,
  SENT_TO_KITCHEN: 2,
  COOKING: 3,
  SERVED: 4,
  CANCELLED: 9,
} as const;

export type OfflineItemStatus =
  (typeof OFFLINE_ITEM_STATUS)[keyof typeof OFFLINE_ITEM_STATUS];

export interface OfflineTopping {
  prod_topping_uuid_fk: string;
  topping_qty: number;
  topping_price?: number;
}

export interface OfflineOrderItem {
  orderItemUuid: string;
  orderUuid: string;
  prodDetailUuid: string;
  quantity: number;
  status: number;
  note: string;
  discountType: string;
  discountValue: number;
  toppings: OfflineTopping[];
  /** Order in which the item entered the local queue; keeps the cart stable. */
  sequence: number;
}

export interface OfflineOrder {
  orderUuid: string;
  tableUuid: string | null;
  branchUuid: string;
  /** 1 = open, 2 = closed/paid. Mirrors tb_orders.order_check_bill. */
  checkBill: number;
  discountType: string;
  discountValue: number;
  serviceRate: number;
  vatRate: number;
  vatStatus: number | null;
  sequence: number;
}

export interface OfflineOrderState {
  orders: Map<string, OfflineOrder>;
  items: Map<string, OfflineOrderItem>;
}

/** A queued POS mutation, already decoded from its raw HTTP form. */
export type OfflineOrderEvent =
  | { kind: "ORDER_CREATE"; orderUuid: string; tableUuid: string | null; branchUuid: string; serviceRate: number; vatRate: number; vatStatus: number | null; items: Array<{ orderItemUuid: string; prodDetailUuid: string; quantity: number; status: number; note: string; toppings: OfflineTopping[] }> }
  | { kind: "ITEM_QTY"; orderItemUuid: string; changeType: string; changeQty: number }
  | { kind: "ITEM_NOTE"; orderItemUuid: string; note: string }
  | { kind: "ITEM_DISCOUNT"; orderItemUuid: string; discountType: string; discountValue: number }
  | { kind: "BILL_DISCOUNT"; orderUuid: string; discountType: string; discountValue: number }
  | { kind: "ITEM_DELETE"; orderItemUuid: string }
  | { kind: "ITEM_CANCEL"; orderItemUuid: string; quantity: number | null }
  | { kind: "KITCHEN_CONFIRM"; orderUuid: string; orderItemUuids: string[] }
  | { kind: "ITEM_SERVED"; orderItemUuids: string[] }
  | { kind: "PAYMENT"; orderUuid: string; tableUuid: string | null };
