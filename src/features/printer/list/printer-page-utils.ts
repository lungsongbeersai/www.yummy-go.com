import type { Category } from "@/services/category";
import type {
  Printer,
  PrinterCategory,
  PrinterMappingType,
  PrinterRole,
  PrinterZone,
} from "@/services/printer";
import type { Zone } from "@/services/zone";

export type PrinterTableRow = Printer & { row_number: number };

export const TYPE_ALL = "all";
export const STATUS_ALL = "all";
export const OWNER_ALL = "all";
export const OWNER_MINE = "own";
export const OWNER_SHARED = "shared";
export type PrinterOwnerFilter =
  | typeof OWNER_ALL
  | typeof OWNER_MINE
  | typeof OWNER_SHARED;

export const XPRINTER_DRIVER_URL =
  "/downloads/drivers/XPrinter%20Driver%20Setup%20V8.2.exe";
export const XPRINTER_DRIVER_FILE_NAME = "XPrinter Driver Setup V8.2.exe";
export const PRINTER_SETUP_DOWNLOAD_URL =
  "https://drive.google.com/file/d/1hLikOQZHEpVzoWgmoFXjoePvy0zM88RV/view";

export function roleLabel(code: string, roles: PrinterRole[]) {
  return roles.find((role) => role.role_code === code)?.role_name ?? code;
}

export function categoryLabel(
  category: Category | PrinterCategory,
  language: string,
) {
  const english = language.startsWith("en");
  const primary = english ? category.cate_name_eng : category.cate_name_la;
  const fallback = english ? category.cate_name_la : category.cate_name_eng;
  return primary || fallback || category.cate_name || category.cate_uuid;
}

export function printerCategories(printer: Printer, categories: Category[]) {
  if (printer.categories?.length) return printer.categories;
  return printer.cate_uuid_fk
    .map((uuid) => categories.find((category) => category.cate_uuid === uuid))
    .filter((category): category is Category => Boolean(category));
}

// เครื่องพิมพ์เก่าก่อน backend เพิ่ม mapping_type ถือว่าเป็น CATEGORY (ดู mappingTypeOf ใน printer-form-utils.ts)
export function mappingTypeOf(printer: Printer): PrinterMappingType {
  return printer.mapping_type ?? "CATEGORY";
}

// เครื่องพิมพ์เก่าก่อน backend เพิ่ม can_edit/can_delete จะไม่มีฟิลด์นี้มา — ถือว่าแก้ไข/ลบได้
// (พฤติกรรมเดิมก่อนมีการแชร์เครื่องพิมพ์ข้ามอุปกรณ์) ต่างจาก false ที่ backend ส่งมาจริงเมื่อเครื่องพิมพ์
// ถูกแชร์มาจากอุปกรณ์อื่น (ไม่ใช่เจ้าของ) — ห้ามอนุมานจาก is_owner เอง เผื่อ backend มีเงื่อนไขสิทธิ์เพิ่มเติม
export function canEditPrinter(printer: Printer) {
  return printer.can_edit ?? true;
}

export function canDeletePrinter(printer: Printer) {
  return printer.can_delete ?? true;
}

// เครื่องพิมพ์เก่าก่อน backend เพิ่ม is_owner ถือว่าเป็นเจ้าของ (พฤติกรรมเดิมก่อนมีการแชร์ข้ามอุปกรณ์ —
// ไม่งั้นเครื่องพิมพ์เก่าทุกเครื่องจะขึ้น badge "แชร์มา" ผิด ๆ)
export function isOwnedPrinter(printer: Printer) {
  return printer.is_owner ?? true;
}

export function matchesPrinterOwnership(
  printer: Printer,
  filter: PrinterOwnerFilter,
) {
  if (filter === OWNER_ALL) return true;
  return filter === OWNER_MINE
    ? isOwnedPrinter(printer)
    : !isOwnedPrinter(printer);
}

export function zoneLabel(zone: Zone | PrinterZone, language: string) {
  const english = language.startsWith("en");
  const primary = english ? zone.zone_name_eng : zone.zone_name_la;
  const fallback = english ? zone.zone_name_la : zone.zone_name_eng;
  return primary || fallback || zone.zone_name || zone.zone_uuid;
}

// zone_uuid_fk มีความหมายเฉพาะ mapping_type = ZONE เท่านั้น — printer ประเภท CATEGORY ไม่มีโซนให้แสดง
export function printerZones(printer: Printer, zones: Zone[]) {
  if (mappingTypeOf(printer) !== "ZONE") return [];
  if (printer.zones?.length) return printer.zones;
  return (printer.zone_uuid_fk ?? [])
    .map((uuid) => zones.find((zone) => zone.zone_uuid === uuid))
    .filter((zone): zone is Zone => Boolean(zone));
}

export function agentDownloadUrl(
  file: { download_url?: string },
  cacheBust?: string | number,
) {
  const downloadUrl =
    typeof file.download_url === "string" ? file.download_url.trim() : "";

  if (!downloadUrl || cacheBust === undefined) return downloadUrl;

  try {
    const url = new URL(downloadUrl);
    url.searchParams.set("agent_download", String(cacheBust));
    return url.toString();
  } catch {
    const separator = downloadUrl.includes("?") ? "&" : "?";
    return `${downloadUrl}${separator}agent_download=${encodeURIComponent(String(cacheBust))}`;
  }
}
