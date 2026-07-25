// Canonical value-reading helpers. Historically these were re-defined in
// ~20 files (report utils, store normalizers, sales utils, services);
// every copy now re-exports from here so behavior can only drift in one place.

export function isPresent(value: unknown) {
  return value !== null && value !== undefined && value !== "";
}

export function textValue(value: unknown, fallback = "-") {
  return isPresent(value) ? String(value) : fallback;
}

export function readValue(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (isPresent(value)) return value;
  }
  return undefined;
}

export function firstNumber(...values: unknown[]) {
  for (const value of values) {
    if (!isPresent(value)) continue;
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

// Same scan as firstNumber but with the 0 fallback several report screens rely on.
export function firstNumberOrZero(...values: unknown[]) {
  return firstNumber(...values) ?? 0;
}

export function readNumber(row: Record<string, unknown>, keys: string[]) {
  return firstNumber(readValue(row, keys));
}

// first non-empty value coerced to a trimmed string, else null
export function optionalString(...values: unknown[]) {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return null;
}

// first present value coerced to boolean (accepts 1/0, true/false, yes/no), else null
export function optionalBoolean(...values: unknown[]) {
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    const text = String(value).trim().toLowerCase();
    if (["1", "true", "yes", "y"].includes(text)) return true;
    if (["0", "false", "no", "n"].includes(text)) return false;
  }
  return null;
}

// optionalNumber is the same first-finite-number scan as firstNumber
export { firstNumber as optionalNumber };
