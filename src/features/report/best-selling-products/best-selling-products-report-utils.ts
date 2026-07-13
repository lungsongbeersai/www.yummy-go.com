import { money } from "@/lib/format";
import { BEST_SELLING_PRODUCTS_SORT_OPTIONS } from "@/config/report-filters";
import type { ApiEntity } from "@/services/shared/types";
import type { BestSellingProductGroup, BestSellingProductItem } from "@/stores/report-store";
import type {
  ReportExcelCellStyle,
  ReportExcelGridRow,
  ReportExcelGridSection
} from "../report-excel-utils";
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

// สไตล์ตาราง Excel แบบจัดกลุ่ม: แถวหัวกลุ่มถือยอดรวมของกลุ่มไว้ในตัว
const GROUPED_TABLE_HEADER_STYLE = {
  align: "center",
  bold: true,
  fill: "#1F4E78",
  fontColor: "#FFFFFF"
} as const satisfies ReportExcelCellStyle;

const GROUP_ROW_STYLE = {
  bold: true,
  fill: "#DEE8F4"
} as const satisfies ReportExcelCellStyle;

const GRAND_TOTAL_ROW_STYLE = {
  bold: true,
  fill: "#D9E2F3"
} as const satisfies ReportExcelCellStyle;

// ตารางเดียวจัดกลุ่มตามกลุ่มสินค้า เหมือนหน้าจอ: แถวกลุ่ม (พร้อมยอดรวมกลุ่ม)
// → สินค้าในกลุ่ม (อันดับนับใหม่ต่อกลุ่ม) → ปิดท้ายด้วยยอดรวมทั้งรายงาน
export function bestSellingGroupedSection(
  groups: BestSellingProductGroup[],
  summary: ApiEntity,
  t: (key: string, options?: Record<string, unknown>) => string
): ReportExcelGridSection {
  const productMetrics = bestSellingProductMetricConfigs(t);
  const groupMetrics = bestSellingGroupMetricConfigs(t);
  const headers = [
    t("report.bestSelling.columns.rank"),
    t("report.bestSelling.columns.product"),
    t("report.bestSelling.columns.productCode"),
    t("report.bestSelling.columns.category"),
    ...productMetrics.map((metric) => metric.label)
  ];
  const rows: ReportExcelGridRow[] = [
    {
      cells: headers.map((header) => ({ value: header })),
      style: GROUPED_TABLE_HEADER_STYLE
    }
  ];

  groups.forEach((group) => {
    rows.push({
      cells: [
        {
          colSpan: 4,
          value: `${group.name} — ${t("report.bestSelling.groupSummary", {
            products: group.productCount,
            qty: formatNumber(group.qtyTotal)
          })}`
        },
        // ราคาขายไม่มีความหมายระดับกลุ่ม เว้นว่างเพื่อให้คอลัมน์ metric อื่นตรงแนว
        { value: "" },
        ...groupMetrics.map((metric) => ({
          value: firstNumber(group[metric.field])
        }))
      ],
      style: GROUP_ROW_STYLE
    });
    group.items.forEach((item, index) => {
      rows.push({
        cells: [
          { value: index + 1 },
          { value: item.productName },
          { value: item.productCode },
          { value: item.categoryName },
          ...productMetrics.map((metric) => ({
            value: firstNumber(item[metric.field])
          }))
        ]
      });
    });
  });

  rows.push({
    cells: [
      { colSpan: 4, value: t("report.summary") },
      { value: "" },
      ...bestSellingSummaryConfigs(t).map((card) => ({
        value: firstNumber(summaryValue(summary, card.keys))
      }))
    ],
    style: GRAND_TOTAL_ROW_STYLE
  });

  return {
    grid: {
      columnCount: headers.length,
      columnWidths: [8, 34, 16, 18, 13, 10, 15, 14, 14, 13, 12, 16],
      rows
    },
    title: t("report.excel.products")
  };
}

export function bestSellingProductRowId(row: BestSellingProductItem) {
  return row.id;
}

export function bestSellingGroupsFromRows(
  groups: BestSellingProductGroup[],
  rows: BestSellingProductItem[]
) {
  const selectedIds = new Set(rows.map(bestSellingProductRowId));

  return groups
    .map((group) => {
      const items = group.items.filter((item) =>
        selectedIds.has(bestSellingProductRowId(item))
      );
      if (!items.length) return null;

      return {
        ...group,
        billDiscountShare: items.reduce((total, item) => total + item.billDiscountShare, 0),
        charge: items.reduce((total, item) => total + item.charge, 0),
        finalTotal: items.reduce((total, item) => total + item.finalTotal, 0),
        itemDiscount: items.reduce((total, item) => total + item.itemDiscount, 0),
        items,
        productCount: items.length,
        qtyTotal: items.reduce((total, item) => total + item.qty, 0),
        subtotal: items.reduce((total, item) => total + item.subtotal, 0),
        vat: items.reduce((total, item) => total + item.vat, 0),
      };
    })
    .filter((group): group is BestSellingProductGroup => Boolean(group));
}

export function bestSellingSummaryFromRows(
  rows: BestSellingProductItem[],
  groupCount: number
) {
  return {
    bill_discount_share: rows.reduce((total, row) => total + row.billDiscountShare, 0),
    charge: rows.reduce((total, row) => total + row.charge, 0),
    final_total: rows.reduce((total, row) => total + row.finalTotal, 0),
    group_count: groupCount,
    item_discount: rows.reduce((total, row) => total + row.itemDiscount, 0),
    product_count: rows.length,
    qty: rows.reduce((total, row) => total + row.qty, 0),
    subtotal: rows.reduce((total, row) => total + row.subtotal, 0),
    vat: rows.reduce((total, row) => total + row.vat, 0),
  };
}

export function displayMetric(value: unknown, kind: "money" | "number") {
  return kind === "money" ? money(firstNumber(value)) : formatNumber(value);
}
