export interface NumberFormatOptions {
  decimal?: boolean;
}

function formatIntegerPart(value: string) {
  if (!value) return "";
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function stripNumberFormat(value: unknown, options: NumberFormatOptions = {}) {
  const text = String(value ?? "").replace(/,/g, "").trim();
  if (!text) return "";

  if (!options.decimal) return text.replace(/\D/g, "");

  let output = "";
  let hasDecimal = false;

  for (const char of text) {
    if (/\d/.test(char)) {
      output += char;
      continue;
    }
    if (char === "." && !hasDecimal) {
      output += char;
      hasDecimal = true;
    }
  }

  return output === "." ? "" : output;
}

export function formatNumberInput(value: unknown, options: NumberFormatOptions = {}) {
  const raw = stripNumberFormat(value, options);
  if (!raw) return "";

  if (!options.decimal) return formatIntegerPart(raw);

  const hasDecimal = raw.includes(".");
  const [integer = "", fraction = ""] = raw.split(".");
  const formattedInteger = formatIntegerPart(integer);

  return hasDecimal ? `${formattedInteger}.${fraction}` : formattedInteger;
}

export function numberFromFormatted(value: unknown, fallback = 0) {
  const raw = stripNumberFormat(value, { decimal: true });
  if (!raw || raw === ".") return fallback;

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}
