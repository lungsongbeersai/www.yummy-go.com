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

// yyyy-mm-dd in local time, the value shape <input type="date"> expects.
export function localDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
