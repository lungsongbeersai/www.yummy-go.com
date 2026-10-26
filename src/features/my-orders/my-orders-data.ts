import type { CartOrder, PosZone } from "@/services/pos";

export type MyOrderStatus = "ordered" | "waiting_to_send" | "sent_to_kitchen" | "preparing" | "served";

export interface MyOrderLine {
  id: string;
  name: string;
  quantity: number;
  note?: string;
  placedBy: string;
  placedById: string;
  status: number | null;
}

export interface MyOrder {
  id: string;
  reference: string;
  zone: string;
  table: string;
  placedBy: string;
  placedAt: string;
  status: MyOrderStatus;
  isPlacedByMe: boolean;
  items: MyOrderLine[];
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

function stringValue(...values: unknown[]): string {
  return values.find((value): value is string => typeof value === "string" && value.trim().length > 0)?.trim() ?? "";
}

function numericValue(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }
  return null;
}

function itemStatus(item: Record<string, unknown>): number | null {
  const detail = record(item.detail);
  const statuses = Array.isArray(item.order_it_statuses) ? item.order_it_statuses : [];
  return numericValue(detail.order_it_status, item.order_it_status, item.status, item.order_status, ...statuses);
}

function orderStatus(statuses: Array<number | null>): MyOrderStatus {
  const active = statuses.filter((status): status is number => status !== null && status !== 9);
  if (active.length > 0 && active.every((status) => status === 4)) return "served";
  if (active.includes(1)) return "waiting_to_send";
  if (active.includes(3)) return "preparing";
  if (active.includes(2)) return "sent_to_kitchen";
  return "ordered";
}

export function buildMyOrdersFromTables(
  zones: PosZone[],
  cartsByTable: ReadonlyMap<string, CartOrder[]>,
  userId: string,
): MyOrder[] {
  const orders = new Map<string, MyOrder>();

  for (const zone of zones) {
    for (const table of zone.tables ?? []) {
      if (table.table_status === 1 && !table.customer_order_state) continue;
      const carts = cartsByTable.get(table.table_uuid) ?? [];
      for (const cart of carts) {
        const orderId = stringValue(cart.order_uuid);
        if (!orderId) continue;
        const cartItems = (cart.items ?? []).filter((item) => !item.is_deposit_redemption);
        const lines = cartItems.map((item, index) => {
          const itemRecord = record(item);
          const detail = record(item.detail);
          const placedById = stringValue(detail.order_it_created_by, itemRecord.order_it_created_by);
          const placedBy = stringValue(detail.order_it_created_by_name, itemRecord.order_it_created_by_name) || (placedById === userId ? "You" : "Team member");
          return {
            id: stringValue(item.order_item_uuid, item.order_it_uuid) || `${orderId}-${index}`,
            name: stringValue(item.prod_name, item.title) || "Order item",
            quantity: numericValue(item.qty, detail.order_it_qty) ?? 1,
            note: stringValue(detail.order_it_note, itemRecord.note) || undefined,
            placedBy,
            placedById,
            status: itemStatus(itemRecord),
          };
        }).filter((item) => item.status !== 9);
        if (lines.length === 0) continue;

        const existing = orders.get(orderId);
        const mergedLines = existing ? [...existing.items, ...lines] : lines;
        const contributors = [...new Set(mergedLines.map((item) => item.placedBy))];
        const rawPlacedAt = stringValue(cart.order_it_date_time, cart.order_created_at, table.datetime_in);
        const current = {
          id: orderId,
          reference: stringValue(cart.order_invoice) || orderId.slice(0, 8).toUpperCase(),
          zone: zone.zone_name || "—",
          table: table.table_name || "—",
          placedBy: contributors.join(", ") || "Unknown",
          placedAt: rawPlacedAt,
          status: orderStatus(mergedLines.map((item) => item.status)),
          isPlacedByMe: mergedLines.some((item) => item.placedById === userId && userId.length > 0),
          items: mergedLines,
        } satisfies MyOrder;
        orders.set(orderId, current);
      }
    }
  }

  return [...orders.values()].sort((left, right) => Date.parse(right.placedAt) - Date.parse(left.placedAt));
}

export function ordersPlacedByMe(orders: MyOrder[], userId: string): MyOrder[] {
  if (!userId) return [];
  return orders.flatMap((order) => {
    const items = order.items.filter((item) => item.placedById === userId);
    return items.length ? [{ ...order, placedBy: "You", isPlacedByMe: true, items }] : [];
  });
}

export function orderStatusLabel(status: MyOrderStatus): string {
  const labels: Record<MyOrderStatus, string> = {
    ordered: "Ordered",
    waiting_to_send: "Waiting to Send",
    sent_to_kitchen: "Sent to Kitchen",
    preparing: "Preparing",
    served: "Served",
  };
  return labels[status];
}
