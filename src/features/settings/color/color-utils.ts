import type { CSSProperties } from "react";
import type { Color, SaveColorInput } from "@/services/color";

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const HEX_PICKER_COLOR = /^#[0-9a-fA-F]{6}$/;

export function colorValue(row: Color | null | undefined, key: string, fallback = "") {
  const raw = row?.[key];
  if (raw === null || raw === undefined || raw === "") return fallback;
  return String(raw);
}

export function colorId(row: Color | null | undefined) {
  return colorValue(row, "color_uuid");
}

export function colorCode(row: Color | null | undefined) {
  return colorValue(row, "color_code");
}

export function colorName(row: Color | null | undefined) {
  return colorValue(row, "color_name", colorCode(row) || "-");
}

export function colorStyle(code: string): CSSProperties | undefined {
  const trimmed = code.trim();
  return HEX_COLOR.test(trimmed) ? { backgroundColor: trimmed } : undefined;
}

export function pickerColor(code: string) {
  const trimmed = code.trim();
  if (HEX_PICKER_COLOR.test(trimmed)) return trimmed;
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`;
  }
  return "#000000";
}

export type ColorMissingField = "code" | null;

export function missingColorField({ code }: { code: string }): ColorMissingField {
  if (!code.trim()) return "code";
  return null;
}

export function buildColorPayload({
  code,
  editing
}: {
  code: string;
  editing: Color | null;
}): SaveColorInput {
  return {
    color_uuid: colorId(editing),
    color_code: code.trim()
  };
}
