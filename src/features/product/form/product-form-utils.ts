import { cn } from "@/lib/utils";
import { numberFromFormatted } from "@/lib/number-format";
import type { Category } from "@/services/category";
import type { Color } from "@/services/color";
import type { Group } from "@/services/group";
import type {
  Product,
  ProductTaste,
  ProductTopping,
  SaveProductInput,
  SaveProductSetChoiceGroupInput,
} from "@/services/product";
import type { Size } from "@/services/size";
import type { Taste } from "@/services/taste";
import type { Topping } from "@/services/topping";
import type { Unit } from "@/services/unit";
import type {
  BinaryFlag,
  DetailRow,
  SetDetailOptionGroupRow,
  DetailStockSummary,
  ProductSavePayloadState,
  RequiredProductFormState,
  SetChoiceGroupMode,
  SizeSelectOption,
  StatusSortFk,
  TasteSelection,
  ToppingSelection,
} from "./product-form-types";

export const ORDER_POINT_OPTIONS = Array.from(
  { length: 30 },
  (_, index) => index + 1,
);
export const TOPPING_MAX_SELECT_OPTIONS = Array.from(
  { length: 20 },
  (_, index) => index + 1,
);
export const TOPPING_MAX_SELECT_UNLIMITED = "0";
export const TASTE_MAX_SELECT_OPTIONS = ["0", "1", "2"] as const;
export const SET_CHOICE_GROUP_MODE_OPTIONS: SetChoiceGroupMode[] = ["none", "one", "many"];
export const DEFAULT_COLOR = "#10b981";
export const CUSTOM_COLOR_VALUE = "__custom__";
export const TOPPING_NONE = "1";
export const TOPPING_HAS = "2";
export const DEFAULT_DETAIL_STOCK_MODE: BinaryFlag = "2";
export const EMPTY_CATEGORIES: Category[] = [];
export const EMPTY_COLORS: Color[] = [];
export const EMPTY_GROUPS: Group[] = [];
export const EMPTY_SIZES: Size[] = [];
export const EMPTY_TASTES: Taste[] = [];
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
export const TASTE_NAME_KEYS = [
  "taste_name",
  "taste_name_la",
  "taste_name_eng",
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

export function productTasteName(
  row: { [key: string]: unknown } | null | undefined,
) {
  return firstText(row, TASTE_NAME_KEYS);
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

export function tasteUuid(
  row: { [key: string]: unknown } | null | undefined,
) {
  return firstText(row, ["taste_uuid", "taste_uuid_fk"]);
}

export function productTasteUuid(
  row: { [key: string]: unknown } | null | undefined,
  rows: Taste[] = [],
) {
  return (
    firstText(row, ["taste_uuid", "taste_uuid_fk"]) ||
    findOptionByText(rows, row, TASTE_NAME_KEYS, tasteUuid)
  );
}

export function findTasteUuidByName(
  rows: Taste[],
  nameLa: string,
  nameEng: string,
) {
  const names = new Set(
    [normalizedText(nameLa), normalizedText(nameEng)].filter(Boolean),
  );
  if (!names.size) return "";
  const match = rows.find((row) =>
    textValues(row, TASTE_NAME_KEYS).some((value) => names.has(value)),
  );
  return tasteUuid(match);
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

export function productHasTastes(row: Product | null | undefined) {
  return Number(row?.prod_taste_max_select ?? 0) > 0;
}

export function nextProductHydrationPlan({
  editingProductUuid,
  hasEditingProduct,
  hasFullEditData,
  hydratedProductUuid,
  routeProductUuid,
}: {
  editingProductUuid: string;
  hasEditingProduct: boolean;
  hasFullEditData: boolean;
  hydratedProductUuid: string;
  routeProductUuid: string;
}) {
  const routeHydratedProductUuid =
    hydratedProductUuid === routeProductUuid ? hydratedProductUuid : "";

  if (!hasEditingProduct) {
    return {
      hydratedProductUuid: routeHydratedProductUuid,
      shouldHydrate: false,
    };
  }

  if (
    hasFullEditData &&
    routeHydratedProductUuid === editingProductUuid
  ) {
    return {
      hydratedProductUuid: routeHydratedProductUuid,
      shouldHydrate: false,
    };
  }

  return {
    hydratedProductUuid: hasFullEditData
      ? editingProductUuid
      : routeHydratedProductUuid,
    shouldHydrate: true,
  };
}

export function productHydrationKey(row: Product | null | undefined) {
  if (!row) return "";
  const details = Array.isArray(row.details) ? row.details : [];
  const toppings = Array.isArray(row.toppings) ? row.toppings : [];
  const tastes = Array.isArray(row.tastes) ? row.tastes : [];
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
        detail.set_taste_max_select,
        (detail.set_tastes ?? [])
          .map((taste) => String(taste.taste_uuid_fk ?? taste.taste_uuid ?? ""))
          .join(","),
        (detail.set_option_groups ?? [])
          .map((group) => [
            group.set_detail_option_group_uuid,
            group.size_uuid_fk,
            group.group_name_la,
            group.group_name_eng,
            group.max_select,
            (group.taste_uuid_fks ?? []).join(","),
          ].join("/"))
          .join(";"),
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
  const tasteKey = tastes
    .map((taste) =>
      [productTasteUuid(taste), taste.taste_status, taste.taste_sort].join(":"),
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
    row.prod_taste_max_select,
    rawProductImage(row),
    detailKey,
    toppingKey,
    tasteKey,
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
    pro_detail_stock: DEFAULT_DETAIL_STOCK_MODE,
    pro_detail_setqty_cut_stock: "1",
    pro_detail_enabled: "1",
    pro_detail_status: statusSortFk === "3" ? "1" : "2",
    set_choice_group_mode: "none",
    set_choice_group_names: [],
    set_taste_max_select: "0",
    set_taste_uuid_fks: [],
    set_option_groups: [],
    ...EMPTY_PROMOTION_FIELDS,
  };
}

export function emptySetDetailOptionGroup(): SetDetailOptionGroupRow {
  return {
    id: rid(),
    size_uuid_fk: "",
    group_name_la: "",
    group_name_eng: "",
    max_select: "1",
    taste_uuid_fks: [],
  };
}

// กลุ่มทั้งหมดที่แถวนี้เคยผูกไว้ (จาก uuid ที่ backend ส่งกลับ) เพื่อดึงชื่อ/โหมดของมันมาแสดง
// ในฟอร์ม — แถวหนึ่งเป็นสมาชิกได้หลายกลุ่มพร้อมกัน
function choiceGroupsFor(
  detail: NonNullable<Product["details"]>[number],
  groups: NonNullable<Product["set_choice_groups"]>,
) {
  const uuids = new Set(detail.set_choice_group_uuid_fks ?? []);
  if (!uuids.size) return [];
  return groups.filter(
    (group) => !!group.set_choice_group_uuid && uuids.has(group.set_choice_group_uuid),
  );
}

export function detailFromProduct(
  detail: NonNullable<Product["details"]>[number],
  statusSortFk: StatusSortFk,
  choiceGroups: NonNullable<Product["set_choice_groups"]> = [],
): DetailRow {
  const matchedGroups = choiceGroupsFor(detail, choiceGroups);
  const savedOptionGroups = detail.set_option_groups ?? [];
  const legacyTasteUuids = (detail.set_tastes ?? [])
    .map((taste) => String(taste.taste_uuid_fk ?? taste.taste_uuid ?? "").trim())
    .filter(Boolean);
  const optionGroups = savedOptionGroups.length
    ? savedOptionGroups.map((group) => ({
        id: rid(),
        set_detail_option_group_uuid: String(
          group.set_detail_option_group_uuid ?? "",
        ) || undefined,
        size_uuid_fk: String(group.size_uuid_fk ?? ""),
        group_name_la: String(group.group_name_la ?? group.group_name ?? ""),
        group_name_eng: String(group.group_name_eng ?? ""),
        max_select: String(group.max_select ?? 1),
        taste_uuid_fks: (group.taste_uuid_fks ?? group.sauce_uuid_fks ?? group.tastes?.map((taste) =>
          String(taste.taste_uuid_fk ?? taste.taste_uuid ?? "")) ?? []).filter(Boolean),
      }))
    : Number(detail.set_taste_max_select ?? 0) > 0
      ? [{
          ...emptySetDetailOptionGroup(),
          group_name_la: "ລົດຊາດ / ນ້ຳຈິ້ມ",
          group_name_eng: "Taste / sauce",
          max_select: String(detail.set_taste_max_select ?? 1),
          taste_uuid_fks: legacyTasteUuids,
        }]
      : [];
  return {
    id: rid(),
    pro_detail_uuid: productDetailUuid(detail),
    size_uuid_fk: detailSizeUuid(detail),
    pro_detail_bprice: String(detail.pro_detail_bprice ?? 0),
    pro_detail_sprice: String(detail.pro_detail_sprice ?? 0),
    pro_detail_qty_stock: String(
      detail.pro_detail_qty_stock ?? detail.qty_stock ?? 0,
    ),
    pro_detail_stock: binaryFlag(detail.pro_detail_stock, DEFAULT_DETAIL_STOCK_MODE),
    pro_detail_setqty_cut_stock: String(detail.pro_detail_setqty_cut_stock ?? 1),
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
    set_choice_group_mode: !matchedGroups.length
      ? "none"
      : matchedGroups.some((group) => Number(group.max_select ?? 1) > 1)
        ? "many"
        : "one",
    set_choice_group_names: matchedGroups.map((group) =>
      String(group.group_name_la ?? group.group_name ?? ""),
    ),
    // แปลงข้อมูลรุ่นเก่าเป็นแถวลูก แล้วบันทึกกลับด้วยโครงสร้างใหม่เท่านั้น
    set_taste_max_select: "0",
    set_taste_uuid_fks: [],
    set_option_groups: optionGroups,
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
      pro_detail_stock: row.pro_detail_stock || DEFAULT_DETAIL_STOCK_MODE,
      pro_detail_setqty_cut_stock: row.pro_detail_setqty_cut_stock || "1",
      pro_detail_enabled: row.pro_detail_enabled || "1",
      pro_detail_bprice: row.pro_detail_bprice || "0",
      pro_detail_sprice: row.pro_detail_sprice || "0",
      pro_detail_qty_stock: row.pro_detail_qty_stock || "0",
      // กลุ่มตัวเลือกมีความหมายเฉพาะสินค้าแบบ Set — สลับออกจาก Set แล้วต้องล้างทิ้ง
      set_choice_group_mode: targetStatus === "2" ? row.set_choice_group_mode : "none",
      set_choice_group_names: targetStatus === "2" ? row.set_choice_group_names : [],
      set_taste_max_select: targetStatus === "2" ? row.set_taste_max_select : "0",
      set_taste_uuid_fks: targetStatus === "2" ? row.set_taste_uuid_fks : [],
      set_option_groups: targetStatus === "2" ? row.set_option_groups : [],
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
    // min-h-16 = p-3 บน/ล่าง (24px) + สองบรรทัด (40px) พอดี — เดิม min-h-20 เหลือที่ว่างเปล่า 16px ทุกใบ
    "flex min-h-16 w-full items-start justify-start gap-3 rounded-lg border p-3 text-left transition",
    active
      ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary/20"
      : "border-border bg-card hover:border-primary/40 hover:bg-muted/40",
  );
}

export function choiceMarkClass(active: boolean) {
  return cn(
    "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border text-2xs",
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
      pro_detail_setqty_cut_stock: numberFromFormatted(row.pro_detail_setqty_cut_stock),
      pro_detail_status: 2,
      set_choice_group_client_refs: choiceGroupNamesOf(row),
      set_taste_max_select: Number(row.set_taste_max_select) || 0,
      set_taste_uuid_fks:
        Number(row.set_taste_max_select) > 0 ? row.set_taste_uuid_fks : [],
      set_option_groups: row.set_option_groups.map((group, index) => ({
        client_ref: group.id,
        size_uuid_fk: group.size_uuid_fk,
        group_name_la: group.group_name_la.trim(),
        group_name_eng: group.group_name_eng.trim() || group.group_name_la.trim(),
        max_select: Number(group.max_select) || 1,
        taste_uuid_fks: group.taste_uuid_fks,
        group_sort: index + 1,
      })),
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

// ชื่อกลุ่มภายในมีความหมายเฉพาะตอน mode ไม่ใช่ "none" และถูกสร้างจากชื่อรายการ SET
// ของแถวแม่ ฟังก์ชันนี้ยังตัดค่าซ้ำ/ว่างเพื่อรองรับข้อมูลเดิมที่หนึ่งแถวอาจอยู่หลายกลุ่ม
export function choiceGroupNamesOf(
  row: Pick<DetailRow, "set_choice_group_mode" | "set_choice_group_names">,
): string[] {
  if (row.set_choice_group_mode === "none") return [];
  return Array.from(new Set(row.set_choice_group_names.map((name) => name.trim()).filter(Boolean)));
}

// กลุ่มไม่มีช่องกรอกชื่ออีกต่อไป — แถวใหม่ใช้ชื่อรายการ SET เป็น client_ref โดยอัตโนมัติ
// ส่วนข้อมูลเดิมที่มีชื่อเดียวกันยังถูกจับเป็นกลุ่มเดียวกันตอนบันทึก
// "เลือกได้หลายรายการ" ไม่มีเลขให้กรอกเอง — max_select ถูกตั้งเท่าจำนวนสมาชิกจริงของกลุ่มนั้น
// (เท่ากับ "เลือกได้ทั้งหมด" ไปในตัว) ส่วน "เลือกได้ 1" ตั้งค่าคงที่เป็น 1 เสมอ ถ้าแถวในกลุ่ม
// เดียวกันขัดกัน (บางแถวติ๊ก "เลือกได้ 1" บางแถวติ๊ก "หลายรายการ") ให้ "หลายรายการ" ชนะ
export function buildChoiceGroupsPayload(
  details: DetailRow[],
): SaveProductSetChoiceGroupInput[] {
  const membersByName = new Map<string, { rows: DetailRow[]; many: boolean }>();

  for (const row of details) {
    for (const name of choiceGroupNamesOf(row)) {
      const entry = membersByName.get(name) ?? { rows: [], many: false };
      entry.rows.push(row);
      if (row.set_choice_group_mode === "many") entry.many = true;
      membersByName.set(name, entry);
    }
  }

  return Array.from(membersByName.entries()).map(([name, entry], index) => ({
    client_ref: name,
    group_name_la: name,
    max_select: entry.many ? entry.rows.length : 1,
    group_sort: index + 1,
  }));
}

export function detailStockSummary(
  rows: Pick<DetailRow, "pro_detail_stock">[],
): DetailStockSummary {
  const stockModes = rows.map((row) => binaryFlag(row.pro_detail_stock, DEFAULT_DETAIL_STOCK_MODE));
  if (!stockModes.length) return "noDeduct";
  if (stockModes.every((value) => value === "1")) {
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
  const availableTasteUuids = state.availableTasteUuids
    ? new Set(state.availableTasteUuids)
    : null;
  const setTasteUuids = state.details.flatMap((row) => [
    ...row.set_taste_uuid_fks,
    ...row.set_option_groups.flatMap((group) => group.taste_uuid_fks),
  ]);
  const selectedProductTasteUuids = new Set(
    state.statusSortFk === "2"
      ? setTasteUuids.filter((uuid) => !availableTasteUuids || availableTasteUuids.has(uuid))
      : (state.selectedTastes ?? []).map((taste) => taste.taste_uuid),
  );
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
    state.statusSortFk === "2" &&
    state.details.some(
      (row) =>
        row.pro_detail_stock === "1" &&
        Number(numberFromFormatted(row.pro_detail_setqty_cut_stock)) <= 0,
    )
      ? "product.setQtyCutStock"
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
    state.statusSortFk !== "2" &&
    Number(state.prodTasteMaxSelect ?? 0) > 0 &&
    (state.selectedTastes ?? []).length < Number(state.prodTasteMaxSelect ?? 0)
      ? "product.sections.tastes"
      : null,
    state.statusSortFk === "2" &&
    state.details.some(
      (row) => row.set_choice_group_mode !== "none" && !choiceGroupNamesOf(row).length,
    )
      ? "product.setChoiceGroupName"
      : null,
    state.statusSortFk === "2" &&
    state.details.some(
      (row) =>
        Number(row.set_taste_max_select) > 0 &&
        row.set_taste_uuid_fks.filter((uuid) =>
          selectedProductTasteUuids.has(uuid),
        ).length < Number(row.set_taste_max_select),
    )
      ? "product.setDetailTastes"
      : null,
    state.statusSortFk === "2" &&
    state.details.some((row) =>
      row.set_option_groups.some((group) => !group.size_uuid_fk),
    )
      ? "product.setChildGroupName"
      : null,
    state.statusSortFk === "2" &&
    state.details.some((row) =>
      row.set_option_groups.some(
        (group) =>
          group.taste_uuid_fks.filter((uuid) =>
            selectedProductTasteUuids.has(uuid),
          ).length < Number(group.max_select),
      ),
    )
      ? "product.setDetailTastes"
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
  const availableTasteUuids = state.availableTasteUuids
    ? new Set(state.availableTasteUuids)
    : null;
  const setTasteUuids = Array.from(new Set(
    state.details.flatMap((row) => [
      ...row.set_taste_uuid_fks,
      ...row.set_option_groups.flatMap((group) => group.taste_uuid_fks),
    ]).filter((uuid) => !availableTasteUuids || availableTasteUuids.has(uuid)),
  ));
  const payloadTastes = state.statusSortFk === "2"
    ? setTasteUuids.map((taste_uuid, index) => ({ taste_uuid, taste_sort: index + 1 }))
    : (state.selectedTastes ?? []).map((row, index) => ({
        taste_uuid: row.taste_uuid,
        taste_sort: index + 1,
      }));
  const payloadTasteMaxSelect = state.statusSortFk === "2"
    ? (payloadTastes.length ? 1 : 0)
    : Number(state.prodTasteMaxSelect ?? 0) || 0;
  const selectedProductTasteUuids = new Set(
    payloadTastes.map((taste) => taste.taste_uuid),
  );
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
    details: state.details.map((row) => {
      const detail = buildDetailPayload(row, state.statusSortFk);
      return state.statusSortFk === "2"
        ? {
            ...detail,
            set_taste_uuid_fks: row.set_taste_uuid_fks.filter(
              (uuid) => selectedProductTasteUuids.has(uuid),
            ),
            set_option_groups: row.set_option_groups.map((group, index) => ({
              client_ref: group.id,
              size_uuid_fk: group.size_uuid_fk,
              group_name_la: group.group_name_la.trim(),
              group_name_eng: group.group_name_eng.trim() || group.group_name_la.trim(),
              max_select: Number(group.max_select) || 1,
              taste_uuid_fks: group.taste_uuid_fks.filter((uuid) =>
                selectedProductTasteUuids.has(uuid),
              ),
              group_sort: index + 1,
            })),
          }
        : detail;
    }),
    prod_topping_status: Number(state.prodToppingStatus),
    toppings:
      state.prodToppingStatus === TOPPING_HAS
        ? state.selectedToppings.map((row) => ({
            topping_uuid_fk: row.topping_uuid_fk,
            topping_price: numberFromFormatted(row.topping_price),
          }))
        : [],
    prod_topping_max_select:
      state.prodToppingStatus === TOPPING_HAS
        ? Number(state.prodToppingMaxSelect) || 0
        : 0,
    prod_taste_max_select: payloadTasteMaxSelect,
    tastes:
      payloadTasteMaxSelect > 0
        ? payloadTastes
        : [],
    set_choice_groups:
      state.statusSortFk === "2" ? buildChoiceGroupsPayload(state.details) : [],
  };
}

export function selectedTasteBadges(
  selectedTastes: TasteSelection[],
  tasteOptions: Taste[],
  language: string,
) {
  return selectedTastes.map((selected) => {
    const taste = tasteOptions.find(
      (row) => tasteUuid(row) === selected.taste_uuid,
    );
    return {
      uuid: selected.taste_uuid,
      label: taste
        ? entityLabel(
            taste,
            "taste_name_eng",
            "taste_name_la",
            language,
            productTasteName(taste) || selected.taste_uuid,
          )
        : selected.taste_uuid,
    };
  });
}

export function productTastesFromRows(
  rows: ProductTaste[] | undefined,
  tastes: Taste[],
) {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row, index) => ({
      taste_uuid: productTasteUuid(row, tastes),
      taste_sort: Number(row.taste_sort) || index + 1,
    }))
    .filter((row) => row.taste_uuid)
    .sort((left, right) => left.taste_sort - right.taste_sort);
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
