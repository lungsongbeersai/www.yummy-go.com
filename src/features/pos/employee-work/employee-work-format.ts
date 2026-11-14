import type { EmployeeWorkBillState, EmployeeWorkKitchenStatus, EmployeeWorkPaymentStatus, EmployeeWorkScope, EmployeeWorkTotals } from "@/services/pos";

export const EMPLOYEE_WORK_SCOPES: readonly EmployeeWorkScope[] = ["current", "carryover", "undated"];
export const EMPLOYEE_WORK_KITCHEN: readonly ("all" | EmployeeWorkKitchenStatus)[] = ["all", "pending", "partial", "sent", "served", "cancelled", "empty"];
export const EMPLOYEE_WORK_PAYMENT: readonly ("all" | EmployeeWorkPaymentStatus)[] = ["all", "unpaid", "partial", "paid", "credit_unpaid", "credit_partial", "cancelled", "unknown", "not_chargeable"];

export function employeeWorkScopeLabel(scope: EmployeeWorkScope) {
  return ({ current: "today", carryover: "carryover", undated: "undated" } as const)[scope];
}

export function employeeWorkKitchenLabel(status: EmployeeWorkKitchenStatus) {
  return ({ pending: "pending", partial: "partial", sent: "sent", served: "served", cancelled: "cancelled", empty: "emptyBill" } as const)[status];
}

export function employeeWorkPaymentLabels(status: EmployeeWorkPaymentStatus): string[] {
  return ({ unpaid: ["unsettled"], partial: ["partlySettled"], paid: ["settled"], credit_unpaid: ["credit"], credit_partial: ["credit", "partlySettled"], cancelled: ["cancelled"], unknown: ["unknown"], not_chargeable: ["notChargeable"] })[status];
}

export function employeeWorkBillLabel(state: EmployeeWorkBillState) {
  return ({ open: "open", closed: "closed", cancelled: "cancelled", empty: "emptyBill", transferred: "transferred", unknown: "unknown" } as const)[state];
}

export function employeeWorkPrintLabel(status: string) {
  return ({ acknowledged: "printAcknowledged", partial: "partial", queued: "printQueued", failed: "printFailed", skipped: "printSkipped", unknown: "printUnknown" } as Record<string, string>)[status] ?? "printUnknown";
}

export function employeeWorkQuantity(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 }).format(value);
}

export function employeeWorkAdjustments(totals: EmployeeWorkTotals) {
  const fields: [string, number | null][] = [["itemDiscount", totals.item_discount_amount], ["billDiscount", totals.discount_amount], ["serviceCharge", totals.service_amount], ["vat", totals.vat_amount]];
  return fields.flatMap(([label, value]) => value === null || value === 0 ? [] : [{ label, value }]);
}
