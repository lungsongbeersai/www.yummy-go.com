import { money } from "@/lib/format";
import { optionalNumber } from "@/lib/values";
import type { CartOrder, DiscountTypeCode } from "@/services/pos";
import type { DiscountDraft } from "./types";
import { formatRate } from "./cart-readers";

export function normalizeDiscountType(
  value: unknown,
  discountValue?: unknown,
): DiscountTypeCode {
  const normalized = String(value ?? "").trim().toUpperCase();
  const amountTypes = ["AMT", "AMOUNT", "FIXED", "MONEY", "LAK", "KIP", "2"];
  const percentTypes = ["PCT", "PERCENT", "PERCENTAGE", "%", "1"];

  if (amountTypes.includes(normalized))
    return "AMT";
  if (percentTypes.includes(normalized))
    return "PCT";

  const numericValue = optionalNumber(discountValue);
  return numericValue !== null && numericValue > 100 ? "AMT" : "PCT";
}

export function discountDraftValue(
  draft: DiscountDraft,
  maxAmount: number | null = null,
) {
  const value = optionalNumber(draft.value);
  if (value === null || value < 0) return null;
  if (draft.type === "PCT" && value > 100) return null;
  if (draft.type === "AMT" && maxAmount !== null && value > maxAmount)
    return null;
  return value;
}

export function normalizeCalculatorValue(value: string) {
  const sanitized = value.replace(/[^\d.]/g, "");
  const [integer = "", ...decimalParts] = sanitized.split(".");
  const normalizedInteger = integer.replace(/^0+(?=\d)/, "");
  const decimal = decimalParts.join("");
  return sanitized.includes(".")
    ? `${normalizedInteger || "0"}.${decimal}`
    : normalizedInteger;
}

export function appendCalculatorInput(currentValue: string, input: string) {
  if (input === "clear") return "0";
  if (input === "delete") return currentValue.slice(0, -1);
  if (input === "." && currentValue.includes(".")) return currentValue;
  return normalizeCalculatorValue(`${currentValue}${input}`);
}

// ສ່ວນຫຼຸດແບບເປີເຊັນຕ້ອງບໍ່ເກີນ 100 — ຖ້າກົດແລ້ວຄ່າຈະເກີນ ໃຫ້ຄົງຄ່າເດີມໄວ້
export function appendDiscountCalculatorInput(
  draft: DiscountDraft,
  input: string,
) {
  const nextValue = appendCalculatorInput(draft.value, input);
  if (draft.type === "PCT") {
    const numeric = optionalNumber(nextValue);
    if (numeric !== null && numeric > 100) return draft.value;
  }
  return nextValue;
}

// ສະຫຼັບປະເພດສ່ວນຫຼຸດ — ຖ້າປ່ຽນເປັນເປີເຊັນແລ້ວຄ່າເດີມເກີນ 100 ໃຫ້ລ້າງຄ່າ
export function discountDraftWithType(
  draft: DiscountDraft,
  type: DiscountTypeCode,
): DiscountDraft {
  if (type === "PCT") {
    const numeric = optionalNumber(draft.value);
    if (numeric !== null && numeric > 100) return { type, value: "" };
  }
  return { ...draft, type };
}

export function billDiscountButtonValue(order: CartOrder | undefined) {
  const value = optionalNumber(order?.order_discount_value);
  if (value === null || value <= 0) return null;

  if (normalizeDiscountType(order?.order_discount_type, value) === "PCT") {
    const rate = formatRate(value);
    return rate ? `${rate}%` : null;
  }

  return money(value);
}
