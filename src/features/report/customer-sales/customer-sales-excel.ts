import type { CustomerSalesReportSummary, CustomerSalesRow } from "@/services/report";
import type {
  ReportExcelCellStyle,
  ReportExcelGridRow,
  ReportExcelGridSection,
} from "@/lib/export/excel";
import {
  REPORT_GRAND_TOTAL_ROW_STYLE,
  REPORT_TABLE_HEADER_STYLE,
} from "@/lib/export/excel-styles";
import { customerSalesSummaryMetricConfigs } from "./customer-sales-utils";

export interface CustomerSalesExportData {
  reportName: string;
  rows: CustomerSalesRow[];
  summary: CustomerSalesReportSummary;
}

// สรุปว่างสำหรับตอนที่ export surface ต้อง render ก่อนข้อมูล export/report ตัวจริงพร้อม (กรณีขอบ
// ที่ current ยังเป็น null — ในทางปฏิบัติปุ่ม export ถูก disable อยู่แล้วตอนนั้น)
export const emptyCustomerSalesSummary: CustomerSalesReportSummary = {
  bill_count: 0,
  customer_count: 0,
  discount_bill: 0,
  grand_total: 0,
  net_sale: 0,
  service_charge: 0,
  vat: 0,
};

export function customerSalesRowId(row: CustomerSalesRow) {
  return row.customer_uuid;
}

// สรุปใหม่จากเฉพาะแถวที่ผู้ใช้เลือกไว้ (ตอนกดเลือกแถวก่อน export Excel/PDF)
export function customerSalesSummaryFromRows(rows: CustomerSalesRow[]): CustomerSalesReportSummary {
  return rows.reduce<CustomerSalesReportSummary>(
    (summary, row) => ({
      bill_count: summary.bill_count + row.summary.bill_count,
      customer_count: summary.customer_count + 1,
      discount_bill: summary.discount_bill + row.summary.discount_bill,
      grand_total: summary.grand_total + row.summary.grand_total,
      net_sale: summary.net_sale + row.summary.net_sale,
      service_charge: summary.service_charge + row.summary.service_charge,
      vat: summary.vat + row.summary.vat,
    }),
    { ...emptyCustomerSalesSummary }
  );
}

export function customerSalesFileBaseName({
  dateFrom,
  dateTo,
  orderBy,
}: {
  dateFrom: string;
  dateTo: string;
  orderBy: string;
}) {
  return `customer-sales-${orderBy}-${dateFrom}-to-${dateTo}`;
}

export function customerSalesSummaryRows(
  summary: CustomerSalesReportSummary,
  t: (key: string) => string
) {
  return customerSalesSummaryMetricConfigs(t).map((metric) => ({
    [t("report.excel.metric")]: metric.label,
    [t("report.excel.value")]: summary[metric.key as keyof CustomerSalesReportSummary],
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

// รายงานนี้เป็นสรุปเชิงบริหารต่อลูกค้า (ใครซื้อเท่าไร กี่บิล) ไม่ใช่รายการบิล/รายการสินค้า —
// รายละเอียดระดับบิลดูได้จาก detail dialog ในหน้าจอแล้ว จึงมีแค่คอลัมน์สรุปต่อคนตรงกับตารางบนหน้าจอ
export function customerSalesTableSection(
  data: CustomerSalesExportData,
  t: (key: string) => string
): ReportExcelGridSection {
  const headers = [
    t("report.customerSales.columns.rank"),
    t("report.customerSales.customer"),
    t("report.customerSales.columns.billCount"),
    t("report.customerSales.columns.netSale"),
    t("report.customerSales.columns.serviceCharge"),
    t("report.customerSales.columns.vat"),
    t("report.customerSales.columns.grandTotal"),
  ];

  const rows: ReportExcelGridRow[] = [
    { cells: headers.map((header) => ({ value: header })), style: REPORT_TABLE_HEADER_STYLE },
  ];

  data.rows.forEach((row, index) => {
    rows.push({
      cells: [
        { value: index + 1, style: NUMBER_STYLE },
        { value: row.customer_name || "-" },
        { value: row.summary.bill_count, style: NUMBER_STYLE },
        { value: row.summary.net_sale, style: MONEY_STYLE },
        { value: row.summary.service_charge, style: MONEY_STYLE },
        { value: row.summary.vat, style: MONEY_STYLE },
        { value: row.summary.grand_total, style: MONEY_STYLE },
      ],
    });
  });

  rows.push({
    cells: [
      { colSpan: 2, value: t("report.summary") },
      { value: data.summary.bill_count, style: NUMBER_STYLE },
      { value: data.summary.net_sale, style: MONEY_STYLE },
      { value: data.summary.service_charge, style: MONEY_STYLE },
      { value: data.summary.vat, style: MONEY_STYLE },
      { value: data.summary.grand_total, style: MONEY_STYLE },
    ],
    style: REPORT_GRAND_TOTAL_ROW_STYLE,
  });

  return {
    grid: { columnCount: headers.length, columnWidths: [8, 30, 12, 16, 16, 14, 16], rows },
    title: t("report.excel.rows"),
  };
}
