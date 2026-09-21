import { dateTime } from "@/lib/format";
import type { EmployeeSalesReportSummary, EmployeeSalesRow, ReportPrintOp } from "@/services/report";
import type { AuthUser } from "@/stores/auth-store";
import { escapeHtml } from "@/services/printer/invoice-print-window";
import {
  receiptDocumentHtml,
  receiptHeaderHtml,
  receiptMetaRowHtml,
} from "../shared/report-receipt-print";

export interface EmployeeSalesPrintLabels {
  grandTotal: string;
  itemsHeaderLeft: string;
  itemsHeaderRight: string;
  period: string;
  printedAt: string;
  printedBy: string;
  title: string;
}

export interface EmployeeSalesPrintRow {
  billCount: number;
  grandTotal: number;
  name: string;
}

export interface EmployeeSalesPrintData {
  branchName: string;
  cashier: string;
  dateFrom: string;
  dateTo: string;
  grandTotal: number;
  labels: EmployeeSalesPrintLabels;
  rows: EmployeeSalesPrintRow[];
  storeName: string;
}

// รายงานนี้มีไว้ดูผลงานตามพนักงาน (ใครขายได้เท่าไร กี่บิล) ไม่ใช่ดูรายละเอียดบิล/สินค้า จึงเป็นแถวเดียว
// (flat) ต่อพนักงาน — ไม่มีการจัดกลุ่มซ้อนแบบ category-sales รายละเอียดระดับบิลดูได้จาก detail sheet
// ในหน้าจอ ไม่จำกัดจำนวนพนักงานที่พิมพ์ (ไม่ใช่ top-N)
export function buildEmployeeSalesPrintData({
  dateFrom,
  dateTo,
  labels,
  rows,
  summary,
  user,
}: {
  dateFrom: string;
  dateTo: string;
  labels: EmployeeSalesPrintLabels;
  rows: EmployeeSalesRow[];
  summary: EmployeeSalesReportSummary;
  user: AuthUser;
}): EmployeeSalesPrintData {
  return {
    branchName: user.branch_name,
    cashier: user.email?.split("@")[0] || user.email || "-",
    dateFrom,
    dateTo,
    grandTotal: summary.grand_total || 0,
    labels,
    rows: rows.map((row) => ({
      billCount: row.summary.bill_count,
      grandTotal: row.summary.grand_total,
      name: row.login_email || "-",
    })),
    storeName: user.store_name,
  };
}

// ตัดคั่นหลักพันด้วยลูกน้ำล้วนๆ ไม่มีสัญลักษณ์สกุลเงิน เหมือน daily-sales/category-sales — เลี่ยง money()
// เพราะ locale "lo-LA" ของฟังก์ชันนั้นคั่นหลักพันด้วยจุด ("150.000") ไม่ใช่ลูกน้ำ และเติมสัญลักษณ์สกุลเงินมาด้วย
function plainMoney(value: number) {
  const amount = Object.is(value, -0) ? 0 : value;
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(amount);
}

export function renderEmployeeSalesPrintHtml(data: EmployeeSalesPrintData) {
  const { labels, rows } = data;
  const dividerHtml = `<div class="divider"></div>`;
  const row = (left: string, amount: number, className = "") => `
    <div class="total-row${className ? ` ${className}` : ""}"><span>${escapeHtml(left)}</span><span>${escapeHtml(plainMoney(amount))}</span></div>`;

  const listHeaderHtml = `<div class="total-row list-header"><span>${escapeHtml(labels.itemsHeaderLeft)}</span><span>${escapeHtml(labels.itemsHeaderRight)}</span></div>`;

  const bodyHtml = `
    ${receiptHeaderHtml({ branchName: data.branchName, storeName: data.storeName, title: labels.title })}
    ${dividerHtml}
    <section class="meta">
      ${receiptMetaRowHtml(labels.period, `${data.dateFrom} - ${data.dateTo}`)}
      ${receiptMetaRowHtml(labels.printedBy, data.cashier)}
      ${receiptMetaRowHtml(labels.printedAt, dateTime(new Date().toISOString()))}
    </section>
    ${dividerHtml}
    ${listHeaderHtml}
    ${rows.map((r) => row(`${r.name} (${r.billCount})`, r.grandTotal)).join("") || `<p style="text-align:center">-</p>`}
    ${dividerHtml}
    ${row(labels.grandTotal, data.grandTotal, "grand-total")}`;

  return receiptDocumentHtml({
    bodyHtml,
    extraStyles: ".list-header { border-bottom: 1px solid #111; padding-bottom: 0.5mm; margin-bottom: 0.5mm; }",
    title: labels.title,
  });
}

// เวอร์ชันพิมพ์ผ่าน printer agent — ขนาดตัวอักษร/โครงสร้างยอดรวม/ตัวแบ่งตรงกับ payment-methods/daily-sales
// ทุกจุด (28/26/36/28/24/28-30/34, divider เป็น { type: "line" })
export function buildEmployeeSalesReportOps(data: EmployeeSalesPrintData): ReportPrintOp[] {
  const { labels, rows } = data;
  const divider: ReportPrintOp = { type: "line" };
  const lr = (left: string, right: number, bold = false): ReportPrintOp => ({
    type: "lr",
    left,
    right: plainMoney(right),
    bold,
    size: bold ? 30 : 28,
  });

  return [
    ...(data.storeName ? [{ type: "text", text: data.storeName, align: "center", bold: true, size: 28 } as ReportPrintOp] : []),
    ...(data.branchName ? [{ type: "text", text: data.branchName, align: "center", size: 26 } as ReportPrintOp] : []),
    { type: "text", text: labels.title, align: "center", bold: true, size: 36 },
    divider,
    { type: "text", text: `${labels.period}: ${data.dateFrom} - ${data.dateTo}`, align: "left", size: 28 },
    { type: "text", text: `${labels.printedBy}: ${data.cashier}`, align: "left", size: 28 },
    { type: "text", text: `${labels.printedAt}: ${dateTime(new Date().toISOString())}`, align: "left", size: 24 },
    divider,
    { type: "lr", left: labels.itemsHeaderLeft, right: labels.itemsHeaderRight, bold: false, size: 24 },
    divider,
    ...rows.map((row) => lr(`${row.name} (${row.billCount})`, row.grandTotal)),
    divider,
    { ...lr(labels.grandTotal, data.grandTotal, true), size: 34 },
    { type: "blank", n: 2 },
  ];
}
