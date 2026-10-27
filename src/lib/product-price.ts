// Zero is an explicit sale price. Missing or malformed values must never turn
// into a complimentary item through Number(null) or a truthy fallback.
export function parseProductPrice(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? Math.max(0, value) : null;
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!/^(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d*)?|\.\d+)$/.test(text)) return null;
  const price = Number(text.replace(/,/g, ""));
  return Number.isFinite(price) && price >= 0 ? price : null;
}

export function readProductPrice(...values: unknown[]): number | null {
  for (const value of values) {
    if (value === null || value === undefined || (typeof value === "string" && !value.trim())) continue;
    return parseProductPrice(value);
  }
  return null;
}
