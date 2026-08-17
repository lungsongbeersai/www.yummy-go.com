import { dateTime, money } from "@/lib/format";
import type { ReportPrintOp } from "@/services/report";
import type { ApiEntity } from "@/services/shared/types";
import type { AuthUser } from "@/stores/auth-store";
import type { CategorySalesGroup } from "@/stores/report-store";
import { escapeHtml } from "@/services/printer/invoice-print-window";
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
  groupLabel: string;
  groupTotal: string;
  period: string;
  printedAt: string;
  printedBy: string;
  title: string;
}

export interface CategorySalesPrintItem {
  categoryName: string;
  grandTotal: number;
  name: string;
  qty: number;
  rank: number;
}

export interface CategorySalesPrintGroup {
  items: CategorySalesPrintItem[];
  name: string;
  total: number;
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
// แบ่งเป็นหมวดตามกลุ่มสินค้าเหมือนบนหน้าจอ (ไม่จำกัด Top N — สอดคล้องกับ best-selling-products/daily-closing
// ที่ไม่จำกัดจำนวนรายการต่อกลุ่มเช่นกัน) เลขลำดับเริ่มนับ 1 ใหม่ทุกกลุ่ม ตรงกับที่แสดงบนตาราง
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
      items: group.rows.map((row, index) => ({
        categoryName: row.cateName,
        grandTotal: row.grandTotal,
        name: row.productName,
        qty: row.totalQty,
        rank: index + 1,
      })),
      name: group.groupName,
      total: firstNumber(group.summary.grand_total),
    })),
    labels,
    storeName: user.store_name,
  };
}

// สไตล์เฉพาะของใบพิมพ์นี้ (ต่อยอดจาก RECEIPT_80MM_BASE_STYLES ที่มี .category-total ให้แล้ว)
// เหมือนกับ best-selling-products ทุกจุด (ทั้งชื่อ class และค่า spacing/font-size) เพราะเป็นดีไซน์เดียวกัน
const CATEGORY_SALES_EXTRA_STYLES = `
      .category { padding-top: 2mm; }
      .category-item + .category-item { margin-top: 1.5mm; }
      .product-category { margin: 0.2mm 0 0 4mm; font-size: 9px; color: #444; }
`;

export function renderCategorySalesPrintHtml(data: CategorySalesPrintData) {
  const { groups, labels } = data;

  const groupsHtml = groups
    .map(
      (group) => `
    <section class="category">
      <h2>${escapeHtml(labels.groupLabel)}: ${escapeHtml(group.name)}</h2>
      ${group.items
        .map(
          (item) => `
        <div class="category-item">
          ${receiptTotalRowHtml(`${item.rank}. ${item.name} (${item.qty})`, item.grandTotal)}
          <p class="product-category">${escapeHtml(item.categoryName)}</p>
        </div>`,
        )
        .join("")}
      ${receiptTotalRowHtml(labels.groupTotal, group.total, "category-total")}
    </section>`,
    )
    .join("");

  const bodyHtml = `
    ${receiptHeaderHtml({ branchName: data.branchName, storeName: data.storeName, title: labels.title })}
    <div class="divider"></div>
    <section class="meta">
      ${receiptMetaRowHtml(labels.period, `${data.dateFrom} - ${data.dateTo}`)}
      ${receiptMetaRowHtml(labels.printedBy, data.cashier)}
      ${receiptMetaRowHtml(labels.printedAt, dateTime(new Date().toISOString()))}
    </section>
    
    ${groupsHtml || `<p style="text-align:center">-</p>`}
   
    ${receiptHeadlineTotalHtml(labels.grandTotal, data.grandTotal)}`;

  return receiptDocumentHtml({ bodyHtml, extraStyles: CATEGORY_SALES_EXTRA_STYLES, title: labels.title });
}

// เวอร์ชันพิมพ์ผ่าน printer agent — แต่ละกลุ่มปิดท้ายด้วย divider แทน border-bottom ของ .category-total ใน HTML
// แถวสินค้า/ยอดรวมกลุ่มเป็น lr เรียบๆ เพราะพิมพ์จริงยืนยันแล้วว่า bold/size บน type "lr" ไม่มีผล
// ยอดรวมทั้งใบยังคงเป็น text 2 บรรทัดแยก (เน้นสูงสุดจุดเดียว)
// ใช้ { type: "line" } ตรงกับ daily-sales/best-selling-products (ยืนยันจากพิมพ์จริงแล้วว่าออกมาเป็นเส้นเต็มปกติ)
export function buildCategorySalesReportOps(data: CategorySalesPrintData): ReportPrintOp[] {
  const { groups, labels } = data;
  const divider: ReportPrintOp = { type: "line" };
  const lr = (left: string, right: number): ReportPrintOp => ({
    type: "lr",
    left,
    right: money(right),
    bold: false,
    size: 24,
  });

  const groupOps: ReportPrintOp[] = groups.flatMap((group) => [
    { type: "text", text: `${labels.groupLabel}: ${group.name}`, align: "left", bold: true, size: 26 },
    // เว้นบรรทัดว่างคั่นระหว่างสินค้า (ไม่ใช่ก่อนตัวแรกหรือหลังตัวสุดท้าย) ให้ตรงกับ margin ของ
    // .category-item ฝั่ง HTML — ป้ายหมวดหมู่ใช้ size เล็กกว่าแถวหลักเหมือนฝั่ง HTML ที่เล็กกว่าเช่นกัน
    ...group.items.flatMap((item, index): ReportPrintOp[] => [
      ...(index > 0 ? [{ type: "blank", n: 1 } as ReportPrintOp] : []),
      lr(`${item.rank}. ${item.name} (${item.qty})`, item.grandTotal),
      { type: "text", text: `  ${item.categoryName}`, align: "left", size: 20 },
    ]),
    lr(labels.groupTotal, group.total),
    divider,
  ]);

  return [
    ...(data.storeName ? [{ type: "text", text: data.storeName, align: "center", bold: true, size: 24 } as ReportPrintOp] : []),
    ...(data.branchName ? [{ type: "text", text: data.branchName, align: "center", size: 22 } as ReportPrintOp] : []),
    { type: "text", text: labels.title, align: "center", bold: true, size: 32 },
    divider,
    { type: "text", text: `${labels.period}: ${data.dateFrom} - ${data.dateTo}`, align: "left", size: 24 },
    { type: "text", text: `${labels.printedBy}: ${data.cashier}`, align: "left", size: 24 },
    { type: "text", text: `${labels.printedAt}: ${dateTime(new Date().toISOString())}`, align: "left", size: 20 },
    divider,
    ...groupOps,
    { type: "text", text: labels.grandTotal, align: "left", bold: true, size: 26 },
    { type: "text", text: money(data.grandTotal), align: "right", bold: true, size: 32 },
    { type: "blank", n: 2 },
  ];
}
