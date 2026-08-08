import { dateTime, money } from "@/lib/format";
import type { ReportPrintOp } from "@/services/report";
import type { ApiEntity } from "@/services/shared/types";
import type { AuthUser } from "@/stores/auth-store";
import type { PaymentMethodReportRow } from "@/stores/report-store";
import { firstNumber } from "./payment-methods-report-utils";
import {
  receiptDocumentHtml,
  receiptHeaderHtml,
  receiptHeadlineTotalHtml,
  receiptMetaRowHtml,
  receiptTotalRowHtml,
} from "../shared/report-receipt-print";

export interface PaymentMethodsPrintLabels {
  grandTotal: string;
  period: string;
  printedAt: string;
  printedBy: string;
  title: string;
}

export interface PaymentMethodsPrintRow {
  billCount: number;
  grandTotal: number;
  name: string;
}

export interface PaymentMethodsPrintData {
  branchName: string;
  cashier: string;
  dateFrom: string;
  dateTo: string;
  grandTotal: number;
  labels: PaymentMethodsPrintLabels;
  rows: PaymentMethodsPrintRow[];
  storeName: string;
}

// รายงานนี้มีไว้กระทบยอดตามวิธีชำระ (เงินสดในลิ้นชักตรงไหม โอน/เครดิตค้างเท่าไร) ไม่ใช่ดูโครงสร้างยอดขาย
// จึงตัด subtotal/discount/service/vat ออก — ตัวเลขนั้นเป็นหน้าที่ของรายงานปิดร้าน/ยอดขายรายวันอยู่แล้ว
// สิ่งที่ช่วยกระทบยอดจริงคือจำนวนบิลต่อวิธีชำระ (เทียบกับใบเสร็จจริง) จึงใส่ไว้ข้างชื่อแต่ละแถวแทน
export function buildPaymentMethodsPrintData({
  dateFrom,
  dateTo,
  labels,
  reportTotal,
  rows,
  user,
}: {
  dateFrom: string;
  dateTo: string;
  labels: PaymentMethodsPrintLabels;
  reportTotal: ApiEntity;
  rows: PaymentMethodReportRow[];
  user: AuthUser;
}): PaymentMethodsPrintData {
  return {
    branchName: user.branch_name,
    cashier: user.email?.split("@")[0] || user.email || "-",
    dateFrom,
    dateTo,
    grandTotal: firstNumber(reportTotal.grand_total),
    labels,
    rows: rows.map((row) => ({ billCount: row.billCount, grandTotal: row.grandTotal, name: row.paymentMethodName })),
    storeName: user.store_name,
  };
}

export function renderPaymentMethodsPrintHtml(data: PaymentMethodsPrintData) {
  const { labels, rows } = data;

  const bodyHtml = `
    ${receiptHeaderHtml({ branchName: data.branchName, storeName: data.storeName, title: labels.title })}
    <div class="divider"></div>
    <section class="meta">
      ${receiptMetaRowHtml(labels.period, `${data.dateFrom} - ${data.dateTo}`)}
      ${receiptMetaRowHtml(labels.printedBy, data.cashier)}
      ${receiptMetaRowHtml(labels.printedAt, dateTime(new Date().toISOString()))}
    </section>
    <div class="divider"></div>
    <section>
      ${rows.map((row) => receiptTotalRowHtml(`${row.name} (${row.billCount})`, row.grandTotal)).join("")}
    </section>
    <div class="divider"></div>
    ${receiptHeadlineTotalHtml(labels.grandTotal, data.grandTotal)}`;

  return receiptDocumentHtml({ bodyHtml, title: labels.title });
}

// เวอร์ชันพิมพ์ผ่าน printer agent — ยอดรวมทั้งหมดจุดเดียวเป็น text 2 บรรทัด (เน้นสูงสุด)
// แถวต่อวิธีชำระเป็น lr เรียบๆ เพราะพิมพ์จริงยืนยันแล้วว่า bold/size บน type "lr" ไม่มีผล
export function buildPaymentMethodsReportOps(data: PaymentMethodsPrintData): ReportPrintOp[] {
  const { labels, rows } = data;
  const lr = (left: string, right: number): ReportPrintOp => ({
    type: "lr",
    left,
    right: money(right),
    bold: false,
    size: 24,
  });

  return [
    ...(data.storeName ? [{ type: "text", text: data.storeName, align: "center", bold: true, size: 24 } as ReportPrintOp] : []),
    ...(data.branchName ? [{ type: "text", text: data.branchName, align: "center", size: 22 } as ReportPrintOp] : []),
    { type: "text", text: labels.title, align: "center", bold: true, size: 32 },
    { type: "line" },
    { type: "text", text: `${labels.period}: ${data.dateFrom} - ${data.dateTo}`, align: "left", size: 24 },
    { type: "text", text: `${labels.printedBy}: ${data.cashier}`, align: "left", size: 24 },
    { type: "text", text: `${labels.printedAt}: ${dateTime(new Date().toISOString())}`, align: "left", size: 20 },
    { type: "line" },
    ...rows.map((row) => lr(`${row.name} (${row.billCount})`, row.grandTotal)),
    { type: "line" },
    { type: "text", text: labels.grandTotal, align: "left", bold: true, size: 26 },
    { type: "text", text: money(data.grandTotal), align: "right", bold: true, size: 32 },
    { type: "blank", n: 2 },
  ];
}
