import type {
  FetchOrderQueueResponse,
  OrderQueueItem,
  OrderQueueOrderTable,
  OrderQueueRow,
  OrderQueueSection
} from "@/services/pos/types";

export function findOrderQueueSection(
  response: FetchOrderQueueResponse,
  status: number
): OrderQueueSection | undefined {
  const sections = Array.isArray(response.sections) ? response.sections : [];
  return sections.find((section) => section.status === status);
}

function toOrderQueueRow(
  item: OrderQueueItem,
  orderUuid: string,
  invoice: string | null,
  table: OrderQueueOrderTable | null
): OrderQueueRow {
  return {
    order_item_uuid: item.order_item_uuid,
    order_uuid: orderUuid,
    order_invoice: invoice ?? "",
    table_name: table?.table_name ?? null,
    order_item_status: item.order_item_status,
    product_name: item.product_name,
    product_image: item.product_image,
    qty: item.qty,
    note: item.note,
    kitchen_print_queued: item.kitchen_print_queued,
    can_send_to_kitchen: item.can_send_to_kitchen,
    can_confirm_served: item.can_confirm_served
  };
}

export function flattenOrderQueueSection(section: OrderQueueSection | undefined): OrderQueueRow[] {
  if (!section) return [];

  if (Array.isArray(section.items)) {
    return section.items.map((item) =>
      toOrderQueueRow(item, item.order_uuid, item.invoice, item.table)
    );
  }

  const legacyOrders = Array.isArray(section.orders) ? section.orders : [];
  return legacyOrders.flatMap((order) =>
    (Array.isArray(order.items) ? order.items : []).map((item) =>
      toOrderQueueRow(item, order.order_uuid, order.invoice, order.table)
    )
  );
}
