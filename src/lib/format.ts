export function money(value?: number | string | null, currency = "₭") {
  const amount = Number(value ?? 0);
  const formatted = amount.toLocaleString("lo-LA", { maximumFractionDigits: 0 });
  return currency ? `${formatted} ${currency}` : formatted;
}

// Public QR prices keep the full amount and use the Kip symbol. A fixed
// grouping locale avoids punctuation changing when the interface language does.
export function formatMoney(price: number, _lang: string) {
  // Keep the existing call signature; QR-menu price punctuation is language-independent.
  void _lang;
  if (!Number.isFinite(price) || price <= 0) return "0 ₭";

  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(price)} ₭`;
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

const BUSINESS_TIME_ZONE = "Asia/Vientiane";
const BUSINESS_DAY_START_HOUR = 6;

// Reports keep sales through 05:59:59 in the prior business day.
export function businessDateInputValue(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    month: "2-digit",
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const businessDate = new Date(
    Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)),
  );

  if (Number(values.hour) < BUSINESS_DAY_START_HOUR) {
    businessDate.setUTCDate(businessDate.getUTCDate() - 1);
  }

  const year = businessDate.getUTCFullYear();
  const month = String(businessDate.getUTCMonth() + 1).padStart(2, "0");
  const day = String(businessDate.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
