import type { EmployeeSalesReportSummary, EmployeeSalesRow } from "@/services/report";
import type {
  ReportExcelCellStyle,
  ReportExcelGridRow,
  ReportExcelGridSection,
} from "@/lib/export/excel";
import {
  REPORT_GRAND_TOTAL_ROW_STYLE,
  REPORT_TABLE_HEADER_STYLE,
} from "@/lib/export/excel-styles";

export interface EmployeeSalesExportData {
  reportName: string;
  rows: EmployeeSalesRow[];
  summary: EmployeeSalesReportSummary;
}

// สรุปว่างสำหรับตอนที่ export surface ต้อง render ก่อนข้อมูล export/report ตัวจริงพร้อม (กรณีขอบ
// ที่ current ยังเป็น null — ในทางปฏิบัติปุ่ม export ถูก disable อยู่แล้วตอนนั้น)
export const emptyEmployeeSalesSummary: EmployeeSalesReportSummary = {
  bill_count: 0,
  bill_discount_amount: 0,
  cancel_bill_count: 0,
  cancel_total_amount: 0,
  cash: 0,
  credit: 0,
  discount_amount: 0,
  employee_count: 0,
  grand_total: 0,
  gross_amount: 0,
  item_discount_amount: 0,
  net_sale: 0,
  order_count: 0,
  payment_total: 0,
  service_charge: 0,
  total_qty: 0,
  transfer: 0,
  vat: 0,
};

export function employeeSalesRowId(row: EmployeeSalesRow) {
  return row.login_uuid;
}

// สรุปใหม่จากเฉพาะแถวที่ผู้ใช้เลือกไว้ (ตอนกดเลือกแถวก่อน export Excel/PDF) — รวมเฉพาะฟิลด์ที่
// รายงานนี้ใช้แสดงจริง (บิล/ยอดขาย/การชำระ/ยกเลิก) ตรงกับที่ backend ส่งมาใน EmployeeSalesReportSummary
export function employeeSalesSummaryFromRows(rows: EmployeeSalesRow[]): EmployeeSalesReportSummary {
  return rows.reduce<EmployeeSalesReportSummary>(
    (summary, row) => ({
      employee_count: summary.employee_count + 1,
      order_count: summary.order_count + row.summary.order_count,
      bill_count: summary.bill_count + row.summary.bill_count,
      total_qty: summary.total_qty + row.summary.total_qty,
      gross_amount: summary.gross_amount + row.summary.gross_amount,
      item_discount_amount: summary.item_discount_amount + row.summary.item_discount_amount,
      bill_discount_amount: summary.bill_discount_amount + row.summary.bill_discount_amount,
      discount_amount: summary.discount_amount + row.summary.discount_amount,
      net_sale: summary.net_sale + row.summary.net_sale,
      service_charge: summary.service_charge + row.summary.service_charge,
      vat: summary.vat + row.summary.vat,
      grand_total: summary.grand_total + row.summary.grand_total,
      cash: summary.cash + row.payment_summary.cash,
      transfer: summary.transfer + row.payment_summary.transfer,
      credit: summary.credit + row.payment_summary.credit,
      payment_total: summary.payment_total + row.payment_summary.payment_total,
      cancel_bill_count: summary.cancel_bill_count + row.cancel_summary.cancel_bill_count,
      cancel_total_amount: summary.cancel_total_amount + row.cancel_summary.cancel_total_amount,
    }),
    { ...emptyEmployeeSalesSummary }
  );
}

export function employeeSalesFileBaseName({
  dateFrom,
  dateTo,
  orderBy,
}: {
  dateFrom: string;
  dateTo: string;
  orderBy: string;
}) {
  return `employee-sales-${orderBy}-${dateFrom}-to-${dateTo}`;
}

function employeeName(row: EmployeeSalesRow) {
  return row.login_email || "-";
}

const MONEY_STYLE = {
  align: "right",
  numberFormat: "#,##0",
} as const satisfies ReportExcelCellStyle;

const NUMBER_STYLE = {
  align: "right",
  numberFormat: "#,##0",
} as const satisfies ReportExcelCellStyle;

const PERCENT_STYLE = {
  align: "right",
  numberFormat: '0.0"%"',
} as const satisfies ReportExcelCellStyle;

export function employeeSalesSummaryRows(
  summary: EmployeeSalesReportSummary,
  t: (key: string) => string
) {
  const metricLabel = t("report.excel.metric");
  const valueLabel = t("report.excel.value");

  return [
    { [metricLabel]: t("employeeSales.employeeCount"), [valueLabel]: summary.employee_count },
    { [metricLabel]: t("employeeSales.billCount"), [valueLabel]: summary.bill_count },
    { [metricLabel]: t("employeeSales.grandTotal"), [valueLabel]: summary.grand_total },
  ];
}

// รายงานนี้เป็นสรุปเชิงบริหารต่อพนักงาน (ใครขายได้เท่าไร กี่บิล) ไม่ใช่รายการบิล/รายการสินค้า —
// รายละเอียดระดับบิลดูได้จาก detail sheet ในหน้าจอแล้ว จึงมีแค่คอลัมน์สรุปต่อคนตามที่ออกแบบไว้
// (ลำดับ/ชื่อ/จำนวนบิล/ยอดขายรวม/% ของยอดขายรวม/ยอดขายเฉลี่ยต่อบิล) เรียงลำดับตามที่ backend ส่งมา
// (ตรงกับ orderBy ที่ผู้ใช้เลือกอยู่แล้ว ไม่ sort ซ้ำที่นี่)
export function employeeSalesTableSection(
  data: EmployeeSalesExportData,
  t: (key: string) => string
): ReportExcelGridSection {
  const headers = [
    t("employeeSales.rank"),
    t("employeeSales.employee"),
    t("employeeSales.billCount"),
    t("employeeSales.grandTotal"),
    t("employeeSales.percentOfTotal"),
    t("employeeSales.averagePerBill"),
  ];
  const reportGrandTotal = data.summary.grand_total || 0;
  const reportBillCount = data.summary.bill_count || 0;

  const rows: ReportExcelGridRow[] = [
    { cells: headers.map((header) => ({ value: header })), style: REPORT_TABLE_HEADER_STYLE },
  ];

  data.rows.forEach((row, index) => {
    const grandTotal = row.summary.grand_total;
    const billCount = row.summary.bill_count;
    const percent = reportGrandTotal ? (grandTotal / reportGrandTotal) * 100 : 0;
    const average = billCount ? grandTotal / billCount : 0;

    rows.push({
      cells: [
        { value: index + 1, style: NUMBER_STYLE },
        { value: employeeName(row) },
        { value: billCount, style: NUMBER_STYLE },
        { value: grandTotal, style: MONEY_STYLE },
        { value: percent, style: PERCENT_STYLE },
        { value: average, style: MONEY_STYLE },
      ],
    });
  });

  rows.push({
    cells: [
      { colSpan: 2, value: t("report.summary") },
      { value: reportBillCount, style: NUMBER_STYLE },
      { value: reportGrandTotal, style: MONEY_STYLE },
      { value: 100, style: PERCENT_STYLE },
      { value: reportBillCount ? reportGrandTotal / reportBillCount : 0, style: MONEY_STYLE },
    ],
    style: REPORT_GRAND_TOTAL_ROW_STYLE,
  });

  return {
    grid: { columnCount: headers.length, columnWidths: [8, 34, 14, 18, 16, 18], rows },
    title: t("report.excel.rows"),
  };
}
