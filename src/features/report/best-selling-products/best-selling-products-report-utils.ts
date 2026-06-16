import { money } from "@/lib/format";
import { BEST_SELLING_PRODUCTS_SORT_OPTIONS } from "@/services/report";
import type { ApiEntity } from "@/services/shared/types";
import type { BestSellingProductGroup, BestSellingProductItem } from "@/stores/report-store";
import type {
  BestSellingMetricConfig,
  BestSellingOption,
  BestSellingProductsFilters,
  BestSellingSummaryCardConfig
} from "./best-selling-products-report-types";

export const ALL_GROUPS_VALUE = "all";

type SummaryMetricDefinition = Omit<BestSellingMetricConfig, "label"> & {
  keys: string[];
  labelKey: string;
};

type RowMetricDefinition<T> = Omit<BestSellingMetricConfig, "label"> & {
  field: keyof T;
  labelKey: string;
};

const bestSellingSummaryMetricDefinitions = [
  {
    key: "qty",
    kind: "number",
    keys: ["qty", "qty_total", "total_qty", "total_quantity", "quantity"],
    labelKey: "report.bestSelling.columns.qty"
  },
  {
    key: "subtotal",
    kind: "money",
    keys: ["subtotal", "sub_total", "gross_total"],
    labelKey: "report.bestSelling.columns.subtotal"
  },
  {
    key: "item_discount",
    kind: "money",
    keys: ["item_discount", "item_discount_amount", "discount"],
    labelKey: "report.bestSelling.columns.itemDiscount"
  },
  {
    key: "bill_discount_share",
    kind: "money",
    keys: ["bill_discount_share", "bill_discount", "bill_discount_amount"],
    labelKey: "report.bestSelling.columns.billDiscountShare"
  },
  {
    key: "charge",
    kind: "money",
    keys: ["charge", "service_charge", "service_charge_amount"],
    labelKey: "report.bestSelling.columns.charge"
  },
  {
    key: "vat",
    kind: "money",
    keys: ["vat", "vat_amount", "tax"],
    labelKey: "report.bestSelling.columns.vat"
  },
  {
    key: "final_total",
    kind: "money",
    keys: ["final_total", "total", "revenue_total", "amount"],
    labelKey: "report.bestSelling.columns.finalTotal"
  }
] as const satisfies readonly SummaryMetricDefinition[];

const bestSellingProductMetricDefinitions = [
  {
    field: "salePrice",
    key: "sale_price",
    kind: "money",
    labelKey: "report.bestSelling.columns.salePrice"
  },
  {
    field: "qty",
    key: "qty",
    kind: "number",
    labelKey: "report.bestSelling.columns.qty"
  },
  {
    field: "subtotal",
    key: "subtotal",
    kind: "money",
    labelKey: "report.bestSelling.columns.subtotal"
  },
  {
    field: "itemDiscount",
    key: "item_discount",
    kind: "money",
    labelKey: "report.bestSelling.columns.itemDiscount"
  },
  {
    field: "billDiscountShare",
    key: "bill_discount_share",
    kind: "money",
    labelKey: "report.bestSelling.columns.billDiscountShare"
  },
  {
    field: "charge",
    key: "charge",
    kind: "money",
    labelKey: "report.bestSelling.columns.charge"
  },
  {
    field: "vat",
    key: "vat",
    kind: "money",
    labelKey: "report.bestSelling.columns.vat"
  },
  {
    field: "finalTotal",
    key: "final_total",
    kind: "money",
    labelKey: "report.bestSelling.columns.finalTotal"
  }
] as const satisfies readonly RowMetricDefinition<BestSellingProductItem>[];

const bestSellingGroupMetricDefinitions = [
  {
    field: "qtyTotal",
    key: "qty",
    kind: "number",
    labelKey: "report.bestSelling.columns.qty"
  },
  {
    field: "subtotal",
    key: "subtotal",
    kind: "money",
    labelKey: "report.bestSelling.columns.subtotal"
  },
  {
    field: "itemDiscount",
    key: "item_discount",
    kind: "money",
    labelKey: "report.bestSelling.columns.itemDiscount"
  },
  {
    field: "billDiscountShare",
    key: "bill_discount_share",
    kind: "money",
    labelKey: "report.bestSelling.columns.billDiscountShare"
  },
  {
    field: "charge",
    key: "charge",
    kind: "money",
    labelKey: "report.bestSelling.columns.charge"
  },
  {
    field: "vat",
    key: "vat",
    kind: "money",
    labelKey: "report.bestSelling.columns.vat"
  },
  {
    field: "finalTotal",
    key: "final_total",
    kind: "money",
    labelKey: "report.bestSelling.columns.finalTotal"
  }
] as const satisfies readonly RowMetricDefinition<BestSellingProductGroup>[];

export function isPresent(value: unknown) {
  return value !== null && value !== undefined && value !== "";
}

export function textValue(value: unknown, fallback = "-") {
  return isPresent(value) ? String(value) : fallback;
}

export function readValue(row: ApiEntity, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (isPresent(value)) return value;
  }
  return undefined;
}

export function firstNumber(...values: unknown[]) {
  for (const value of values) {
    if (!isPresent(value)) continue;
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return 0;
}

function normalizeKey(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

export function summaryValue(summary: ApiEntity | ApiEntity[], keys: string[]) {
  if (Array.isArray(summary)) {
    const aliases = keys.map(normalizeKey);
    for (const card of summary) {
      const key = normalizeKey(readValue(card, ["key", "name", "code", "field", "id", "label", "title"]));
      if (!aliases.includes(key)) continue;
      const value = readValue(card, ["value", "amount", "total", "count", ...keys]);
      if (isPresent(value)) return value;
    }
    return undefined;
  }

  return readValue(summary, keys);
}

export function formatNumber(value: unknown) {
  return firstNumber(value).toLocaleString("en-US");
}

export function localDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function groupOptionFromRow(row: ApiEntity, language: string): BestSellingOption | null {
  const value = textValue(readValue(row, ["group_uuid", "group_uuid_fk", "uuid"]), "");
  if (!value) return null;
  const labelKeys =
    language === "en"
      ? ["group_name_eng", "group_name", "group_name_la", "name"]
      : ["group_name_la", "group_name", "group_name_eng", "name"];
  return { value, label: textValue(readValue(row, labelKeys), value) };
}

export function selectedOptionLabel(options: BestSellingOption[], value: string, fallback = "-") {
  return options.find((option) => option.value === value)?.label ?? fallback;
}

export function groupParam(groupUuid: string) {
  return groupUuid || ALL_GROUPS_VALUE;
}

export function bestSellingSortLabel(sortBy: BestSellingProductsFilters["sortBy"], t: (key: string) => string) {
  return t(`report.bestSelling.sortOptions.${sortBy}`);
}

export function bestSellingSortOptions(t: (key: string) => string) {
  return BEST_SELLING_PRODUCTS_SORT_OPTIONS.map((value) => ({
    label: bestSellingSortLabel(value, t),
    value
  }));
}

export function bestSellingSummaryConfigs(t: (key: string) => string): BestSellingSummaryCardConfig[] {
  return bestSellingSummaryMetricDefinitions.map((definition) => ({
    kind: definition.kind,
    keys: [...definition.keys],
    label: t(definition.labelKey)
  }));
}

function rowMetricConfigs<T>(
  definitions: readonly RowMetricDefinition<T>[],
  t: (key: string) => string
) {
  return definitions.map((definition) => ({
    field: definition.field,
    key: definition.key,
    kind: definition.kind,
    label: t(definition.labelKey)
  }));
}

export function bestSellingProductMetricConfigs(t: (key: string) => string) {
  return rowMetricConfigs(bestSellingProductMetricDefinitions, t);
}

export function bestSellingGroupMetricConfigs(t: (key: string) => string) {
  return rowMetricConfigs(bestSellingGroupMetricDefinitions, t);
}

export function bestSellingProductMetrics(row: BestSellingProductItem, t: (key: string) => string) {
  return bestSellingProductMetricConfigs(t).map((metric) => ({
    ...metric,
    value: row[metric.field]
  }));
}

export function bestSellingGroupMetrics(group: BestSellingProductGroup, t: (key: string) => string) {
  return bestSellingGroupMetricConfigs(t).map((metric) => ({
    ...metric,
    value: group[metric.field]
  }));
}

export function bestSellingFileBaseName(filters: BestSellingProductsFilters) {
  return `best-selling-products-${filters.sortBy}-${filters.dateFrom}-to-${filters.dateTo}`;
}

export function waitForPaint() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

export function exportSummaryRows(
  cards: BestSellingSummaryCardConfig[],
  summary: ApiEntity,
  t: (key: string) => string
) {
  return cards.map((card) => ({
    [t("report.bestSelling.export.metric")]: card.label,
    [t("report.bestSelling.export.value")]: firstNumber(summaryValue(summary, card.keys))
  }));
}

export function exportGroupRows(groups: BestSellingProductGroup[], t: (key: string) => string) {
  const metrics = bestSellingGroupMetricConfigs(t);
  return groups.map((group, index) => ({
    [t("fields.no")]: index + 1,
    [t("report.bestSelling.columns.group")]: group.name,
    [t("report.bestSelling.cards.productCount")]: group.productCount,
    ...Object.fromEntries(metrics.map((metric) => [metric.label, Number(group[metric.field] ?? 0)]))
  }));
}

export function exportProductRows(rows: BestSellingProductItem[], t: (key: string) => string) {
  const metrics = bestSellingProductMetricConfigs(t);
  return rows.map((row) => ({
    [t("report.bestSelling.columns.rank")]: row.rank,
    [t("report.bestSelling.columns.product")]: row.productName,
    [t("report.bestSelling.columns.productCode")]: row.productCode,
    [t("report.bestSelling.columns.category")]: row.categoryName,
    [t("report.bestSelling.columns.group")]: row.groupName,
    ...Object.fromEntries(metrics.map((metric) => [metric.label, Number(row[metric.field] ?? 0)]))
  }));
}

export function displayMetric(value: unknown, kind: "money" | "number") {
  return kind === "money" ? money(firstNumber(value)) : formatNumber(value);
}
