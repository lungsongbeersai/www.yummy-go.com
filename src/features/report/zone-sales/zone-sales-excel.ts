import type { ZoneSalesRow, ZoneSalesSummary } from "@/services/report";
import type {
  ReportExcelCellStyle,
  ReportExcelGridRow,
  ReportExcelGridSection,
} from "@/lib/export/excel";
import {
  REPORT_GRAND_TOTAL_ROW_STYLE,
  REPORT_TABLE_HEADER_STYLE,
} from "@/lib/export/excel-styles";
import { zoneOptionLabel, zoneSalesSummaryMetricConfigs } from "./zone-sales-utils";

export interface ZoneSalesExportData {
  reportName: string;
  rows: ZoneSalesRow[];
  summary: ZoneSalesSummary;
}

// สรุปว่างสำหรับตอนที่ export surface ต้อง render ก่อนข้อมูล export/report ตัวจริงพร้อม (กรณีขอบ
// ที่ current ยังเป็น null — ในทางปฏิบัติปุ่ม export ถูก disable อยู่แล้วตอนนั้น)
export const emptyZoneSalesSummary: ZoneSalesSummary = {
  bill_count: 0,
  customer_count: 0,
  discount_amount: 0,
  grand_total: 0,
  gross_amount: 0,
  net_sale: 0,
  service_charge: 0,
  vat: 0,
  zone_count: 0,
};

export function zoneSalesRowId(row: ZoneSalesRow) {
  return row.zone_uuid;
}

// สรุปใหม่จากเฉพาะแถวที่ผู้ใช้เลือกไว้ (ตอนกดเลือกแถวก่อน export Excel/PDF)
export function zoneSalesSummaryFromRows(rows: ZoneSalesRow[]): ZoneSalesSummary {
  return rows.reduce<ZoneSalesSummary>(
    (summary, row) => ({
      bill_count: summary.bill_count + row.bill_count,
      customer_count: summary.customer_count + row.customer_count,
      discount_amount: summary.discount_amount + row.discount_amount,
      grand_total: summary.grand_total + row.grand_total,
      gross_amount: summary.gross_amount + row.gross_amount,
      net_sale: summary.net_sale + row.net_sale,
      service_charge: summary.service_charge + row.service_charge,
      vat: summary.vat + row.vat,
      zone_count: summary.zone_count + 1,
    }),
    { ...emptyZoneSalesSummary }
  );
}

export function zoneSalesFileBaseName({
  dateFrom,
  dateTo,
}: {
  dateFrom: string;
  dateTo: string;
}) {
  return `zone-sales-${dateFrom}-to-${dateTo}`;
}

export function zoneSalesSummaryRows(
  summary: ZoneSalesSummary,
  t: (key: string) => string
) {
  return zoneSalesSummaryMetricConfigs(t).map((metric) => ({
    [t("report.excel.metric")]: metric.label,
    [t("report.excel.value")]: summary[metric.key as keyof ZoneSalesSummary],
  }));
}

const MONEY_STYLE = {
  align: "right",
  numberFormat: "#,##0",
} as const satisfies ReportExcelCellStyle;

const NUMBER_STYLE = {
  align: "right",
  numberFormat: "#,##0",
} as const satisfies ReportExcelCellStyle;

// ตารางหลักตรงกับตารางบนหน้าจอ (zone-sales-table.tsx) ทุกคอลัมน์ — โซนมีจำนวนน้อย ไม่ต้องตัดทอน
export function zoneSalesTableSection(
  data: ZoneSalesExportData,
  language: string,
  t: (key: string) => string
): ReportExcelGridSection {
  const headers = [
    t("report.zoneSales.columns.rank"),
    t("report.zoneSales.zone"),
    t("report.zoneSales.columns.billCount"),
    t("report.zoneSales.columns.customerCount"),
    t("report.zoneSales.columns.discount"),
    t("report.zoneSales.columns.netSale"),
    t("report.zoneSales.columns.serviceCharge"),
    t("report.zoneSales.columns.vat"),
    t("report.zoneSales.columns.grandTotal"),
  ];

  const rows: ReportExcelGridRow[] = [
    { cells: headers.map((header) => ({ value: header })), style: REPORT_TABLE_HEADER_STYLE },
  ];

  data.rows.forEach((row, index) => {
    rows.push({
      cells: [
        { value: index + 1, style: NUMBER_STYLE },
        { value: zoneOptionLabel(row, language) },
        { value: row.bill_count, style: NUMBER_STYLE },
        { value: row.customer_count, style: NUMBER_STYLE },
        { value: row.discount_amount, style: MONEY_STYLE },
        { value: row.net_sale, style: MONEY_STYLE },
        { value: row.service_charge, style: MONEY_STYLE },
        { value: row.vat, style: MONEY_STYLE },
        { value: row.grand_total, style: MONEY_STYLE },
      ],
    });
  });

  rows.push({
    cells: [
      { colSpan: 2, value: t("report.summary") },
      { value: data.summary.bill_count, style: NUMBER_STYLE },
      { value: data.summary.customer_count, style: NUMBER_STYLE },
      { value: data.summary.discount_amount, style: MONEY_STYLE },
      { value: data.summary.net_sale, style: MONEY_STYLE },
      { value: data.summary.service_charge, style: MONEY_STYLE },
      { value: data.summary.vat, style: MONEY_STYLE },
      { value: data.summary.grand_total, style: MONEY_STYLE },
    ],
    style: REPORT_GRAND_TOTAL_ROW_STYLE,
  });

  return {
    grid: { columnCount: headers.length, columnWidths: [8, 24, 12, 14, 14, 16, 16, 14, 16], rows },
    title: t("report.excel.rows"),
  };
}
