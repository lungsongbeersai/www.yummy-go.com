import type { CartOrder, PosTable } from "@/services/pos";
import type { cartSummary } from "./utils";
import type { PaymentKind } from "./payment-dialog-utils";

export interface PaymentDialogProps {
  onCompleted: () => Promise<void>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  orders: CartOrder[];
  paymentKind?: PaymentKind;
  splitBillItemUuids?: string[];
  summary: ReturnType<typeof cartSummary>;
  table: PosTable;
}
