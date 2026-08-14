import { dateTime, money } from "@/lib/format";
import type { ReportPrintOp } from "@/services/report";
import type { ApiEntity } from "@/services/shared/types";
import type { AuthUser } from "@/stores/auth-store";
import type { BestSellingProductItem } from "@/stores/report-store";
import { firstNumber, summaryValue } from "./best-selling-products-report-utils";
import {
  receiptDocumentHtml,
  receiptHeaderHtml,
  receiptHeadlineTotalHtml,
  receiptMetaRowHtml,
  receiptTotalRowHtml,
} from "../shared/report-receipt-print";

const TOP_N = 10;
const GRAND_TOTAL_KEYS = ["final_total", "total", "revenue_total", "amount"];

export interface BestSellingPrintLabels {
  grandTotal: string;
  period: string;
  printedAt: string;
  printedBy: string;
  title: string;
}

export interface BestSellingPrintRow {
  finalTotal: number;
  name: string;
  qty: number;
  rank: number;
}

export interface BestSellingPrintOthers {
  label: string;
  total: number;
}

export interface BestSellingPrintData {
  branchName: string;
  cashier: string;
  dateFrom: string;
  dateTo: string;
  grandTotal: number;
  labels: BestSellingPrintLabels;
  others: BestSellingPrintOthers | null;
  rows: BestSellingPrintRow[];
  storeName: string;
}

// รายงานนี้มีไว้ตอบว่า "สินค้าไหนขายดี/ขายไม่ดี" เพื่อตัดสินใจเรื่องเมนู/สต็อก — ไม่ใช่ดูโครงสร้างยอดขาย
// จึงตัด subtotal/discount/service/vat ออกเหมือนอีก 2 รายงาน เหลือแค่อันดับ + จำนวนขาย + ยอดขายต่อสินค้า
// จำกัด Top 10 ให้พอดีกระดาษ 80mm ที่เหลือรวมเป็นแถว "อื่นๆ" แถวเดียว (label ต้องแปลข้างนอกเพราะขึ้นกับ
// จำนวนที่เหลือจริง ซึ่งรู้ได้หลังตัด Top N แล้วเท่านั้น)
export function buildBestSellingPrintData({
  dateFrom,
  dateTo,
  labels,
  othersLabel,
  rows,
  summary,
  user,
}: {
  dateFrom: string;
  dateTo: string;
  labels: BestSellingPrintLabels;
  othersLabel: (count: number) => string;
  rows: BestSellingProductItem[];
  summary: ApiEntity;
  user: AuthUser;
}): BestSellingPrintData {
  const topRows = rows.slice(0, TOP_N).map((row) => ({
    finalTotal: row.finalTotal,
    name: row.productName,
    qty: row.qty,
    rank: row.rank,
  }));
  const remaining = rows.slice(TOP_N);

  return {
    branchName: user.branch_name,
    cashier: user.email?.split("@")[0] || user.email || "-",
    dateFrom,
    dateTo,
    grandTotal: firstNumber(summaryValue(summary, GRAND_TOTAL_KEYS)),
    labels,
    others: remaining.length
      ? {
          label: othersLabel(remaining.length),
          total: remaining.reduce((sum, row) => sum + row.finalTotal, 0),
        }
      : null,
    rows: topRows,
    storeName: user.store_name,
  };
}

export function renderBestSellingPrintHtml(data: BestSellingPrintData) {
  const { labels, others, rows } = data;

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
      ${rows.map((row) => receiptTotalRowHtml(`${row.rank}. ${row.name} (${row.qty})`, row.finalTotal)).join("")}
      ${others ? receiptTotalRowHtml(others.label, others.total) : ""}
    </section>
    <div class="divider"></div>
    ${receiptHeadlineTotalHtml(labels.grandTotal, data.grandTotal)}`;

  return receiptDocumentHtml({ bodyHtml, title: labels.title });
}

// { type: "line" } พิมพ์ออกมาเป็นเส้น underscore ต่อกันบนเครื่องจริง (ยืนยันจากการพิมพ์ทดสอบ) ไม่ใช่เส้นประ —
// ใช้ข้อความ "-" ยาวแทน ซึ่งพิมพ์ได้ถูกต้อง (เหมือน daily-sales)
const RECEIPT_DIVIDER_TEXT = "---------------------";

// เวอร์ชันพิมพ์ผ่าน printer agent — ยอดรวมทั้งหมดจุดเดียวเป็น text 2 บรรทัด (เน้นสูงสุด)
// แถวสินค้า/อื่นๆ เป็น lr เรียบๆ เพราะพิมพ์จริงยืนยันแล้วว่า bold/size บน type "lr" ไม่มีผล
export function buildBestSellingReportOps(data: BestSellingPrintData): ReportPrintOp[] {
  const { labels, others, rows } = data;
  const divider: ReportPrintOp = { type: "text", text: RECEIPT_DIVIDER_TEXT, align: "left", size: 20 };
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
    divider,
    { type: "text", text: `${labels.period}: ${data.dateFrom} - ${data.dateTo}`, align: "left", size: 24 },
    { type: "text", text: `${labels.printedBy}: ${data.cashier}`, align: "left", size: 24 },
    { type: "text", text: `${labels.printedAt}: ${dateTime(new Date().toISOString())}`, align: "left", size: 20 },
    divider,
    ...rows.map((row) => lr(`${row.rank}. ${row.name} (${row.qty})`, row.finalTotal)),
    ...(others ? [lr(others.label, others.total)] : []),
    divider,
    { type: "text", text: labels.grandTotal, align: "left", bold: true, size: 26 },
    { type: "text", text: money(data.grandTotal), align: "right", bold: true, size: 32 },
    { type: "blank", n: 2 },
  ];
}
