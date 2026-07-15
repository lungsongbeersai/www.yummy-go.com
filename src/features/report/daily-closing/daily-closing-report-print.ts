import { openWindowOutsideNativeApp } from "@/lib/capacitor-platform";
import { money } from "@/lib/format";
import {
  escapeHtml,
  fullscreenPrintWindowFeatures,
  maximizePrintWindow,
} from "@/features/pos/print/invoice-print-window";
import type { DailyStoreClosingReport } from "@/stores/report-store";
import { dailyClosingLabel } from "./daily-closing-report-utils";

export interface DailyClosingPrintLabels {
  businessDate: string;
  cancelledBills: string;
  cash: string;
  cashier: string;
  credit: string;
  difference: string;
  discount: string;
  grandTotal: string;
  group: string;
  groupTotal: string;
  revenueSummary: string;
  noData: string;
  paymentTotal: string;
  product: string;
  serviceCharge: string;
  title: string;
  totalAmount: string;
  totalQuantity: string;
  transfer: string;
  quantity: string;
  vat: string;
}

export interface DailyClosingPrintData {
  branchName: string;
  businessDate: string;
  cashier: string;
  labels: DailyClosingPrintLabels;
  report: DailyStoreClosingReport;
  storeName: string;
}

// สไตล์ใบเสร็จ 80mm — ใช้ร่วมกันทั้งหน้าต่างพิมพ์ (window.open) และ preview บนหน้าจอ
// เพื่อให้สิ่งที่ผู้ใช้เห็นบนหน้า ตรงกับสิ่งที่ออกจากเครื่องพิมพ์แบบ 1:1
const DAILY_CLOSING_RECEIPT_STYLES = `
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
      @media print { html, body { width: 74mm; } }`;

export function openDailyClosingPrintWindow() {
  const printWindow = openWindowOutsideNativeApp("", "_blank", fullscreenPrintWindowFeatures());
  if (!printWindow) return null;
  maximizePrintWindow(printWindow);
  printWindow.document.write(
    "<!doctype html><html><head><title>Print</title></head><body>Loading print preview...</body></html>",
  );
  printWindow.document.close();
  return printWindow;
}

export function renderDailyClosingPrintWindow(printWindow: Window, data: DailyClosingPrintData) {
  printWindow.document.open();
  printWindow.document.write(renderDailyClosingPrintHtml(data));
  printWindow.document.close();
}

// เนื้อหาใบเสร็จ (ไม่รวม html/head/style/script) เพื่อ reuse ระหว่างหน้าพิมพ์กับ preview บนหน้าจอ
export function renderDailyClosingReceiptBody(data: DailyClosingPrintData) {
  const { labels, report } = data;
  const apiLabels = report.labels;
  const groupLabel = labels.group;
  const groupTotalLabel = dailyClosingLabel(apiLabels.groupTotal, labels.groupTotal);
  const discountLabel = dailyClosingLabel(apiLabels.discountAmount, labels.discount);
  const totalAmountLabel = dailyClosingLabel(apiLabels.totalAmount, labels.totalAmount);
  const groups = report.groups
    .map((group) => {
      const groupName = group.name || dailyClosingLabel(apiLabels.noGroup, "-");
      const groupQuantity = group.items.reduce((total, item) => total + item.totalQty, 0);
      const products = group.items
        .map((item) => `
        <div class="product row">
          <span>${escapeHtml(item.productName || "-")}</span>
          <span>${escapeHtml(formatNumber(item.totalQty))}</span>
          <span>${escapeHtml(money(item.totalAmount))}</span>
        </div>`)
        .join("");

      return `
    <section class="category">
      <h2>${escapeHtml(groupLabel)}: ${escapeHtml(groupName)}</h2>
      ${products || `<p style="text-align:center">${escapeHtml(labels.noData)}</p>`}
      <div class="category-total row strong">
        <span>${escapeHtml(groupTotalLabel)} ${escapeHtml(groupName)}</span>
        <span>${escapeHtml(formatNumber(groupQuantity))}</span>
        <span>${escapeHtml(money(group.totalAmount))}</span>
      </div>
    </section>`;
    })
    .join("");

  return `
    <header>
      ${data.storeName ? `<p class="strong">${escapeHtml(data.storeName)}</p>` : ""}
      ${data.branchName ? `<p>${escapeHtml(data.branchName)}</p>` : ""}
      <h1>${escapeHtml(labels.title)}</h1>
    </header>
    <div class="divider"></div>
    <section class="meta">
      <p>${escapeHtml(labels.businessDate)}: ${escapeHtml(data.businessDate)}</p>
      <p>${escapeHtml(labels.cashier)}: ${escapeHtml(data.cashier)}</p>
    </section>
    <div class="divider"></div>
    <div class="columns strong">
      <span>${escapeHtml(labels.product)}</span>
      <span>${escapeHtml(labels.quantity)}</span>
      <span>${escapeHtml(totalAmountLabel)}</span>
    </div>
    ${groups || `<p style="text-align:center">${escapeHtml(labels.noData)}</p>`}
    <div class="divider"></div>
    <section>
      <div class="total-row strong"><span>${escapeHtml(dailyClosingLabel(apiLabels.totalQty, labels.totalQuantity))}</span><span>${escapeHtml(formatNumber(report.summary.totalQty))}</span></div>
      ${totalRow(totalAmountLabel, report.summary.totalAmount)}
      ${totalRow(discountLabel, -report.summary.discountAmount)}
      ${totalRow(dailyClosingLabel(apiLabels.serviceCharge, labels.serviceCharge), report.summary.serviceCharge)}
      ${totalRow(dailyClosingLabel(apiLabels.vat, labels.vat), report.summary.vat)}
      ${totalRow(dailyClosingLabel(apiLabels.grandTotal, labels.grandTotal), report.summary.grandTotal, "grand-total")}
    </section>
    <div class="divider"></div>
    <section>
      <h2 class="section-title">${escapeHtml(labels.revenueSummary)}</h2>
      ${totalRow(dailyClosingLabel(apiLabels.cash, labels.cash), report.paymentSummary.cash)}
      ${totalRow(dailyClosingLabel(apiLabels.transfer, labels.transfer), report.paymentSummary.transfer)}
      ${totalRow(dailyClosingLabel(apiLabels.credit, labels.credit), report.paymentSummary.credit)}
      ${totalRow(dailyClosingLabel(apiLabels.paymentTotal, labels.paymentTotal), report.paymentSummary.paymentTotal, "strong")}
      ${totalRow(labels.difference, report.paymentSummary.paymentTotal - report.summary.grandTotal)}
      <div class="total-row"><span>${escapeHtml(dailyClosingLabel(apiLabels.cancelBill, labels.cancelledBills))} (${escapeHtml(formatNumber(report.cancelSummary.billCount))})</span><span>${escapeHtml(money(report.cancelSummary.totalAmount))}</span></div>
    </section>`;
}

export function renderDailyClosingPrintHtml(data: DailyClosingPrintData) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(data.labels.title)}</title>
    <style>${DAILY_CLOSING_RECEIPT_STYLES}
    </style>
  </head>
  <body>
    ${renderDailyClosingReceiptBody(data)}
    <script>window.addEventListener("load", () => { window.focus(); window.setTimeout(() => window.print(), 250); });</script>
  </body>
</html>`;
}

// เอกสาร preview บนหน้าจอ — ใช้เนื้อหา/สไตล์ชุดเดียวกับหน้าพิมพ์ แต่ไม่มีสคริปต์สั่งพิมพ์
// จัดใบเสร็จให้อยู่กึ่งกลางเฟรม เพื่อให้ดูเหมือนกระดาษใบเสร็จจริง
export function renderDailyClosingReceiptPreviewDoc(data: DailyClosingPrintData) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>${DAILY_CLOSING_RECEIPT_STYLES}
      html, body { margin-left: auto; margin-right: auto; }
      body { padding: 3mm 0; }
    </style>
  </head>
  <body>
    ${renderDailyClosingReceiptBody(data)}
  </body>
</html>`;
}

function totalRow(label: string, value: number, className = "") {
  const displayValue = Object.is(value, -0) ? 0 : value;

  return `
    <div class="total-row${className ? ` ${className}` : ""}"><span>${escapeHtml(label)}</span><span>${escapeHtml(money(displayValue))}</span></div>`;
}

function formatNumber(value: number) {
  return Number.isInteger(value)
    ? value.toLocaleString("en-US")
    : value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}
