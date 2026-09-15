import type {
  FetchOrderQueueResponse,
  OrderQueueItem,
  OrderQueueSection
} from "@/services/pos/types";

export interface OrderQueueSectionSummary {
  key: string;
  title: string;
  status: number;
  total: number;
}

export function findOrderQueueSection(
  response: FetchOrderQueueResponse,
  status: number
): OrderQueueSection | undefined {
  return response.sections.find((section) => section.status === status);
}

export function summarizeOrderQueueSections(
  response: FetchOrderQueueResponse
): OrderQueueSectionSummary[] {
  return response.sections.map((section) => ({
    key: section.key,
    title: section.title,
    status: section.status,
    total: section.total
  }));
}

function itemArrivedAt(item: OrderQueueItem): number {
  const parsed = Date.parse(item.order_it_date_time.replace(" ", "T"));
  return Number.isNaN(parsed) ? 0 : parsed;
}

function kitchenConfirmedAt(item: OrderQueueItem): number {
  if (!item.kitchen_confirmed_at) return itemArrivedAt(item);

  const parsed = Date.parse(item.kitchen_confirmed_at.replace(" ", "T"));
  return Number.isNaN(parsed) ? itemArrivedAt(item) : parsed;
}

function isSentToKitchen(item: OrderQueueItem): boolean {
  // Backend groups status 3 together with status 2 in the sent-to-kitchen tab.
  return item.order_item_status === 2 || item.order_item_status === 3;
}

export function sortOrderQueueItems(items: OrderQueueItem[]): OrderQueueItem[] {
  return items.toSorted((left, right) => {
    // The first item confirmed by staff stays at the top even when it entered
    // the waiting queue after another item.
    if (isSentToKitchen(left) && isSentToKitchen(right)) {
      const confirmedDiff = kitchenConfirmedAt(left) - kitchenConfirmedAt(right);
      if (confirmedDiff !== 0) return confirmedDiff;
    } else {
      // The waiting queue remains FIFO: longest wait first.
      const waitDiff = right.open_minutes - left.open_minutes;
      if (waitDiff !== 0) return waitDiff;
    }

    const arrivedDiff = itemArrivedAt(left) - itemArrivedAt(right);
    if (arrivedDiff !== 0) return arrivedDiff;

    return left.order_it_q - right.order_it_q;
  });
}
