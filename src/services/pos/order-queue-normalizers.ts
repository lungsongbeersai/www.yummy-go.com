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

// คิวทำงานแบบ FIFO: รอ นานที่สุดอยู่บนสุด ถ้านาทีเท่ากันใช้เวลาเข้ามาก่อน แล้วค่อยเลขคิว
export function sortOrderQueueItems(items: OrderQueueItem[]): OrderQueueItem[] {
  return items.toSorted((left, right) => {
    const waitDiff = right.open_minutes - left.open_minutes;
    if (waitDiff !== 0) return waitDiff;

    const arrivedDiff = itemArrivedAt(left) - itemArrivedAt(right);
    if (arrivedDiff !== 0) return arrivedDiff;

    return left.order_it_q - right.order_it_q;
  });
}
