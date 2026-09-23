import type { OrderAuditAction, OrderAuditRow } from "@/services/report";

export interface OrderAuditGroup {
  actions: OrderAuditAction[];
  actorName: string | null;
  actorType: OrderAuditRow["actor_type"];
  entityCount: number;
  id: string;
  orderInvoice: string;
  orderUuid: string;
  recordedAt: string;
  relatedOrderInvoice: string;
  relatedOrderUuid: string | null;
  rows: OrderAuditRow[];
}

// ลำดับความรุนแรงมากไปน้อย ใช้เลือก badge เด่นของกลุ่มเมื่อกลุ่มมีหลาย action ปนกัน
// (เช่น batch ยืนยันเข้าครัวที่มีทั้ง DISCOUNT และ UPDATE ในทรานแซกชันเดียว)
const ACTION_SEVERITY: OrderAuditAction[] = [
  "CANCEL", "DELETE", "DISCOUNT", "PRICE", "QUANTITY", "MOVE", "UPDATE", "PAYMENT", "CREATE",
];

export function dominantAuditAction(actions: OrderAuditAction[]): OrderAuditAction {
  return actions.reduce((worst, action) =>
    ACTION_SEVERITY.indexOf(action) < ACTION_SEVERITY.indexOf(worst) ? action : worst, actions[0]);
}

// รวมแถวที่มี transaction_id เดียวกันเป็น "เหตุการณ์" เดียว — บันทึกหนึ่งครั้งของผู้ใช้ (เช่นยืนยันบิลเข้าครัว
// ที่ลดราคา+เปลี่ยนสถานะหลายรายการพร้อมกัน) มักสร้างหลาย audit row ที่ transaction_id เดียวกันเสมอ
// ไม่ใช่การ group ข้ามเวลา/ข้าม transaction — แถวในกลุ่มเดียวกันเกิดพร้อมกันจริงในฐานข้อมูล
export function groupOrderAuditRows(rows: OrderAuditRow[]): OrderAuditGroup[] {
  const order: string[] = [];
  const byId = new Map<string, OrderAuditRow[]>();

  for (const row of rows) {
    const key = row.transaction_id || row.audit_id;
    const existing = byId.get(key);
    if (existing) {
      existing.push(row);
      continue;
    }
    byId.set(key, [row]);
    order.push(key);
  }

  return order.map((id) => {
    const groupRows = byId.get(id) ?? [];
    const head = groupRows[0];
    return {
      actions: [...new Set(groupRows.map((row) => row.action))],
      actorName: head.actor_name,
      actorType: head.actor_type,
      entityCount: new Set(groupRows.map((row) => row.entity_uuid)).size,
      id,
      orderInvoice: head.order_invoice,
      orderUuid: head.order_uuid_fk,
      recordedAt: head.recorded_at,
      relatedOrderInvoice: head.related_order_invoice,
      relatedOrderUuid: head.related_order_uuid_fk,
      rows: groupRows,
    };
  });
}

export function groupEntityLabel(row: OrderAuditRow, language: string): string {
  return (language === "en" ? row.entity_label_eng || row.entity_label_la : row.entity_label_la || row.entity_label_eng) || "";
}

export function groupEntityLabelsPreview(group: OrderAuditGroup, language: string, max = 2): string {
  const labels = [...new Set(group.rows.map((row) => groupEntityLabel(row, language)).filter(Boolean))];
  if (!labels.length) return "";
  if (labels.length <= max) return labels.join(", ");
  return `${labels.slice(0, max).join(", ")} +${labels.length - max}`;
}

// รวมแถวในกลุ่มเดียวกันที่ entity_uuid เดียวกันไว้ด้วยกัน เพื่อแสดงใต้หัวข้อ entity เดียว
// (ยังไม่ merge ฟิลด์ที่เปลี่ยน — แต่ละแถวยังคงตาราง before/after ของตัวเอง กันความเสี่ยงตีความ
// ค่าก่อน/หลังผิดถ้าฟิลด์เดียวกันถูกแก้ซ้ำในทรานแซกชันเดียว)
export function groupRowsByEntity(group: OrderAuditGroup): OrderAuditRow[][] {
  const order: string[] = [];
  const byEntity = new Map<string, OrderAuditRow[]>();

  for (const row of group.rows) {
    const existing = byEntity.get(row.entity_uuid);
    if (existing) {
      existing.push(row);
      continue;
    }
    byEntity.set(row.entity_uuid, [row]);
    order.push(row.entity_uuid);
  }

  return order.map((entityUuid) => byEntity.get(entityUuid) ?? []);
}
