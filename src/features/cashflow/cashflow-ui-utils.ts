export function isCashflowDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
  );
}

export function validCashflowDateRange(from: string, to: string) {
  return isCashflowDate(from) && isCashflowDate(to) && from <= to;
}

export function cashflowAmountValue(value: string) {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return null;
  const amount = Number(value);
  return Number.isFinite(amount) &&
    amount > 0 &&
    Number.isSafeInteger(Math.round(amount * 100))
    ? amount
    : null;
}

export function formatCashflowAmount(amount: number, currency = "LAK") {
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(
    amount
  )} ${currency}`;
}

export function formatCashflowDate(value: string, language: string) {
  const date = value.slice(0, 10);
  if (!isCashflowDate(date)) return value;
  return new Intl.DateTimeFormat(language === "en" ? "en-GB" : "lo-LA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}
