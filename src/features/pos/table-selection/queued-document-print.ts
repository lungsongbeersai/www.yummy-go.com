import type { KitchenPrintResult } from "@/services/printer";

export type QueuedDocumentPrintOutcome = "success" | "pending" | "error";

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
  print: () => Promise<void>;
  onCommitted: () => void;
  refresh: () => Promise<void>;
  onPrintError: (error: unknown) => void;
}): Promise<{ completionError?: unknown; refreshError?: unknown }> {
  const result: { completionError?: unknown; refreshError?: unknown } = {};
  try {
    await print();
  } catch (printError) {
    try {
      onPrintError(printError);
    } catch (completionError) {
      result.completionError = completionError;
    }
  }
  try {
    onCommitted();
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
  >,
): QueuedDocumentPrintOutcome {
  if (result.failedCount > 0) return "error";
  if (result.pending) return "pending";
  if (result.successCount > 0) return "success";
  return "error";
}
