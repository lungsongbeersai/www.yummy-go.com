import type { DepositRow } from "@/services/deposit";

export type DepositCreateValidationError =
  | "customerRequired"
  | "itemsRequired"
  | "productRequired"
  | "qtyInvalid"
  | "expireDateInvalid"
  | "expireDatePast";

export interface DepositCreateItemDraft {
  proDetailUuid: string;
  qty: number;
}

export type DepositWithdrawValidationError = "qtyInvalid" | "qtyExceedsRemaining" | "depositNotActive";

export type DepositBadgeVariant = "default" | "secondary" | "destructive" | "outline";

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function todayDateOnly() {
  return new Date().toISOString().slice(0, 10);
}

// เอาไว้เดา expire_date ล่วงหน้าให้พนักงานเห็นก่อนกดฝากจริง ค่าจริงยังคำนวณที่
// backend เสมอ (ฝั่งนี้ใช้เวลาเครื่อง client ได้ เพราะ backend validate/คำนวณซ้ำอยู่ดี)
export function expireDateFromToday(days: number | null | undefined) {
  if (!days || days <= 0) return "";
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function toDepositQtyInput(value: string | number | null | undefined) {
  const parsed = Number(String(value ?? "").replaceAll(",", "").trim());
  return Number.isFinite(parsed) ? Math.max(parsed, 0) : 0;
}

export function validateDepositCreate(input: {
  customerUuid: string;
  items: DepositCreateItemDraft[];
  expireDate: string;
}): DepositCreateValidationError | null {
  if (!input.customerUuid) return "customerRequired";
  if (!input.items.length) return "itemsRequired";

  for (const item of input.items) {
    if (!item.proDetailUuid) return "productRequired";
    if (!Number.isFinite(item.qty) || item.qty <= 0) return "qtyInvalid";
  }

  if (input.expireDate) {
    if (!DATE_ONLY_PATTERN.test(input.expireDate)) return "expireDateInvalid";
    if (input.expireDate < todayDateOnly()) return "expireDatePast";
  }

  return null;
}

export function validateDepositWithdraw(input: {
  qtyWithdrawn: number;
  deposit: DepositRow | null;
}): DepositWithdrawValidationError | null {
  if (!Number.isFinite(input.qtyWithdrawn) || input.qtyWithdrawn <= 0) return "qtyInvalid";
  if (!input.deposit || input.deposit.status !== "ACTIVE" || input.deposit.is_expired) {
    return "depositNotActive";
  }
  if (input.qtyWithdrawn > input.deposit.remaining_qty) return "qtyExceedsRemaining";
  return null;
}

export function depositBadgeVariant(row: Pick<DepositRow, "status" | "is_expired">): DepositBadgeVariant {
  if (row.is_expired || row.status === "EXPIRED") return "destructive";
  if (row.status === "ACTIVE") return "default";
  if (row.status === "WITHDRAWN") return "secondary";
  return "outline";
}
