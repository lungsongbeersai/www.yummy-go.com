import { dateTime, money } from "@/lib/format";
import { firstNumberOrZero, readValue, textValue } from "@/lib/values";
import type { ReportPrintOp } from "@/services/report";
import type { ApiEntity } from "@/services/shared/types";
import type { AuthUser } from "@/stores/auth-store";
import type {
  CategorySalesGroup,
  DailySaleItemsBillGroup,
} from "@/stores/report-store";
import { escapeHtml } from "@/services/printer/invoice-print-window";
import {
  receiptDocumentHtml,
  receiptHeaderHtml,
  receiptMetaRowHtml,
  receiptTotalRowHtml,
} from "../shared/report-receipt-print";

export interface DailySalesPrintLabels {
  billCount: string;
  cancelledBills: string;
  cashReceived: string;
  categoryTotal: string;
  debt: string;
  discount: string;
  grandTotal: string;
  group: string;
  period: string;
  printedAt: string;
  printedBy: string;
  product: string;
  quantity: string;
  revenueSummary: string;
  serviceCharge: string;
  subtotal: string;
  title: string;
  totalAmount: string;
  totalQuantity: string;
  transferReceived: string;
  vat: string;
}

export interface DailySalesPrintProduct {
  amount: number;
  name: string;
  quantity: number;
}

export interface DailySalesPrintCategory {
  amount: number;
  name: string;
  products: DailySalesPrintProduct[];
  quantity: number;
}

export interface DailySalesPrintSummary {
  activeBillCount: number;
  cancelledAmount: number;
  cancelledBillCount: number;
  cashReceived: number;
  change: number;
  debt: number;
  discount: number;
  grandTotal: number;
  serviceCharge: number;
  subtotal: number;
  totalQuantity: number;
  transferReceived: number;
  vat: number;
}

export interface DailySalesPrintData {
  branchName: string;
  cashier: string;
  categories: DailySalesPrintCategory[];
  dateFrom: string;
  dateTo: string;
  labels: DailySalesPrintLabels;
  storeName: string;
  summary: DailySalesPrintSummary;
}

const numberValue = firstNumberOrZero;

function itemQuantity(item: ApiEntity) {
  return numberValue(readValue(item, ["qty", "quantity", "order_it_qty", "sale_qty"]));
}

function itemAmount(item: ApiEntity, quantity: number) {
  const explicit = readValue(item, [
    "line_total",
    "net_total",
    "total",
    "amount",
    "gross_total",
    "base_line_total",
    "product_price_total",
  ]);
  if (explicit !== undefined) return numberValue(explicit);
  return numberValue(readValue(item, ["sale_price", "unit_price", "price"])) * quantity;
}

function itemName(item: ApiEntity) {
  return textValue(
    readValue(item, ["product_full_name", "product_name", "prod_name", "name", "item_name"]),
  );
}

function categoryName(item: ApiEntity) {
  return textValue(
    readValue(item, ["group_name", "cate_name", "category_name", "group_name_la", "cate_name_la"]),
  );
}

export function buildDailySalesPrintData({
  bills,
  dateFrom,
  dateTo,
  labels,
  salesGroups = [],
  user,
}: {
  bills: DailySaleItemsBillGroup[];
  dateFrom: string;
  dateTo: string;
  labels: DailySalesPrintLabels;
  salesGroups?: CategorySalesGroup[];
  user: AuthUser;
}): DailySalesPrintData {
  const activeBills = bills.filter((bill) => !bill.cancelled);
  const cancelledBills = bills.filter((bill) => bill.cancelled);
  const categoryMap = new Map<string, Map<string, DailySalesPrintProduct>>();

  activeBills.flatMap((bill) => bill.items).forEach((item) => {
    const category = categoryName(item);
    const name = itemName(item);
    const quantity = itemQuantity(item);
    const amount = itemAmount(item, quantity);
    const products = categoryMap.get(category) ?? new Map<string, DailySalesPrintProduct>();
    const current = products.get(name) ?? { amount: 0, name, quantity: 0 };
    products.set(name, {
      ...current,
      amount: current.amount + amount,
      quantity: current.quantity + quantity,
    });
    categoryMap.set(category, products);
  });

  const fallbackCategories = Array.from(categoryMap, ([name, productMap]) => {
    const products = Array.from(productMap.values());
    return printCategory(name, products);
  });
  const categories = salesGroups.length
    ? salesGroups.map((group) =>
        printCategory(
          group.groupName,
          group.rows.map((row) => ({
            amount: row.productPriceTotal,
            name: row.productName,
            quantity: row.totalQty,
          })),
        ),
      )
    : fallbackCategories;

  const sum = (read: (bill: DailySaleItemsBillGroup) => number) =>
    activeBills.reduce((total, bill) => total + read(bill), 0);

  return {
    branchName: user.branch_name,
    cashier: user.email?.split("@")[0] || user.email || "-",
    categories,
    dateFrom,
    dateTo,
    labels,
    storeName: user.store_name,
    summary: {
      activeBillCount: activeBills.length,
      cancelledAmount: cancelledBills.reduce((total, bill) => total + bill.lineTotal, 0),
      cancelledBillCount: cancelledBills.length,
      cashReceived: sum((bill) => bill.receiveCashAmount),
      change: sum((bill) => bill.changeAmount),
      debt: sum((bill) => bill.debtAmount),
      discount: sum((bill) => bill.discountTotal),
      grandTotal: sum((bill) => bill.lineTotal),
      serviceCharge: sum((bill) => bill.serviceChargeAmount),
      subtotal: sum((bill) => bill.amountTotal),
      totalQuantity: categories.reduce((total, category) => total + category.quantity, 0),
      transferReceived: sum((bill) => bill.receiveTransferAmount),
      vat: sum((bill) => bill.vatAmount),
    },
  };
}

function printCategory(name: string, products: DailySalesPrintProduct[]) {
  return {
    amount: products.reduce((total, product) => total + product.amount, 0),
    name,
    products,
    quantity: products.reduce((total, product) => total + product.quantity, 0),
  };
}

// สไตล์เฉพาะรายงานยอดขายรายวัน: ตารางสามคอลัมน์ (สินค้า | จำนวน | ยอดรวม)
const DAILY_SALES_EXTRA_STYLES = `
      .columns, .row { display: grid; grid-template-columns: minmax(0, 1fr) 11mm 23mm; gap: 1mm; align-items: start; }
      .columns span:nth-child(n+2), .row span:nth-child(n+2) { text-align: right; font-variant-numeric: tabular-nums; }
      .product span:first-child { overflow-wrap: anywhere; }
`;

export function renderDailySalesPrintHtml(data: DailySalesPrintData) {
  const { labels, summary } = data;
  const categories = data.categories.map((category) => `
    <section class="category">
      <h2>${escapeHtml(labels.group)}: ${escapeHtml(category.name)}</h2>
      ${category.products.map((product) => `
        <div class="product row">
          <span>${escapeHtml(product.name)}</span>
          <span>${escapeHtml(formatQuantity(product.quantity))}</span>
          <span>${escapeHtml(money(product.amount))}</span>
        </div>`).join("")}
      <div class="category-total row strong">
        <span>${escapeHtml(labels.categoryTotal)} ${escapeHtml(category.name)}</span>
        <span>${escapeHtml(formatQuantity(category.quantity))}</span>
        <span>${escapeHtml(money(category.amount))}</span>
      </div>
    </section>`).join("");

  const totalRow = (label: string, value: number, strong = false) =>
    receiptTotalRowHtml(label, value, strong ? "grand-total" : "");

  const bodyHtml = `
    ${receiptHeaderHtml({ branchName: data.branchName, storeName: data.storeName, title: labels.title })}
    <div class="divider"></div>
    <section class="meta">
      ${receiptMetaRowHtml(labels.period, `${data.dateFrom} - ${data.dateTo}`)}
      ${receiptMetaRowHtml(labels.billCount, summary.activeBillCount)}
      ${receiptMetaRowHtml(labels.printedBy, data.cashier)}
      ${receiptMetaRowHtml(labels.printedAt, dateTime(new Date().toISOString()))}
    </section>
    <div class="divider"></div>
    <div class="columns strong"><span>${escapeHtml(labels.product)}</span><span>${escapeHtml(labels.quantity)}</span><span>${escapeHtml(labels.totalAmount)}</span></div>
    ${categories || `<p style="text-align:center">-</p>`}
    <div class="divider"></div>
    <section>
      <div class="total-row strong"><span>${escapeHtml(labels.totalQuantity)}</span><span>${escapeHtml(formatQuantity(summary.totalQuantity))}</span></div>
      ${totalRow(labels.subtotal, summary.subtotal)}
      ${totalRow(labels.discount, -summary.discount)}
      ${totalRow(labels.serviceCharge, summary.serviceCharge)}
      ${totalRow(labels.vat, summary.vat)}
      ${totalRow(labels.grandTotal, summary.grandTotal, true)}
    </section>
    <div class="divider"></div>
    <section>
      <h2 class="section-title">${escapeHtml(labels.revenueSummary)}</h2>
      ${totalRow(labels.cashReceived, summary.cashReceived)}
      ${totalRow(labels.transferReceived, summary.transferReceived)}
      ${totalRow(labels.debt, summary.debt)}
      <div class="total-row"><span>${escapeHtml(labels.cancelledBills)} (${summary.cancelledBillCount})</span><span>${escapeHtml(money(summary.cancelledAmount))}</span></div>
    </section>`;

  return receiptDocumentHtml({
    bodyHtml,
    extraStyles: DAILY_SALES_EXTRA_STYLES,
    title: labels.title,
  });
}

function formatQuantity(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

// สรุปย่อสำหรับพิมพ์ผ่าน printer agent — ตัดรายการสินค้า/หมวดหมู่ออกตามการตัดสินใจของ product owner
export function buildDailySalesReportOps(data: DailySalesPrintData): ReportPrintOp[] {
  const { labels, summary } = data;
  const lr = (left: string, right: number, bold = false): ReportPrintOp => ({
    type: "lr",
    left,
    right: money(right),
    bold,
    size: bold ? 26 : 24
  });

  return [
    // ลำดับหัวใบเสร็จต้องตรงกับ receiptHeaderHtml: ชื่อร้าน(หนา) -> ชื่อสาขา -> หัวข้อรายงาน(ใหญ่สุด)
    ...(data.storeName ? [{ type: "text", text: data.storeName, align: "center", bold: true, size: 24 } as ReportPrintOp] : []),
    ...(data.branchName ? [{ type: "text", text: data.branchName, align: "center", size: 22 } as ReportPrintOp] : []),
    { type: "text", text: labels.title, align: "center", bold: true, size: 32 },
    { type: "line" },
    { type: "text", text: `${labels.period}: ${data.dateFrom} - ${data.dateTo}`, align: "left", size: 24 },
    { type: "text", text: `${labels.printedBy}: ${data.cashier}`, align: "left", size: 24 },
    { type: "text", text: `${labels.printedAt}: ${dateTime(new Date().toISOString())}`, align: "left", size: 20 },
    { type: "line" },
    { type: "lr", left: labels.billCount, right: String(summary.activeBillCount), bold: false, size: 24 },
    { type: "lr", left: labels.totalQuantity, right: formatQuantity(summary.totalQuantity), bold: false, size: 24 },
    lr(labels.subtotal, summary.subtotal),
    lr(labels.discount, -summary.discount),
    lr(labels.serviceCharge, summary.serviceCharge),
    lr(labels.vat, summary.vat),
    { type: "line" },
    { ...lr(labels.grandTotal, summary.grandTotal, true), size: 30 },
    { type: "line" },
    { type: "text", text: labels.revenueSummary, align: "center", bold: true, size: 26 },
    lr(labels.cashReceived, summary.cashReceived),
    lr(labels.transferReceived, summary.transferReceived),
    lr(labels.debt, summary.debt),
    { type: "lr", left: `${labels.cancelledBills} (${summary.cancelledBillCount})`, right: money(summary.cancelledAmount), bold: false, size: 22 },
    { type: "blank", n: 2 }
  ];
}
