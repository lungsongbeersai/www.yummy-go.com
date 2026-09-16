// สเกลความเร่งด่วนนี้ใช้เฉพาะแท็บ "รอยืนยันส่งครัว" (WAITING_CONFIRM) เท่านั้น — แยกจาก
// queueWaitUrgency (fresh/aging/late ที่ 10/20 นาที) ใน order-queue-view.ts โดยตั้งใจ
// เพื่อไม่ให้กระทบภาพลักษณ์ของแท็บอื่น (ส่งครัวแล้ว/เสิร์ฟแล้ว/ยกเลิก) ที่ยังใช้เกณฑ์เดิม
export type ManageQueueUrgencyTier =
  | "normal"
  | "elevated"
  | "high"
  | "critical"
  | "blocking";

export function manageQueueUrgencyTier(waitMinutes: number): ManageQueueUrgencyTier {
  if (waitMinutes >= 15) return "blocking";
  if (waitMinutes >= 10) return "critical";
  if (waitMinutes >= 5) return "high";
  if (waitMinutes >= 3) return "elevated";
  return "normal";
}

/** ออเดอร์ที่ต้องโชว์ในตาราง "Manage" ฝั่งขวา */
export function isManageQueueUrgent(waitMinutes: number): boolean {
  return waitMinutes >= 3;
}

export function manageQueueWaitBadgeVariant(
  tier: ManageQueueUrgencyTier
): "secondary" | "outline" | "destructive" {
  if (tier === "normal") return "secondary";
  if (tier === "elevated" || tier === "high") return "outline";
  return "destructive";
}

// ตารางฝั่งเนื้อหา (OrderQueueTableRow) — ไม่กะพริบทั้งแถวอีกต่อไป (อ่านของอื่นในแถวไม่ออก
// เพราะพื้นหลังกะพริบทับรูปสินค้า/badge/ปุ่ม) กะพริบเฉพาะ badge เวลารอเพียงจุดเดียวแทน
// ซึ่งเป็นข้อมูลที่ต้องการเน้นจริง ๆ อยู่แล้ว ส่วนสีพื้น/ขอบของ badge มาจาก
// manageQueueWaitBadgeVariant (variant ของ Badge) อยู่แล้ว ฟังก์ชันนี้คืนแค่ class
// สำหรับกะพริบเพิ่ม (ไม่มีค่าตอน normal/elevated เพราะสองระดับนี้ไม่ต้องกะพริบตาม spec)
const WAIT_BADGE_BLINK_CLASS: Record<ManageQueueUrgencyTier, string> = {
  normal: "",
  elevated: "",
  high: "order-queue-row-blink-warning",
  critical: "order-queue-row-blink-destructive",
  blocking: "order-queue-row-blink-destructive"
};

export function manageQueueWaitBadgeBlinkClass(tier: ManageQueueUrgencyTier): string {
  return WAIT_BADGE_BLINK_CLASS[tier];
}

// การ์ด (มือถือ/แท็บเล็ต) — ไม่กะพริบทั้งใบอีกต่อไป (เหตุผลเดียวกับแถวตาราง) ใช้แถบสีข้างการ์ด
// (เหมือน queueWaitEdgeClass เดิม) เปลี่ยนสีตามระดับแทน เป็นแค่ตัวบอกสีนิ่ง ๆ ไม่กะพริบ
// ส่วนที่กะพริบจริงย้ายไปอยู่ที่ QueueWaitPill (ใช้ manageQueueWaitBadgeBlinkClass) แทน
const EDGE_CLASS: Record<ManageQueueUrgencyTier, string> = {
  normal: "bg-border",
  elevated: "bg-warning",
  high: "bg-warning",
  critical: "bg-destructive",
  blocking: "bg-destructive"
};

export function manageQueueEdgeClass(tier: ManageQueueUrgencyTier): string {
  return EDGE_CLASS[tier];
}

// ใช้กับ QueueWaitPill บนการ์ด (พื้นหลัง+ตัวหนังสือ ไม่ใช่แถบขอบ) — สีเข้มขึ้นตามระดับ
// เดียวกับ manageQueueEdgeClass แต่เป็นคู่สี bg/text ที่คอนทราสต์พออ่านได้เป็นตัวหนังสือ
const TONE_CLASS: Record<ManageQueueUrgencyTier, string> = {
  normal: "bg-muted text-muted-foreground",
  elevated: "bg-warning/15 text-warning",
  high: "bg-warning/15 text-warning",
  critical: "bg-destructive/15 text-destructive",
  blocking: "bg-destructive/15 text-destructive"
};

export function manageQueueWaitToneClass(tier: ManageQueueUrgencyTier): string {
  return TONE_CLASS[tier];
}
