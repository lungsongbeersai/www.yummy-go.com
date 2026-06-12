import { money } from "@/lib/format";
import { getProductImageUrl } from "@/services/product";
import type { DailySalesReportType } from "@/services/report";
import type { ApiEntity } from "@/services/shared/types";
import {
  createDailySalesBillGroups,
  type DailySalesBillGroup,
} from "@/stores/report-store";
import type {
  DetailPaginationBasis,
  ReportBranchOption,
  ReportColumn,
  ReportPaymentMethodFilter,
  SummaryCards,
} from "./daily-sales-report-types";

export const reportImageKeys = [
  "prod_image",
  "product_image",
  "image",
  "image_url",
];
export const paymentMethodOptions: ReportPaymentMethodFilter[] = [
  "all",
  "cash",
  "transfer",
  "debt",
  "mixed",
];

const HEX_COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

export function paymentMethodParam(paymentMethod: ReportPaymentMethodFilter) {
  return paymentMethod === "all" ? undefined : paymentMethod;
}

export function branchOptionLabel(branch: ApiEntity, language: string) {
  const keys =
    language === "en"
      ? [
          "branch_name_eng",
          "branch_name",
          "branch_name_la",
          "branch_code",
          "branch_uuid",
        ]
      : [
          "branch_name_la",
          "branch_name",
          "branch_name_eng",
          "branch_code",
          "branch_uuid",
        ];

  return textValue(readValue(branch, keys), "-");
}

export function branchOptionFromRow(
  branch: ApiEntity,
  language: string,
): ReportBranchOption | null {
  const value = textValue(
    readValue(branch, ["branch_uuid", "branch_uuid_fk"]),
    "",
  );
  if (!value) return null;
  return { value, label: branchOptionLabel(branch, language) };
}

export function selectedBranchLabel(
  options: ReportBranchOption[],
  value: string,
  fallback = "-",
) {
  return options.find((option) => option.value === value)?.label ?? fallback;
}

export function localDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isPresent(value: unknown) {
  return value !== null && value !== undefined && value !== "";
}

export function textValue(value: unknown, fallback = "-") {
  return isPresent(value) ? String(value) : fallback;
}

export function displayTextValue(value: unknown, fallback = "") {
  const text = textValue(value, "").trim();
  return text && text !== "-" ? text : fallback;
}

export function hasDisplayValue(value: unknown) {
  return Boolean(displayTextValue(value));
}

export function hasColumnData(rows: ApiEntity[], column: ReportColumn) {
  return rows.some((row) => hasDisplayValue(readValue(row, column.keys)));
}

export function normalizeKey(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

export function isRecord(value: unknown): value is ApiEntity {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function asRecords(value: unknown): ApiEntity[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

export function readValue(row: ApiEntity, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (isPresent(value)) return value;
  }
  return undefined;
}

export function firstNumber(...values: unknown[]) {
  for (const value of values) {
    if (!isPresent(value)) continue;
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return 0;
}

export function firstOptionalNumber(...values: unknown[]) {
  for (const value of values) {
    if (!isPresent(value)) continue;
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

export function summaryCardValue(
  summaryCards: SummaryCards,
  reportTotal: ApiEntity,
  keys: string[],
) {
  if (Array.isArray(summaryCards)) {
    const aliases = keys.map(normalizeKey);
    for (const card of summaryCards) {
      const cardKey = normalizeKey(
        readValue(card, [
          "key",
          "name",
          "code",
          "field",
          "id",
          "label",
          "title",
        ]),
      );
      if (!aliases.includes(cardKey)) continue;
      const value = readValue(card, [
        "value",
        "amount",
        "total",
        "count",
        ...keys,
      ]);
      if (isPresent(value)) return value;
    }
  } else {
    const value = readValue(summaryCards, keys);
    if (isPresent(value)) return value;
  }

  return readValue(reportTotal, keys);
}

export function reportMetricNumber(
  summaryCards: SummaryCards,
  reportTotal: ApiEntity,
  keys: string[],
) {
  return firstOptionalNumber(summaryCardValue(summaryCards, reportTotal, keys));
}

export function detailPaginationBasis(
  total: number,
  summaryCards: SummaryCards,
  reportTotal: ApiEntity,
): DetailPaginationBasis {
  const linesCount = reportMetricNumber(summaryCards, reportTotal, [
    "lines_count",
    "line_count",
    "items_count",
    "total_lines",
  ]);
  const billsCount = reportMetricNumber(summaryCards, reportTotal, [
    "bills_count",
    "bill_count",
    "total_bills",
    "orders_count",
  ]);

  if (linesCount !== null && total === linesCount) return "lines";
  if (billsCount !== null && total === billsCount) return "bills";
  if (
    linesCount !== null &&
    billsCount !== null &&
    linesCount !== billsCount &&
    total > billsCount
  ) {
    return "lines";
  }
  return "lines";
}

export function formatDate(value: unknown) {
  const raw = textValue(value, "");
  if (!raw) return "-";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString();
}

export function isTruthy(value: unknown) {
  if (value === true || value === 1) return true;
  const text = String(value ?? "")
    .trim()
    .toLowerCase();
  return text === "true" || text === "1" || text === "yes";
}

export function isCancelledRow(row: ApiEntity) {
  if (isTruthy(readValue(row, ["is_cancelled", "cancelled", "is_void"])))
    return true;
  const status = textValue(
    readValue(row, [
      "status_code",
      "payment_type_code",
      "order_status",
      "order_status_text",
      "order_it_status",
      "order_it_status_text",
      "status_name",
      "status_text",
      "status",
    ]),
    "",
  ).toLowerCase();

  return status.includes("cancel") || status.includes("void");
}

export function statusClass(row: ApiEntity, value: unknown) {
  if (isCancelledRow(row)) {
    return "border-destructive/25 bg-destructive/10 text-destructive";
  }
  const status = textValue(value, "").toLowerCase();
  if (status.includes("cancel") || status.includes("void") || status === "0") {
    return "border-destructive/20 bg-destructive/10 text-destructive";
  }
  if (
    status.includes("active") ||
    status.includes("paid") ||
    status.includes("success") ||
    status === "1"
  ) {
    return "border-primary/20 bg-primary/10 text-primary";
  }
  return "border-border bg-muted text-muted-foreground";
}

export function isHexColor(value: string) {
  return HEX_COLOR_PATTERN.test(value.trim());
}

export function reportImageValue(row: ApiEntity) {
  return textValue(readValue(row, reportImageKeys), "").trim();
}

export function reportImageHexColor(value: string) {
  const hashIndex = value.lastIndexOf("#");
  const candidate = hashIndex >= 0 ? value.slice(hashIndex) : value;
  return isHexColor(candidate) ? candidate : "";
}

export function reportImageSrc(row: ApiEntity) {
  const value = reportImageValue(row);
  if (!value || reportImageHexColor(value)) return "";
  if (/^(https?:\/\/|data:image\/)/i.test(value) || value.startsWith("/"))
    return value;
  return getProductImageUrl(value);
}

export function reportImageColor(row: ApiEntity) {
  const value = reportImageValue(row);
  return reportImageHexColor(value);
}

export function rowKey(row: ApiEntity, index: number) {
  return textValue(
    readValue(row, [
      "__report_record_id",
      "order_item_uuid",
      "order_it_uuid",
      "order_uuid",
      "invoice_number",
      "invoice_no",
      "invoice",
    ]),
    String(index),
  );
}

export function reportRecordId(row: ApiEntity) {
  const syntheticId = textValue(readValue(row, ["__report_record_id"]), "");
  if (syntheticId) return syntheticId;

  const itemId = textValue(
    readValue(row, ["order_item_uuid", "order_it_uuid"]),
    "",
  );
  if (itemId) return `item:${itemId}`;

  const hasItemFields = [
    "product_name",
    "prod_name",
    "base_price",
    "qty",
    "line_total",
  ].some((key) => isPresent(row[key]));
  const orderId = textValue(
    readValue(row, [
      "order_uuid",
      "invoice_number",
      "invoice_no",
      "invoice",
      "order_invoice",
    ]),
    "",
  );
  if (!hasItemFields && orderId) return `order:${orderId}`;

  return [
    "line",
    orderId,
    textValue(
      readValue(row, [
        "product_name",
        "prod_name",
        "prod_name_la",
        "prod_name_eng",
      ]),
      "",
    ),
    textValue(readValue(row, ["size_name", "size", "prod_size"]), ""),
    textValue(readValue(row, ["qty", "quantity", "order_it_qty"]), ""),
    textValue(readValue(row, ["line_total", "net_total", "total"]), ""),
    textValue(readValue(row, ["note", "order_it_note", "order_note"]), ""),
  ].join(":");
}

export function rowQuantityValue(row: ApiEntity) {
  return firstNumber(readValue(row, ["qty", "quantity", "order_it_qty"]));
}

export function rowBaseTotalValue(row: ApiEntity) {
  const explicitTotal = firstOptionalNumber(
    readValue(row, ["base_total", "base_line_total"]),
  );
  if (explicitTotal !== null) return explicitTotal;
  const calculated =
    firstNumber(
      readValue(row, [
        "base_price",
        "unit_price",
        "pro_detail_sprice",
        "price",
        "sale_price",
      ]),
    ) *
    (firstOptionalNumber(readValue(row, ["qty", "quantity", "order_it_qty"])) ??
      1);
  if (calculated > 0) return calculated;
  return firstNumber(readValue(row, ["line_total", "total", "net_total"]));
}

export function sumRows(rows: ApiEntity[], keys: string[]) {
  return rows.reduce(
    (total, row) => total + firstNumber(readValue(row, keys)),
    0,
  );
}

export function toppingLines(row: ApiEntity) {
  return asRecords(row.toppings).map((topping) => {
    const qty = firstNumber(readValue(topping, ["qty", "quantity"]));
    const name = textValue(
      readValue(topping, ["name", "topping_name", "prod_name", "product_name"]),
      "",
    );
    const total = firstNumber(
      readValue(topping, ["total", "line_total", "amount"]),
      readValue(topping, ["price"]),
    );
    return name
      ? `${qty || 1} x ${name} - ${money(total)}`
      : `${qty || 1} x ${money(total)}`;
  });
}

export function reportTotalFromRows(
  rows: ApiEntity[],
  typePage: DailySalesReportType,
): ApiEntity {
  if (typePage === "detail") {
    const billGroups = createDailySalesBillGroups(rows);
    const cancelledLines = rows.filter(isCancelledRow).length;

    return {
      active_lines_count: Math.max(0, rows.length - cancelledLines),
      amount: rows.reduce(
        (total, row) =>
          total +
          firstNumber(
            readValue(row, ["line_total", "total", "net_total"]),
            rowBaseTotalValue(row),
          ),
        0,
      ),
      base_total: rows.reduce(
        (total, row) => total + rowBaseTotalValue(row),
        0,
      ),
      bills_count: billGroups.length,
      cancelled_lines_count: cancelledLines,
      change_amount: sumRows(rows, ["change_amount", "change_total"]),
      debt_amount: sumRows(rows, [
        "debt_amount",
        "debt_total",
        "balance_total",
      ]),
      discount_bill: sumRows(rows, [
        "discount_bill",
        "discount_amount",
        "discount_total",
      ]),
      item_discount: sumRows(rows, [
        "item_discount",
        "item_discount_amount",
        "order_it_discount_amount",
        "discount",
      ]),
      item_discount_amount: sumRows(rows, [
        "item_discount",
        "item_discount_amount",
        "order_it_discount_amount",
        "discount",
      ]),
      line_total: sumRows(rows, ["line_total", "net_total", "total"]),
      lines_count: rows.length,
      receive_cash: sumRows(rows, [
        "cash_received",
        "receive_cash",
        "cash_amount",
        "cash_total",
      ]),
      receive_transfer: sumRows(rows, [
        "transfer_received",
        "receive_transfer",
        "transfer_amount",
        "transfer_total",
      ]),
      service_charge: sumRows(rows, [
        "service_charge",
        "service_charge_amount",
        "service_total",
      ]),
      total: sumRows(rows, ["line_total", "net_total", "total"]),
      qty_total: rows.reduce((total, row) => total + rowQuantityValue(row), 0),
      topping_total: sumRows(rows, [
        "topping_total",
        "topping_unit_total",
        "topping_line_total",
      ]),
      vat: sumRows(rows, ["vat", "vat_amount", "vat_total"]),
    };
  }

  const cancelledBills = rows.filter(isCancelledRow).length;
  return {
    active_count: Math.max(0, rows.length - cancelledBills),
    bills_count: rows.length,
    cancelled_count: cancelledBills,
    change_amount: sumRows(rows, ["change_amount", "change_total"]),
    debt_amount: sumRows(rows, ["debt_amount", "debt_total", "balance_total"]),
    discount_amount: sumRows(rows, [
      "discount",
      "discount_amount",
      "discount_total",
    ]),
    net_total: sumRows(rows, ["net_total", "grand_total", "order_grand_total"]),
    order_total: sumRows(rows, ["order_total", "total_order", "gross_total"]),
    receive_cash: sumRows(rows, [
      "cash_received",
      "receive_cash",
      "cash_amount",
      "cash_total",
    ]),
    receive_transfer: sumRows(rows, [
      "transfer_received",
      "receive_transfer",
      "transfer_amount",
      "transfer_total",
    ]),
    service_charge: sumRows(rows, [
      "service_charge",
      "service_charge_amount",
      "service_total",
    ]),
    vat_amount: sumRows(rows, ["vat", "vat_amount", "vat_total"]),
  };
}

export function reportTotalFromBillGroups(
  groups: DailySalesBillGroup[],
): ApiEntity {
  const rows = groups.flatMap((group) => group.items);
  const cancelledLines = rows.filter(isCancelledRow).length;
  const cancelledBills = groups.filter((group) => group.cancelled).length;

  return {
    active_count: Math.max(0, groups.length - cancelledBills),
    active_lines_count: Math.max(0, rows.length - cancelledLines),
    amount: groups.reduce((total, group) => total + group.amountTotal, 0),
    base_total: groups.reduce((total, group) => total + group.baseTotal, 0),
    bills_count: groups.length,
    cancelled_count: cancelledBills,
    cancelled_lines_count: cancelledLines,
    change_amount: groups.reduce(
      (total, group) => total + group.changeAmount,
      0,
    ),
    debt_amount: groups.reduce((total, group) => total + group.debtAmount, 0),
    discount_bill: groups.reduce(
      (total, group) => total + group.discountBillAmount,
      0,
    ),
    item_discount: groups.reduce(
      (total, group) => total + group.itemDiscountAmount,
      0,
    ),
    item_discount_amount: groups.reduce(
      (total, group) => total + group.itemDiscountAmount,
      0,
    ),
    line_total: groups.reduce((total, group) => total + group.lineTotal, 0),
    lines_count: rows.length,
    qty_total: groups.reduce((total, group) => total + group.qtyTotal, 0),
    receive_cash: groups.reduce(
      (total, group) => total + group.receiveCashAmount,
      0,
    ),
    receive_transfer: groups.reduce(
      (total, group) => total + group.receiveTransferAmount,
      0,
    ),
    service_charge: groups.reduce(
      (total, group) => total + group.serviceChargeAmount,
      0,
    ),
    topping_total: groups.reduce(
      (total, group) => total + group.toppingTotal,
      0,
    ),
    total: groups.reduce((total, group) => total + group.lineTotal, 0),
    vat: groups.reduce((total, group) => total + group.vatAmount, 0),
  };
}

export function isZeroColumnValue(row: ApiEntity, column: ReportColumn) {
  if (column.kind !== "money" && column.kind !== "number") return false;
  return firstNumber(readValue(row, column.keys)) === 0;
}
