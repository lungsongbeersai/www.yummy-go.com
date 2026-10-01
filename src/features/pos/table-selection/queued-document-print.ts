import type { KitchenPrintResult } from "@/services/printer";

export type QueuedDocumentPrintOutcome = "success" | "pending" | "error";

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
