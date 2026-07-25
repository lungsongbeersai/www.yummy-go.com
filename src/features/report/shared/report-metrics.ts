import { money } from "@/lib/format";
import { firstNumberOrZero as firstNumber } from "@/lib/values";

export type ReportMetricKind = "money" | "number" | "percent";

export function formatNumber(value: unknown) {
  return firstNumber(value).toLocaleString("en-US");
}

export function displayMetric(value: unknown, kind: ReportMetricKind) {
  if (kind === "money") return money(firstNumber(value));
  if (kind === "percent") return `${firstNumber(value).toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;
  return formatNumber(value);
}

// ป้องกันค่าจาก backend ที่ไม่ใช่ตัวเลข (null/undefined/NaN) ไม่ให้ทำให้ class/คำนวณพัง
export function metricNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}
