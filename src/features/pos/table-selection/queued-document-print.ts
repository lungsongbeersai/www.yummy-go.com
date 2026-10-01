import type { KitchenPrintResult } from "@/services/printer";

export type QueuedDocumentPrintOutcome = "success" | "pending" | "error";
export type QueuedDocumentPrintRoute = QueuedDocumentPrintOutcome | "system-print";

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

export function queuedDocumentPrintRoute(
  result: Pick<
    KitchenPrintResult,
    "successCount" | "failedCount" | "pending"
  >,
  systemPrintAvailable: boolean,
): QueuedDocumentPrintRoute {
  const outcome = queuedDocumentPrintOutcome(result);
  return outcome === "error"
    && result.successCount === 0
    && !result.pending
    && systemPrintAvailable
    ? "system-print"
    : outcome;
}
