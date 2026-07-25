export function money(value?: number | string | null, currency = "₭") {
  const amount = Number(value ?? 0);
  return `${amount.toLocaleString("lo-LA", { maximumFractionDigits: 0 })} ${currency}`;
}

// Locale-aware variant used by the public QR menu (public-pos/order), which
// always shows amounts suffixed "LAK" regardless of the staff POS's "₭"
// (P3.3 relocated these from product-domain.ts; kept as separate named
// functions rather than folded into money() so neither surface's visible
// output changes).
export function formatMoney(price: number, lang: string) {
  if (!Number.isFinite(price) || price <= 0) return "0 LAK";

  const locale = lang === "en" ? "en-US" : "lo-LA";
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(price)} LAK`;
}

export function formatShortDate(value: string, lang: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat(lang === "en" ? "en-US" : "lo-LA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
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
