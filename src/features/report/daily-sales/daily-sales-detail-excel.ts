import type { ApiEntity } from "@/services/shared/types";
import type { DailySalesBillGroup } from "@/stores/report-store";
import {
  createSingleSheetReportWorkbook,
  type ReportExcelCellStyle,
  type ReportExcelGridCell,
  type ReportExcelGridRow,
  type ReportExcelGridSection,
  type ReportExcelLayout,
  type XlsxModule,
} from "../report-excel-utils";
import {
  buildDailySalesDetailReportModel,
  type DailySalesDetailAdjustmentKey,
  type DailySalesDetailMetrics,
  type DailySalesDetailReportModel,
} from "./daily-sales-detail-model";
import type {
  SummaryCardConfig,
  SummaryCards,
} from "./daily-sales-report-types";
import {
  firstOptionalNumber,
  firstNumber,
  readValue,
  summaryCardValue,
} from "./daily-sales-report-utils";

type Translate = (key: string) => string;

interface DailySalesDetailExcelInput {
  billGroups: DailySalesBillGroup[];
  branchLabel: string;
  cards: SummaryCardConfig[];
  dateFrom: string;
  dateTo: string;
  dateTotals: ApiEntity[];
  // ใส่ section สรุปเฉพาะตอนที่ summary cards แสดงอยู่ใน UI
  includeSummary: boolean;
  layout: ReportExcelLayout;
  paymentMethodLabel: string;
  reportTotal: ApiEntity;
  summaryCards: SummaryCards;
  t: Translate;
}

const TABLE_HEADER_STYLE = {
  align: "center",
  bold: true,
  fill: "#1F4E78",
  fontColor: "#FFFFFF",
} as const satisfies ReportExcelCellStyle;

const MONEY_STYLE = {
  align: "right",
  numberFormat: "#,##0",
} as const satisfies ReportExcelCellStyle;

const NUMBER_STYLE = {
  align: "right",
  numberFormat: "#,##0",
} as const satisfies ReportExcelCellStyle;

const DATE_ONLY_STYLE = {
  numberFormat: "yyyy-mm-dd",
} as const satisfies ReportExcelCellStyle;

const DATE_TIME_STYLE = {
  numberFormat: "yyyy-mm-dd hh:mm",
} as const satisfies ReportExcelCellStyle;

// สไตล์ของตารางจัดกลุ่มตามบิล: แถวบิลเด่นสุด > แถวรวมย่อย > แถวรายการสินค้า
const BILL_ROW_STYLE = {
  bold: true,
  fill: "#DEE8F4",
} as const satisfies ReportExcelCellStyle;

const BILL_ROW_CANCELLED_STYLE = {
  bold: true,
  fill: "#FFE4E6",
  fontColor: "#991B1B",
} as const satisfies ReportExcelCellStyle;

const CANCELLED_ITEM_STYLE = {
  fill: "#FFF1F2",
  fontColor: "#991B1B",
} as const satisfies ReportExcelCellStyle;

const SUBTOTAL_ROW_STYLE = {
  bold: true,
  fill: "#EEF3F7",
} as const satisfies ReportExcelCellStyle;

const GRAND_TOTAL_ROW_STYLE = {
  bold: true,
  fill: "#D9E2F3",
} as const satisfies ReportExcelCellStyle;

const PAYMENT_INFO_STYLE = {
  fontColor: "#64748B",
  italic: true,
} as const satisfies ReportExcelCellStyle;

const ADJUSTMENT_LABEL_KEYS: Record<DailySalesDetailAdjustmentKey, string> = {
  "bill-discount": "report.columns.billDiscount",
  "service-charge": "dashboard.serviceCharge",
  total: "common.total",
  vat: "dashboard.vat",
};

const SUMMARY_KEY_ALIASES: Record<string, string[]> = {
  bill_count: ["bills_count", "total_bills"],
  sum_servicecharge: ["service_charge", "service_charge_amount"],
  sum_total: ["total", "line_total", "net_total", "grand_total"],
  sum_vate: ["vat", "vat_amount"],
  total_qty: ["qty_total", "quantity_total"],
};

function cell(
  value: ReportExcelGridCell["value"],
  style?: ReportExcelCellStyle,
): ReportExcelGridCell {
  return { style, value };
}

function moneyCell(value: number | null | undefined) {
  return cell(value ?? "", MONEY_STYLE);
}

function numberCell(value: number | null | undefined) {
  return cell(value ?? "", NUMBER_STYLE);
}

function excelDate(value: unknown) {
  const source = String(value ?? "").trim();
  if (!source) return "";
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(source);
  if (dateOnly) {
    return new Date(
      Number(dateOnly[1]),
      Number(dateOnly[2]) - 1,
      Number(dateOnly[3]),
    );
  }
  const parsed = new Date(source.includes(" ") ? source.replace(" ", "T") : source);
  return Number.isNaN(parsed.getTime()) ? source : parsed;
}

function dateCell(value: unknown) {
  const source = String(value ?? "").trim();
  const parsed = excelDate(value);
  if (!(parsed instanceof Date)) return cell(parsed);
  return cell(
    parsed,
    /^\d{4}-\d{2}-\d{2}$/.test(source) ? DATE_ONLY_STYLE : DATE_TIME_STYLE,
  );
}

function tableSection({
  autoFilter = false,
  headers,
  rows,
  title,
  widths,
}: {
  autoFilter?: boolean;
  headers: string[];
  rows: ReportExcelGridRow[];
  title: string;
  widths: number[];
}): ReportExcelGridSection {
  return {
    grid: {
      autoFilter,
      columnCount: headers.length,
      columnWidths: widths,
      rows: [
        {
          cells: headers.map((header) => cell(header)),
          style: TABLE_HEADER_STYLE,
        },
        ...rows,
      ],
    },
    title,
  };
}

function alternatingRow(index: number, cancelled = false): ReportExcelCellStyle {
  if (cancelled) return { fill: "#FFF1F2", fontColor: "#991B1B" };
  return index % 2 === 1 ? { fill: "#F8FAFC" } : {};
}

function summaryValue(
  input: DailySalesDetailExcelInput,
  card: SummaryCardConfig,
) {
  const directValue = firstOptionalNumber(
    summaryCardValue(input.summaryCards, input.reportTotal, card.keys),
  );
  if (directValue !== null) return directValue;

  if (card.keys.includes("sum_discount")) {
    const billDiscount = firstNumber(
      summaryCardValue(input.summaryCards, input.reportTotal, [
        "discount_bill",
        "bill_discount",
      ]),
    );
    const itemDiscount = firstNumber(
      summaryCardValue(input.summaryCards, input.reportTotal, [
        "item_discount",
        "item_discount_amount",
        "discount_item",
      ]),
    );
    return billDiscount + itemDiscount;
  }

  const aliases = card.keys.flatMap(
    (key) => SUMMARY_KEY_ALIASES[key] ?? [],
  );
  return firstNumber(
    summaryCardValue(input.summaryCards, input.reportTotal, aliases),
  );
}

function infoSection(input: DailySalesDetailExcelInput) {
  const { t } = input;
  const infoRows: ReportExcelGridRow[] = [
    [t("report.filters.typePage"), t("report.detailedSalesReport")],
    [t("dashboard.branch"), input.branchLabel],
    [t("report.filters.dateFrom"), input.dateFrom],
    [t("report.filters.dateTo"), input.dateTo],
    [t("report.filters.paymentMethod"), input.paymentMethodLabel],
  ].map(([label, value], index) => ({
    cells: [cell(label, { bold: true }), cell(value)],
    style: alternatingRow(index),
  }));

  return tableSection({
    autoFilter: false,
    headers: [t("report.excel.metric"), t("report.excel.value")],
    rows: infoRows,
    title: t("report.excel.reportInformation"),
    widths: [30, 32],
  });
}

function summarySection(input: DailySalesDetailExcelInput) {
  const { cards, t } = input;
  const summaryRows: ReportExcelGridRow[] = cards.map((card, index) => ({
    cells: [
      cell(card.label),
      card.kind === "money"
        ? moneyCell(summaryValue(input, card))
        : numberCell(summaryValue(input, card)),
    ],
    style: alternatingRow(index),
  }));

  return tableSection({
    autoFilter: false,
    headers: [t("report.excel.metric"), t("report.excel.value")],
    rows: summaryRows,
    title: t("report.summary"),
    widths: [30, 32],
  });
}

function metricCells(metrics: DailySalesDetailMetrics) {
  return [
    moneyCell(metrics.sellingPrice),
    numberCell(metrics.quantity),
    moneyCell(metrics.topping),
    moneyCell(metrics.amount),
    moneyCell(metrics.discount),
    moneyCell(metrics.total),
  ];
}

function blankCells(count: number) {
  return Array.from({ length: count }, () => cell(""));
}

// ตารางเดียวจัดกลุ่มตามบิล: แถวบิล → รายการสินค้า → รวมย่อย → ส่วนลด/VAT/ค่าบริการ
// → ยอดสุทธิ ตามโครงเดียวกับหน้าจอและ PDF (DetailPrintTable)
function billDetailSection(
  input: DailySalesDetailExcelInput,
  model: DailySalesDetailReportModel,
) {
  const { t } = input;
  const { hasStatus } = model;
  const statusPad = (cells: ReportExcelGridCell[]) =>
    hasStatus ? [...cells, cell("")] : cells;
  const headers = [
    t("fields.no"),
    t("report.columns.invoiceNumber"),
    t("report.columns.saleDate"),
    t("report.columns.tableName"),
    t("report.columns.paymentType"),
    t("report.columns.productName"),
    t("report.columns.salePrice"),
    t("report.columns.quantity"),
    t("report.columns.toppingTotal"),
    t("report.columns.amount"),
    t("report.columns.discount"),
    t("common.total"),
    ...(hasStatus ? [t("report.columns.status")] : []),
  ];
  const rows: ReportExcelGridRow[] = [];

  model.bills.forEach((bill, index) => {
    rows.push({
      cells: [
        numberCell(index + 1),
        cell(bill.invoiceNumber),
        dateCell(bill.saleDate),
        cell(bill.tableName),
        cell(bill.paymentType),
        ...blankCells(7),
        ...(hasStatus ? [cell(bill.status)] : []),
      ],
      style: bill.cancelled ? BILL_ROW_CANCELLED_STYLE : BILL_ROW_STYLE,
    });

    bill.items.forEach((item) => {
      rows.push({
        cells: statusPad([
          ...blankCells(5),
          cell(item.productLabel),
          ...metricCells(item.metrics),
        ]),
        style:
          item.cancelled || bill.cancelled ? CANCELLED_ITEM_STYLE : undefined,
      });
    });

    rows.push({
      cells: statusPad([
        cell(""),
        { colSpan: 5, value: t("report.summary") },
        ...metricCells(bill.itemSubtotal),
      ]),
      style: SUBTOTAL_ROW_STYLE,
    });

    bill.adjustments.forEach((adjustment) => {
      rows.push({
        cells: statusPad([
          cell(""),
          {
            colSpan: 10,
            style: { align: "right" },
            value: t(ADJUSTMENT_LABEL_KEYS[adjustment.key]),
          },
          moneyCell(adjustment.value),
        ]),
        style: adjustment.key === "total" ? SUBTOTAL_ROW_STYLE : undefined,
      });
    });

    // ข้อมูลการรับชำระระดับบิล แสดงเฉพาะรายการที่มียอด ไม่เปลืองคอลัมน์ถาวร
    const paymentInfo: Array<[string, number]> = [
      [t("report.columns.cashReceived"), bill.source.receiveCashAmount],
      [t("report.columns.transferReceived"), bill.source.receiveTransferAmount],
      [t("report.columns.debtAmount"), bill.source.debtAmount],
      [t("report.columns.changeAmount"), bill.source.changeAmount],
    ];
    paymentInfo
      .filter(([, value]) => value !== 0)
      .forEach(([label, value]) => {
        rows.push({
          cells: statusPad([
            cell(""),
            { colSpan: 10, style: { align: "right" }, value: label },
            moneyCell(value),
          ]),
          style: PAYMENT_INFO_STYLE,
        });
      });
  });

  const totalLabel =
    model.totals.billCount === null
      ? t("report.summary")
      : `${t("report.summary")} - ${t("report.cards.billsCount")}: ${model.totals.billCount.toLocaleString("en-US")}`;
  rows.push({
    cells: statusPad([
      cell(""),
      { colSpan: 5, value: totalLabel },
      moneyCell(model.totals.sellingPrice),
      numberCell(model.totals.quantity),
      moneyCell(model.totals.topping),
      moneyCell(model.totals.amount),
      moneyCell(model.totals.discount),
      moneyCell(model.totals.total),
    ]),
    style: GRAND_TOTAL_ROW_STYLE,
  });

  return tableSection({
    headers,
    rows,
    title: t("report.excel.bills"),
    widths: [7, 18, 19, 12, 16, 40, 14, 10, 13, 15, 13, 16, ...(hasStatus ? [14] : [])],
  });
}

function dailyTotalsSection(input: DailySalesDetailExcelInput) {
  const { t } = input;
  const headers = [
    t("report.columns.saleDate"),
    t("report.cards.billsCount"),
    t("report.cards.orderTotal"),
    t("report.cards.toppingTotal"),
    t("report.cards.discountAmount"),
    t("report.cards.itemDiscountAmount"),
    t("report.cards.serviceCharge"),
    t("report.cards.vatAmount"),
    t("report.cards.netTotal"),
    t("report.cards.receiveCash"),
    t("report.cards.receiveTransfer"),
    t("report.cards.debtAmount"),
    t("report.cards.changeAmount"),
  ];
  const rows = input.dateTotals.map<ReportExcelGridRow>((row, index) => ({
    cells: [
      dateCell(readValue(row, ["date", "sale_date"])),
      numberCell(firstNumber(readValue(row, ["bills_count", "bill_count"]))),
      moneyCell(firstNumber(readValue(row, ["amount", "order_total", "total_order"]))),
      moneyCell(firstNumber(readValue(row, ["topping_total", "topping_line_total"]))),
      moneyCell(firstNumber(readValue(row, ["discount_bill", "discount_amount", "discount_total"]))),
      moneyCell(firstNumber(readValue(row, ["item_discount", "item_discount_amount"]))),
      moneyCell(firstNumber(readValue(row, ["service_charge", "service_charge_amount"]))),
      moneyCell(firstNumber(readValue(row, ["vat", "vat_amount"]))),
      moneyCell(firstNumber(readValue(row, ["total", "net_total", "grand_total"]))),
      moneyCell(firstNumber(readValue(row, ["receive_cash", "cash_received"]))),
      moneyCell(firstNumber(readValue(row, ["receive_transfer", "transfer_received"]))),
      moneyCell(firstNumber(readValue(row, ["debt_amount", "debt_total"]))),
      moneyCell(firstNumber(readValue(row, ["change_amount", "change_total"]))),
    ],
    style: alternatingRow(index),
  }));

  return tableSection({
    headers,
    rows,
    title: t("report.dateTotals"),
    widths: [18, 12, 16, 16, 16, 16, 16, 14, 16, 16, 18, 14, 14],
  });
}

export function createDailySalesDetailExcelWorkbook(
  XLSX: XlsxModule,
  input: DailySalesDetailExcelInput,
) {
  const model = buildDailySalesDetailReportModel(
    input.billGroups,
    input.summaryCards,
    input.reportTotal,
  );
  // ทุก section อยู่ใน sheet เดียว จึงปิด autofilter เพราะ Excel มี filter ได้
  // sheet ละอัน และการ filter จะซ่อนแถวของตารางอื่นที่อยู่ถัดลงไปด้วย
  const sections = [
    infoSection(input),
    ...(input.includeSummary ? [summarySection(input)] : []),
    billDetailSection(input, model),
    ...(input.dateTotals.length ? [dailyTotalsSection(input)] : []),
  ];

  return createSingleSheetReportWorkbook(XLSX, sections, input.layout);
}
