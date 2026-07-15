import { money } from "@/lib/format";
import { openWindowOutsideNativeApp } from "@/lib/capacitor-platform";
import type { ApiEntity } from "@/services/shared/types";
import type { AuthUser } from "@/stores/auth-store";
import type {
  CategorySalesGroup,
  DailySaleItemsBillGroup,
} from "@/stores/report-store";
import {
  escapeHtml,
  fullscreenPrintWindowFeatures,
  maximizePrintWindow,
} from "@/features/pos/print/invoice-print-window";

export interface DailySalesPrintLabels {
  billCount: string;
  cancelledBills: string;
  cashReceived: string;
  categoryTotal: string;
  change: string;
  debt: string;
  discount: string;
  grandTotal: string;
  group: string;
  period: string;
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

function numberValue(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function textValue(value: unknown, fallback = "-") {
  return value === null || value === undefined || value === ""
    ? fallback
    : String(value);
}

function readValue(row: ApiEntity, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value !== null && value !== undefined && value !== "") return value;
  }
  return undefined;
}

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

export function openDailySalesPrintWindow() {
  const printWindow = openWindowOutsideNativeApp("", "_blank", fullscreenPrintWindowFeatures());
  if (!printWindow) return null;
  maximizePrintWindow(printWindow);
  printWindow.document.write("<!doctype html><html><head><title>Print</title></head><body>Loading print preview...</body></html>");
  printWindow.document.close();
  return printWindow;
}

export function renderDailySalesPrintWindow(printWindow: Window, data: DailySalesPrintData) {
  printWindow.document.open();
  printWindow.document.write(renderDailySalesPrintHtml(data));
  printWindow.document.close();
}

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

  const totalRow = (label: string, value: number, strong = false) => `
    <div class="total-row${strong ? " grand-total" : ""}"><span>${escapeHtml(label)}</span><span>${escapeHtml(money(value))}</span></div>`;

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(labels.title)}</title>
    <style>
      @page { size: 80mm 297mm; margin: 3mm; }
      * { box-sizing: border-box; }
      html, body { width: 74mm; margin: 0; background: #fff; color: #111; }
      body { font-family: "Noto Sans Lao", "Segoe UI", sans-serif; font-size: 11px; line-height: 1.3; }
      header { text-align: center; }
      h1 { margin: 1mm 0; font-size: 16px; line-height: 1.2; }
      h2 { margin: 2mm 0 1mm; font-size: 12px; }
      p { margin: 0.4mm 0; }
      .divider { border-top: 1px dashed #111; margin: 1.5mm 0; }
      .columns, .row { display: grid; grid-template-columns: minmax(0, 1fr) 11mm 23mm; gap: 1mm; align-items: start; }
      .columns span:nth-child(n+2), .row span:nth-child(n+2) { text-align: right; font-variant-numeric: tabular-nums; }
      .product { padding: 0.65mm 0; border-bottom: 1px dotted #bbb; }
      .product span:first-child { overflow-wrap: anywhere; }
      .strong { font-weight: 800; }
      .category-total { padding: 1mm 0; border-bottom: 1px solid #111; }
      .total-row { display: flex; justify-content: space-between; gap: 2mm; padding: 0.45mm 0; }
      .total-row span:last-child { flex-shrink: 0; text-align: right; font-variant-numeric: tabular-nums; }
      .grand-total { margin-top: 0.8mm; padding: 1mm 0; border-top: 1px solid #111; border-bottom: 1px double #111; font-size: 14px; font-weight: 900; }
      .section-title { text-align: center; }
      .meta { text-align: left; }
      @media print { html, body { width: 74mm; } }
    </style>
  </head>
  <body>
    <header>
      ${data.storeName ? `<p class="strong">${escapeHtml(data.storeName)}</p>` : ""}
      ${data.branchName ? `<p>${escapeHtml(data.branchName)}</p>` : ""}
      <h1>${escapeHtml(labels.title)}</h1>
    </header>
    <div class="divider"></div>
    <section class="meta">
      <p>${escapeHtml(labels.period)}: ${escapeHtml(data.dateFrom)} - ${escapeHtml(data.dateTo)}</p>
      <p>${escapeHtml(labels.billCount)}: ${summary.activeBillCount}</p>
      <p>Cashier: ${escapeHtml(data.cashier)}</p>
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
      ${totalRow(labels.change, summary.change)}
      ${totalRow(labels.debt, summary.debt)}
      <div class="total-row"><span>${escapeHtml(labels.cancelledBills)} (${summary.cancelledBillCount})</span><span>${escapeHtml(money(summary.cancelledAmount))}</span></div>
    </section>
    <script>window.addEventListener("load", () => { window.focus(); window.setTimeout(() => window.print(), 250); });</script>
  </body>
</html>`;
}

function formatQuantity(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}
