import { money } from "@/lib/format";

export type InvoicePrintItem = {
  displayTotal: number;
  hasItemDiscount: boolean;
  name: string;
  originalLineTotal: number | null;
  qty: number;
  toppingLabel: string;
  toppingTotal: number | null;
  toppings: InvoicePrintTopping[];
  unitPrice: number | null;
};

export type InvoicePrintTopping = {
  name: string;
  qty: number | null;
  total: number | null;
};

export type InvoicePrintData = {
  branchAddress: string;
  branchName: string;
  branchTel: string;
  cashier: string;
  customer: string | null;
  discount: number;
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
  >;
  contentWidthMm: number;
  paperHeightMm: number;
  paperWidthMm: number;
  printedAt: Date;
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
  const paperWidth = data.paperWidthMm;
  const windowWidth = Math.max(
    Math.round(paperWidth * 4.2),
    window.screen.availWidth || window.innerWidth || 1024
  );
  const windowHeight = window.screen.availHeight || window.innerHeight || 768;
  const printWindow = window.open(
    "",
    "_blank",
    `left=0,top=0,width=${windowWidth},height=${windowHeight},resizable=yes,scrollbars=yes`
  );
  if (!printWindow) return false;

  try {
    printWindow.moveTo(0, 0);
    printWindow.resizeTo(windowWidth, windowHeight);
  } catch {
    // Browser popup policies can block resizing; the window can still print.
  }

  const safeTitle = escapeHtml(
    data.invoice ? `${data.labels.invoice}: ${data.invoice}` : data.title
  );
  printWindow.document.write(
    `<!doctype html><html><head><title>${safeTitle}</title></head><body>Loading print preview...</body></html>`
  );
  printWindow.document.close();

  printWindow.document.open();
  printWindow.document.write(renderLocalInvoiceHtml(data, safeTitle));
  printWindow.document.close();
  return true;
}

export function renderLocalInvoiceHtml(
  data: InvoicePrintData,
  safeTitle: string
) {
  const contentWidth = data.contentWidthMm;
  const paperHeight = data.paperHeightMm;
  const paperWidth = data.paperWidthMm;

  return `<!doctype html>
<html>
  <head>
    <title>${safeTitle}</title>
    <style>
      @page { size: ${paperWidth}mm ${paperHeight}mm; margin: 0; }
      * { box-sizing: border-box; }
      html, body { width: ${paperWidth}mm; min-height: ${paperHeight}mm; margin: 0; background: #fff; color: #111; }
      body {
        font-family: Arial, "Noto Sans Lao", "Segoe UI", sans-serif;
        font-size: 13px;
        line-height: 1.16;
      }
      .paper {
        width: ${contentWidth}mm;
        min-height: ${paperHeight}mm;
        padding: 0;
        margin: 0 auto;
      }
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
        text-align: center;
        line-height: 1.12;
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
        margin-top: 0.25mm;
        padding-top: 0;
        font-size: 16px;
        font-weight: 900;
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
      @media print {
        html, body { width: ${paperWidth}mm; min-height: ${paperHeight}mm; }
        .paper { width: ${contentWidth}mm; min-height: ${paperHeight}mm; margin: 0 auto; }
      }
    </style>
  </head>
  <body>
    <main class="paper">
      ${renderInvoiceHeader(data)}
      <div class="divider"></div>
      ${renderInvoiceMeta(data)}
      <div class="divider"></div>
      ${renderInvoiceItems(data)}
      <div class="divider"></div>
      ${renderInvoiceTotals(data)}
      ${renderInvoiceQr(data)}
      <p class="footer">${escapeHtml(data.labels.thankYou)}</p>
    </main>
    <script>
      window.addEventListener("load", () => {
        window.focus();
        window.setTimeout(() => window.print(), 250);
      });
    </script>
  </body>
</html>`;
}

export function renderInvoiceHeader(data: InvoicePrintData) {
  return `
    <header class="center">
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
    invoiceMetaRow(data.labels.date, formatInvoicePrintDate(data.printedAt)),
    invoiceMetaRow(data.labels.table, data.tableName || "-"),
    invoiceMetaRow(data.labels.cashier, data.cashier),
    data.customer ? invoiceMetaRow(data.labels.customer, data.customer) : "",
  ].join("");
}

export function renderInvoiceItems(data: InvoicePrintData) {
  const rows = data.items.length
    ? data.items.map(renderInvoiceItem).join("")
    : `<section class="item"><div class="center muted">-</div></section>`;

  return `
    <section>
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
      ${renderInvoiceToppings(item)}
    </section>`;
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

export function renderInvoiceQr(data: InvoicePrintData) {
  return data.qrUrl
    ? `<img class="branch-qr" src="${escapeHtml(data.qrUrl)}" alt="" />`
    : "";
}

export function invoiceMetaRow(label: string, value: string) {
  return `<p class="meta">${escapeHtml(label)}: ${escapeHtml(value)}</p>`;
}

export function invoiceTotalRow(label: string, value: string, strong = false) {
  return `<p class="total-row ${strong ? "grand-total" : ""}"><span>${escapeHtml(label)}</span><span>${escapeHtml(value)}</span></p>`;
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
