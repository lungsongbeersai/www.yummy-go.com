import { cn } from "@/lib/utils";
import { numberFromFormatted } from "@/lib/number-format";
import type { Category } from "@/services/category";
import type { Color } from "@/services/color";
import type {
  Product,
  ProductTopping,
  SaveProductInput,
} from "@/services/product";
import type { Size } from "@/services/size";
import type { Topping } from "@/services/topping";
import type { Unit } from "@/services/unit";
import type {
  BinaryFlag,
  DetailRow,
  DetailStockSummary,
  ProductSavePayloadState,
  RequiredProductFormState,
  SizeSelectOption,
  StatusSortFk,
  ToppingSelection,
} from "./product-form-types";

export const ORDER_POINT_OPTIONS = Array.from(
  { length: 30 },
  (_, index) => index + 1,
);
export const DEFAULT_COLOR = "#10b981";
export const CUSTOM_COLOR_VALUE = "__custom__";
export const TOPPING_NONE = "1";
export const TOPPING_HAS = "2";
export const EMPTY_CATEGORIES: Category[] = [];
export const EMPTY_COLORS: Color[] = [];
export const EMPTY_SIZES: Size[] = [];
export const EMPTY_TOPPINGS: Topping[] = [];
export const EMPTY_UNITS: Unit[] = [];
export const PRODUCT_FORM_DEFAULTS_STORAGE_PREFIX =
  "yummy-go-product-form-defaults";
export const EMPTY_PRODUCT_FORM_DEFAULTS: ProductFormDefaults = {
  cateUuidFk: "",
  uniteUuidFk: "",
  toppingPrices: {},
};
export const CATEGORY_NAME_KEYS = [
  "cate_name",
  "cate_name_la",
  "cate_name_eng",
  "category_name",
  "category_name_la",
  "category_name_eng",
];
export const UNIT_NAME_KEYS = [
  "unite_name",
  "unite_name_la",
  "unite_name_eng",
  "unit_name",
  "unit_name_la",
  "unit_name_eng",
];
export const TOPPING_NAME_KEYS = [
  "topping_name",
  "topping_name_la",
  "topping_name_eng",
  "prod_topping_name",
  "prod_topping_name_la",
  "prod_topping_name_eng",
];
export const SIZE_NAME_KEYS = ["size_name", "size_name_la", "size_name_eng"];
export const EMPTY_PROMOTION_FIELDS = {
  pro_detail_cus_qtyBuy: "0",
  pro_detail_cus_qtyFree: "0",
  pro_detail_sDate: "",
  pro_detail_eDate: "",
  pro_detail_sTime: "",
  pro_detail_eTime: "",
};

const UUID_PATTERN =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export function rid() {
  return Math.random().toString(36).slice(2, 10);
}

export function generateProdCode() {
  return `PRD-${Date.now().toString(36).toUpperCase()}`;
}

export function colorCode(row: Color) {
  return String(row.color_code ?? "").trim();
}

export function isHexColor(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value);
}

export function colorLabel(row: Color) {
  const code = colorCode(row);
  return String(row.color_name || code || "-");
}

export function rawProductImage(
  row: { [key: string]: unknown } | null | undefined,
) {
  const raw = String(row?.prod_image_raw ?? "");
  if (raw) return raw;

  const image = String(row?.prod_image ?? "");
  if (!/^https?:\/\//i.test(image)) return image;

  try {
    return new URL(image).pathname.split("/").filter(Boolean).pop() ?? "";
  } catch {
    return image.split("/").filter(Boolean).pop() ?? "";
  }
}

export function binaryFlag(
  value: unknown,
  fallback: BinaryFlag = "2",
): BinaryFlag {
  return String(value ?? fallback) === "1" ? "1" : "2";
}

export function dateInputValue(value: unknown) {
  const text = String(value ?? "");
  if (!text.includes("T")) return text;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text.slice(0, 10);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function timeInputValue(value: unknown) {
  const text = String(value ?? "");
  return text ? text.slice(0, 5) : "";
}

export function productImageStatus(row: { [key: string]: unknown }) {
  if (
    rawProductImage(row).startsWith("#") ||
    String(row.prod_image ?? "").startsWith("#")
  ) {
    return "2";
  }
  const status = String(row.prod_status_imge ?? "");
  if (status === "1" || status === "2") return status as BinaryFlag;
  return "1";
}

export function productColorValue(
  row: { [key: string]: unknown } | null | undefined,
) {
  const image = String(row?.prod_image ?? "");
  const raw = rawProductImage(row);
  if (image.startsWith("#")) return image;
  return raw.startsWith("#") ? raw : "";
}

export function firstText(
  row: { [key: string]: unknown } | null | undefined,
  keys: string[],
) {
  for (const key of keys) {
    const value = String(row?.[key] ?? "").trim();
    if (value) return value;
  }
  return "";
}

export function normalizedText(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

export function textValues(
  row: { [key: string]: unknown } | null | undefined,
  keys: string[],
) {
  return keys.map((key) => normalizedText(row?.[key])).filter(Boolean);
}

export function findOptionByText<T extends { [key: string]: unknown }>(
  rows: T[],
  selected: { [key: string]: unknown } | null | undefined,
  keys: string[],
  rowId: (row: { [key: string]: unknown } | null | undefined) => string,
) {
  const selectedValues = new Set(textValues(selected, keys));
  if (!selectedValues.size) return "";

  const match = rows.find((row) =>
    textValues(row, keys).some((value) => selectedValues.has(value)),
  );
  return rowId(match);
}

export function productCategoryUuid(
  row: { [key: string]: unknown } | null | undefined,
) {
  return firstText(row, [
    "cate_uuid_fk",
    "category_uuid_fk",
    "cate_uuid",
    "category_uuid",
  ]);
}

export function productUnitUuid(
  row: { [key: string]: unknown } | null | undefined,
) {
  return firstText(row, [
    "unite_uuid_fk",
    "unit_uuid_fk",
    "unite_uuid",
    "unit_uuid",
  ]);
}

export function productCategoryName(
  row: { [key: string]: unknown } | null | undefined,
) {
  return firstText(row, CATEGORY_NAME_KEYS);
}

export function productUnitName(
  row: { [key: string]: unknown } | null | undefined,
) {
  return firstText(row, UNIT_NAME_KEYS);
}

export function sizeName(
  row: { [key: string]: unknown } | null | undefined,
) {
  return firstText(row, SIZE_NAME_KEYS);
}

export function productToppingName(
  row: { [key: string]: unknown } | null | undefined,
) {
  return firstText(row, TOPPING_NAME_KEYS);
}

export function categoryUuid(
  row: { [key: string]: unknown } | null | undefined,
) {
  return firstText(row, [
    "cate_uuid",
    "cate_uuid_fk",
    "category_uuid",
    "category_uuid_fk",
  ]);
}

export function unitUuid(
  row: { [key: string]: unknown } | null | undefined,
) {
  return firstText(row, [
    "unite_uuid",
    "unite_uuid_fk",
    "unit_uuid",
    "unit_uuid_fk",
  ]);
}

export function toppingUuid(
  row: { [key: string]: unknown } | null | undefined,
) {
  return firstText(row, [
    "topping_uuid",
    "topping_uuid_fk",
    "prod_topping_uuid",
  ]);
}

export function productToppingUuid(
  row: { [key: string]: unknown } | null | undefined,
  rows: Topping[] = [],
) {
  return (
    firstText(row, ["topping_uuid_fk", "topping_uuid"]) ||
    findOptionByText(rows, row, TOPPING_NAME_KEYS, toppingUuid) ||
    firstText(row, ["prod_topping_uuid"])
  );
}

export function findToppingUuidByName(
  rows: Topping[],
  nameLa: string,
  nameEng: string,
) {
  const names = new Set(
    [normalizedText(nameLa), normalizedText(nameEng)].filter(Boolean),
  );
  if (!names.size) return "";
  const match = rows.find((row) =>
    textValues(row, TOPPING_NAME_KEYS).some((value) => names.has(value)),
  );
  return toppingUuid(match);
}

export function findSizeUuidByName(
  rows: Array<{ [key: string]: unknown }>,
  nameLa: string,
  nameEng: string,
) {
  const names = new Set(
    [normalizedText(nameLa), normalizedText(nameEng)].filter(Boolean),
  );
  if (!names.size) return "";
  const match = rows.find((row) =>
    textValues(row, SIZE_NAME_KEYS).some((value) => names.has(value)),
  );
  return sizeUuid(match);
}

export function filterSizeOptionsByText<T extends { [key: string]: unknown }>(
  rows: T[],
  search: string,
) {
  const query = normalizedText(search);
  if (!query) return rows;
  return rows.filter((row) =>
    textValues(row, SIZE_NAME_KEYS).some((value) => value.includes(query)),
  );
}

export function sizeUuid(
  row: { [key: string]: unknown } | null | undefined,
) {
  return firstText(row, ["size_uuid", "size_uuid_fk"]);
}

export function detailSizeUuid(
  row: { [key: string]: unknown } | null | undefined,
) {
  return firstText(row, ["size_uuid_fk", "size_uuid"]);
}

export function uuidText(value: unknown) {
  const text = String(value ?? "").trim();
  return UUID_PATTERN.test(text) ? text : "";
}

export function productDetailUuid(
  row: { [key: string]: unknown } | null | undefined,
) {
  return (
    firstText(row, [
      "pro_detail_uuid",
      "prod_detail_uuid",
      "product_detail_uuid",
      "detail_uuid",
    ]) || uuidText(row?.pro_detail_id)
  );
}

export function includeSelectedOption<T extends { [key: string]: unknown }>(
  rows: T[],
  selected: { [key: string]: unknown } | null | undefined,
  selectedId: string,
  rowId: (row: { [key: string]: unknown } | null | undefined) => string,
) {
  const validRows = rows.filter((row) => rowId(row));
  if (!selectedId || validRows.some((row) => rowId(row) === selectedId)) {
    return validRows;
  }
  return selected ? [...validRows, selected as T] : validRows;
}

export interface ProductFormSizeOptionsInput {
  statusSortFk: StatusSortFk;
  sizesByStatus: SizeSelectOption[];
  sizesByStatusStatus: number | null;
  sizes: SizeSelectOption[];
  details: DetailRow[];
  editingDetails?: Product["details"];
}

export interface ProductFormDefaults {
  cateUuidFk: string;
  uniteUuidFk: string;
  toppingPrices: Record<string, string>;
}

export interface ProductFormDefaultsStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

function objectRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function productFormDefaultsStorageKey(storeUuid: string) {
  return `${PRODUCT_FORM_DEFAULTS_STORAGE_PREFIX}:${storeUuid.trim()}`;
}

export function normalizeProductFormDefaults(value: unknown): ProductFormDefaults {
  const raw = objectRecord(value);
  const toppingPrices = objectRecord(raw.toppingPrices);

  return {
    cateUuidFk: String(raw.cateUuidFk ?? "").trim(),
    uniteUuidFk: String(raw.uniteUuidFk ?? "").trim(),
    toppingPrices: Object.fromEntries(
      Object.entries(toppingPrices)
        .map(([uuid, price]) => [
          uuid.trim(),
          String(price ?? "").trim() || "0",
        ])
        .filter(([uuid]) => uuid),
    ),
  };
}

export function parseProductFormDefaults(value: string | null | undefined) {
  if (!value) return EMPTY_PRODUCT_FORM_DEFAULTS;

  try {
    return normalizeProductFormDefaults(JSON.parse(value));
  } catch {
    return EMPTY_PRODUCT_FORM_DEFAULTS;
  }
}

export function readProductFormDefaults(
  storage: ProductFormDefaultsStorage,
  storeUuid: string,
) {
  const key = productFormDefaultsStorageKey(storeUuid);
  try {
    return parseProductFormDefaults(storage.getItem(key));
  } catch {
    return EMPTY_PRODUCT_FORM_DEFAULTS;
  }
}

export function writeProductFormDefaults(
  storage: ProductFormDefaultsStorage,
  storeUuid: string,
  defaults: ProductFormDefaults,
) {
  const key = productFormDefaultsStorageKey(storeUuid);
  try {
    storage.setItem(key, JSON.stringify(normalizeProductFormDefaults(defaults)));
  } catch {
    // Ignore restricted storage failures; the form should still save normally.
  }
}

export function productFormDefaultsForOptions(
  defaults: ProductFormDefaults,
  categoryOptions: Category[],
  unitOptions: Unit[],
) {
  return {
    ...defaults,
    cateUuidFk: categoryOptions.some(
      (category) => categoryUuid(category) === defaults.cateUuidFk,
    )
      ? defaults.cateUuidFk
      : "",
    uniteUuidFk: unitOptions.some((unit) => unitUuid(unit) === defaults.uniteUuidFk)
      ? defaults.uniteUuidFk
      : "",
  };
}

export function productFormToppingDefaultPrice(
  defaults: Pick<ProductFormDefaults, "toppingPrices">,
  toppingUuidValue: string,
  fallback = "0",
) {
  const price = defaults.toppingPrices[toppingUuidValue]?.trim();
  return price || fallback;
}

export function mergeProductFormToppingPrices(
  current: Record<string, string>,
  selectedToppings: ToppingSelection[],
) {
  const next = { ...current };
  selectedToppings.forEach((row) => {
    const uuid = row.topping_uuid_fk.trim();
    if (!uuid) return;
    next[uuid] = row.topping_price.trim() || "0";
  });
  return next;
}

export function productFormSizeOptions({
  statusSortFk,
  sizesByStatus,
  sizesByStatusStatus,
  sizes,
  details,
  editingDetails,
}: ProductFormSizeOptionsInput): SizeSelectOption[] {
  const currentStatus = Number(statusSortFk);
  const statusRows =
    sizesByStatusStatus === currentStatus ? sizesByStatus : [];
  const baseSizes =
    statusSortFk === "2" ? statusRows : statusRows.length ? statusRows : sizes;
  const rows = baseSizes.filter((size) => sizeUuid(size));
  const seen = new Set(rows.map((size) => sizeUuid(size)));
  const missing = details
    .map((detail) => detail.size_uuid_fk)
    .filter((uuid) => uuid && !seen.has(uuid))
    .map((uuid) =>
      editingDetails?.find((detail) => detailSizeUuid(detail) === uuid),
    )
    .filter(
      (detail): detail is NonNullable<Product["details"]>[number] =>
        Boolean(detail),
    );

  return missing.length ? [...rows, ...missing] : rows;
}

export function hasEditableProductData(
  row: { [key: string]: unknown } | null | undefined,
) {
  const details = Array.isArray(row?.details) ? row.details : [];
  return Boolean(
    row &&
      productCategoryUuid(row) &&
      productUnitUuid(row) &&
      details.length &&
      details.every((detail) =>
        detailSizeUuid(detail as { [key: string]: unknown }),
      ),
  );
}

export function productHasToppings(row: Product | null | undefined) {
  if (binaryFlag(row?.prod_topping_status, TOPPING_NONE) === TOPPING_HAS) {
    return true;
  }
  const toppings = Array.isArray(row?.toppings) ? row.toppings : [];
  return toppings.some((topping) => Boolean(productToppingUuid(topping)));
}

export function productHydrationKey(row: Product | null | undefined) {
  if (!row) return "";
  const details = Array.isArray(row.details) ? row.details : [];
  const toppings = Array.isArray(row.toppings) ? row.toppings : [];
  const detailKey = details
    .map((detail) =>
      [
        productDetailUuid(detail),
        detailSizeUuid(detail),
        detail.pro_detail_bprice,
        detail.pro_detail_sprice,
        detail.pro_detail_qty_stock,
        detail.pro_detail_stock,
        detail.pro_detail_enabled,
        detail.pro_detail_status,
        detail.pro_detail_sDate,
        detail.pro_detail_eDate,
        detail.pro_detail_sTime,
        detail.pro_detail_eTime,
      ].join(":"),
    )
    .join("|");
  const toppingKey = toppings
    .map((topping) =>
      [
        productToppingUuid(topping),
        topping.topping_price,
        topping.topping_status,
      ].join(":"),
    )
    .join("|");

  return [
    row.prod_uuid,
    row.prod_code,
    row.prod_name_la,
    row.prod_name_eng,
    productCategoryUuid(row),
    productUnitUuid(row),
    row.prod_order_point,
    row.prod_notification,
    row.status_sort_fk,
    row.prod_set_price,
    row.prod_status_imge,
    row.prod_topping_status,
    rawProductImage(row),
    detailKey,
    toppingKey,
  ].join("::");
}

export function emptyDetail(statusSortFk: StatusSortFk = "1"): DetailRow {
  return {
    id: rid(),
    pro_detail_uuid: "",
    size_uuid_fk: "",
    pro_detail_bprice: "0",
    pro_detail_sprice: "0",
    pro_detail_qty_stock: "0",
    pro_detail_stock: "1",
    pro_detail_enabled: "1",
    pro_detail_status: statusSortFk === "3" ? "1" : "2",
    ...EMPTY_PROMOTION_FIELDS,
  };
}

export function detailFromProduct(
  detail: NonNullable<Product["details"]>[number],
  statusSortFk: StatusSortFk,
): DetailRow {
  return {
    id: rid(),
    pro_detail_uuid: productDetailUuid(detail),
    size_uuid_fk: detailSizeUuid(detail),
    pro_detail_bprice: String(detail.pro_detail_bprice ?? 0),
    pro_detail_sprice: String(detail.pro_detail_sprice ?? 0),
    pro_detail_qty_stock: String(
      detail.pro_detail_qty_stock ?? detail.qty_stock ?? 0,
    ),
    pro_detail_stock: binaryFlag(detail.pro_detail_stock, "1"),
    pro_detail_enabled: binaryFlag(detail.pro_detail_enabled, "1"),
    pro_detail_status: binaryFlag(
      detail.pro_detail_status,
      statusSortFk === "3" ? "1" : "2",
    ),
    pro_detail_cus_qtyBuy: String(detail.pro_detail_cus_qtyBuy ?? 0),
    pro_detail_cus_qtyFree: String(detail.pro_detail_cus_qtyFree ?? 0),
    pro_detail_sDate: dateInputValue(detail.pro_detail_sDate),
    pro_detail_eDate: dateInputValue(detail.pro_detail_eDate),
    pro_detail_sTime: timeInputValue(detail.pro_detail_sTime),
    pro_detail_eTime: timeInputValue(detail.pro_detail_eTime),
  };
}

export function normalizeDetailsForStatus(
  rows: DetailRow[],
  targetStatus: StatusSortFk,
  sourceStatus: StatusSortFk,
) {
  const sourceRows = rows.length ? rows : [emptyDetail(targetStatus)];

  return sourceRows.map((row) => {
    const base = {
      ...row,
      size_uuid_fk:
        targetStatus === "2" && sourceStatus !== "2" ? "" : row.size_uuid_fk,
      pro_detail_stock: row.pro_detail_stock || "1",
      pro_detail_enabled: row.pro_detail_enabled || "1",
      pro_detail_bprice: row.pro_detail_bprice || "0",
      pro_detail_sprice: row.pro_detail_sprice || "0",
      pro_detail_qty_stock: row.pro_detail_qty_stock || "0",
    };

    if (targetStatus !== "3") {
      return {
        ...base,
        pro_detail_status: "2" as BinaryFlag,
        ...EMPTY_PROMOTION_FIELDS,
      };
    }

    const keepPromotion = sourceStatus === "3";
    const promotionStatus: BinaryFlag =
      keepPromotion && base.pro_detail_status === "2" ? "2" : "1";

    return {
      ...base,
      pro_detail_status: promotionStatus,
      pro_detail_cus_qtyBuy: keepPromotion
        ? base.pro_detail_cus_qtyBuy || "0"
        : "0",
      pro_detail_cus_qtyFree: keepPromotion
        ? base.pro_detail_cus_qtyFree || "0"
        : "0",
      pro_detail_sDate: keepPromotion ? base.pro_detail_sDate : "",
      pro_detail_eDate: keepPromotion ? base.pro_detail_eDate : "",
      pro_detail_sTime:
        keepPromotion && promotionStatus === "2" ? base.pro_detail_sTime : "",
      pro_detail_eTime:
        keepPromotion && promotionStatus === "2" ? base.pro_detail_eTime : "",
    };
  });
}

export function entityLabel(
  item: { [key: string]: unknown },
  primaryKey: string,
  fallbackKey: string,
  language: string,
  fallback = "",
) {
  const english = language.startsWith("en");
  const primary = english ? item[primaryKey] : item[fallbackKey];
  const fallbackName = english ? item[fallbackKey] : item[primaryKey];
  return String(primary || fallbackName || fallback || "-");
}

export function choiceCardClass(active: boolean) {
  return cn(
    "flex min-h-20 w-full items-start gap-3 rounded-lg border p-3 text-left transition",
    active
      ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary/20"
      : "border-border bg-card hover:border-primary/40 hover:bg-muted/40",
  );
}

export function choiceMarkClass(active: boolean) {
  return cn(
    "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border text-[10px]",
    active
      ? "border-primary bg-primary text-primary-foreground"
      : "border-border bg-background text-transparent",
  );
}

export function buildDetailPayload(
  row: DetailRow,
  statusSortFk: StatusSortFk,
) {
  const detailUuid = row.pro_detail_uuid.trim();
  const base = {
    ...(detailUuid ? { pro_detail_uuid: detailUuid } : {}),
    size_uuid_fk: row.size_uuid_fk,
    pro_detail_bprice: numberFromFormatted(row.pro_detail_bprice),
    pro_detail_qty_stock: numberFromFormatted(row.pro_detail_qty_stock),
    pro_detail_stock: Number(row.pro_detail_stock),
    pro_detail_enabled: Number(row.pro_detail_enabled),
  };

  if (statusSortFk === "1") {
    return {
      ...base,
      pro_detail_sprice: numberFromFormatted(row.pro_detail_sprice),
    };
  }

  if (statusSortFk === "2") {
    return {
      ...base,
      pro_detail_status: 2,
    };
  }

  return {
    ...base,
    pro_detail_sprice: numberFromFormatted(row.pro_detail_sprice),
    pro_detail_cus_qtyBuy: numberFromFormatted(row.pro_detail_cus_qtyBuy),
    pro_detail_cus_qtyFree: numberFromFormatted(row.pro_detail_cus_qtyFree),
    pro_detail_status: Number(row.pro_detail_status),
    pro_detail_sDate: row.pro_detail_sDate,
    pro_detail_eDate: row.pro_detail_eDate,
    pro_detail_sTime: row.pro_detail_status === "2" ? row.pro_detail_sTime : null,
    pro_detail_eTime: row.pro_detail_status === "2" ? row.pro_detail_eTime : null,
  };
}

export function detailStockSummary(
  rows: Pick<DetailRow, "pro_detail_stock">[],
): DetailStockSummary {
  const stockModes = rows.map((row) => binaryFlag(row.pro_detail_stock, "1"));
  if (!stockModes.length || stockModes.every((value) => value === "1")) {
    return "deduct";
  }
  if (stockModes.every((value) => value === "2")) return "noDeduct";
  return "mixed";
}

export function nextBulkStockMode(
  summary: DetailStockSummary,
): BinaryFlag {
  return summary === "deduct" ? "2" : "1";
}

export function requiredFieldErrorKeys(state: RequiredProductFormState) {
  return [
    !state.prodNameLa.trim() ? "fields.prod_name" : null,
    !state.cateUuidFk ? "nav.category" : null,
    !state.uniteUuidFk ? "nav.unit" : null,
    !state.details.length ? "product.sections.details" : null,
    state.details.some((row) => !row.size_uuid_fk)
      ? state.statusSortFk === "2"
        ? "pos.product"
        : "fields.size"
      : null,
    state.details.some((row) => row.pro_detail_bprice.trim() === "")
      ? "fields.bprice"
      : null,
    state.statusSortFk !== "2" &&
    state.details.some((row) => row.pro_detail_sprice.trim() === "")
      ? "fields.sprice"
      : null,
    state.statusSortFk === "3" &&
    state.details.some((row) => !row.pro_detail_sDate || !row.pro_detail_eDate)
      ? ["product.startDate", "product.endDate"]
      : null,
    state.statusSortFk === "3" &&
    state.details.some(
      (row) =>
        row.pro_detail_status === "2" &&
        (!row.pro_detail_sTime || !row.pro_detail_eTime),
    )
      ? ["product.startTime", "product.endTime"]
      : null,
    state.prodToppingStatus === TOPPING_HAS && !state.selectedToppings.length
      ? "product.sections.toppings"
      : null,
  ].filter(Boolean) as Array<string | string[]>;
}

export function requiredFieldErrors(
  state: RequiredProductFormState,
  translate: (key: string) => string,
) {
  return requiredFieldErrorKeys(state).map((item) =>
    Array.isArray(item) ? item.map(translate).join(", ") : translate(item),
  );
}

export function buildSaveProductPayload(
  state: ProductSavePayloadState,
): SaveProductInput {
  return {
    cate_uuid_fk: state.cateUuidFk,
    unite_uuid_fk: state.uniteUuidFk,
    prod_code: state.prodCode,
    prod_name_la: state.prodNameLa,
    prod_name_eng: state.prodNameEng.trim() || state.prodNameLa,
    prod_order_point: Number(state.prodOrderPoint),
    prod_notification: Number(state.prodNotification),
    status_sort_fk: Number(state.statusSortFk),
    prod_set_price:
      state.statusSortFk === "2" ? numberFromFormatted(state.prodSetPrice) : 0,
    prod_status_imge: Number(state.prodStatusImge),
    prod_image: state.prodImage,
    branch_uuid_fk: state.branchUuid,
    details: state.details.map((row) =>
      buildDetailPayload(row, state.statusSortFk),
    ),
    prod_topping_status: Number(state.prodToppingStatus),
    toppings:
      state.prodToppingStatus === TOPPING_HAS
        ? state.selectedToppings.map((row) => ({
            topping_uuid_fk: row.topping_uuid_fk,
            topping_price: numberFromFormatted(row.topping_price),
          }))
        : [],
  };
}

export function selectedToppingBadges(
  selectedToppings: ToppingSelection[],
  toppingOptions: Topping[],
  language: string,
) {
  return selectedToppings.map((selected) => {
    const topping = toppingOptions.find(
      (row) => toppingUuid(row) === selected.topping_uuid_fk,
    );
    const label = topping
      ? entityLabel(
          topping,
          "topping_name_eng",
          "topping_name_la",
          language,
          productToppingName(topping) || selected.topping_uuid_fk,
        )
      : selected.topping_uuid_fk;

    return {
      uuid: selected.topping_uuid_fk,
      label,
      price: selected.topping_price || "0",
    };
  });
}

export function productToppingsFromRows(
  rows: ProductTopping[] | undefined,
  toppings: Topping[],
) {
  if (!Array.isArray(rows)) return [];

  return rows
    .map((row) => ({
      topping_uuid_fk: productToppingUuid(row, toppings),
      topping_price: String(row.topping_price ?? 0),
    }))
    .filter((row) => row.topping_uuid_fk);
}
