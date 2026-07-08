import type { Category } from "@/services/category";
import type { Printer, PrinterCategory, PrinterRole } from "@/services/printer";

export type PrinterTableRow = Printer & { row_number: number };

export const TYPE_ALL = "all";
export const STATUS_ALL = "all";

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

export function agentDownloadUrl(file: { download_url?: string }) {
  return typeof file.download_url === "string" ? file.download_url.trim() : "";
}
