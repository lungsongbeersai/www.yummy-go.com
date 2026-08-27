import { OrderItemStatus } from "@/config/pos-constants";
import type { OrderQueueItem } from "@/services/pos";

export type QueueWaitUrgency = "fresh" | "aging" | "late";

/** action ที่พนักงานกดได้กับรายการนี้ — มาจาก flag ของ backend เท่านั้น ไม่เดาจาก status */
export type QueueItemAction = "send" | "serve";

export type QueueListView = "table" | "card";

// เลี่ยง import react-i18next เข้ามาในไฟล์ logic ล้วน (เทสรันบน node ไม่มี provider)
type Translate = (key: string, options?: Record<string, unknown>) => string;

export interface OrderQueueTab {
  status: number;
  title: string;
  total: number;
}

export interface QueueWaitParts {
  days: number;
  hours: number;
  minutes: number;
  totalMinutes: number;
}

const TAB_STATUS_ORDER = [1, 2, 4, 9];
const TAB_STATUS_ORDER_SET = new Set(TAB_STATUS_ORDER);

// ORDERED (0, "รอลูกค้ายืนยัน") เป็นแท็บดูอย่างเดียวมาตั้งแต่แรก — ยังไม่มี API เปลี่ยน
// สถานะ 0→1 (ดูคอมเมนต์ที่ OrderItemStatus ใน pos-constants.ts) กดอะไรในนั้นไม่ได้เลย
// ตามที่ตกลงไว้ให้เอาออกจากคิว กรองทิ้งตั้งแต่ต้นทางเลยแทนที่จะแค่เอาออกจาก
// TAB_STATUS_ORDER — เอาออกจากลำดับเฉย ๆ จะโดนลูป fallback ใน buildOrderQueueTabs
// ดึงกลับมาโชว์ท้ายแถวแทน (เพราะไม่อยู่ใน TAB_STATUS_ORDER_SET แล้วก็ยังนับเป็น "แท็บ
// ที่ไม่รู้จัก" อยู่ดี)
const HIDDEN_TAB_STATUSES = new Set([0]);

const TAB_STATUS_FALLBACK: Record<number, string> = {
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

// สีบอกความเร่งด่วนใช้ที่ "เวลารอ" จุดเดียวเท่านั้น ส่วนอื่นของการ์ดคุมโทนกลางไว้
// ไม่งั้นทุกใบดูด่วนไปหมดจนกวาดสายตาหาใบที่ต้องรีบจริงไม่เจอ
const WAIT_TONE_CLASS: Record<QueueWaitUrgency, string> = {
  fresh: "bg-muted text-muted-foreground",
  aging: "bg-warning/15 text-warning",
  late: "bg-destructive/15 text-destructive"
};

// แถบสีข้างการ์ด — ใบที่รอนานที่สุดต้องสะดุดตาก่อนใบอื่นตั้งแต่ยังไม่อ่านตัวเลข
const WAIT_EDGE_CLASS: Record<QueueWaitUrgency, string> = {
  fresh: "bg-border",
  aging: "bg-warning",
  late: "bg-destructive"
};

export function queueWaitToneClass(urgency: QueueWaitUrgency): string {
  return WAIT_TONE_CLASS[urgency];
}

export function queueWaitEdgeClass(urgency: QueueWaitUrgency): string {
  return WAIT_EDGE_CLASS[urgency];
}

export function queueWaitParts(totalMinutes: number): QueueWaitParts {
  const safe = Math.max(0, Math.floor(Number(totalMinutes) || 0));
  return {
    days: Math.floor(safe / 1440),
    hours: Math.floor((safe % 1440) / 60),
    minutes: safe % 60,
    totalMinutes: safe
  };
}

/** "18 min" / "1h 05m" / "1d 2h" — เลือกหน่วยหยาบสุดที่ยังบอกความต่างได้ ให้อ่านจบในสายตาเดียว */
export function formatQueueWait(totalMinutes: number, t: Translate): string {
  const { days, hours, minutes } = queueWaitParts(totalMinutes);

  if (days > 0) return t("orderQueue.waitDaysHours", { days, hours });
  if (hours > 0) return t("orderQueue.hoursMinutes", { hours, minutes });
  return t("orderQueue.waitMinutes", { count: minutes });
}

/**
 * open_minutes ถูกคำนวณฝั่ง server ตอน fetch ส่วน order_it_date_time เป็นเวลา local
 * ของ server ที่ไม่มี timezone ติดมา (ข้อมูลจริงต่างกันราว 6 ชม.) — ถ้าคำนวณเวลารอ
 * จาก timestamp ตรง ๆ ฝั่ง client จะเพี้ยนตาม timezone ผู้ใช้ จึงยึด open_minutes
 * เป็นหลักแล้วบวกเวลาที่ผ่านไปนับจากตอนโหลดแทน — เดินต่อได้เองโดยไม่ต้องยิง API ซ้ำ
 */
export function liveWaitMinutes(
  openMinutes: number,
  minutesSinceLoad: number
): number {
  const base = Math.max(0, Math.floor(Number(openMinutes) || 0));
  return base + Math.max(0, Math.floor(Number(minutesSinceLoad) || 0));
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
  const visibleSections = sections.filter(
    (section) => !HIDDEN_TAB_STATUSES.has(section.status)
  );
  const byStatus = new Map(
    visibleSections.map((section) => [section.status, section])
  );

  const ordered = TAB_STATUS_ORDER.flatMap((status) => {
    const section = byStatus.get(status);
    if (!section) return [];
    return [section];
  });

  for (const section of visibleSections) {
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

/** flag ของ backend เป็นตัวตัดสินว่ากดอะไรได้ ไม่ใช่ order_item_status */
export function queueItemAction(item: OrderQueueItem): QueueItemAction | null {
  if (item.can_send_to_kitchen) return "send";
  if (item.can_confirm_served) return "serve";
  return null;
}

export function canSelectQueueItem(
  item: OrderQueueItem,
  status: number
): boolean {
  // สองคิวนี้เป็นปลายทาง/รอฝั่งลูกค้า พนักงานไม่มี action ให้ทำต่อ
  if (status === OrderItemStatus.ORDERED) return false;
  if (status === OrderItemStatus.CANCELLED) return false;
  if (queueItemAction(item)) return true;
  // เสิร์ฟแล้วยังยกเลิกได้ แม้ไม่มี can_* flag เหลือ
  return status === OrderItemStatus.SERVED;
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
