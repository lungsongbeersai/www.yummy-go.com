import { dateTime } from "@/lib/format";
import type { ReportPrintOp } from "@/services/report";
import type { ApiEntity } from "@/services/shared/types";
import type { AuthUser } from "@/stores/auth-store";
import type { CategorySalesGroup } from "@/stores/report-store";
import { escapeHtml } from "@/services/printer/invoice-print-window";
import { firstNumber } from "./category-sales-report-utils";
import {
  receiptDocumentHtml,
  receiptHeaderHtml,
  receiptMetaRowHtml,
} from "../shared/report-receipt-print";

export interface CategorySalesPrintLabels {
  grandTotal: string;
  groupLabel: string;
  groupTotal: string;
  itemsHeaderLeft: string;
  itemsHeaderRight: string;
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
// แบ่งเป็นหมวดตามกลุ่มสินค้าเหมือนบนหน้าจอ (ไม่จำกัด Top N — สอดคล้องกับ daily-sales ที่ไม่จำกัดจำนวนรายการ
// ต่อกลุ่มเช่นกัน) เลขลำดับเริ่มนับ 1 ใหม่ทุกกลุ่ม ตรงกับที่แสดงบนตาราง
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

// ตัดคั่นหลักพันด้วยลูกน้ำล้วนๆ ไม่มีสัญลักษณ์สกุลเงิน เหมือน daily-sales — เลี่ยง money() เพราะ locale
// "lo-LA" ของฟังก์ชันนั้นคั่นหลักพันด้วยจุด ("150.000") ไม่ใช่ลูกน้ำ และเติมสัญลักษณ์สกุลเงินที่ไม่ต้องการมาด้วย
function plainMoney(value: number) {
  const amount = Object.is(value, -0) ? 0 : value;
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(amount);
}

// สไตล์เฉพาะของใบพิมพ์นี้ (ต่อยอดจาก RECEIPT_80MM_BASE_STYLES) — โครงสร้างเดียวกับ .date-group ของ
// daily-sales ทุกจุด (ต่างกันแค่ตัวแบ่งเป็นกลุ่มสินค้าแทนกลุ่มวันที่ และมีบรรทัดหมวดหมู่ย่อยใต้แต่ละสินค้า)
const CATEGORY_SALES_EXTRA_STYLES = `
      .category { margin: 0 0 1mm; }
      .category + .category { margin-top: 2.5mm; }
      .divider-section { margin-bottom: 2mm; }
      .category h2 { margin: 0 0 0.8mm; padding-bottom: 0.5mm; border-bottom: 1px solid #111; font-size: 12px; }
      .list-header { border-bottom: 1px solid #111; padding-bottom: 0.5mm; margin-bottom: 0.5mm; }
      .product-category { margin: 0 0 0.65mm 4mm; font-size: 10px; }
`;

export function renderCategorySalesPrintHtml(data: CategorySalesPrintData) {
  const { groups, labels } = data;
  const dividerHtml = `<div class="divider"></div>`;
  const row = (left: string, amount: number, className = "") => `
    <div class="total-row${className ? ` ${className}` : ""}"><span>${escapeHtml(left)}</span><span>${escapeHtml(plainMoney(amount))}</span></div>`;

  const listHeaderHtml = `<div class="total-row list-header"><span>${escapeHtml(labels.itemsHeaderLeft)}</span><span>${escapeHtml(labels.itemsHeaderRight)}</span></div>`;
  const sectionDividerHtml = `<div class="divider divider-section"></div>`;

  const groupsHtml = groups
    .map(
      (group, index) => `
    <section class="category">
      ${index > 0 ? sectionDividerHtml : ""}
      <h2>${escapeHtml(labels.groupLabel)}: ${escapeHtml(group.name)}</h2>
      ${group.items
        .map(
          (item) => `
        ${row(`${item.rank}. ${item.name} (${item.qty})`, item.grandTotal)}
        <p class="product-category">${escapeHtml(item.categoryName)}</p>`,
        )
        .join("")}
      ${dividerHtml}
      ${row(labels.groupTotal, group.total, "strong")}
    </section>`,
    )
    .join("");

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
    ${groupsHtml || `<p style="text-align:center">-</p>`}
    ${dividerHtml}
    ${row(labels.grandTotal, data.grandTotal, "grand-total")}`;

  return receiptDocumentHtml({ bodyHtml, extraStyles: CATEGORY_SALES_EXTRA_STYLES, title: labels.title });
}

// เวอร์ชันพิมพ์ผ่าน printer agent — โครงสร้างตรงกับ dateGroupOps ของ daily-sales ทุกจุด: หัวกลุ่ม(bold26) →
// divider → รายการ (ไม่มีบรรทัดว่างคั่นระหว่างรายการ) → divider → ยอดรวมกลุ่ม(bold lr) แล้วค่อยคั่นด้วย
// divider+บรรทัดว่างก่อนกลุ่มถัดไป (ไม่ใช่ก่อนกลุ่มแรก) ยอดรวมทั้งใบเป็น lr ตัวเดียว bold size 34 ตรงกับ daily-sales
export function buildCategorySalesReportOps(data: CategorySalesPrintData): ReportPrintOp[] {
  const { groups, labels } = data;
  const divider: ReportPrintOp = { type: "line" };
  const lr = (left: string, right: number, bold = false): ReportPrintOp => ({
    type: "lr",
    left,
    right: plainMoney(right),
    bold,
    size: bold ? 30 : 28,
  });

  const groupOps: ReportPrintOp[] = groups.flatMap((group, index) => [
    ...(index > 0 ? [divider, { type: "blank", n: 1 } as ReportPrintOp] : []),
    { type: "text", text: `${labels.groupLabel}: ${group.name}`, align: "left", bold: true, size: 26 },
    divider,
    ...group.items.flatMap((item): ReportPrintOp[] => [
      lr(`${item.rank}. ${item.name} (${item.qty})`, item.grandTotal),
      { type: "text", text: `  ${item.categoryName}`, align: "left", size: 24 },
    ]),
    divider,
    lr(labels.groupTotal, group.total, true),
  ]);

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
    ...groupOps,
    divider,
    { ...lr(labels.grandTotal, data.grandTotal, true), size: 34 },
    { type: "blank", n: 2 },
  ];
}
