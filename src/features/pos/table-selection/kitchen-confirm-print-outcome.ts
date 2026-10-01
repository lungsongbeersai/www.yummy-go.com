export interface KitchenConfirmPrintResult {
  errorMessage?: string;
  failedCount: number;
  pending?: boolean;
  successCount: number;
  total: number;
}

export type KitchenConfirmPrintOutcome =
  | "success"
  | "queued"
  | "incomplete";

export function kitchenConfirmPrintOutcome(
  result: KitchenConfirmPrintResult,
): KitchenConfirmPrintOutcome {
  if (
    result.failedCount > 0 ||
    Boolean(result.errorMessage) ||
    (result.total > 0 && result.successCount < result.total)
  ) {
    return "incomplete";
  }

  // A remote SHARED owner prints asynchronously and ACKs through Backend.
  // Pending with no missing/failed result means accepted by that queue, not failed.
  if (result.pending) return "queued";

  return "success";
}
