import { ServiceError } from "@/lib/api";

export function requiredText(value: unknown, field: string) {
  const text = String(value ?? "").trim();
  if (!text) throw new ServiceError(`${field} is required`, 400);
  return text;
}

export const requiredUuid = requiredText;
export const requiredToken = (value: unknown) => requiredText(value, "token");

export function requiredItems<T>(items: T[] | undefined | null, field = "items") {
  if (!Array.isArray(items) || !items.length) {
    throw new ServiceError(`${field} is required`, 400);
  }
  return items;
}

export function binaryNumber(value: unknown, field: string) {
  const next = Number(value);
  if (next !== 1 && next !== 2) throw new ServiceError(`${field} must be 1 or 2`, 400);
  return next;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function asRecords<T extends Record<string, unknown>>(value: unknown): T[] {
  return Array.isArray(value) ? value.filter(isRecord) as T[] : [];
}

export function asRecord<T extends Record<string, unknown>>(value: unknown): T | null {
  return isRecord(value) ? value as T : null;
}

export function firstNumber(...values: unknown[]) {
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

export function stringArray(value: unknown) {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}
