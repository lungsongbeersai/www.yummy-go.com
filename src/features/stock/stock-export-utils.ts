import {
  categoryName,
  detailLabel,
  detailStockQty,
  productName,
  productOrderPoint,
  unitName
} from "@/features/product/list/product-list-utils";
import type { StockProduct, StockStatus } from "@/services/stock";
import {
  stockDetailEnabled,
  stockDetails,
  stockLevelStatus,
  stockStatusTranslationKey
} from "./stock-utils";

type Translate = (key: string) => string;

// แถวสินค้าแบบแบนราบ (สินค้า × ขนาด) ใช้ร่วมกันทั้งไฟล์ Excel และหน้า PDF
export interface StockExportRow {
  no: number;
  productName: string;
  prodCode: string;
  categoryName: string;
  variantLabel: string;
  quantity: number;
  unitName: string;
  orderPoint: number;
  statusLabel: string;
  enabledLabel: string;
}

export function flattenStockExportRows(
  rows: StockProduct[],
  language: string,
  t: Translate
): StockExportRow[] {
  let no = 0;

  return rows.flatMap((row) => {
    const orderPoint = productOrderPoint(row);

    return stockDetails(row).map((detail, index) => {
      no += 1;
      return {
        no,
        productName: productName(row, language),
        prodCode: String(row.prod_code || "-"),
        categoryName: categoryName(row, language),
        variantLabel: detailLabel(detail, index, language),
        quantity: detailStockQty(detail),
        unitName: unitName(row, language),
        orderPoint,
        statusLabel: t(
          stockStatusTranslationKey(stockLevelStatus(detail, orderPoint))
        ),
        enabledLabel: stockDetailEnabled(detail)
          ? t("stock.enabled")
          : t("stock.disabled")
      };
    });
  });
}

export function stockExcelRows(rows: StockExportRow[], t: Translate) {
  return rows.map((row) => ({
    [t("fields.no")]: row.no,
    [t("stock.columns.product")]: row.productName,
    [t("stock.columns.code")]: row.prodCode,
    [t("stock.columns.category")]: row.categoryName,
    [t("stock.columns.variant")]: row.variantLabel,
    [t("stock.columns.quantity")]: row.quantity,
    [t("stock.columns.unit")]: row.unitName,
    [t("stock.columns.reorderPoint")]: row.orderPoint,
    [t("stock.columns.status")]: row.statusLabel,
    [t("stock.columns.enabled")]: row.enabledLabel
  }));
}

// แถว Metric/Value หัวไฟล์ export — โครงเดียวกับ exportInfoRows ของหน้ารายงาน
export function stockExportInfoRows(
  t: Translate,
  input: {
    branchLabel: string;
    categoryLabel: string;
    statusLabel: string;
    dateLabel: string;
  }
) {
  return [
    { Metric: t("stock.branchLabel"), Value: input.branchLabel },
    { Metric: t("stock.filters.category"), Value: input.categoryLabel },
    { Metric: t("stock.filters.status"), Value: input.statusLabel },
    { Metric: t("report.reportDate"), Value: input.dateLabel }
  ];
}

export function stockExportFileBaseName(status: StockStatus, date: string) {
  return `stock-${status}-${date}`;
}
