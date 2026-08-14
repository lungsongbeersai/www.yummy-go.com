import { dateTime } from "@/lib/format";
import type { ReportPrintOp } from "@/services/report";
import type { AuthUser } from "@/stores/auth-store";
import type { DailySaleItemsBillGroup } from "@/stores/report-store";
import { escapeHtml } from "@/services/printer/invoice-print-window";
import {
  receiptDocumentHtml,
  receiptHeaderHtml,
  receiptMetaRowHtml,
} from "../shared/report-receipt-print";

export interface DailySalesPrintLabels {
  billCount: string;
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
  saleDate: string;
  serviceCharge: string;
  subtotal: string;
  table: string;
  title: string;
  totalAmount: string;
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

// นำหน้าด้วยเลขลำดับบิลของวันนั้น (เริ่ม 1 ใหม่ทุกวันที่ขาย) รูปแบบ "1./ " แล้วรวมเลขบิลกับจำนวนรายการไว้ใน
// ช่องเดียวกัน เช่น "1./ 120826-0011 (2 ລາຍການ)" ให้เหลือแค่ 2 คอลัมน์ (left/right)
// ต้องได้ข้อความชุดเดียวกันเป๊ะทั้ง auto print และ window.open ถึงจะหน้าตาตรงกัน
function invoiceLeftLabel(sequence: number, invoice: DailySalesPrintInvoice, labels: DailySalesPrintLabels) {
  return `${sequence}./ ${invoice.invoiceNumber} (${formatQuantity(invoice.quantity)} ${labels.items})`;
}

// แถวย่อยใต้แถวหลักของแต่ละบิล บอกโต๊ะของบิลนั้น เช่น "ໂຕະ 4"
function invoiceTableLabel(invoice: DailySalesPrintInvoice, labels: DailySalesPrintLabels) {
  return `${labels.table} ${invoice.tableName}`;
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

// ฟอนต์พิมพ์ใบเสร็จ (Saysettha OT / Times) มีแค่ font-weight: 400 ไฟล์เดียว ไม่มีตัวหนาจริง —
// font-weight: bold ทาง CSS จึงไม่มีผลอะไรเลยกับฟอนต์นี้ ใช้เส้นขอบ/ขนาดตัวอักษรแยกลำดับความสำคัญแทน
// เส้นคั่นฝั่ง auto print กลับมาใช้ { type: "line" } (ยืนยันจากการพิมพ์ทดสอบจริงแล้วว่าออกมาเป็นเส้นเต็มปกติ)
// ฝั่ง window.open จึงกลับไปใช้ CSS border เต็มความกว้างแถวให้ตรงกัน (ใช้ solid ไม่ใช่ dashed ของ .divider ฐาน
// ให้เหมือน .grand-total ที่เห็นแล้วว่าเต็มแถวชัดเจนดี)
const DAILY_SALES_EXTRA_STYLES = `
      .divider { border-top: 1px solid #111; }
      /* ระยะห่างในกลุ่มวันเดียวกัน (หัววันที่ -> ตาราง) ให้แน่นเพราะเป็นเนื้อหาเดียวกัน
         ส่วนระยะห่าง "ระหว่าง" กลุ่มวันที่ (เมื่อมีมากกว่า 1 วัน) ให้เว้นชัดเจนกว่า เพื่อบอกว่าเริ่มส่วนใหม่ */
      .date-group { margin: 0 0 1mm; }
      .date-group + .date-group { margin-top: 2.5mm; }
      /* เส้นคั่น "ระหว่าง" วันที่ (ไม่ใช่เส้นใต้หัววันที่) เว้นระยะเพิ่มด้านล่างให้วันที่ถัดไปหายใจ แทนที่จะ
         เพิ่มเส้นคั่นซ้อนอีกเส้นประกบข้อความบรรทัดเดียว ซึ่งจะดูรกกว่า */
      .divider-section { margin-bottom: 2mm; }
      .date-group h2 { margin: 0 0 0.8mm; padding-bottom: 0.5mm; border-bottom: 1px solid #111; font-size: 12px; }
      .invoice-table-header { border-bottom: 1px solid #111; padding-bottom: 0.5mm; margin-bottom: 0.5mm; }
      .invoice-items { margin: 0 0 0.65mm 4mm; font-size: 10px; }
`;

export function renderDailySalesPrintHtml(data: DailySalesPrintData) {
  const { labels, summary } = data;
  const dividerHtml = `<div class="divider"></div>`;
  const row = (left: string, amount: number, className = "") => `
    <div class="total-row${className ? ` ${className}` : ""}"><span>${escapeHtml(left)}</span><span>${escapeHtml(plainMoney(amount))}</span></div>`;

  // หัวตาราง "ເລກທີ່ບິນ / ຍອດລວມ" แสดงครั้งเดียวบนสุด ไม่วนซ้ำต่อวันที่ — วันที่แต่ละกลุ่มอยู่ใต้หัวตารางนี้แทน
  const invoiceHeaderHtml = `<div class="total-row invoice-table-header"><span>${escapeHtml(labels.invoiceNumber)}</span><span>${escapeHtml(labels.totalAmount)}</span></div>`;

  const sectionDividerHtml = `<div class="divider divider-section"></div>`;

  const dateGroups = data.dateGroups.map((group, index) => `
    <section class="date-group">
      ${index > 0 ? sectionDividerHtml : ""}
      <h2>${escapeHtml(labels.saleDate)}: ${escapeHtml(group.date)}</h2>
      ${group.invoices.map((invoice, invoiceIndex) => `
        ${row(invoiceLeftLabel(invoiceIndex + 1, invoice, labels), invoice.amount)}
        <p class="invoice-items">${escapeHtml(invoiceTableLabel(invoice, labels))}</p>`).join("")}
      ${dividerHtml}
      ${row(labels.dateTotal, group.totalAmount, "strong")}
    </section>`).join("");

  // ใช้ plainMoney (คั่นด้วยลูกน้ำ) แทน receiptTotalRowHtml ที่เรียก money() ภายใน — money() คั่นหลักพันด้วย
  // จุดตาม locale "lo-LA" ไม่ใช่ลูกน้ำ ทำให้ตัวเลขในตารางบิล (ลูกน้ำ) กับสรุปท้ายใบ (จุด) ไม่ตรงกัน
  const totalRow = (label: string, value: number, className = "") => row(label, value, className);

  const bodyHtml = `
    ${receiptHeaderHtml({ branchName: data.branchName, storeName: data.storeName, title: labels.title })}
    ${dividerHtml}
    <section class="meta">
      ${receiptMetaRowHtml(labels.period, `${data.dateFrom} - ${data.dateTo}`)}
      ${receiptMetaRowHtml(labels.printedBy, data.cashier)}
      ${receiptMetaRowHtml(labels.printedAt, dateTime(new Date().toISOString()))}
    </section>
    ${dividerHtml}
    ${invoiceHeaderHtml}
    ${dateGroups || `<p style="text-align:center">-</p>`}
    ${dividerHtml}
    <section>
      <h2 class="section-title">${escapeHtml(labels.revenueSummary)}</h2>
      <div class="total-row strong"><span>${escapeHtml(labels.billCount)}</span><span>${escapeHtml(String(summary.activeBillCount))}</span></div>
      ${totalRow(labels.subtotal, summary.subtotal)}
      ${totalRow(labels.discount, -summary.discount)}
      ${totalRow(labels.serviceCharge, summary.serviceCharge)}
      ${totalRow(labels.vat, summary.vat)}
      ${dividerHtml}
      ${totalRow(labels.grandTotal, summary.grandTotal, "grand-total")}
      ${dividerHtml}
      ${totalRow(labels.cashReceived, summary.cashReceived)}
      ${totalRow(labels.transferReceived, summary.transferReceived)}
      ${totalRow(labels.debt, summary.debt)}
      <div class="total-row"><span>${escapeHtml(labels.cancelledBills)} (${summary.cancelledBillCount})</span><span>${escapeHtml(plainMoney(summary.cancelledAmount))}</span></div>
    </section>`;

  return receiptDocumentHtml({
    bodyHtml,
    extraStyles: DAILY_SALES_EXTRA_STYLES,
    title: labels.title,
  });
}

// สรุปย่อสำหรับพิมพ์ผ่าน printer agent — ป้ายเครื่องพิมพ์รองรับแค่ 2 คอลัมน์ (left/right) เท่านั้น
// จึงรวมจำนวนเข้ากับเลขบิลในฝั่ง left ตาม convention เดียวกับรายงานอื่น (เช่น best-selling-products)
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

  // เส้นคั่น "ระหว่าง" วันที่ (ไม่ใช่ในวันเดียวกัน) วางไว้หลังยอดรวมของวันก่อนหน้า — คั่นให้เห็นชัดว่าเริ่มวันที่ใหม่
  // เว้นบรรทัดว่างต่อท้ายเส้นคั่นนี้ (ไม่ใช่เพิ่มเส้นคั่นซ้อนอีกเส้น) ให้วันที่ถัดไปหายใจ ตรงกับฝั่ง window.open
  // ที่ใช้ margin-bottom บน .divider-section แทน
  const dateGroupOps: ReportPrintOp[] = data.dateGroups.flatMap((group, index) => [
    ...(index > 0 ? [divider, { type: "blank", n: 1 } as ReportPrintOp] : []),
    { type: "text", text: `${labels.saleDate}: ${group.date}`, align: "left", bold: true, size: 26 },
    // ฝั่ง HTML มี .date-group h2 border-bottom ใต้วันที่ — ฝั่งนี้ต้องมีให้ตรงกัน
    divider,
    // แถวจำนวนรายการ เยื้องเข้าไปด้วยช่องว่างนำหน้า (เครื่องพิมพ์ thermal ไม่รองรับ CSS margin) —
    // เป็น op ชนิด "text" เพราะ size บน "lr" เครื่องจริงไม่ใช้ ต้องใช้ "text" ถึงจะเล็กกว่าแถวหลักจริง
    ...group.invoices.flatMap((invoice, invoiceIndex): ReportPrintOp[] => [
      lr(invoiceLeftLabel(invoiceIndex + 1, invoice, labels), invoice.amount),
      { type: "text", text: `  ${invoiceTableLabel(invoice, labels)}`, align: "left", size: 24 },
    ]),
    // ฝั่ง HTML มีเส้นคั่นก่อนแถว dateTotal เสมอ (ดู dividerHtml ก่อน row(labels.dateTotal, ...) ใน
    // renderDailySalesPrintHtml) — ฝั่งนี้ต้องมีให้ตรงกัน
    divider,
    lr(labels.dateTotal, group.totalAmount, true),
  ]);

  return [
    // ลำดับหัวใบเสร็จต้องตรงกับ receiptHeaderHtml: ชื่อร้าน(หนา) -> ชื่อสาขา -> หัวข้อรายงาน(ใหญ่สุด)
    ...(data.storeName ? [{ type: "text", text: data.storeName, align: "center", bold: true, size: 28 } as ReportPrintOp] : []),
    ...(data.branchName ? [{ type: "text", text: data.branchName, align: "center", size: 26 } as ReportPrintOp] : []),
    { type: "text", text: labels.title, align: "center", bold: true, size: 36 },
    divider,
    { type: "text", text: `${labels.period}: ${data.dateFrom} - ${data.dateTo}`, align: "left", size: 28 },
    { type: "text", text: `${labels.printedBy}: ${data.cashier}`, align: "left", size: 28 },
    { type: "text", text: `${labels.printedAt}: ${dateTime(new Date().toISOString())}`, align: "left", size: 24 },
    divider,
    // หัวตาราง "ເລກທີ່ບິນ / ຍອດລວມ" แสดงครั้งเดียวบนสุด ไม่วนซ้ำต่อวันที่ — ฝั่ง HTML แถวนี้ไม่มี class "strong"
    // จึงไม่ตัวหนา ฝั่งนี้ต้องตรงกัน แล้วตามด้วย divider จำลอง .invoice-table-header border-bottom ของฝั่ง HTML
    { type: "lr", left: labels.invoiceNumber, right: labels.totalAmount, bold: false, size: 24 },
    divider,
    ...dateGroupOps,
    divider,
    { type: "text", text: labels.revenueSummary, align: "center", bold: true, size: 30 },
    // ฝั่ง HTML ใช้ class="total-row strong" กับแถวนี้ (ตัวหนา) — ฝั่งนี้ต้องตรงกัน
    { type: "lr", left: labels.billCount, right: String(summary.activeBillCount), bold: true, size: 28 },
    lr(labels.subtotal, summary.subtotal),
    lr(labels.discount, -summary.discount),
    lr(labels.serviceCharge, summary.serviceCharge),
    lr(labels.vat, summary.vat),
    divider,
    { ...lr(labels.grandTotal, summary.grandTotal, true), size: 34 },
    divider,
    lr(labels.cashReceived, summary.cashReceived),
    lr(labels.transferReceived, summary.transferReceived),
    lr(labels.debt, summary.debt),
    { type: "lr", left: `${labels.cancelledBills} (${summary.cancelledBillCount})`, right: plainMoney(summary.cancelledAmount), bold: false, size: 26 },
    { type: "blank", n: 2 }
  ];
}
