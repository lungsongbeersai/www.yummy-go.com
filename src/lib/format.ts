export function money(value?: number | string | null, currency = "₭") {
  const amount = Number(value ?? 0);
  return `${amount.toLocaleString("lo-LA", { maximumFractionDigits: 0 })} ${currency}`;
}

export function dateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function compactText(value: unknown, fallback = "-") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}
