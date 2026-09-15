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

// กัน uuid ซ้ำ ไม่ว่าจะมาจาก backend embed ซ้ำเอง (categories/zones) หรือ cate_uuid_fk/zone_uuid_fk ซ้ำ —
// React ใช้ uuid นี้เป็น key ของ Badge ใน BadgeList โดยตรง ถ้าซ้ำจะเจอ "two children with the same key"
function dedupeByUuid<T>(items: T[], uuidOf: (item: T) => string) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const uuid = uuidOf(item);
    if (seen.has(uuid)) return false;
    seen.add(uuid);
    return true;
  });
}

export function printerCategories(printer: Printer, categories: Category[]) {
  const source = printer.categories?.length
    ? printer.categories
    : printer.cate_uuid_fk
        .map((uuid) => categories.find((category) => category.cate_uuid === uuid))
        .filter((category): category is Category => Boolean(category));
  return dedupeByUuid(source, (category) => category.cate_uuid);
}

// เครื่องพิมพ์เก่าก่อน backend เพิ่ม mapping_type ถือว่าเป็น CATEGORY (ดู mappingTypeOf ใน printer-form-utils.ts)
export function mappingTypeOf(printer: Printer): PrinterMappingType {
  return printer.mapping_type ?? "CATEGORY";
}

function isSharedPrinter(printer: Printer) {
  return (
    printer.is_shared === true ||
    String(printer.sharing_mode ?? "").trim().toUpperCase() === "SHARED"
  );
}

// สิทธิ์จาก Backend เป็นแหล่งจริง เมื่อเป็นข้อมูลจาก Backend รุ่นเก่าที่ยังไม่มี
// can_edit/can_delete ให้ถือเครื่อง SHARED เป็น read-only เพื่อไม่เปิดทางให้อุปกรณ์
// อื่นแก้ไขหรือลบโดยอาศัยค่า fallback ฝั่งหน้าเว็บ
export function canEditPrinter(printer: Printer) {
  if (printer.can_edit !== undefined) return printer.can_edit;
  if (isSharedPrinter(printer)) {
    return printer.is_owner === true && printer.is_local_device !== false;
  }
  return printer.is_owner !== false && printer.is_local_device !== false;
}

export function canDeletePrinter(printer: Printer) {
  if (printer.can_delete !== undefined) return printer.can_delete;
  if (isSharedPrinter(printer)) {
    return printer.is_owner === true && printer.is_local_device !== false;
  }
  return printer.is_owner !== false && printer.is_local_device !== false;
}

// เครื่องพิมพ์เก่าก่อน backend เพิ่ม is_owner ถือว่าเป็นเจ้าของ (พฤติกรรมเดิมก่อนมีการแชร์ข้ามอุปกรณ์ —
// ไม่งั้นเครื่องพิมพ์เก่าทุกเครื่องจะขึ้น badge "แชร์มา" ผิด ๆ)
export function isOwnedPrinter(printer: Printer) {
  if (printer.is_owner !== undefined) return printer.is_owner;
  if (printer.is_local_device === false || isSharedPrinter(printer)) return false;
  return true;
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
  const source = printer.zones?.length
    ? printer.zones
    : (printer.zone_uuid_fk ?? [])
        .map((uuid) => zones.find((zone) => zone.zone_uuid === uuid))
        .filter((zone): zone is Zone => Boolean(zone));
  return dedupeByUuid(source, (zone) => zone.zone_uuid);
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
