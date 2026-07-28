import {
  categoryUuid,
  generateProdCode,
  sizeUuid,
  unitUuid,
} from "@/features/product/form/product-form-utils";
import { normalizeProductImportKey } from "@/lib/product-import";
import type { Category } from "@/services/category";
import type {
  Product,
  SaveProductInput,
  SizeOption,
} from "@/services/product";
import type { Size } from "@/services/size";
import type { Unit } from "@/services/unit";
import {
  planProductImportReferences,
  type ProductImportReferenceConflict,
  type ProductImportReferenceNames,
  type ProductImportReferencePlan,
  type ProductImportReferencePlanInput,
} from "@/stores/product-store/import-references";

export type ProductImportType = "normal" | "set";
export type ProductImportExecutionStatus = "pending" | "succeeded" | "failed";
export { normalizeProductImportKey } from "@/lib/product-import";

export interface ProductImportSheetRow {
  rowNumber: number;
  values: Record<string, unknown>;
}

export interface ProductImportWorkbookRows {
  Normal?: ProductImportSheetRow[];
  Set?: ProductImportSheetRow[];
}

export interface ProductImportDraftDetail {
  rowNumber: number;
  referenceName: string;
  costPrice: number;
  salePrice: number;
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
  sizeNames: string[];
  details: ProductImportDraftDetail[];
  detailCount: number;
  salePrice: number;
  validationErrors: string[];
  warnings: string[];
  payload: SaveProductInput | null;
  executionStatus: ProductImportExecutionStatus;
  executionError: string;
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
  multipleSetPrices: () => string;
  duplicateCode?: (code: string) => string;
  duplicateName?: (name: string) => string;
}

export interface ProductImportAnalysisInput {
  workbook: ProductImportWorkbookRows;
  branchUuid: string;
  existingProducts: Product[];
  generatedCodeSeed: string;
  messages?: ProductImportMessages;
}

export interface ProductImportAnalysis {
  drafts: ProductImportDraft[];
  referenceNames: ProductImportReferenceNames;
}

export interface ResolveProductImportDraftOptions {
  requireReferences?: boolean;
}

export type ProductImportDraftReferenceContext = Omit<
  ProductImportReferencePlanInput,
  keyof ProductImportReferenceNames
>;

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

interface NormalizedImportRow<H extends string> {
  productIndex: number;
  rowNumber: number;
  values: Record<H, string>;
}

const DEFAULT_IMPORT_MESSAGES: ProductImportMessages = {
  required: (field) => `${field} is required`,
  rowRequired: (row, field) => `Row ${row}: ${field} is required`,
  categoryNotFound: (name) => `Category not found: ${name}`,
  unitNotFound: (name) => `Unit not found: ${name}`,
  sizeNotFound: (row, name) => `Row ${row}: Size not found: ${name}`,
  setOptionNotFound: (row, name) => `Row ${row}: Set option not found: ${name}`,
  multipleSetPrices: () =>
    "Set has multiple Set Price values. The first price will be used.",
  duplicateCode: (code) => `Duplicate product code: ${code}`,
  duplicateName: (name) => `Duplicate product name: ${name}`,
};

function cleanText(value: unknown) {
  return String(value ?? "").replace(/\s+/gu, " ").trim();
}

function numberValue(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(cleanText(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function optionLabel(row: Record<string, unknown>, keys: string[]) {
  return keys
    .map((key) => normalizeProductImportKey(row[key]))
    .filter(Boolean);
}

function matchOption<T extends Record<string, unknown>>(
  rows: T[],
  value: string,
  keys: string[],
  rowId: (row: T | null | undefined) => string,
) {
  const target = normalizeProductImportKey(value);
  if (!target) return "";
  const match = rows.find((row) => optionLabel(row, keys).includes(target));
  return rowId(match);
}

function required(
  value: string,
  label: string,
  errors: string[],
  messages: ProductImportMessages,
) {
  if (!value) errors.push(messages.required(label));
}

function rowRequired(
  value: string,
  row: number,
  label: string,
  errors: string[],
  messages: ProductImportMessages,
) {
  if (!value) errors.push(messages.rowRequired(row, label));
}

function normalizeRows<H extends string>(
  rows: ProductImportSheetRow[] | undefined,
  headers: readonly H[],
  identityHeaders: readonly H[],
  inheritedHeaders: readonly H[],
) {
  const normalized: NormalizedImportRow<H>[] = [];
  let previous: Partial<Record<H, string>> = {};
  let productIndex = -1;

  rows?.forEach((row) => {
    const directValues = {} as Record<H, string>;
    headers.forEach((header) => {
      directValues[header] = cleanText(row.values[header]);
    });

    const hasAnyValue = headers.some((header) => directValues[header]);
    if (!hasAnyValue) return;
    if (/^(enter |import defaults:)/i.test(directValues[headers[0]])) return;

    const startsProduct =
      productIndex < 0 ||
      identityHeaders.some((header) => Boolean(directValues[header]));
    if (startsProduct) {
      productIndex += 1;
      previous = {};
    }

    const values = { ...directValues };
    inheritedHeaders.forEach((header) => {
      if (!values[header]) values[header] = previous[header] ?? "";
    });
    inheritedHeaders.forEach((header) => {
      if (values[header]) previous[header] = values[header];
    });

    normalized.push({ productIndex, rowNumber: row.rowNumber, values });
  });

  return normalized;
}

function normalizedNormalRows(rows: ProductImportSheetRow[] | undefined) {
  return normalizeRows(
    rows,
    NORMAL_HEADERS,
    ["Product Code", "Product Name (Lao)", "Product Name (English)"],
    [
      "Product Code",
      "Product Name (Lao)",
      "Product Name (English)",
      "Category",
      "Unit",
    ],
  );
}

function normalizedSetRows(rows: ProductImportSheetRow[] | undefined) {
  return normalizeRows(
    rows,
    SET_HEADERS,
    ["Product Code", "Set Name (Lao)", "Set Name (English)"],
    [
      "Product Code",
      "Set Name (Lao)",
      "Set Name (English)",
      "Category",
      "Unit",
      "Set Price",
    ],
  );
}

function groupRows<H extends string>(rows: NormalizedImportRow<H>[]) {
  const groups = new Map<number, NormalizedImportRow<H>[]>();
  rows.forEach((row) => {
    groups.set(row.productIndex, [...(groups.get(row.productIndex) ?? []), row]);
  });
  return [...groups.values()];
}

export function sheetRowsFromAoA(
  rows: unknown[][],
  headers: readonly string[],
): ProductImportSheetRow[] {
  const headerIndex = rows.findIndex((row) =>
    headers.every((header) => row.map(cleanText).includes(header)),
  );
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

function uniqueImportNames(values: string[]) {
  const names = new Map<string, string>();
  values.forEach((value) => {
    const cleaned = cleanText(value);
    const key = normalizeProductImportKey(cleaned);
    if (key && !names.has(key)) names.set(key, cleaned);
  });
  return [...names.values()];
}

function pushUnique(target: string[], value: string) {
  if (value && !target.includes(value)) target.push(value);
}

function createDrafts(
  workbook: ProductImportWorkbookRows,
  branchUuid: string,
  messages: ProductImportMessages,
) {
  const drafts: ProductImportDraft[] = [];

  groupRows(normalizedNormalRows(workbook.Normal)).forEach((rows) => {
    const first = rows[0]?.values;
    if (!first) return;
    const validationErrors: string[] = [];
    const details = rows.map((row) => {
      const referenceName = row.values["Size Name"];
      rowRequired(
        referenceName,
        row.rowNumber,
        "Size Name",
        validationErrors,
        messages,
      );
      return {
        rowNumber: row.rowNumber,
        referenceName,
        costPrice: numberValue(row.values["Cost Price"]),
        salePrice: numberValue(row.values["Sale Price"]),
      };
    });

    required(
      first["Product Name (Lao)"],
      "Product Name (Lao)",
      validationErrors,
      messages,
    );
    required(first.Category, "Category", validationErrors, messages);
    required(first.Unit, "Unit", validationErrors, messages);

    drafts.push({
      key: `normal-row-${rows[0]?.rowNumber ?? drafts.length}`,
      type: "normal",
      sheetName: "Normal",
      rowNumbers: rows.map((row) => row.rowNumber),
      productCode: first["Product Code"],
      productNameLa: first["Product Name (Lao)"],
      productNameEng:
        first["Product Name (English)"] || first["Product Name (Lao)"],
      categoryName: first.Category,
      unitName: first.Unit,
      sizeNames: uniqueImportNames(
        details.map((detail) => detail.referenceName),
      ),
      details,
      detailCount: details.length,
      salePrice: details[0]?.salePrice ?? 0,
      validationErrors,
      warnings: [],
      payload: null,
      executionStatus: "pending",
      executionError: "",
    });
  });

  groupRows(normalizedSetRows(workbook.Set)).forEach((rows) => {
    const first = rows[0]?.values;
    if (!first) return;
    const validationErrors: string[] = [];
    const setPrices = rows.map((row) => numberValue(row.values["Set Price"]));
    const setPrice = setPrices[0] ?? 0;
    const details = rows.map((row) => {
      const referenceName = row.values["Set Option / Product Name"];
      rowRequired(
        referenceName,
        row.rowNumber,
        "Set Option / Product Name",
        validationErrors,
        messages,
      );
      return {
        rowNumber: row.rowNumber,
        referenceName,
        costPrice: numberValue(row.values["Cost Price"]),
        salePrice: numberValue(row.values["Set Price"]),
      };
    });

    required(
      first["Set Name (Lao)"],
      "Set Name (Lao)",
      validationErrors,
      messages,
    );
    required(first.Category, "Category", validationErrors, messages);
    required(first.Unit, "Unit", validationErrors, messages);

    const warnings =
      new Set(setPrices).size > 1 ? [messages.multipleSetPrices()] : [];
    drafts.push({
      key: `set-row-${rows[0]?.rowNumber ?? drafts.length}`,
      type: "set",
      sheetName: "Set",
      rowNumbers: rows.map((row) => row.rowNumber),
      productCode: first["Product Code"],
      productNameLa: first["Set Name (Lao)"],
      productNameEng:
        first["Set Name (English)"] || first["Set Name (Lao)"],
      categoryName: first.Category,
      unitName: first.Unit,
      sizeNames: uniqueImportNames(
        details.map((detail) => detail.referenceName),
      ),
      details,
      detailCount: details.length,
      salePrice: setPrice,
      validationErrors,
      warnings,
      payload: null,
      executionStatus: "pending",
      executionError: "",
    });
  });

  return drafts.map((draft) => ({
    ...draft,
    payload: draft.validationErrors.length
      ? null
      : buildDraftPayload(draft, branchUuid, "", "", () => ""),
  }));
}

function productNameKeys(product: Product) {
  return uniqueImportNames([
    cleanText(product.prod_name),
    cleanText(product.prod_name_la),
    cleanText(product.prod_name_eng),
  ]).map(normalizeProductImportKey);
}

function appendDuplicateErrors(
  drafts: ProductImportDraft[],
  existingProducts: Product[],
  messages: ProductImportMessages,
) {
  const existingCodes = new Set(
    existingProducts
      .map((product) => normalizeProductImportKey(product.prod_code))
      .filter(Boolean),
  );
  const existingNames = new Set(existingProducts.flatMap(productNameKeys));
  const workbookCodeCounts = new Map<string, number>();
  const workbookNameCounts = new Map<string, number>();

  drafts.forEach((draft) => {
    const codeKey = normalizeProductImportKey(draft.productCode);
    if (codeKey) {
      workbookCodeCounts.set(
        codeKey,
        (workbookCodeCounts.get(codeKey) ?? 0) + 1,
      );
    }
    new Set(
      [draft.productNameLa, draft.productNameEng]
        .map(normalizeProductImportKey)
        .filter(Boolean),
    ).forEach((nameKey) => {
      workbookNameCounts.set(
        nameKey,
        (workbookNameCounts.get(nameKey) ?? 0) + 1,
      );
    });
  });

  drafts.forEach((draft) => {
    const codeKey = normalizeProductImportKey(draft.productCode);
    if (
      codeKey &&
      (existingCodes.has(codeKey) || (workbookCodeCounts.get(codeKey) ?? 0) > 1)
    ) {
      pushUnique(
        draft.validationErrors,
        messages.duplicateCode?.(draft.productCode) ??
          DEFAULT_IMPORT_MESSAGES.duplicateCode?.(draft.productCode) ??
          `Duplicate product code: ${draft.productCode}`,
      );
    }

    const draftNames = new Map<string, string>();
    [draft.productNameLa, draft.productNameEng].forEach((name) => {
      const nameKey = normalizeProductImportKey(name);
      if (nameKey && !draftNames.has(nameKey)) draftNames.set(nameKey, name);
    });
    draftNames.forEach((name, nameKey) => {
      if (
        existingNames.has(nameKey) ||
        (workbookNameCounts.get(nameKey) ?? 0) > 1
      ) {
        pushUnique(
          draft.validationErrors,
          messages.duplicateName?.(name) ??
            DEFAULT_IMPORT_MESSAGES.duplicateName?.(name) ??
            `Duplicate product name: ${name}`,
        );
      }
    });
    if (draft.validationErrors.length) draft.payload = null;
  });
}

function assignGeneratedCodes(
  drafts: ProductImportDraft[],
  existingProducts: Product[],
  generatedCodeSeed: string,
) {
  const reservedCodes = new Set(
    existingProducts
      .map((product) => normalizeProductImportKey(product.prod_code))
      .filter(Boolean),
  );
  drafts.forEach((draft) => {
    const codeKey = normalizeProductImportKey(draft.productCode);
    if (codeKey) reservedCodes.add(codeKey);
  });

  const seed = cleanText(generatedCodeSeed) || "IMPORT";
  let sequence = 1;
  drafts.forEach((draft) => {
    if (draft.productCode) return;
    let candidate = `${seed}-${sequence}`;
    while (reservedCodes.has(normalizeProductImportKey(candidate))) {
      sequence += 1;
      candidate = `${seed}-${sequence}`;
    }
    draft.productCode = candidate;
    reservedCodes.add(normalizeProductImportKey(candidate));
    sequence += 1;
  });
}

export function productImportReferenceNamesFromDrafts(
  drafts: ProductImportDraft[],
): ProductImportReferenceNames {
  const validDrafts = drafts.filter(
    (draft) => draft.validationErrors.length === 0,
  );
  return {
    categoryNames: uniqueImportNames(
      validDrafts.map((draft) => draft.categoryName),
    ),
    unitNames: uniqueImportNames(validDrafts.map((draft) => draft.unitName)),
    normalSizeNames: uniqueImportNames(
      validDrafts
        .filter((draft) => draft.type === "normal")
        .flatMap((draft) =>
          draft.details.map((detail) => detail.referenceName),
        ),
    ),
    setSizeNames: uniqueImportNames(
      validDrafts
        .filter((draft) => draft.type === "set")
        .flatMap((draft) =>
          draft.details.map((detail) => detail.referenceName),
        ),
    ),
  };
}

export function productImportReferenceConflictApplies(
  draft: ProductImportDraft,
  conflict: ProductImportReferenceConflict,
) {
  const conflictName = normalizeProductImportKey(conflict.name);
  if (conflict.kind === "group") return true;
  if (conflict.kind === "category") {
    return normalizeProductImportKey(draft.categoryName) === conflictName;
  }
  if (conflict.kind === "unit") {
    return normalizeProductImportKey(draft.unitName) === conflictName;
  }
  if (
    (conflict.kind === "normalSize" && draft.type !== "normal") ||
    (conflict.kind === "setSize" && draft.type !== "set")
  ) {
    return false;
  }
  return draft.details.some(
    (detail) =>
      normalizeProductImportKey(detail.referenceName) === conflictName,
  );
}

export function planProductImportDraftReferences(
  drafts: ProductImportDraft[],
  context: ProductImportDraftReferenceContext,
): ProductImportReferencePlan {
  const validDrafts = drafts.filter(
    (draft) => draft.validationErrors.length === 0,
  );
  const initialPlan = planProductImportReferences({
    ...context,
    ...productImportReferenceNamesFromDrafts(validDrafts),
  });
  const safeDrafts = validDrafts.filter(
    (draft) =>
      !initialPlan.conflicts.some((conflict) =>
        productImportReferenceConflictApplies(draft, conflict),
      ),
  );
  if (safeDrafts.length === validDrafts.length) return initialPlan;

  const safePlan = planProductImportReferences({
    ...context,
    ...productImportReferenceNamesFromDrafts(safeDrafts),
  });
  return { ...safePlan, conflicts: initialPlan.conflicts };
}

export function analyzeProductImportWorkbook({
  workbook,
  branchUuid,
  existingProducts,
  generatedCodeSeed,
  messages = DEFAULT_IMPORT_MESSAGES,
}: ProductImportAnalysisInput): ProductImportAnalysis {
  const drafts = createDrafts(workbook, branchUuid, messages);
  assignGeneratedCodes(drafts, existingProducts, generatedCodeSeed);
  appendDuplicateErrors(drafts, existingProducts, messages);

  drafts.forEach((draft) => {
    if (!draft.validationErrors.length) {
      draft.payload = buildDraftPayload(draft, branchUuid, "", "", () => "");
    }
  });

  return {
    drafts,
    referenceNames: productImportReferenceNamesFromDrafts(drafts),
  };
}

export function productImportReferenceNames(
  workbook: ProductImportWorkbookRows,
): ProductImportReferenceNames {
  return analyzeProductImportWorkbook({
    workbook,
    branchUuid: "",
    existingProducts: [],
    generatedCodeSeed: "IMPORT",
  }).referenceNames;
}

function buildDraftPayload(
  draft: ProductImportDraft,
  branchUuid: string,
  categoryId: string,
  unitId: string,
  detailId: (detail: ProductImportDraftDetail, index: number) => string,
): SaveProductInput {
  const base = {
    branch_uuid_fk: branchUuid,
    cate_uuid_fk: categoryId,
    unite_uuid_fk: unitId,
    prod_code: draft.productCode,
    prod_name_la: draft.productNameLa,
    prod_name_eng: draft.productNameEng || draft.productNameLa,
    prod_order_point: DEFAULT_ORDER_POINT,
    prod_notification: 1,
    status_sort_fk: draft.type === "set" ? 2 : 1,
    prod_set_price: draft.type === "set" ? draft.salePrice : 0,
    prod_status_imge: 2,
    prod_image: DEFAULT_COLOR,
    prod_topping_status: 1,
    toppings: [],
  };

  if (draft.type === "set") {
    return {
      ...base,
      details: draft.details.map((detail, index) => ({
        size_uuid_fk: detailId(detail, index),
        pro_detail_bprice: detail.costPrice,
        pro_detail_qty_stock: DEFAULT_STOCK_QTY,
        pro_detail_stock: 2,
        pro_detail_enabled: 1,
        pro_detail_status: 2,
      })),
    };
  }

  return {
    ...base,
    details: draft.details.map((detail, index) => ({
      size_uuid_fk: detailId(detail, index),
      pro_detail_bprice: detail.costPrice,
      pro_detail_sprice: detail.salePrice,
      pro_detail_qty_stock: DEFAULT_STOCK_QTY,
      pro_detail_stock: 2,
      pro_detail_enabled: 1,
    })),
  };
}

export function buildProductImportDrafts(
  workbook: ProductImportWorkbookRows,
  references: ProductImportReferences,
  messages: ProductImportMessages = DEFAULT_IMPORT_MESSAGES,
) {
  const analysis = analyzeProductImportWorkbook({
    workbook,
    branchUuid: references.branchUuid,
    existingProducts: [],
    generatedCodeSeed: generateProdCode(),
    messages,
  });
  return resolveProductImportDrafts(analysis.drafts, references, messages);
}

export function resolveProductImportDrafts(
  drafts: ProductImportDraft[],
  references: ProductImportReferences,
  messages: ProductImportMessages = DEFAULT_IMPORT_MESSAGES,
  options: ResolveProductImportDraftOptions = {},
) {
  const categoryKeys = [
    "cate_name",
    "cate_name_la",
    "cate_name_eng",
    "category_name",
    "category_name_la",
    "category_name_eng",
  ];
  const unitKeys = [
    "unite_name",
    "unite_name_la",
    "unite_name_eng",
    "unit_name",
    "unit_name_la",
    "unit_name_eng",
  ];
  const sizeKeys = ["size_name", "size_name_la", "size_name_eng"];

  return drafts.map((draft) => {
    const validationErrors = [...draft.validationErrors];
    const categoryId = matchOption(
      references.categories,
      draft.categoryName,
      categoryKeys,
      categoryUuid,
    );
    const unitId = matchOption(
      references.units,
      draft.unitName,
      unitKeys,
      unitUuid,
    );
    const detailRows =
      draft.type === "set" ? references.setSizes : references.sizes;
    const detailIds = draft.details.map((detail) =>
      matchOption(detailRows, detail.referenceName, sizeKeys, sizeUuid),
    );

    if (options.requireReferences) {
      if (!categoryId) {
        pushUnique(
          validationErrors,
          messages.categoryNotFound(draft.categoryName),
        );
      }
      if (!unitId) {
        pushUnique(validationErrors, messages.unitNotFound(draft.unitName));
      }
      draft.details.forEach((detail, index) => {
        if (detailIds[index]) return;
        pushUnique(
          validationErrors,
          draft.type === "set"
            ? messages.setOptionNotFound(
                detail.rowNumber,
                detail.referenceName,
              )
            : messages.sizeNotFound(detail.rowNumber, detail.referenceName),
        );
      });
    }

    return {
      ...draft,
      validationErrors,
      payload: validationErrors.length
        ? null
        : buildDraftPayload(
            draft,
            references.branchUuid,
            categoryId,
            unitId,
            (_detail, index) => detailIds[index] ?? "",
          ),
    };
  });
}

export function productImportSummary(drafts: ProductImportDraft[]) {
  const ready = drafts.filter(
    (draft) =>
      draft.executionStatus !== "succeeded" &&
      draft.payload &&
      !draft.validationErrors.length,
  ).length;
  const invalid = drafts.filter(
    (draft) => draft.validationErrors.length > 0,
  ).length;
  const succeeded = drafts.filter(
    (draft) => draft.executionStatus === "succeeded",
  ).length;
  const failed = drafts.filter(
    (draft) => draft.executionStatus === "failed",
  ).length;
  const warnings = drafts.reduce(
    (sum, draft) => sum + draft.warnings.length,
    0,
  );
  return { total: drafts.length, ready, invalid, warnings, succeeded, failed };
}
