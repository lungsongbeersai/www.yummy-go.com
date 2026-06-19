import type { Category } from "@/services/category";
import type { SaveProductInput, SizeOption } from "@/services/product";
import type { Size } from "@/services/size";
import type { Unit } from "@/services/unit";
import {
  categoryUuid,
  generateProdCode,
  sizeUuid,
  unitUuid,
} from "@/features/product/form/product-form-utils";

export type ProductImportType = "normal" | "set";

export interface ProductImportSheetRow {
  rowNumber: number;
  values: Record<string, unknown>;
}

export interface ProductImportWorkbookRows {
  Normal?: ProductImportSheetRow[];
  Set?: ProductImportSheetRow[];
}

export interface ProductImportDraft {
  key: string;
  type: ProductImportType;
  sheetName: "Normal" | "Set";
  rowNumbers: number[];
  productCode: string;
  productNameLa: string;
  productNameEng: string;
  categoryName: string;
  unitName: string;
  detailCount: number;
  salePrice: number;
  errors: string[];
  warnings: string[];
  payload: SaveProductInput | null;
}

export interface ProductImportReferences {
  branchUuid: string;
  categories: Category[];
  units: Unit[];
  sizes: Size[];
  setSizes: SizeOption[];
}

export interface ProductImportMessages {
  required: (field: string) => string;
  rowRequired: (row: number, field: string) => string;
  categoryNotFound: (name: string) => string;
  unitNotFound: (name: string) => string;
  sizeNotFound: (row: number, name: string) => string;
  setOptionNotFound: (row: number, name: string) => string;
  priceGreaterThanZero: (row: number, field: string) => string;
  setPriceGreaterThanZero: () => string;
  multipleSetPrices: () => string;
}

const DEFAULT_COLOR = "#10B981";
const DEFAULT_ORDER_POINT = 10;
const DEFAULT_STOCK_QTY = 100;

const NORMAL_HEADERS = [
  "Product Code",
  "Product Name (Lao)",
  "Product Name (English)",
  "Category",
  "Unit",
  "Size Name",
  "Cost Price",
  "Sale Price",
] as const;

const SET_HEADERS = [
  "Product Code",
  "Set Name (Lao)",
  "Set Name (English)",
  "Category",
  "Unit",
  "Set Option / Product Name",
  "Cost Price",
  "Set Price",
] as const;

type NormalHeader = (typeof NORMAL_HEADERS)[number];
type SetHeader = (typeof SET_HEADERS)[number];

const DEFAULT_IMPORT_MESSAGES: ProductImportMessages = {
  required: (field) => `${field} is required`,
  rowRequired: (row, field) => `Row ${row}: ${field} is required`,
  categoryNotFound: (name) => `Category not found: ${name}`,
  unitNotFound: (name) => `Unit not found: ${name}`,
  sizeNotFound: (row, name) => `Row ${row}: Size not found: ${name}`,
  setOptionNotFound: (row, name) => `Row ${row}: Set option not found: ${name}`,
  priceGreaterThanZero: (row, field) => `Row ${row}: ${field} must be greater than 0`,
  setPriceGreaterThanZero: () => "Set Price must be greater than 0",
  multipleSetPrices: () => "Set has multiple Set Price values. The first price will be used.",
};

function cleanText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function keyText(value: unknown) {
  return cleanText(value).toLocaleLowerCase("lo");
}

function numberValue(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(cleanText(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function firstText(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = cleanText(row[key]);
    if (value) return value;
  }
  return "";
}

function optionLabel(row: Record<string, unknown>, keys: string[]) {
  return keys.map((key) => keyText(row[key])).filter(Boolean);
}

function matchOption<T extends Record<string, unknown>>(
  rows: T[],
  value: string,
  keys: string[],
  rowId: (row: T | null | undefined) => string,
) {
  const target = keyText(value);
  if (!target) return "";
  const match = rows.find((row) => optionLabel(row, keys).includes(target));
  return rowId(match);
}

function required(value: string, label: string, errors: string[], messages: ProductImportMessages) {
  if (!value) errors.push(messages.required(label));
}

function rowRequired(value: string, row: number, label: string, errors: string[], messages: ProductImportMessages) {
  if (!value) errors.push(messages.rowRequired(row, label));
}

function makeGroupKey(type: ProductImportType, code: string, nameLa: string, nameEng: string, category: string, unit: string) {
  return [type, code || nameLa, nameEng, category, unit].map(keyText).join("::");
}

function displayCode(code: string, index: number) {
  return code || `${generateProdCode()}-${index + 1}`;
}

function normalizeRows<H extends string>(rows: ProductImportSheetRow[] | undefined, headers: readonly H[]) {
  const normalized: Array<{ rowNumber: number; values: Record<H, string> }> = [];
  const previous: Partial<Record<H, string>> = {};

  rows?.forEach((row) => {
    const firstCell = cleanText(row.values[headers[0]]);
    const values = {} as Record<H, string>;
    headers.forEach((header) => {
      const text = cleanText(row.values[header]);
      values[header] = text || previous[header] || "";
    });

    const hasAnyValue = headers.some((header) => cleanText(row.values[header]));
    if (!hasAnyValue) return;
    if (/^(enter |import defaults:)/i.test(firstCell)) return;

    headers.forEach((header) => {
      const directValue = cleanText(row.values[header]);
      if (directValue) previous[header] = directValue;
    });
    normalized.push({ rowNumber: row.rowNumber, values });
  });

  return normalized;
}

export function sheetRowsFromAoA(rows: unknown[][], headers: readonly string[]): ProductImportSheetRow[] {
  const headerIndex = rows.findIndex((row) => headers.every((header) => row.map(cleanText).includes(header)));
  if (headerIndex < 0) return [];

  const headerRow = rows[headerIndex].map(cleanText);
  return rows.slice(headerIndex + 1).map((row, index) => {
    const values: Record<string, unknown> = {};
    headerRow.forEach((header, columnIndex) => {
      if (header) values[header] = row[columnIndex];
    });
    return { rowNumber: headerIndex + index + 2, values };
  });
}

export function buildProductImportDrafts(
  workbook: ProductImportWorkbookRows,
  references: ProductImportReferences,
  messages: ProductImportMessages = DEFAULT_IMPORT_MESSAGES,
) {
  const drafts: ProductImportDraft[] = [];
  const categoryKeys = ["cate_name", "cate_name_la", "cate_name_eng", "category_name", "category_name_la", "category_name_eng"];
  const unitKeys = ["unite_name", "unite_name_la", "unite_name_eng", "unit_name", "unit_name_la", "unit_name_eng"];
  const sizeKeys = ["size_name", "size_name_la", "size_name_eng"];

  const normalGroups = new Map<string, Array<{ rowNumber: number; values: Record<NormalHeader, string> }>>();
  normalizeRows(workbook.Normal, NORMAL_HEADERS).forEach((row) => {
    const code = row.values["Product Code"];
    const key = makeGroupKey(
      "normal",
      code,
      row.values["Product Name (Lao)"],
      row.values["Product Name (English)"],
      row.values.Category,
      row.values.Unit,
    );
    normalGroups.set(key, [...(normalGroups.get(key) ?? []), row]);
  });

  Array.from(normalGroups.values()).forEach((rows, index) => {
    const first = rows[0]?.values;
    if (!first) return;
    const errors: string[] = [];
    const warnings: string[] = [];
    const code = displayCode(first["Product Code"], drafts.length + index);
    const categoryId = matchOption(references.categories, first.Category, categoryKeys, categoryUuid);
    const unitId = matchOption(references.units, first.Unit, unitKeys, unitUuid);

    required(first["Product Name (Lao)"], "Product Name (Lao)", errors, messages);
    required(first.Category, "Category", errors, messages);
    required(first.Unit, "Unit", errors, messages);
    if (first.Category && !categoryId) errors.push(messages.categoryNotFound(first.Category));
    if (first.Unit && !unitId) errors.push(messages.unitNotFound(first.Unit));

    const details = rows.map((row) => {
      const sizeNameValue = row.values["Size Name"];
      const costPrice = numberValue(row.values["Cost Price"]);
      const salePrice = numberValue(row.values["Sale Price"]);
      const sizeId = matchOption(references.sizes, sizeNameValue, sizeKeys, sizeUuid);

      rowRequired(sizeNameValue, row.rowNumber, "Size Name", errors, messages);
      if (sizeNameValue && !sizeId) errors.push(messages.sizeNotFound(row.rowNumber, sizeNameValue));
      if (costPrice <= 0) errors.push(messages.priceGreaterThanZero(row.rowNumber, "Cost Price"));
      if (salePrice <= 0) errors.push(messages.priceGreaterThanZero(row.rowNumber, "Sale Price"));

      return {
        size_uuid_fk: sizeId,
        pro_detail_bprice: costPrice,
        pro_detail_sprice: salePrice,
        pro_detail_qty_stock: DEFAULT_STOCK_QTY,
        pro_detail_stock: 2,
        pro_detail_enabled: 1,
      };
    });

    drafts.push({
      key: `normal-${drafts.length}`,
      type: "normal",
      sheetName: "Normal",
      rowNumbers: rows.map((row) => row.rowNumber),
      productCode: code,
      productNameLa: first["Product Name (Lao)"],
      productNameEng: first["Product Name (English)"] || first["Product Name (Lao)"],
      categoryName: first.Category,
      unitName: first.Unit,
      detailCount: details.length,
      salePrice: details[0]?.pro_detail_sprice ?? 0,
      errors,
      warnings,
      payload: errors.length
        ? null
        : {
            branch_uuid_fk: references.branchUuid,
            cate_uuid_fk: categoryId,
            unite_uuid_fk: unitId,
            prod_code: code,
            prod_name_la: first["Product Name (Lao)"],
            prod_name_eng: first["Product Name (English)"] || first["Product Name (Lao)"],
            prod_order_point: DEFAULT_ORDER_POINT,
            prod_notification: 1,
            status_sort_fk: 1,
            prod_set_price: 0,
            prod_status_imge: 2,
            prod_image: DEFAULT_COLOR,
            prod_topping_status: 1,
            details,
            toppings: [],
          },
    });
  });

  const setGroups = new Map<string, Array<{ rowNumber: number; values: Record<SetHeader, string> }>>();
  normalizeRows(workbook.Set, SET_HEADERS).forEach((row) => {
    const code = row.values["Product Code"];
    const key = makeGroupKey(
      "set",
      code,
      row.values["Set Name (Lao)"],
      row.values["Set Name (English)"],
      row.values.Category,
      row.values.Unit,
    );
    setGroups.set(key, [...(setGroups.get(key) ?? []), row]);
  });

  Array.from(setGroups.values()).forEach((rows, index) => {
    const first = rows[0]?.values;
    if (!first) return;
    const errors: string[] = [];
    const warnings: string[] = [];
    const code = displayCode(first["Product Code"], drafts.length + index);
    const categoryId = matchOption(references.categories, first.Category, categoryKeys, categoryUuid);
    const unitId = matchOption(references.units, first.Unit, unitKeys, unitUuid);
    const setPrices = rows.map((row) => numberValue(row.values["Set Price"])).filter((value) => value > 0);
    const setPrice = setPrices[0] ?? 0;

    required(first["Set Name (Lao)"], "Set Name (Lao)", errors, messages);
    required(first.Category, "Category", errors, messages);
    required(first.Unit, "Unit", errors, messages);
    if (first.Category && !categoryId) errors.push(messages.categoryNotFound(first.Category));
    if (first.Unit && !unitId) errors.push(messages.unitNotFound(first.Unit));
    if (setPrice <= 0) errors.push(messages.setPriceGreaterThanZero());
    if (new Set(setPrices).size > 1) warnings.push(messages.multipleSetPrices());

    const details = rows.map((row) => {
      const optionName = row.values["Set Option / Product Name"];
      const costPrice = numberValue(row.values["Cost Price"]);
      const sizeId = matchOption(references.setSizes, optionName, sizeKeys, sizeUuid);

      rowRequired(optionName, row.rowNumber, "Set Option / Product Name", errors, messages);
      if (optionName && !sizeId) errors.push(messages.setOptionNotFound(row.rowNumber, optionName));
      if (costPrice <= 0) errors.push(messages.priceGreaterThanZero(row.rowNumber, "Cost Price"));

      return {
        size_uuid_fk: sizeId,
        pro_detail_bprice: costPrice,
        pro_detail_qty_stock: DEFAULT_STOCK_QTY,
        pro_detail_stock: 2,
        pro_detail_enabled: 1,
        pro_detail_status: 2,
      };
    });

    drafts.push({
      key: `set-${drafts.length}`,
      type: "set",
      sheetName: "Set",
      rowNumbers: rows.map((row) => row.rowNumber),
      productCode: code,
      productNameLa: first["Set Name (Lao)"],
      productNameEng: first["Set Name (English)"] || first["Set Name (Lao)"],
      categoryName: first.Category,
      unitName: first.Unit,
      detailCount: details.length,
      salePrice: setPrice,
      errors,
      warnings,
      payload: errors.length
        ? null
        : {
            branch_uuid_fk: references.branchUuid,
            cate_uuid_fk: categoryId,
            unite_uuid_fk: unitId,
            prod_code: code,
            prod_name_la: first["Set Name (Lao)"],
            prod_name_eng: first["Set Name (English)"] || first["Set Name (Lao)"],
            prod_order_point: DEFAULT_ORDER_POINT,
            prod_notification: 1,
            status_sort_fk: 2,
            prod_set_price: setPrice,
            prod_status_imge: 2,
            prod_image: DEFAULT_COLOR,
            prod_topping_status: 1,
            details,
            toppings: [],
          },
    });
  });

  return drafts;
}

export function productImportSummary(drafts: ProductImportDraft[]) {
  const ready = drafts.filter((draft) => draft.payload && !draft.errors.length).length;
  const invalid = drafts.length - ready;
  const warnings = drafts.reduce((sum, draft) => sum + draft.warnings.length, 0);
  return { total: drafts.length, ready, invalid, warnings };
}
