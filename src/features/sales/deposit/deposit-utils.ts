import type { DepositRow } from "@/services/deposit";

export type DepositCreateValidationError =
  | "customerRequired"
  | "itemsRequired"
  | "productRequired"
  | "qtyInvalid";

export interface DepositCreateItemDraft {
  proDetailUuid: string;
  qty: number;
}

export type DepositWithdrawValidationError = "qtyInvalid" | "qtyExceedsRemaining" | "depositNotActive";

export type DepositBadgeVariant = "default" | "secondary" | "destructive" | "outline";

export interface DepositDateSchedule {
  depositDate: string;
  expireDate: string;
}

const BUSINESS_TIME_ZONE = "Asia/Vientiane";

function dateOnlyInTimeZone(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric"
  }).formatToParts(value);
  const fields = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${fields.year}-${fields.month}-${fields.day}`;
}

// This is a preview for staff. The backend repeats the same calculation from
// its own Vientiane date and store setting when the deposit is persisted.
export function depositDateSchedule(
  days: number | null | undefined,
  now = new Date()
): DepositDateSchedule {
  const depositDate = dateOnlyInTimeZone(now);
  const normalizedDays = Number(days);
  if (!Number.isInteger(normalizedDays) || normalizedDays <= 0) {
    return { depositDate, expireDate: "" };
  }

  const [year, month, day] = depositDate.split("-").map(Number);
  const expires = new Date(Date.UTC(year, month - 1, day));
  expires.setUTCDate(expires.getUTCDate() + normalizedDays);

  return {
    depositDate,
    expireDate: expires.toISOString().slice(0, 10)
  };
}

export function toDepositQtyInput(value: string | number | null | undefined) {
  const parsed = Number(String(value ?? "").replaceAll(",", "").trim());
  return Number.isFinite(parsed) ? Math.max(parsed, 0) : 0;
}

export function validateDepositCreate(input: {
  customerUuid: string;
  items: DepositCreateItemDraft[];
}): DepositCreateValidationError | null {
  if (!input.customerUuid) return "customerRequired";
  if (!input.items.length) return "itemsRequired";

  for (const item of input.items) {
    if (!item.proDetailUuid) return "productRequired";
    if (!Number.isFinite(item.qty) || item.qty <= 0) return "qtyInvalid";
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
