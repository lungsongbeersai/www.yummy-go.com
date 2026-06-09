"use client";

import { usePaymentDialogWorkflow } from "./hooks/use-payment-dialog-workflow";
import { PaymentDialogContent } from "./payment-dialog-content";
import type { PaymentDialogProps } from "./payment-dialog-types";

export type { PaymentDialogProps } from "./payment-dialog-types";

export function PaymentDialog(props: PaymentDialogProps) {
  const workflow = usePaymentDialogWorkflow(props);

  return <PaymentDialogContent workflow={workflow} />;
}
