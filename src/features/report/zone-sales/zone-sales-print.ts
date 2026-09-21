import { dateTime } from "@/lib/format";
import type { ReportPrintOp, ZoneSalesRow } from "@/services/report";
import type { AuthUser } from "@/stores/auth-store";
import { escapeHtml } from "@/services/printer/invoice-print-window";
import {
  receiptDocumentHtml,
  receiptHeaderHtml,
  receiptMetaRowHtml,
} from "../shared/report-receipt-print";
import { zoneOptionLabel } from "./zone-sales-utils";

export interface ZoneSalesPrintLabels {
  grandTotal: string;
  itemsHeaderLeft: string;
  itemsHeaderRight: string;
  period: string;
  printedAt: string;
  printedBy: string;
  title: string;
}

export interface ZoneSalesPrintRow {
  billCount: number;
  grandTotal: number;
  name: string;
}

export interface ZoneSalesPrintData {
  branchName: string;
  cashier: string;
  dateFrom: string;
  dateTo: string;
  grandTotal: number;
  labels: ZoneSalesPrintLabels;
  rows: ZoneSalesPrintRow[];
  storeName: string;
}

// รายงานนี้มีไว้ดูว่าโซนไหนขายดี ไม่ใช่ดูโครงสร้างยอดขาย จึงตัด discount/service/vat ออกจากใบพิมพ์
// (ตัวเลขนั้นดูได้จากรายงานปิดร้าน/ยอดขายรายวัน) เหลือแค่จำนวนบิลไว้ข้างชื่อโซนเพื่อกระทบยอดคร่าวๆ
export function buildZoneSalesPrintData({
  dateFrom,
  dateTo,
  labels,
  language,
  rows,
  summary,
  user,
}: {
  dateFrom: string;
  dateTo: string;
  labels: ZoneSalesPrintLabels;
  language: string;
  rows: ZoneSalesRow[];
  summary: { grand_total: number };
  user: AuthUser;
}): ZoneSalesPrintData {
  return {
    branchName: user.branch_name,
    cashier: user.email?.split("@")[0] || user.email || "-",
    dateFrom,
    dateTo,
    grandTotal: summary.grand_total,
    labels,
    rows: rows.map((row) => ({
      billCount: row.bill_count,
      grandTotal: row.grand_total,
      name: zoneOptionLabel(row, language),
    })),
    storeName: user.store_name,
  };
}

// ตัดคั่นหลักพันด้วยลูกน้ำล้วนๆ ไม่มีสัญลักษณ์สกุลเงิน เหมือนรายงานอื่น — เลี่ยง money() เพราะ locale
// "lo-LA" คั่นหลักพันด้วยจุด ("150.000") ไม่ใช่ลูกน้ำ และเติมสัญลักษณ์สกุลเงินที่ไม่ต้องการมาด้วย
function plainMoney(value: number) {
  const amount = Object.is(value, -0) ? 0 : value;
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(amount);
}

export function renderZoneSalesPrintHtml(data: ZoneSalesPrintData) {
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

// เวอร์ชันพิมพ์ผ่าน printer agent — ขนาดตัวอักษร/โครงสร้างยอดรวม/ตัวแบ่งตรงกับ payment-methods/vat/
// customer-sales ทุกจุด
export function buildZoneSalesReportOps(data: ZoneSalesPrintData): ReportPrintOp[] {
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
