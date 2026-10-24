import type { KitchenPrintResult } from "@/services/printer";
import type { ConfirmToKitchenPendingQuery, ReprintReceiptRequest } from "@/services/pos";

export type QueuedDocumentPrintOutcome = "success" | "pending" | "error";

export function queuedDocumentPrintFailureMessage(
  response: {
    print_queue_error?: { message?: unknown } | null;
    fallback_print?: { reason?: unknown } | null;
  },
  fallbackMessage: string,
): string {
  for (const reason of [response.print_queue_error?.message, response.fallback_print?.reason]) {
    if (typeof reason === "string" && reason.trim()) return reason.trim();
  }
  return fallbackMessage;
}

interface CommittedReceiptOrder {
  order_uuid?: string;
  print_order_uuid?: string;
  new_order_uuid?: string;
  payment?: { order_uuid_fk?: string };
  new_order?: { order_uuid?: string };
  data?: { new_order?: { order_uuid?: string } };
}

export function committedReceiptOrderUuid(
  response: CommittedReceiptOrder,
  committedOrderUuid: string,
  isSplitPayment = false,
): string {
  return response.print_order_uuid ||
    response.payment?.order_uuid_fk ||
    response.new_order?.order_uuid ||
    response.data?.new_order?.order_uuid ||
    response.new_order_uuid ||
    (!isSplitPayment ? response.order_uuid : "") ||
    committedOrderUuid;
}

export function createCommittedReceiptRetry({
  receipt,
  requestReceipt,
  execute,
  createOperationUuid,
  missingJobMessage,
}: {
  receipt: Omit<ReprintReceiptRequest, "operation_uuid">;
  requestReceipt: (request: ReprintReceiptRequest) => Promise<ConfirmToKitchenPendingQuery | null>;
  execute: (query: ConfirmToKitchenPendingQuery) => Promise<QueuedDocumentPrintOutcome>;
  createOperationUuid: () => string;
  missingJobMessage: string;
}) {
  const committedReceipt = { ...receipt };
  let operationUuid = createOperationUuid();
  let pendingQuery: ConfirmToKitchenPendingQuery | undefined;

  return {
    orderUuid: committedReceipt.order_uuid,
    async retry(newPrintRound = true): Promise<QueuedDocumentPrintOutcome> {
      // A manual click starts a fresh print after a known job. A lost enqueue
      // response still reuses its operation ID until its job can be identified.
      if (newPrintRound && pendingQuery) {
        operationUuid = createOperationUuid();
        pendingQuery = undefined;
      }
      if (!pendingQuery) {
        const query = await requestReceipt({
          ...committedReceipt,
          operation_uuid: operationUuid,
        });
        if (!query) throw new Error(missingJobMessage);
        pendingQuery = query;
      }
      return execute(pendingQuery);
    },
  };
}

export function createCheckoutDocumentActionGuard() {
  const active = new Set<string>();
  return {
    isActive: (key: string) => active.has(key),
    acquire(key: string): (() => void) | null {
      if (active.has(key)) return null;
      active.add(key);
      let released = false;
      return () => {
        if (released) return;
        released = true;
        active.delete(key);
      };
    },
  };
}

// Keep the guard across dialog remounts while the original invoice is printing.
// This is only an in-flight action lock; Backend owns every payment and print job.
export const checkoutDocumentActionGuard = createCheckoutDocumentActionGuard();

// Payment has already committed. Keep its dialog and print loading visible
// until the existing receipt job returns a delivery result. A print or screen
// failure must never turn that committed payment into a payment error.
export async function finishCommittedPayment({
  print,
  onCommitted,
  refresh,
  onPrintError,
}: {
  print: () => Promise<QueuedDocumentPrintOutcome>;
  onCommitted: (printOutcome: QueuedDocumentPrintOutcome) => void;
  refresh: () => Promise<void>;
  onPrintError: (error: unknown) => void;
}): Promise<{
  printOutcome: QueuedDocumentPrintOutcome;
  printError?: unknown;
  completionError?: unknown;
  refreshError?: unknown;
}> {
  const result: {
    printOutcome: QueuedDocumentPrintOutcome;
    printError?: unknown;
    completionError?: unknown;
    refreshError?: unknown;
  } = { printOutcome: "error" };
  try {
    result.printOutcome = await print();
  } catch (printError) {
    result.printError = printError;
    try {
      onPrintError(printError);
    } catch (completionError) {
      result.completionError = completionError;
    }
  }
  try {
    onCommitted(result.printOutcome);
  } catch (completionError) {
    result.completionError = completionError;
  }
  try {
    await refresh();
  } catch (refreshError) {
    result.refreshError = refreshError;
  }
  return result;
}

export function isInvoicePrintPreparationError(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("payload" in error)) return false;
  const payload = error.payload;
  return Boolean(
    payload &&
    typeof payload === "object" &&
    "error_code" in payload &&
    payload.error_code === "INVOICE_PRINT_PREPARATION_FAILED",
  );
}

export function queuedDocumentPrintOutcome(
  result: Pick<
    KitchenPrintResult,
    "successCount" | "failedCount" | "pending"
  > & Partial<Pick<KitchenPrintResult, "total" | "errorMessage">>,
): QueuedDocumentPrintOutcome {
  if (result.failedCount > 0) return "error";
  if (result.errorMessage) return "error";
  if (result.pending) return "pending";
  if (result.successCount > 0 && result.successCount >= (result.total ?? 0)) return "success";
  return "error";
}
