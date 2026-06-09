import type { Currency, SaveCurrencyInput } from "@/services/currency";

export function currencyValue(row: Currency | null | undefined, key: string, fallback = "") {
  const raw = row?.[key];
  if (raw === null || raw === undefined || raw === "") return fallback;
  return String(raw);
}

export function currencyId(row: Currency | null | undefined) {
  return currencyValue(row, "currency_uuid");
}

export function currencyName(row: Currency | null | undefined) {
  return currencyValue(row, "currency_name", "-");
}

export function currencyIcon(row: Currency | null | undefined) {
  return currencyValue(row, "currency_icon", "-").toUpperCase();
}

export function currencyStatus(row: Currency | null | undefined) {
  return currencyValue(row, "currency_status", "1");
}

export function currencyStatusLabel(status: string, activeLabel: string, inactiveLabel: string) {
  return Number(status || 1) === 1 ? activeLabel : inactiveLabel;
}

export function currencyStatusBadgeClass(status: string) {
  return Number(status || 1) === 1
    ? "border-primary/25 bg-primary/10 text-primary"
    : "border-muted-foreground/20 bg-muted text-muted-foreground";
}

export type CurrencyMissingField = "name" | "flag" | "status" | null;

export function missingCurrencyField({
  icon,
  name,
  status
}: {
  icon: string;
  name: string;
  status: string;
}): CurrencyMissingField {
  if (!name.trim()) return "name";
  if (!icon.trim()) return "flag";
  if (!status.trim()) return "status";
  return null;
}

export function buildCurrencyPayload({
  editing,
  icon,
  name,
  status
}: {
  editing: Currency | null;
  icon: string;
  name: string;
  status: string;
}): SaveCurrencyInput {
  return {
    currency_uuid: currencyId(editing),
    currency_name: name.trim(),
    currency_icon: icon.trim().toUpperCase(),
    currency_status: Number(status || 1)
  };
}
