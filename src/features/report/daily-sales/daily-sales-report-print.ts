import type { ReportPrintOp } from "@/services/report";
import type { AuthUser } from "@/stores/auth-store";
import type { DailySaleItemsBillGroup } from "@/stores/report-store";
import { escapeHtml } from "@/services/printer/invoice-print-window";
import {
  receiptDocumentHtml,
  receiptHeaderHtml,
  receiptMetaRowHtml,
} from "../shared/report-receipt-print";
import { formatReportDate, formatReportDateRange, formatReportDateTime } from "@/features/report/shared/report-date-format";

export interface DailySalesPrintLabels {
  billCount: string;
  bills: string;
  cancelledBills: string;
  cashReceived: string;
  dateTotal: string;
  debt: string;
  discount: string;
  grandTotal: string;
  invoiceNumber: string;
  items: string;
  period: string;
  printedAt: string;
  printedBy: string;
  revenueSummary: string;
  salesSummary: string;
  saleDate: string;
  serviceCharge: string;
  subtotal: string;
  table: string;
  title: string;
  totalAmount: string;
  totalRevenue: string;
  transferReceived: string;
  vat: string;
}

export interface DailySalesPrintInvoice {
  amount: number;
  invoiceNumber: string;
  quantity: number;
  tableName: string;
}

export interface DailySalesPrintDateGroup {
  date: string;
  invoices: DailySalesPrintInvoice[];
  totalAmount: number;
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
  transferReceived: number;
  vat: number;
}

export interface DailySalesPrintData {
  branchName: string;
  cashier: string;
  dateFrom: string;
  dateGroups: DailySalesPrintDateGroup[];
  dateTo: string;
  labels: DailySalesPrintLabels;
  storeName: string;
  summary: DailySalesPrintSummary;
}

// ใบพิมพ์นี้ตาม spec ต้องแสดงเลขคั่นหลักพันด้วยลูกน้ำล้วนๆ ไม่มีสัญลักษณ์สกุลเงิน — เลี่ยง money()
// เพราะ locale "lo-LA" ของฟังก์ชันนั้นคั่นหลักพันด้วยจุด ("150.000") ไม่ใช่ลูกน้ำ
function plainMoney(value: number) {
  const amount = Object.is(value, -0) ? 0 : value;
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(amount);
}

function formatQuantity(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

// แถวบิลตามแบบที่ร้านเลือก: "T01 · 211026-0003" ฝั่งซ้าย ยอดฝั่งขวา และบรรทัดรองเป็นจำนวนรายการ —
// ไม่มีเลขลำดับ "1./" แล้ว ต้องได้ข้อความชุดเดียวกันเป๊ะทั้ง auto print และ window.open ถึงจะหน้าตาตรงกัน
function invoiceLabel(invoice: DailySalesPrintInvoice) {
  return `${invoice.tableName || "-"} · ${invoice.invoiceNumber}`;
}

function invoiceItemsLabel(invoice: DailySalesPrintInvoice, labels: DailySalesPrintLabels) {
  return `${formatQuantity(invoice.quantity)} ${labels.items}`;
}

function dateBillCountLabel(group: DailySalesPrintDateGroup, labels: DailySalesPrintLabels) {
  return `${group.invoices.length} ${labels.bills}`;
}

// เรียงบิลของโต๊ะเดียวกันให้อยู่ติดกัน — โต๊ะเรียงตามบิลแรกที่พบ และคงลำดับบิลภายในโต๊ะตามที่ API ส่งมา
// (orderBy ของตัวกรอง) ไม่เรียงชื่อโต๊ะตามตัวอักษร เพราะชื่อโต๊ะเป็นข้อความอิสระของแต่ละร้าน
export function sortInvoicesByTable(invoices: DailySalesPrintInvoice[]): DailySalesPrintInvoice[] {
  const byTable = new Map<string, DailySalesPrintInvoice[]>();
  invoices.forEach((invoice) => {
    const group = byTable.get(invoice.tableName) ?? [];
    group.push(invoice);
    byTable.set(invoice.tableName, group);
  });
  return Array.from(byTable.values()).flat();
}

function groupBillsByDate(bills: DailySaleItemsBillGroup[]): DailySalesPrintDateGroup[] {
  const byDate = new Map<string, DailySalesPrintInvoice[]>();

  bills.forEach((bill) => {
    const invoices = byDate.get(bill.saleDate) ?? [];
    invoices.push({
      amount: bill.lineTotal,
      invoiceNumber: bill.invoiceNumber,
      quantity: bill.qtyTotal,
      tableName: bill.tableName,
    });
    byDate.set(bill.saleDate, invoices);
  });

  return Array.from(byDate, ([date, invoices]) => ({
    date,
    invoices,
    totalAmount: invoices.reduce((total, invoice) => total + invoice.amount, 0),
  })).sort((a, b) => a.date.localeCompare(b.date));
}

export function buildDailySalesPrintData({
  bills,
  dateFrom,
  dateTo,
  labels,
  user,
}: {
  bills: DailySaleItemsBillGroup[];
  dateFrom: string;
  dateTo: string;
  labels: DailySalesPrintLabels;
  user: AuthUser;
}): DailySalesPrintData {
  const activeBills = bills.filter((bill) => !bill.cancelled);
  const cancelledBills = bills.filter((bill) => bill.cancelled);

  const sum = (read: (bill: DailySaleItemsBillGroup) => number) =>
    activeBills.reduce((total, bill) => total + read(bill), 0);

  return {
    branchName: user.branch_name,
    cashier: user.email?.split("@")[0] || user.email || "-",
    dateFrom,
    dateGroups: groupBillsByDate(activeBills),
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
      transferReceived: sum((bill) => bill.receiveTransferAmount),
      vat: sum((bill) => bill.vatAmount),
    },
  };
}

// ฟอนต์พิมพ์ใบเสร็จ (Saysettha OT / Times) มีแค่ font-weight: 400 ไฟล์เดียว ไม่มีตัวหนาจริง — ตัวหนาจึงจำลองด้วย
// -webkit-text-stroke (.bold) และใช้เฉพาะจุดที่ต้องเด่น: ชื่อร้าน หัวข้อ วันที่ หัวข้อส่วน และยอดรวม
// เนื้อหาที่เหลือ (แถวบิล รายการ สรุปย่อย) น้ำหนักปกติ ไม่งั้นทั้งใบหนาไปหมดจนอ่านยาก
// เส้นคั่นฝั่ง auto print ใช้ { type: "line" } (ยืนยันจากการพิมพ์ทดสอบจริงแล้วว่าออกมาเป็นเส้นเต็มปกติ)
// ฝั่ง window.open จึงใช้ CSS border เต็มความกว้างแถว (solid) ให้ตรงกัน
const DAILY_SALES_EXTRA_STYLES = `
      /* เครื่อง thermal พิมพ์ได้แค่ขาว/ดำ: สีเทา (#111, #444) และตัวอักษรเล็กถูก dither เป็นจุดจนขอบตัวอักษรเบลอ
         จึงใช้ดำล้วน #000 ทั้งใบและขยายขนาดตัวอักษรเนื้อหาให้เส้นหนาพอจะพิมพ์ออกมาคม */
      html, body { color: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      body { font-size: 12.5px; line-height: 1.35; }
      .divider { border-top: 1px solid #000; }
      .bold, header .strong, header h1 { font-weight: 900; -webkit-text-stroke: 0.3px currentColor; }
      header .strong { font-size: 16px; line-height: 1.25; }
      header h1 { font-size: 18px; }
      .meta p { margin: 0.6mm 0; }
      .date-group + .date-group { margin-top: 2.5mm; }
      .date-head { display: flex; justify-content: space-between; align-items: baseline; gap: 2mm; margin: 1.2mm 0 0.8mm; font-size: 14px; }
      .date-head .count { font-size: 12px; font-weight: 400; -webkit-text-stroke: 0; }
      .invoice { padding: 0.9mm 0; }
      .invoice .total-row { padding: 0; font-size: 13px; }
      .invoice .sub { margin: 0; font-size: 11px; }
      .date-total { padding: 1mm 0; font-size: 14px; }
      .section-title { margin: 1.5mm 0 1mm; font-size: 14px; }
      .grand-total { margin: 0; padding: 1mm 0; border: 0; font-size: 14px; }
      .grand-total span:last-child { font-size: 17px; }
      .revenue-total { margin-top: 0.6mm; padding: 1mm 0; border-top: 1px solid #000; font-size: 14px; }
`;

export function renderDailySalesPrintHtml(data: DailySalesPrintData) {
  const { labels, summary } = data;
  const dividerHtml = `<div class="divider"></div>`;
  const row = (left: string, right: string, className = "") => `
    <div class="total-row${className ? ` ${className}` : ""}"><span>${escapeHtml(left)}</span><span>${escapeHtml(right)}</span></div>`;
  // ใช้ plainMoney (คั่นด้วยลูกน้ำ) แทน receiptTotalRowHtml ที่เรียก money() ภายใน — money() คั่นหลักพันด้วย
  // จุดตาม locale "lo-LA" ไม่ใช่ลูกน้ำ ทำให้ตัวเลขในตารางบิล (ลูกน้ำ) กับสรุปท้ายใบ (จุด) ไม่ตรงกัน
  const moneyRow = (label: string, value: number, className = "") => row(label, plainMoney(value), className);

  const dateGroups = data.dateGroups.map((group, index) => `
    <section class="date-group">
      ${index > 0 ? dividerHtml : ""}
      <div class="date-head bold"><span>${escapeHtml(formatReportDate(group.date))}</span><span class="count">${escapeHtml(dateBillCountLabel(group, labels))}</span></div>
      ${dividerHtml}
      ${sortInvoicesByTable(group.invoices).map((invoice) => `
        <div class="invoice">
          ${row(invoiceLabel(invoice), plainMoney(invoice.amount))}
          <p class="sub">${escapeHtml(invoiceItemsLabel(invoice, labels))}</p>
        </div>`).join("")}
      ${dividerHtml}
      ${moneyRow(labels.dateTotal, group.totalAmount, "date-total bold")}
    </section>`).join("");

  const bodyHtml = `
    ${receiptHeaderHtml({ branchName: data.branchName, storeName: data.storeName, title: labels.title })}
    ${dividerHtml}
    <section class="meta">
      ${receiptMetaRowHtml(labels.period, `${formatReportDateRange(data.dateFrom, data.dateTo)}`)}
      ${receiptMetaRowHtml(labels.printedBy, data.cashier)}
      ${receiptMetaRowHtml(labels.printedAt, formatReportDateTime(new Date().toISOString()))}
    </section>
    ${dividerHtml}
    ${dateGroups || `<p style="text-align:center">-</p>`}
    ${dividerHtml}
    <section class="sales-calculation">
      <h2 class="section-title bold">${escapeHtml(labels.salesSummary)}</h2>
      ${row(labels.billCount, String(summary.activeBillCount))}
      ${moneyRow(labels.subtotal, summary.subtotal)}
      ${moneyRow(labels.discount, -summary.discount)}
      ${moneyRow(labels.serviceCharge, summary.serviceCharge)}
      ${moneyRow(labels.vat, summary.vat)}
      ${dividerHtml}
      ${moneyRow(labels.grandTotal, summary.grandTotal, "grand-total bold")}
    </section>
    ${dividerHtml}
    <section class="revenue-summary">
      <h2 class="section-title bold">${escapeHtml(labels.revenueSummary)}</h2>
      ${moneyRow(labels.cashReceived, summary.cashReceived)}
      ${moneyRow(labels.transferReceived, summary.transferReceived)}
      ${moneyRow(labels.debt, summary.debt)}
      ${moneyRow(labels.totalRevenue, summary.grandTotal, "revenue-total bold")}
      ${moneyRow(`${labels.cancelledBills} (${summary.cancelledBillCount})`, summary.cancelledAmount)}
    </section>`;

  return receiptDocumentHtml({
    bodyHtml,
    extraStyles: DAILY_SALES_EXTRA_STYLES,
    title: labels.title,
  });
}

// สรุปย่อสำหรับพิมพ์ผ่าน printer agent — ป้ายเครื่องพิมพ์รองรับแค่ 2 คอลัมน์ (left/right) เท่านั้น
// ลำดับและน้ำหนักตัวอักษรต้องตรงกับ renderDailySalesPrintHtml ทุกแถว
export function buildDailySalesReportOps(data: DailySalesPrintData): ReportPrintOp[] {
  const { labels, summary } = data;
  const divider: ReportPrintOp = { type: "line" };
  const lr = (left: string, right: number, bold = false): ReportPrintOp => ({
    type: "lr",
    left,
    right: plainMoney(right),
    bold,
    size: bold ? 30 : 28
  });
  const sectionHeading = (text: string): ReportPrintOp[] => [
    { type: "spacer", px: 12 },
    { type: "text", text, align: "center", bold: true, size: 30 },
    { type: "spacer", px: 12 },
  ];

  // เส้นคั่น "ระหว่าง" วันที่ วางไว้หลังยอดรวมของวันก่อนหน้า แล้วเว้นบรรทัดว่าง (ไม่ใช่เส้นซ้อน) ให้วันถัดไปหายใจ
  const dateGroupOps: ReportPrintOp[] = data.dateGroups.flatMap((group, index) => [
    ...(index > 0 ? [divider, { type: "blank", n: 1 } as ReportPrintOp] : []),
    { type: "lr", left: formatReportDate(group.date), right: dateBillCountLabel(group, labels), bold: true, size: 30 },
    divider,
    // แถวบิลน้ำหนักปกติ + จำนวนรายการเป็น op ชนิด "text" ที่เล็กกว่า (size บน "lr" เครื่องจริงไม่ใช้)
    // แล้วเว้นช่องเล็กน้อยก่อนบิลถัดไป ตรงกับ .invoice padding ฝั่ง HTML
    ...sortInvoicesByTable(group.invoices).flatMap((invoice): ReportPrintOp[] => [
      lr(invoiceLabel(invoice), invoice.amount),
      { type: "text", text: invoiceItemsLabel(invoice, labels), align: "left", bold: false, size: 22 },
      { type: "spacer", px: 4 },
    ]),
    divider,
    lr(labels.dateTotal, group.totalAmount, true),
  ]);

  return [
    // ลำดับหัวใบเสร็จต้องตรงกับ receiptHeaderHtml: ชื่อร้าน(หนา) -> ชื่อสาขา -> หัวข้อรายงาน(ใหญ่สุด)
    ...(data.storeName ? [{ type: "text", text: data.storeName, align: "center", bold: true, size: 32 } as ReportPrintOp] : []),
    ...(data.branchName ? [{ type: "text", text: data.branchName, align: "center", size: 26 } as ReportPrintOp] : []),
    { type: "text", text: labels.title, align: "center", bold: true, size: 36 },
    divider,
    { type: "text", text: `${labels.period}: ${formatReportDateRange(data.dateFrom, data.dateTo)}`, align: "left", size: 28 },
    { type: "text", text: `${labels.printedBy}: ${data.cashier}`, align: "left", size: 28 },
    { type: "text", text: `${labels.printedAt}: ${formatReportDateTime(new Date().toISOString())}`, align: "left", size: 24 },
    divider,
    ...dateGroupOps,
    divider,
    ...sectionHeading(labels.salesSummary),
    { type: "lr", left: labels.billCount, right: String(summary.activeBillCount), bold: false, size: 28 },
    lr(labels.subtotal, summary.subtotal),
    lr(labels.discount, -summary.discount),
    lr(labels.serviceCharge, summary.serviceCharge),
    lr(labels.vat, summary.vat),
    divider,
    { ...lr(labels.grandTotal, summary.grandTotal, true), size: 34 },
    divider,
    ...sectionHeading(labels.revenueSummary),
    lr(labels.cashReceived, summary.cashReceived),
    lr(labels.transferReceived, summary.transferReceived),
    lr(labels.debt, summary.debt),
    divider,
    // Use the active bills' net total; tendered cash can include change.
    { ...lr(labels.totalRevenue, summary.grandTotal, true), size: 32 },
    { type: "lr", left: `${labels.cancelledBills} (${summary.cancelledBillCount})`, right: plainMoney(summary.cancelledAmount), bold: false, size: 26 },
    { type: "blank", n: 2 }
  ];
}
