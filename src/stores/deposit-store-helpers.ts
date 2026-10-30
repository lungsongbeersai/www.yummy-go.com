import type { DepositCreateInput, DepositRow, DepositWithdrawInput } from "@/services/deposit";
import type { KitchenPrintResult } from "@/services/printer";

export type DepositReceiptOutcome = "success" | "pending" | "error" | "skipped";

export function depositCreateFingerprint(input: DepositCreateInput) {
  return JSON.stringify({
    branch: input.branch_uuid.trim(),
    customer: input.customer_uuid.trim(),
    order: input.order_uuid?.trim() || "",
    items: input.items.map((item) => [item.pro_detail_uuid.trim(), item.deposit_qty])
      .sort((left, right) => String(left[0]).localeCompare(String(right[0]))),
    note: input.note?.trim() || ""
  });
}

export function depositWithdrawFingerprint(input: Omit<DepositWithdrawInput, "request_uuid">) {
  return JSON.stringify({
    deposit: input.deposit_uuid.trim(),
    order: input.order_uuid?.trim() || "",
    quantity: input.qty_withdrawn,
    note: input.note?.trim() || ""
  });
}

export function mergeDepositRows(current: DepositRow[], incoming: DepositRow[]) {
  const seen = new Set<string>();
  return [...incoming, ...current].filter((row) => {
    if (seen.has(row.deposit_uuid)) return false;
    seen.add(row.deposit_uuid);
    return true;
  });
}

export function depositReceiptPrintOutcome(result: KitchenPrintResult): DepositReceiptOutcome {
  if (result.failedCount > 0 || result.errorMessage) return "error";
  if (result.pending) return "pending";
  return result.total > 0 && result.successCount >= result.total ? "success" : "error";
}
