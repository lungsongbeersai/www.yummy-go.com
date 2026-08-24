import type {
  FetchOrderQueueResponse,
  OrderQueueRow,
  OrderQueueSection
} from "@/services/pos/types";

export function findOrderQueueSection(
  response: FetchOrderQueueResponse,
  status: number
): OrderQueueSection | undefined {
  return response.sections.find((section) => section.status === status);
}

export function flattenOrderQueueSection(section: OrderQueueSection | undefined): OrderQueueRow[] {
  if (!section) return [];

  return section.orders.flatMap((order) =>
    order.items.map((item) => ({
      order_item_uuid: item.order_item_uuid,
      order_uuid: order.order_uuid,
      order_invoice: order.invoice,
      table_name: order.table?.table_name ?? null,
      order_item_status: item.order_item_status,
      product_name: item.product_name,
      product_image: item.product_image,
      qty: item.qty,
      note: item.note,
      kitchen_print_queued: item.kitchen_print_queued,
      can_send_to_kitchen: item.can_send_to_kitchen,
      can_confirm_served: item.can_confirm_served
    }))
  );
}
