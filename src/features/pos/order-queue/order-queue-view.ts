import type { OrderQueueItem } from "@/services/pos";

export type QueueWaitUrgency = "fresh" | "aging" | "late";

export interface OrderQueueTab {
  status: number;
  title: string;
  total: number;
}

const TAB_STATUS_ORDER = [1, 2, 0, 4, 9];
const TAB_STATUS_ORDER_SET = new Set(TAB_STATUS_ORDER);

const TAB_STATUS_FALLBACK: Record<number, string> = {
  0: "orderQueue.tabs.customerPending",
  1: "orderQueue.tabs.waitingConfirm",
  2: "orderQueue.tabs.sentToKitchen",
  4: "orderQueue.tabs.served",
  9: "orderQueue.tabs.cancelled"
};

export function queueWaitUrgency(minutes: number): QueueWaitUrgency {
  if (minutes >= 20) return "late";
  if (minutes >= 10) return "aging";
  return "fresh";
}

export function waitBadgeVariant(
  urgency: QueueWaitUrgency
): "secondary" | "outline" | "destructive" {
  if (urgency === "late") return "destructive";
  if (urgency === "aging") return "outline";
  return "secondary";
}

export function formatQueueClock(dateTime: string): string {
  if (!dateTime) return "";

  const parsed = new Date(dateTime.replace(" ", "T"));
  if (Number.isNaN(parsed.getTime())) return dateTime;

  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(parsed);
}

export function formatQueueDateTime(dateTime: string): string {
  if (!dateTime) return "";

  const parsed = new Date(dateTime.replace(" ", "T"));
  if (Number.isNaN(parsed.getTime())) return dateTime;

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(parsed);
}

export function buildOrderQueueTabs(
  sections: Array<{ status: number; title: string; total: number }>
): OrderQueueTab[] {
  const byStatus = new Map(
    sections.map((section) => [section.status, section])
  );

  const ordered = TAB_STATUS_ORDER.flatMap((status) => {
    const section = byStatus.get(status);
    if (!section) return [];
    return [section];
  });

  for (const section of sections) {
    if (!TAB_STATUS_ORDER_SET.has(section.status)) {
      ordered.push(section);
    }
  }

  return ordered.map((section) => ({
    status: section.status,
    title: section.title,
    total: section.total
  }));
}

export function queueTabFallbackKey(status: number): string {
  return TAB_STATUS_FALLBACK[status] ?? `orderQueue.tabs.status${status}`;
}

export function canSelectQueueItem(
  item: OrderQueueItem,
  status: number
): boolean {
  if (status === 1) return item.can_send_to_kitchen;
  if (status === 2) return item.can_confirm_served;
  if (status === 4) return true;
  return false;
}

const HEX_COLOR_PATTERN =
  /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export type ProductMedia =
  | { type: "image"; src: string }
  | { type: "color"; color: string }
  | { type: "empty" };

// product_image เป็นได้ทั้ง URL รูปจริง หรือ hex color (สินค้าที่ไม่มีรูป)
export function resolveProductMedia(image: string): ProductMedia {
  const value = image.trim();
  if (!value) return { type: "empty" };
  if (HEX_COLOR_PATTERN.test(value)) return { type: "color", color: value };
  return { type: "image", src: value };
}
