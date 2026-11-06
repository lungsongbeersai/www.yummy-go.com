import { money } from "@/lib/format";
import { openWindowOutsideNativeApp } from "@/lib/capacitor-platform";
import {
  WINDOW_OPEN_FONT_CLASS_NAME,
  WINDOW_OPEN_FONT_STYLESHEET_LINK,
  WINDOW_OPEN_PRINT_ON_LOAD_SCRIPT,
} from "@/lib/window-open-fonts";

// Measure after the print fonts load so money values fit beside their labels
// without wrapping, truncating digits, or relying on estimated glyph widths.
export const INVOICE_TOTAL_FIT_SCRIPT = `
  const fitInvoiceTotals = () => {
    for (const row of document.querySelectorAll(".grand-total, .exchange-row")) {
      const parts = Array.from(row.querySelectorAll("span"));
      if (parts.length !== 2) continue;
      for (const part of parts) part.style.removeProperty("font-size");
      const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
      const available = row.getBoundingClientRect().width - gap - 1;
      const width = parts.reduce((sum, part) => sum + part.getBoundingClientRect().width, 0);
      const scale = Math.min(1, available / width);
      if (scale > 0 && scale < 1) {
        for (const part of parts) {
          part.style.fontSize = (parseFloat(getComputedStyle(part).fontSize) * scale) + "px";
        }
      }
    }
  };
  window.addEventListener("load", () =>
    Promise.resolve(document.fonts?.ready).finally(fitInvoiceTotals));
  window.addEventListener("beforeprint", fitInvoiceTotals);
`;

export type InvoicePrintItem = {
  displayTotal: number;
  hasItemDiscount: boolean;
  mergeKey?: string;
  name: string;
  originalLineTotal: number | null;
  qty: number;
  toppingLabel: string;
  toppingTotal: number | null;
  toppings: InvoicePrintTopping[];
  tastes?: InvoicePrintTaste[];
  unitPrice: number | null;
};

export type InvoicePrintTopping = {
  name: string;
  qty: number | null;
  total: number | null;
};

export type InvoicePrintTaste = {
  name: string;
};

export type InvoicePrintExchangeRate = {
  code: "THB" | "USD" | string;
  rate: number;
};

export type InvoicePrintPayment = {
  paidCash: number;
  paidTransfer: number;
  paidTotal: number;
  change: number;
  label: string;
  currency: string;
  exchangeRate: number;
  foreignPaid: number;
  paidLak: number;
  changeLak: number;
  isCredit?: boolean;
  debtAmount?: number;
  creditPaidTotal?: number;
  creditBalance?: number;
  dueDate?: string;
};

function invoicePrintNumber(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function invoicePrintPerUnit(value: number | null, qty: number) {
  if (value === null) return null;
  return qty > 0
    ? invoicePrintNumber(value / qty)
    : invoicePrintNumber(value);
}

function invoicePrintToppingKey(
  topping: InvoicePrintTopping,
  itemQty: number,
) {
  return JSON.stringify([
    topping.name.trim(),
    topping.qty,
    invoicePrintPerUnit(topping.total, itemQty),
  ]);
}

function invoicePrintItemKey(item: InvoicePrintItem) {
  return JSON.stringify([
    item.mergeKey ?? "",
    item.name.trim(),
    item.unitPrice,
    item.hasItemDiscount,
    invoicePrintPerUnit(item.displayTotal, item.qty),
    invoicePrintPerUnit(item.originalLineTotal, item.qty),
    item.toppingLabel,
    (item.tastes ?? []).map((taste) => taste.name.trim()).sort(),
    invoicePrintPerUnit(item.toppingTotal, item.qty),
    item.toppings
      .map((topping) => invoicePrintToppingKey(topping, item.qty))
      .sort(),
  ]);
}

/**
 * Combine equivalent rows only in the invoice/receipt projection. The cart
 * keeps its original rows so staff can still see each ordering round.
 */
export function mergeInvoicePrintItems(items: InvoicePrintItem[]) {
  const merged: InvoicePrintItem[] = [];
  const byKey = new Map<string, InvoicePrintItem>();

  items.forEach((source) => {
    const item: InvoicePrintItem = {
      ...source,
      ...(source.tastes
        ? { tastes: source.tastes.map((taste) => ({ ...taste })) }
        : {}),
      toppings: source.toppings.map((topping) => ({ ...topping })),
    };
    const key = invoicePrintItemKey(item);
    const existing = byKey.get(key);

    if (!existing) {
      byKey.set(key, item);
      merged.push(item);
      return;
    }

    const existingQty = existing.qty;
    item.toppings.forEach((topping) => {
      const toppingKey = invoicePrintToppingKey(topping, item.qty);
      const target = existing.toppings.find(
        (candidate) =>
          invoicePrintToppingKey(candidate, existingQty) === toppingKey,
      );
      if (!target || topping.total === null) return;
      target.total = invoicePrintNumber((target.total ?? 0) + topping.total);
    });

    existing.qty = invoicePrintNumber(existing.qty + item.qty);
    existing.displayTotal = invoicePrintNumber(
      existing.displayTotal + item.displayTotal,
    );
    if (item.originalLineTotal !== null) {
      existing.originalLineTotal = invoicePrintNumber(
        (existing.originalLineTotal ?? 0) + item.originalLineTotal,
      );
    }
    if (item.toppingTotal !== null) {
      existing.toppingTotal = invoicePrintNumber(
        (existing.toppingTotal ?? 0) + item.toppingTotal,
      );
    }
  });

  return merged;
}

export type InvoicePrintData = {
  logoUrl?: string | null;
  branchAddress: string;
  branchName: string;
  branchTel: string;
  cashier: string;
  customer: string | null;
  discount: number;
  exchangeRates?: InvoicePrintExchangeRate[];
  invoice: string | null;
  items: InvoicePrintItem[];
  labels: Record<
    | "address"
    | "cashier"
    | "customer"
    | "date"
    | "discount"
    | "invoice"
    | "price"
    | "service"
    | "subtotal"
    | "table"
    | "thankYou"
    | "title"
    | "topping"
    | "total"
    | "vat",
    string
  > & {
    amountDueByCurrency?: string;
    currentExchangeRate?: string;
    item?: string;
    amount?: string;
    paidCash?: string;
    paidTransfer?: string;
    paidTotal?: string;
    change?: string;
    payment?: string;
    foreignPaid?: string;
    debtAmount?: string;
    creditPaidTotal?: string;
    creditBalance?: string;
    dueDate?: string;
  };

  contentWidthMm: number;
  paperHeightMm: number;
  paperWidthMm: number;
  payment?: InvoicePrintPayment;
  printedAt: Date;
  saleDateTime?: string;
  qrUrl: string | null;
  service: number;
  storeName: string;
  subtotal: number;
  tableName: string;
  title: string;
  total: number;
  vat: number;
};

export async function openLocalInvoicePrintWindow(data: InvoicePrintData) {
  return openLocalInvoiceBatchPrintWindow([data]);
}

export async function openLocalInvoiceBatchPrintWindow(
  dataList: InvoicePrintData[]
) {
  if (!dataList.length) return false;

  const reservation = reserveInvoicePrintWindow();
  if (!reservation) return false;
  const rendered = reservation.renderBatch(dataList);
  if (!rendered) reservation.closeUnused();
  return rendered;
}

export type LocalInvoicePrintWindowReservation = {
  render(data: InvoicePrintData): boolean;
  closeUnused(): void;
};

/** Open during the click gesture; populate only after the server confirms its snapshot. */
export function reserveLocalInvoicePrintWindow(): LocalInvoicePrintWindowReservation | null {
  return reserveInvoicePrintWindow();
}

function reserveInvoicePrintWindow(): (LocalInvoicePrintWindowReservation & {
  renderBatch(dataList: InvoicePrintData[]): boolean;
}) | null {
  let printWindow: Window | null;
  try {
    printWindow = openWindowOutsideNativeApp(
      "",
      "_blank",
      fullscreenPrintWindowFeatures(),
    );
  } catch {
    return null;
  }
  if (!printWindow || printWindow.closed) return null;

  const popup = printWindow;
  let rendered = false;
  let discarded = false;
  const closeUnused = () => {
    if (rendered || discarded) return;
    discarded = true;
    try {
      if (!popup.closed) popup.close();
    } catch {
      // A closed or navigated preview no longer belongs to this operation.
    }
  };
  try {
    maximizePrintWindow(popup);
    popup.document.write(
      `<!doctype html><html><head>${WINDOW_OPEN_FONT_STYLESHEET_LINK}<title>Print preview</title></head><body class="${WINDOW_OPEN_FONT_CLASS_NAME}">Loading print preview...</body></html>`,
    );
    popup.document.close();
  } catch {
    closeUnused();
    return null;
  }

  const renderBatch = (dataList: InvoicePrintData[]) => {
    if (rendered || discarded || !dataList.length) return false;
    try {
      if (popup.closed) return false;
      const first = dataList[0];
      const safeTitle = escapeHtml(
        dataList.length > 1
          ? `${first.title} (${dataList.length})`
          : first.invoice
            ? `${first.labels.invoice}: ${first.invoice}`
            : first.title,
      );
      popup.document.open();
      popup.document.write(renderLocalInvoiceBatchHtml(dataList, safeTitle));
      // Mark ownership before close(), which can synchronously run print scripts.
      rendered = true;
      popup.document.close();
      return true;
    } catch {
      return false;
    }
  };
  return { render: (data) => renderBatch([data]), renderBatch, closeUnused };
}

export function fullscreenPrintWindowFeatures() {
  const width = window.screen.availWidth || window.innerWidth || 1024;
  const height = window.screen.availHeight || window.innerHeight || 768;
  return [
    "left=0",
    "top=0",
    "screenX=0",
    "screenY=0",
    `width=${width}`,
    `height=${height}`,
    "resizable=yes",
    "scrollbars=yes",
    "fullscreen=yes"
  ].join(",");
}

export function maximizePrintWindow(printWindow: Window) {
  const width = window.screen.availWidth || window.innerWidth || 1024;
  const height = window.screen.availHeight || window.innerHeight || 768;
  try {
    printWindow.moveTo(0, 0);
    printWindow.resizeTo(width, height);
  } catch {
    // Browser popup policies can block resizing; the window can still print.
  }
}

export function renderLocalInvoiceBatchHtml(
  dataList: InvoicePrintData[],
  safeTitle: string,
  autoPrint = true,
) {
  const first = dataList[0];
  const contentWidth = first.contentWidthMm;
  const paperHeight = first.paperHeightMm;
  const paperWidth = first.paperWidthMm;

  const receipts = dataList
    .map(
      (data, index) => `
    <section class="receipt${index === dataList.length - 1 ? " receipt-last" : ""}">
      ${renderInvoiceReceiptBody(data)}
    </section>`
    )
    .join("");

  return `<!doctype html>
<html>
  <head>
    ${WINDOW_OPEN_FONT_STYLESHEET_LINK}
    <title>${safeTitle}</title>
    <style>
      @page { size: ${paperWidth}mm ${paperHeight}mm; margin: 0; }
      * { box-sizing: border-box; }
      html, body { width: ${paperWidth}mm; margin: 0; background: #fff; color: #111; }
      body {
        font-size: 13px;
        line-height: 1.16;
      }
      .receipt {
        width: ${contentWidth}mm;
        min-height: ${paperHeight}mm;
        padding: 0;
        margin: 0 auto;
        break-after: page;
        page-break-after: always;
      }
      .receipt-last {
        break-after: auto;
        page-break-after: auto;
      }
      ${invoiceSharedStyles(paperWidth)}
      @media print {
        html, body { width: ${paperWidth}mm; }
        .receipt { width: ${contentWidth}mm; min-height: ${paperHeight}mm; margin: 0 auto; }
      }
    </style>
  </head>
  <body class="${WINDOW_OPEN_FONT_CLASS_NAME}">
    ${receipts}
    <script>${INVOICE_TOTAL_FIT_SCRIPT}</script>
    ${autoPrint ? `<script>${WINDOW_OPEN_PRINT_ON_LOAD_SCRIPT}</script>` : ""}
  </body>
</html>`;
}

export function renderLocalInvoiceHtml(
  data: InvoicePrintData,
  safeTitle: string,
  autoPrint = true,
) {
  return renderLocalInvoiceBatchHtml([data], safeTitle, autoPrint);
}

export function renderInvoiceSystemPrintHtml(data: InvoicePrintData) {
  const safeTitle = escapeHtml(
    data.invoice
      ? `${data.labels.invoice}: ${data.invoice}`
      : data.title,
  );
  return renderLocalInvoiceHtml(data, safeTitle, false);
}

function renderInvoiceReceiptBody(data: InvoicePrintData) {
  return `
      ${renderInvoiceHeader(data)}
      <div class="divider"></div>
      ${renderInvoiceMeta(data)}
      ${renderInvoiceItems(data)}
      <div class="divider"></div>
      ${renderInvoiceTotals(data)}
      ${renderInvoicePayment(data)}
      ${renderInvoiceExchangeRates(data)}
      ${renderInvoiceQr(data)}
      <p class="footer">${escapeHtml(data.labels.thankYou)}</p>`;
}

function invoiceSharedStyles(paperWidthMm: number) {
  return `
      .center { text-align: center; }
      .strong { font-weight: 800; }
      .store {
        margin: 0;
        font-size: 20px;
        font-weight: 900;
        line-height: 1.12;
      }
      .muted {
        margin: 0;
        color: #333;
        line-height: 1.14;
      }
      .title {
        margin: 0.9mm 0 0.4mm;
        font-size: 18px;
        font-weight: 900;
        /* The print font only includes regular glyphs; retain their shape while strengthening the title. */
        -webkit-text-stroke: 0.3px currentColor;
        text-align: center;
        line-height: 1.12;
      }
      .exchange-heading {
        margin: 0;
        font-size: 17px;
        font-weight: 900;
        text-align: center;
        line-height: 1.16;
      }
      .exchange-heading-lao {
        /* Saysettha has no bold face; strengthen this heading's original glyphs. */
        -webkit-text-stroke: 0.3px currentColor;
      }
      .exchange-rates {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        row-gap: 1px;
        min-width: 0;
      }
      .exchange-row {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 1mm;
        min-width: 0;
        margin: 0;
        font-family: Arial, sans-serif !important;
        font-size: ${paperWidthMm <= 58 ? 14 : 15}px;
        font-weight: 700;
        line-height: 1.05;
      }
      .exchange-row > span {
        font-family: inherit !important;
        flex: 0 0 auto;
        white-space: nowrap;
      }
      .exchange-row .exchange-amount {
        font-family: Arial, sans-serif !important;
        font-size: ${paperWidthMm <= 58 ? 18 : 20}px;
        font-weight: 700;
        line-height: 1.05;
        text-align: right;
        font-variant-numeric: tabular-nums;
      }
      .exchange-rate {
        margin: 0;
        font-size: ${paperWidthMm <= 58 ? 11 : 12}px;
        font-weight: 400;
        line-height: 1.05;
        overflow-wrap: anywhere;
      }
      .divider {
        height: 0;
        margin: 0.8mm 0;
        border-top: 1px dashed #111;
      }
      .total-row,
      .item-main,
      .item-meta {
        display: flex;
        justify-content: space-between;
        gap: 2mm;
      }
      .meta {
        margin: 0;
        line-height: 1.16;
        font-variant-numeric: tabular-nums;
      }
      .total-row span:first-child {
        min-width: 0;
      }
      .total-row span:last-child,
      .item-total {
        flex-shrink: 0;
        text-align: right;
        font-variant-numeric: tabular-nums;
      }
      .item-original-total {
        flex-shrink: 0;
        color: #555;
        font-variant-numeric: tabular-nums;
        text-align: right;
        text-decoration: line-through;
        text-decoration-thickness: 1px;
      }
      .totals {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        min-width: 0;
        gap: 0.45mm;
      }
      .total-row {
        margin: 0;
        line-height: 1.16;
      }
      .item {
        padding: 0.7mm 0;
        border-bottom: 1px dashed #d4d4d4;
      }
      .item-heading {
        margin-top: 0.8mm;
        padding: 0.8mm 0;
        border-top: 1px dashed #111;
        border-bottom: 1px dashed #111;
      }
      .item-heading > span {
        font-weight: 900;
      }
      .item-heading .item-heading-lao {
        -webkit-text-stroke: 0.3px currentColor;
      }
      .item-name {
        min-width: 0;
        font-weight: 800;
        overflow-wrap: anywhere;
      }
      .item-meta {
        margin-top: 0.25mm;
        color: #333;
        font-size: 12px;
      }
      .toppings {
        display: grid;
        gap: 0.25mm;
        margin-top: 0.35mm;
        color: #333;
        font-size: 12px;
      }
      .topping-line {
        display: flex;
        justify-content: space-between;
        gap: 2mm;
      }
      .topping-line span:first-child {
        min-width: 0;
        overflow-wrap: anywhere;
      }
      .topping-line span:last-child {
        flex-shrink: 0;
        text-align: right;
        font-variant-numeric: tabular-nums;
      }
      .grand-total {
        display: flex;
        flex-wrap: nowrap;
        align-items: baseline;
        gap: 1mm;
        width: 100%;
        margin-top: 0.8mm;
        padding-top: 0;
        font-size: ${paperWidthMm <= 58 ? 18 : 20}px;
        font-weight: 900;
      }
      .grand-total span {
        flex: 0 0 auto;
        white-space: nowrap;
      }
      .grand-total .payable-label-lao {
        -webkit-text-stroke: 0.3px currentColor;
      }
      .grand-total span:last-child {
        min-width: 0;
        font-size: ${paperWidthMm <= 58 ? 26 : 30}px;
        font-weight: 900;
        line-height: 1.14;
      }
      .footer {
        margin-top: 2mm;
        text-align: center;
        font-size: 13px;
        font-weight: 700;
      }
      .branch-qr {
        display: block;
        width: 58mm;
        max-width: 100%;
        height: auto;
        margin: 2.4mm auto 1.6mm;
        object-fit: contain;
      }
      .branch-logo {
        display: block;
        max-width: 32mm;
        max-height: 26mm;
        width: auto;
        height: auto;
        margin: 0 auto 1.5mm;
        object-fit: contain;
      }`;
}

export function renderInvoiceHeader(data: InvoicePrintData) {
  return `
    <header class="center">
      ${data.logoUrl ? `<img class="branch-logo" src="${escapeHtml(data.logoUrl)}" alt="" />` : ""}
      ${data.storeName ? `<p class="store">${escapeHtml(data.storeName)}</p>` : ""}
      ${data.branchName ? `<p class="muted">${escapeHtml(data.branchName)}</p>` : ""}
      ${data.branchTel ? `<p class="muted">${escapeHtml(data.branchTel)}</p>` : ""}
      ${data.branchAddress ? `<p class="muted">${escapeHtml(data.branchAddress)}</p>` : ""}
      <p class="title">${escapeHtml(data.title)}</p>
    </header>`;
}

export function renderInvoiceMeta(data: InvoicePrintData) {
  return [
    invoiceMetaRow(data.labels.invoice, data.invoice ?? "-"),
    invoiceMetaRow(data.labels.date, data.saleDateTime || formatInvoicePrintDate(data.printedAt)),
    invoiceMetaRow(data.labels.table, data.tableName || "-"),
    invoiceMetaRow(data.labels.cashier, data.cashier),
    data.customer ? invoiceMetaRow(data.labels.customer, data.customer) : "",
  ].join("");
}

export function renderInvoiceItems(data: InvoicePrintData) {
  const itemLabel = data.labels.item ?? "Item";
  const amountLabel = data.labels.amount ?? "Amount";
  const laoHeadingClass = (label: string) => /[\u0E80-\u0EFF]/.test(label) ? " item-heading-lao" : "";
  const items = mergeInvoicePrintItems(data.items);
  const rows = items.length
    ? items.map(renderInvoiceItem).join("")
    : `<section class="item"><div class="center muted">-</div></section>`;

  return `
    <section>
      <div class="item-main strong item-heading">
        <span class="item-name${laoHeadingClass(itemLabel)}">${escapeHtml(itemLabel)}</span>
        <span class="item-total${laoHeadingClass(amountLabel)}">${escapeHtml(amountLabel)}</span>
      </div>
      ${rows}
    </section>`;
}

export function renderInvoiceItem(item: InvoicePrintItem) {
  return `
    <section class="item">
      <div class="item-main">
        <span class="item-name">${escapeHtml(item.name)}</span>
        <span class="item-total">${escapeHtml(money(item.displayTotal))}</span>
      </div>
      <div class="item-meta">
        <span>${escapeHtml(formatInvoiceQty(item.qty))} x ${escapeHtml(item.unitPrice === null ? "-" : money(item.unitPrice))}</span>
        ${renderInvoiceOriginalLineTotal(item)}
      </div>
      ${renderInvoiceTastes(item)}
      ${renderInvoiceToppings(item)}
    </section>`;
}

export function renderInvoiceTastes(item: InvoicePrintItem) {
  const tastes = item.tastes ?? [];
  if (!tastes.length) return "";
  return `<div class="toppings">${tastes
    .map((taste) => `<div class="topping-line"><span>• ${escapeHtml(taste.name)}</span></div>`)
    .join("")}</div>`;
}

export function renderInvoiceOriginalLineTotal(item: InvoicePrintItem) {
  return item.hasItemDiscount && item.originalLineTotal !== null
    ? `<span class="item-original-total">${escapeHtml(money(item.originalLineTotal))}</span>`
    : "";
}

export function renderInvoiceToppings(item: InvoicePrintItem) {
  if (item.toppings.length) {
    return `<div class="toppings">${item.toppings.map(renderInvoiceTopping).join("")}</div>`;
  }

  if (item.toppingTotal !== null && item.toppingTotal > 0) {
    return `<div class="toppings"><div class="topping-line"><span>+ ${escapeHtml(item.toppingLabel)}</span><span>+${escapeHtml(money(item.toppingTotal))}</span></div></div>`;
  }

  return "";
}

export function renderInvoiceTopping(topping: InvoicePrintTopping) {
  const qty = topping.qty !== null ? ` x ${formatInvoiceQty(topping.qty)}` : "";
  const total =
    topping.total !== null
      ? `<span>+${escapeHtml(money(topping.total))}</span>`
      : "";
  return `<div class="topping-line"><span>+ ${escapeHtml(topping.name)}${escapeHtml(qty)}</span>${total}</div>`;
}

export function renderInvoiceTotals(data: InvoicePrintData) {
  return `<section class="totals">${[
    invoiceTotalRow(data.labels.subtotal, money(data.subtotal)),
    data.discount > 0
      ? invoiceTotalRow(data.labels.discount, `-${money(data.discount)}`)
      : "",
    data.service > 0
      ? invoiceTotalRow(data.labels.service, money(data.service))
      : "",
    data.vat > 0 ? invoiceTotalRow(data.labels.vat, money(data.vat)) : "",
    invoiceTotalRow(data.labels.total, money(data.total), true),
  ].join("")}</section>`;
}

export function renderInvoicePayment(data: InvoicePrintData) {
  const payment = data.payment;
  if (!payment) return "";
  return `<div class="divider"></div><section class="totals payment-summary">${[
    payment.label ? invoiceTotalRow(data.labels.payment ?? "Payment", payment.label) : "",
    payment.paidCash > 0 ? invoiceTotalRow(data.labels.paidCash ?? "Cash received", money(payment.paidCash)) : "",
    payment.paidTransfer > 0 ? invoiceTotalRow(data.labels.paidTransfer ?? "Transfer received", money(payment.paidTransfer)) : "",
    invoiceTotalRow(data.labels.paidTotal ?? "Amount received", money(
      payment.isCredit ? payment.paidCash + payment.paidTransfer : payment.paidTotal,
    )),
    invoiceTotalRow(data.labels.change ?? "Change", money(payment.change)),
    payment.currency && payment.currency !== "LAK" && payment.foreignPaid > 0
      ? invoiceTotalRow(
          data.labels.foreignPaid ?? "Foreign currency received",
          `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(payment.foreignPaid)} ${payment.currency}`,
        )
      : "",
    payment.isCredit && payment.debtAmount !== undefined
      ? invoiceTotalRow(data.labels.debtAmount ?? "Debt", money(payment.debtAmount)) : "",
    payment.isCredit && payment.creditPaidTotal !== undefined
      ? invoiceTotalRow(data.labels.creditPaidTotal ?? "Credit repayments", money(payment.creditPaidTotal)) : "",
    payment.isCredit && payment.creditBalance !== undefined
      ? invoiceTotalRow(data.labels.creditBalance ?? "Credit balance", money(payment.creditBalance)) : "",
    payment.isCredit && payment.dueDate
      ? invoiceTotalRow(data.labels.dueDate ?? "Due date", payment.dueDate) : "",
  ].join("")}</section>`;
}

export function renderInvoiceExchangeRates(data: InvoicePrintData) {
  if (!data.exchangeRates?.length) return "";
  const heading = data.labels.currentExchangeRate ?? "Current Exchange Rate";
  const laoHeadingClass = /[\u0E80-\u0EFF]/.test(heading) ? " exchange-heading-lao" : "";

  return `
    <div class="divider"></div>
    <section class="exchange-rates">
      <p class="exchange-heading${laoHeadingClass} strong">${escapeHtml(heading)}</p>
      ${data.exchangeRates
        .map((item) => `<div class="exchange-group"><p class="exchange-row"><span>${escapeHtml(item.code)}</span><span class="exchange-amount">${escapeHtml(formatInvoiceForeignDue(data.total, item.rate))}</span></p><p class="exchange-rate">1 ${escapeHtml(item.code)} = ${escapeHtml(formatInvoiceExchangeRate(item.rate))} LAK</p></div>`)
        .join("")}
    </section>`;
}

export function formatInvoiceExchangeRate(value: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6,
  }).format(value);
}

export function formatInvoiceForeignDue(totalLak: number, rate: number) {
  const due = rate > 0 ? Math.ceil((totalLak / rate) * 100) / 100 : 0;
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(due);
}

export function renderInvoiceQr(data: InvoicePrintData) {
  return data.qrUrl
    ? `<img class="branch-qr" src="${escapeHtml(data.qrUrl)}" alt="" />`
    : "";
}

export function invoiceMetaRow(label: string, value: string) {
  return `<p class="meta">${escapeHtml(label)}: ${escapeHtml(value)}</p>`;
}

export function invoiceTotalRow(label: string, value: string, strong = false) {
  const laoLabelClass = strong && /[\u0E80-\u0EFF]/.test(label) ? ' class="payable-label-lao"' : "";
  return `<p class="total-row ${strong ? "grand-total" : ""}"><span${laoLabelClass}>${escapeHtml(label)}</span><span>${escapeHtml(value)}</span></p>`;
}

export function formatInvoiceQty(value: number) {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

export function formatInvoicePrintDate(value: Date) {
  return value.toLocaleString();
}

export function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => {
    if (char === "&") return "&amp;";
    if (char === "<") return "&lt;";
    if (char === ">") return "&gt;";
    if (char === '"') return "&quot;";
    return "&#39;";
  });
}
