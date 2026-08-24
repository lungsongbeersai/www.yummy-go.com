import type { OrderQueueRow } from "@/services/pos";

export interface OrderQueueGroup {
  order_uuid: string;
  order_invoice: string;
  table_name: string | null;
  rows: OrderQueueRow[];
}

// จัดกลุ่มแถวที่ flatten แล้วกลับเป็นก้อนต่อออเดอร์ตาม order_uuid — ทุกแถวมี order_uuid/
// order_invoice/table_name อยู่แล้วในตัว จึงทำเป็น view เฉพาะหน้านี้ได้เลยโดยไม่ต้องแก้
// store/normalizer ที่ใช้ร่วมกับ flow อื่น (sendToKitchen ฯลฯ ยังอิง order_item_uuid ตรงๆ)
// Map รักษาลำดับ insertion ไว้ ทำให้ออเดอร์เดียวกัน (โต๊ะเดียวกัน) อยู่ติดกันตามลำดับที่
// backend ส่งมา (FIFO) โดยไม่ต้อง sort เพิ่ม
export function groupOrderQueueRows(rows: OrderQueueRow[]): OrderQueueGroup[] {
  const groups = new Map<string, OrderQueueGroup>();

  for (const row of rows) {
    const existing = groups.get(row.order_uuid);
    if (existing) {
      existing.rows.push(row);
      continue;
    }
    groups.set(row.order_uuid, {
      order_uuid: row.order_uuid,
      order_invoice: row.order_invoice,
      table_name: row.table_name,
      rows: [row]
    });
  }

  return Array.from(groups.values());
}

const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export type ProductMedia = { type: "image"; src: string } | { type: "color"; color: string } | { type: "empty" };

// product_image เป็นได้ทั้ง URL รูปจริง หรือ hex color (สินค้าที่ไม่มีรูป) — pattern เดียวกับ
// cartItemMedia ใน pos/table-selection/cart-readers.ts แต่ทำสำเนาเบาๆ ไว้ที่นี่เพราะ
// input เป็น string ตรงๆ (ไม่ต้องไล่ fallback หลาย field แบบ CartItem)
export function resolveProductMedia(image: string): ProductMedia {
  const value = image.trim();
  if (!value) return { type: "empty" };
  if (HEX_COLOR_PATTERN.test(value)) return { type: "color", color: value };
  return { type: "image", src: value };
}
