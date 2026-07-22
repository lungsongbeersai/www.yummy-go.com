import { openWindowOutsideNativeApp } from "@/lib/capacitor-platform";
import { money } from "@/lib/format";
import {
  WINDOW_OPEN_FONT_CLASS_NAME,
  WINDOW_OPEN_FONT_STYLESHEET_LINK,
  WINDOW_OPEN_PRINT_ON_LOAD_SCRIPT,
} from "@/lib/window-open-fonts";
import {
  escapeHtml,
  fullscreenPrintWindowFeatures,
  maximizePrintWindow,
} from "@/services/printer/invoice-print-window";

// ฐานสไตล์ใบเสร็จ 80mm ที่ทุกรายงานใช้ร่วมกัน — สิ่งที่เห็นบนจอต้องตรงกับ
// สิ่งที่ออกจากเครื่องพิมพ์ 1:1 แต่ละรายงานเพิ่มเฉพาะ layout คอลัมน์ของตัวเอง
export const RECEIPT_80MM_BASE_STYLES = `
      @page { size: 80mm 297mm; margin: 3mm; }
      * { box-sizing: border-box; }
      html, body { width: 74mm; margin: 0; background: #fff; color: #111; }
      body { font-size: 11px; line-height: 1.3; }
      header { text-align: center; }
      h1 { margin: 1mm 0; font-size: 16px; line-height: 1.2; }
      h2 { margin: 2mm 0 1mm; font-size: 12px; }
      p { margin: 0.4mm 0; }
      .divider { border-top: 1px dashed #111; margin: 1.5mm 0; }
      .product { padding: 0.65mm 0; border-bottom: 1px dotted #bbb; }
      .strong { font-weight: 800; }
      .category-total { padding: 1mm 0; border-bottom: 1px solid #111; }
      .total-row { display: flex; justify-content: space-between; gap: 2mm; padding: 0.45mm 0; }
      .total-row span:last-child { flex-shrink: 0; text-align: right; font-variant-numeric: tabular-nums; }
      .grand-total { margin-top: 0.8mm; padding: 1mm 0; border-top: 1px solid #111; border-bottom: 1px double #111; font-size: 14px; font-weight: 900; }
      .section-title { text-align: center; }
      .meta { text-align: left; }
      @media print { html, body { width: 74mm; } }
`;

export function openReceiptPrintWindow() {
  const printWindow = openWindowOutsideNativeApp(
    "",
    "_blank",
    fullscreenPrintWindowFeatures(),
  );

  if (!printWindow) return null;

  maximizePrintWindow(printWindow);

  printWindow.document.write(
    `<!doctype html><html><head>${WINDOW_OPEN_FONT_STYLESHEET_LINK}<title>Print</title></head><body class="${WINDOW_OPEN_FONT_CLASS_NAME}">Loading print preview...</body></html>`,
  );
  printWindow.document.close();

  return printWindow;
}

export function renderReceiptPrintWindow(printWindow: Window, html: string) {
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

export function receiptDocumentHtml({
  autoPrint = true,
  bodyHtml,
  extraStyles = "",
  title = "",
}: {
  autoPrint?: boolean;
  bodyHtml: string;
  extraStyles?: string;
  title?: string;
}) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    ${WINDOW_OPEN_FONT_STYLESHEET_LINK}
    ${title ? `<title>${escapeHtml(title)}</title>` : ""}
    <style>
      ${RECEIPT_80MM_BASE_STYLES}
      ${extraStyles}
    </style>
  </head>
  <body class="${WINDOW_OPEN_FONT_CLASS_NAME}">
    ${bodyHtml}
    ${autoPrint ? `<script>${WINDOW_OPEN_PRINT_ON_LOAD_SCRIPT}</script>` : ""}
  </body>
</html>`;
}

export function receiptTotalRowHtml(label: string, value: number, className = "") {
  const displayValue = Object.is(value, -0) ? 0 : value;

  return `
    <div class="total-row${className ? ` ${className}` : ""}">
      <span>${escapeHtml(label)}</span>
      <span>${escapeHtml(money(displayValue))}</span>
    </div>
  `;
}

// ส่วนหัวใบเสร็จร่วมกันทุกรายงาน: ชื่อร้าน (ถ้ามี) → ชื่อสาขา (ถ้ามี) → หัวข้อรายงาน
export function receiptHeaderHtml({
  branchName,
  storeName,
  title,
}: {
  branchName?: string;
  storeName?: string;
  title: string;
}) {
  return `
    <header>
      ${storeName ? `<p class="strong">${escapeHtml(storeName)}</p>` : ""}
      ${branchName ? `<p>${escapeHtml(branchName)}</p>` : ""}
      <h1>${escapeHtml(title)}</h1>
    </header>
  `;
}

export function receiptMetaRowHtml(label: string, value: unknown) {
  return `<p>${escapeHtml(label)}: ${escapeHtml(value)}</p>`;
}
