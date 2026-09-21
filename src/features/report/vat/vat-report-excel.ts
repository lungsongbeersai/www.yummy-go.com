import type { VatReportRow, VatReportSummary } from "@/services/report";
import type {
  ReportExcelCellStyle,
  ReportExcelGridRow,
  ReportExcelGridSection,
} from "@/lib/export/excel";
import {
  REPORT_GRAND_TOTAL_ROW_STYLE,
  REPORT_TABLE_HEADER_STYLE,
} from "@/lib/export/excel-styles";
import { formatShortDate } from "@/lib/format";
import { vatSummaryMetricConfigs } from "./vat-report-utils";

export interface VatExportData {
  reportName: string;
  rows: VatReportRow[];
  summary: VatReportSummary;
}

// สรุปว่างสำหรับตอนที่ export surface ต้อง render ก่อนข้อมูล export/report ตัวจริงพร้อม (กรณีขอบ
// ที่ current ยังเป็น null — ในทางปฏิบัติปุ่ม export ถูก disable อยู่แล้วตอนนั้น)
export const emptyVatSummary: VatReportSummary = {
  bill_count: 0,
  discount_bill: 0,
  discount_amount: 0,
  net_sale: 0,
  service_charge: 0,
  vat: 0,
  grand_total: 0,
};

export function vatRowId(row: VatReportRow) {
  return row.order_uuid;
}

// สรุปใหม่จากเฉพาะแถวที่ผู้ใช้เลือกไว้ (ตอนกดเลือกแถวก่อน export Excel/PDF)
export function vatSummaryFromRows(rows: VatReportRow[]): VatReportSummary {
  return rows.reduce<VatReportSummary>(
    (summary, row) => ({
      bill_count: summary.bill_count + 1,
      discount_bill: summary.discount_bill + row.discount_bill,
      discount_amount: summary.discount_amount + row.discount_amount,
      net_sale: summary.net_sale + row.net_sale,
      service_charge: summary.service_charge + row.service_charge,
      vat: summary.vat + row.vat,
      grand_total: summary.grand_total + row.grand_total,
    }),
    { ...emptyVatSummary }
  );
}

export function vatFileBaseName({
  dateFrom,
  dateTo,
  orderBy,
}: {
  dateFrom: string;
  dateTo: string;
  orderBy: string;
}) {
  return `vat-report-${orderBy}-${dateFrom}-to-${dateTo}`;
}

export function vatSummaryRows(
  summary: VatReportSummary,
  t: (key: string) => string
) {
  return vatSummaryMetricConfigs(t).map((metric) => ({
    [t("report.excel.metric")]: metric.label,
    [t("report.excel.value")]: summary[metric.key as keyof VatReportSummary],
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

// รายงานนี้ใช้เพื่อยื่นภาษี — แต่ละแถวคือใบเสร็จจริงหนึ่งใบ (ไม่ใช่ยอดรวมต่อกลุ่มแบบรายงานอื่น) จึง
// ต้องมีครบทุกแถวตามที่แสดงบนหน้าจอ ห้ามตัดทอนหรือรวมยอด ตรงกับคอลัมน์บนตาราง (vat-report-table.tsx)
export function vatTableSection(
  data: VatExportData,
  language: string,
  t: (key: string) => string
): ReportExcelGridSection {
  const headers = [
    t("report.vat.columns.saleDate"),
    t("report.vat.columns.invoice"),
    t("report.vat.columns.customer"),
    t("report.vat.columns.discount"),
    t("report.vat.columns.netSale"),
    t("report.vat.columns.serviceCharge"),
    t("report.vat.columns.vatRate"),
    t("report.vat.columns.vat"),
    t("report.vat.columns.grandTotal"),
  ];

  const rows: ReportExcelGridRow[] = [
    { cells: headers.map((header) => ({ value: header })), style: REPORT_TABLE_HEADER_STYLE },
  ];

  data.rows.forEach((row) => {
    rows.push({
      cells: [
        { value: formatShortDate(row.sale_date, language) },
        { value: row.order_invoice },
        { value: row.customer_name || "-" },
        { value: row.discount_amount, style: MONEY_STYLE },
        { value: row.net_sale, style: MONEY_STYLE },
        { value: row.service_charge, style: MONEY_STYLE },
        { value: row.vat_rate, style: NUMBER_STYLE },
        { value: row.vat, style: MONEY_STYLE },
        { value: row.grand_total, style: MONEY_STYLE },
      ],
    });
  });

  rows.push({
    cells: [
      { colSpan: 3, value: t("report.summary") },
      { value: data.summary.discount_amount, style: MONEY_STYLE },
      { value: data.summary.net_sale, style: MONEY_STYLE },
      { value: data.summary.service_charge, style: MONEY_STYLE },
      { value: "" },
      { value: data.summary.vat, style: MONEY_STYLE },
      { value: data.summary.grand_total, style: MONEY_STYLE },
    ],
    style: REPORT_GRAND_TOTAL_ROW_STYLE,
  });

  return {
    grid: { columnCount: headers.length, columnWidths: [14, 16, 24, 14, 16, 14, 10, 14, 16], rows },
    title: t("report.excel.rows"),
  };
}
