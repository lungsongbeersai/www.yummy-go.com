import type { ApiEntity } from "@/services/shared/types";
import {
  createDailySalesBillGroups,
  type DailySalesBillGroup,
} from "@/stores/report-store";
import type {
  ReportColumn,
  ReportFilters,
  SummaryCardConfig,
  SummaryCards,
} from "./daily-sales-report-types";
import {
  firstNumber,
  formatDate,
  readValue,
  reportImageColor,
  reportImageSrc,
  reportRecordId,
  summaryCardValue,
  textValue,
  toppingLines,
} from "./daily-sales-report-utils";

export function reportFileBaseName(filters: ReportFilters) {
  return `daily-sales-${filters.typePage}-${filters.dateFrom}-to-${filters.dateTo}`;
}

export function waitForPaint() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}
export function exportCellValue(row: ApiEntity, column: ReportColumn) {
  const value = readValue(row, column.keys);
  if (column.kind === "image")
    return reportImageSrc(row) || reportImageColor(row);
  if (column.kind === "product") {
    const productName = textValue(value, "");
    const toppings = toppingLines(row);
    return toppings.length
      ? `${productName} (${toppings.join("; ")})`
      : productName;
  }
  if (column.kind === "money" || column.kind === "number")
    return firstNumber(value);
  if (column.kind === "date") return formatDate(value);
  return textValue(value, "");
}

export function exportSummaryRows(
  cards: SummaryCardConfig[],
  summaryCards: SummaryCards,
  reportTotal: ApiEntity,
) {
  return cards.map((card) => ({
    Metric: card.label,
    Value: firstNumber(summaryCardValue(summaryCards, reportTotal, card.keys)),
  }));
}

export function exportTableRows(rows: ApiEntity[], columns: ReportColumn[]) {
  return rows.map((row, index) => {
    const output: Record<string, string | number> = { No: index + 1 };
    columns.forEach((column) => {
      output[column.header] = exportCellValue(row, column);
    });
    return output;
  });
}
export function exportBillRows(
  groups: DailySalesBillGroup[],
  t: (key: string) => string,
  includeStatus = true,
) {
  const allItems = groups.flatMap((group) => group.items);
  const hasStatusData = allItems.some((item) => {
    const value = readValue(item, [
      "status_name",
      "status_text",
      "status",
      "status_code",
      "order_status_text",
      "order_it_status_text",
    ]);
    return value !== null && value !== undefined && value !== "";
  });

  return groups.map((group, index) => {
    const row: Record<string, string | number> = {
      [t("fields.no")]: index + 1,
      [t("report.columns.invoiceNumber")]: group.invoiceNumber,
      [t("report.columns.saleDate")]: group.saleDate,
      [t("report.columns.tableName")]: group.tableName,
      [t("report.columns.paymentType")]: group.paymentType,
      [t("report.columns.cashierName")]: group.cashierName,
      [t("report.billItems")]: group.itemCount,
      [t("report.cards.netTotal")]: group.lineTotal,
    };

    if (includeStatus && hasStatusData) {
      row[t("report.columns.status")] = group.status;
    }

    return row;
  });
}

export function exportDateTotalRows(
  rows: ApiEntity[],
  t: (key: string) => string,
) {
  return rows.map((row) => ({
    [t("report.columns.saleDate")]: formatDate(
      readValue(row, ["date", "sale_date"]),
    ),
    [t("report.cards.billsCount")]: firstNumber(
      readValue(row, ["bills_count", "bill_count"]),
    ),
    [t("report.cards.orderTotal")]: firstNumber(
      readValue(row, ["amount", "order_total", "total_order"]),
    ),
    [t("report.cards.toppingTotal")]: firstNumber(
      readValue(row, ["topping_total", "topping_line_total"]),
    ),
    [t("report.cards.discountAmount")]: firstNumber(
      readValue(row, ["discount_bill", "discount_amount", "discount_total"]),
    ),
    [t("report.cards.itemDiscountAmount")]: firstNumber(
      readValue(row, ["item_discount", "item_discount_amount"]),
    ),
    [t("report.cards.serviceCharge")]: firstNumber(
      readValue(row, ["service_charge", "service_charge_amount"]),
    ),
    [t("report.cards.vatAmount")]: firstNumber(
      readValue(row, ["vat", "vat_amount"]),
    ),
    [t("report.cards.netTotal")]: firstNumber(
      readValue(row, ["total", "net_total", "grand_total"]),
    ),
  }));
}

export function dateTotalsFromGroups(groups: DailySalesBillGroup[]) {
  const byDate = new Map<string, ApiEntity>();

  groups.forEach((group) => {
    const date = formatDate(group.saleDate);
    const current = byDate.get(date) ?? {
      amount: 0,
      bills_count: 0,
      date,
      discount_bill: 0,
      item_discount: 0,
      service_charge: 0,
      topping_total: 0,
      total: 0,
      vat: 0,
    };

    current.bills_count = firstNumber(current.bills_count) + 1;
    current.amount = firstNumber(current.amount) + group.amountTotal;
    current.topping_total =
      firstNumber(current.topping_total) + group.toppingTotal;
    current.discount_bill =
      firstNumber(current.discount_bill) + group.discountBillAmount;
    current.item_discount =
      firstNumber(current.item_discount) + group.itemDiscountAmount;
    current.service_charge =
      firstNumber(current.service_charge) + group.serviceChargeAmount;
    current.total = firstNumber(current.total) + group.lineTotal;
    current.vat = firstNumber(current.vat) + group.vatAmount;
    byDate.set(date, current);
  });

  return Array.from(byDate.values());
}

export function selectedDetailBillGroups(
  groups: DailySalesBillGroup[],
  selectedRecordIds: Set<string>,
) {
  return groups.flatMap((group) => {
    const selectedItems = group.items.filter((item) =>
      selectedRecordIds.has(reportRecordId(item)),
    );
    if (!selectedItems.length) return [];
    if (selectedItems.length === group.items.length) return [group];
    return createDailySalesBillGroups(selectedItems);
  });
}
