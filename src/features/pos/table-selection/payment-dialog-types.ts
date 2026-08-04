import type { CartOrder, PosTable } from "@/services/pos";
import type { cartSummary } from "./utils";
import type { PaymentKind } from "./payment-dialog-utils";

export interface PaymentDialogProps {
  // false เฉพาะออเดอร์เคาน์เตอร์ (ร้านไม่มีโต๊ะ) ที่ table เป็น identity
  // สังเคราะห์ขึ้นมา (ดู counterOrderTable) ไม่ใช่โต๊ะจริง — ต้องไม่ส่ง
  // table_uuid นี้ไปกับ payment payload
  hasRealTable?: boolean;
  onCompleted: () => Promise<void>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  orders: CartOrder[];
  paymentKind?: PaymentKind;
  splitBillItemUuids?: string[];
  summary: ReturnType<typeof cartSummary>;
  table: PosTable;
}
