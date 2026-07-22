// ตัวช่วย coerce ค่าจาก API ที่ type หลวม (string/number/boolean ปนกัน)
// ใช้ร่วมกันใน permissions/access / permissions/menu-admin / permissions/sidebar
export function text(value: unknown, fallback = "") {
  const next = String(value ?? "").trim();
  return next || fallback;
}

export function numberValue(value: unknown, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

export function booleanFlag(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "1" || normalized === "true";
}
