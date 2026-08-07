import { dateTime, money } from "@/lib/format";
import type { ReportPrintOp } from "@/services/report";
import type { ApiEntity } from "@/services/shared/types";
import type { AuthUser } from "@/stores/auth-store";
import type { CategorySalesGroup } from "@/stores/report-store";
import { firstNumber } from "./category-sales-report-utils";
import {
  receiptDocumentHtml,
  receiptHeaderHtml,
  receiptHeadlineTotalHtml,
  receiptMetaRowHtml,
  receiptTotalRowHtml,
} from "../shared/report-receipt-print";

export interface CategorySalesPrintLabels {
  grandTotal: string;
  period: string;
  printedAt: string;
  printedBy: string;
  title: string;
}

export interface CategorySalesPrintGroup {
  grandTotal: number;
  name: string;
  totalQty: number;
}

export interface CategorySalesPrintData {
  branchName: string;
  cashier: string;
  dateFrom: string;
  dateTo: string;
  grandTotal: number;
  groups: CategorySalesPrintGroup[];
  labels: CategorySalesPrintLabels;
  storeName: string;
}

// รายงานนี้มีไว้ดูผลงานตามกลุ่มสินค้า (กลุ่มไหนขายดี ทั้งจำนวนและมูลค่า) ไม่ใช่ดูโครงสร้างยอดขาย
// จึงตัด subtotal/discount/service/vat ออก — เป็นหน้าที่ของรายงานปิดร้าน/ยอดขายรายวันอยู่แล้ว
// สิ่งที่ตอบคำถามจริงของรายงานนี้คือจำนวนที่ขายได้ต่อกลุ่ม จึงใส่ไว้ข้างชื่อแต่ละแถวแทน
export function buildCategorySalesPrintData({
  dateFrom,
  dateTo,
  groups,
  labels,
  summary,
  user,
}: {
  dateFrom: string;
  dateTo: string;
  groups: CategorySalesGroup[];
  labels: CategorySalesPrintLabels;
  summary: ApiEntity;
  user: AuthUser;
}): CategorySalesPrintData {
  return {
    branchName: user.branch_name,
    cashier: user.email?.split("@")[0] || user.email || "-",
    dateFrom,
    dateTo,
    grandTotal: firstNumber(summary.grand_total),
    groups: groups.map((group) => ({
      grandTotal: firstNumber(group.summary.grand_total),
      name: group.groupName,
      totalQty: firstNumber(group.summary.total_qty),
    })),
    labels,
    storeName: user.store_name,
  };
}

export function renderCategorySalesPrintHtml(data: CategorySalesPrintData) {
  const { groups, labels } = data;

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
      ${groups.map((group) => receiptTotalRowHtml(`${group.name} (${group.totalQty})`, group.grandTotal)).join("")}
    </section>
    <div class="divider"></div>
    ${receiptHeadlineTotalHtml(labels.grandTotal, data.grandTotal)}`;

  return receiptDocumentHtml({ bodyHtml, title: labels.title });
}

// เวอร์ชันพิมพ์ผ่าน printer agent — ยอดรวมทั้งหมดจุดเดียวเป็น text 2 บรรทัด (เน้นสูงสุด)
// แถวต่อกลุ่มเป็น lr เรียบๆ เพราะพิมพ์จริงยืนยันแล้วว่า bold/size บน type "lr" ไม่มีผล
export function buildCategorySalesReportOps(data: CategorySalesPrintData): ReportPrintOp[] {
  const { groups, labels } = data;
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
    ...groups.map((group) => lr(`${group.name} (${group.totalQty})`, group.grandTotal)),
    { type: "line" },
    { type: "text", text: labels.grandTotal, align: "left", bold: true, size: 26 },
    { type: "text", text: money(data.grandTotal), align: "right", bold: true, size: 32 },
    { type: "blank", n: 2 },
  ];
}
