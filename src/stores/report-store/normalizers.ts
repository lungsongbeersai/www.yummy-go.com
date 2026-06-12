import { isAllPageLimit, pageLimitNumber } from "@/lib/pagination";
import type { DailySalesReportResponse } from "@/services/report";
import type { ApiEntity, PageLimit } from "@/services/shared/types";

export type SummaryCards = ApiEntity | ApiEntity[];

export interface DailySalesBillGroup {
  amountTotal: number;
  baseTotal: number;
  cashierName: string;
  changeAmount: number;
  cancelled: boolean;
  debtAmount: number;
  discountBillAmount: number;
  id: string;
  itemCount: number;
  itemDiscountAmount: number;
  items: ApiEntity[];
  lineTotal: number;
  paymentType: string;
  qtyTotal: number;
  receiveCashAmount: number;
  receiveTransferAmount: number;
  saleDate: string;
  serviceChargeAmount: number;
  status: string;
  tableName: string;
  toppingTotal: number;
  vatAmount: number;
  invoiceNumber: string;
}

function isRecord(value: unknown): value is ApiEntity {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asRecord(value: unknown): ApiEntity {
  return isRecord(value) ? value : {};
}

function asRecords(value: unknown): ApiEntity[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function isPresent(value: unknown) {
  return value !== null && value !== undefined && value !== "";
}

function textValue(value: unknown, fallback = "") {
  return isPresent(value) ? String(value) : fallback;
}

function readValue(row: ApiEntity, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (isPresent(value)) return value;
  }
  return undefined;
}

function readAnyValue(rows: ApiEntity[], keys: string[]) {
  for (const row of rows) {
    const value = readValue(row, keys);
    if (isPresent(value)) return value;
  }
  return undefined;
}

function numericValue(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function serviceChargeValue(sources: ApiEntity[], itemDiscountAmount = 0) {
  const explicit = optionalNumber(
    readAnyValue(sources, [
      "service_charge",
      "service_charge_amount",
      "service_total",
      "sum_service_total"
    ])
  );
  if (explicit !== null) return explicit;

  const amount = optionalNumber(
    readAnyValue(sources, ["amount", "order_total", "total_order", "gross_total"])
  );
  const total = optionalNumber(
    readAnyValue(sources, ["total", "net_total", "grand_total"])
  );
  const toppingTotal = numericValue(
    readAnyValue(sources, ["topping_total", "topping_line_total", "sum_topping_total"])
  );
  const discountBill = numericValue(
    readAnyValue(sources, ["discount_bill", "discount_amount", "discount_total"])
  );
  const vat = numericValue(
    readAnyValue(sources, ["vat", "vat_amount", "vat_total"])
  );

  if (amount === null || total === null) return 0;
  return Math.max(
    0,
    total - amount - toppingTotal + discountBill + itemDiscountAmount - vat
  );
}

function optionalNumber(value: unknown) {
  if (!isPresent(value)) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function rowQuantity(row: ApiEntity) {
  return optionalNumber(readValue(row, ["qty", "quantity", "order_it_qty"])) ?? 0;
}

function rowBaseTotal(row: ApiEntity) {
  const explicitTotal = optionalNumber(readValue(row, ["base_total", "base_line_total"]));
  if (explicitTotal !== null) return explicitTotal;

  const basePrice = optionalNumber(readValue(row, ["base_price", "unit_price", "pro_detail_sprice", "price", "sale_price"])) ?? 0;
  const quantity = optionalNumber(readValue(row, ["qty", "quantity", "order_it_qty"])) ?? 1;
  const calculated = basePrice * quantity;
  if (calculated > 0) return calculated;
  return optionalNumber(readValue(row, ["line_total", "total", "net_total"])) ?? 0;
}

function isTruthy(value: unknown) {
  if (value === true || value === 1) return true;
  const text = String(value ?? "").trim().toLowerCase();
  return text === "true" || text === "1" || text === "yes";
}

function isCancelledReportRow(row: ApiEntity) {
  if (isTruthy(readValue(row, ["is_cancelled", "cancelled", "is_void"]))) return true;
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
      "status"
    ])
  ).toLowerCase();

  return status.includes("cancel") || status.includes("void");
}

function nestedRows(rows: ApiEntity[]) {
  const nested = rows.flatMap((row) => {
    for (const key of ["items", "orders", "report_data", "details", "data"]) {
      const items = asRecords(row[key]);
      if (items.length) {
        const parent = { ...row };
        delete parent[key];
        return items.map((item) => ({ ...parent, ...item }));
      }
    }
    return [];
  });

  return nested.length ? nested : rows;
}

function isNewDetailBill(row: ApiEntity) {
  return isRecord(row.title) && isRecord(row.summary) && Array.isArray(row.details);
}

function syntheticDetailId(billId: string, row: ApiEntity, itemIndex: number) {
  return [
    "detail",
    billId,
    itemIndex,
    textValue(readValue(row, ["product_name", "prod_name", "prod_name_la", "prod_name_eng"])),
    textValue(readValue(row, ["price", "sale_price", "unit_price"])),
    textValue(readValue(row, ["qty", "quantity", "order_it_qty"])),
    textValue(readValue(row, ["total", "line_total", "net_total"]))
  ].join(":");
}

function normalizeNewDetailBill(row: ApiEntity, parent: ApiEntity, index: number): DailySalesBillGroup {
  const title = asRecord(row.title);
  const summary = asRecord(row.summary);
  const details = asRecords(row.details);
  const invoiceNumber = textValue(readValue(title, ["invoice", "invoice_number", "invoice_no", "order_invoice"]), `bill-${index + 1}`);
  const branchId = textValue(readValue(parent, ["branch_uuid_fk", "branch_uuid"]), "");
  const billId = textValue(readValue(row, ["order_uuid", "bill_uuid", "order_id"]), `bill:${branchId ? `${branchId}:` : ""}${invoiceNumber}`);
  const saleDate = textValue(readValue(title, ["date", "sale_date", "business_date", "created_at"]), "-");
  const tableName = textValue(readValue(title, ["table_name", "table_name_la", "table_name_eng"]), "-");
  const cashierName = textValue(readValue(title, ["cashier_name", "login_name", "user_name"]), "-");
  const paymentType = textValue(readValue(title, ["payment_method", "payment_type", "payment_name", "payment_type_name"]), "-");
  const status = textValue(readValue(row, ["status_name", "status_text", "status", "status_code"]), "-");
  const billSources = [summary, title, row];
  const items = details.map((detail, itemIndex) => {
    const item = {
      ...parent,
      ...detail,
      __report_bill_id: billId,
      __report_record_id: syntheticDetailId(billId, detail, itemIndex),
      cashier_name: cashierName,
      invoice_number: invoiceNumber,
      item_discount_amount: numericValue(readValue(detail, ["discount", "item_discount_amount", "order_it_discount_amount"])),
      line_total: numericValue(readValue(detail, ["total", "line_total", "net_total"])),
      order_invoice: invoiceNumber,
      payment_method: paymentType,
      payment_type_name: paymentType,
      sale_date: saleDate,
      status_name: textValue(readValue(detail, ["status_name", "status_text", "status", "status_code"]), status),
      table_name: tableName,
      topping_total: numericValue(readValue(detail, ["topping_total", "topping_unit_total", "topping_line_total"]))
    };
    return item;
  });

  const itemDiscountAmount = numericValue(readValue(summary, ["item_discount", "item_discount_amount"])) ||
    items.reduce((total, item) => total + numericValue(readValue(item, ["item_discount_amount", "discount"])), 0);

  return {
    amountTotal: numericValue(readAnyValue(billSources, ["amount", "order_total", "total_order", "gross_total"])),
    baseTotal: numericValue(readAnyValue(billSources, ["amount", "base_total", "base_line_total"])),
    cashierName,
    changeAmount: numericValue(readAnyValue(billSources, ["change_amount", "change_total"])),
    cancelled: isCancelledReportRow(row),
    debtAmount: numericValue(readAnyValue(billSources, ["debt_amount", "debt_total", "balance_total"])),
    discountBillAmount: numericValue(readAnyValue(billSources, ["discount_bill", "discount_amount", "discount_total"])),
    id: billId,
    invoiceNumber,
    itemCount: details.length,
    itemDiscountAmount,
    items,
    lineTotal: numericValue(readAnyValue(billSources, ["total", "net_total", "grand_total"])),
    paymentType,
    qtyTotal: items.reduce((total, item) => total + rowQuantity(item), 0),
    receiveCashAmount: numericValue(readAnyValue(billSources, ["receive_cash", "cash_received", "cash_amount", "cash_total"])),
    receiveTransferAmount: numericValue(readAnyValue(billSources, ["receive_transfer", "transfer_received", "transfer_amount", "transfer_total"])),
    saleDate,
    serviceChargeAmount: serviceChargeValue(billSources, itemDiscountAmount),
    status,
    tableName,
    toppingTotal: numericValue(readAnyValue(billSources, ["topping_total", "topping_line_total", "sum_topping_total"])),
    vatAmount: numericValue(readAnyValue(billSources, ["vat", "vat_amount", "vat_total"]))
  };
}

function detailBillGroupsFromRows(rows: ApiEntity[]) {
  const groups: DailySalesBillGroup[] = [];

  rows.forEach((row, rowIndex) => {
    if (isNewDetailBill(row)) {
      groups.push(normalizeNewDetailBill(row, {}, rowIndex));
      return;
    }

    const items = asRecords(row.items);
    items.forEach((item, itemIndex) => {
      if (!isNewDetailBill(item)) return;
      const parent = { ...row };
      delete parent.items;
      groups.push(normalizeNewDetailBill(item, parent, groups.length || itemIndex));
    });
  });

  return groups;
}

function detailBillGroupsFromResponse(root: ApiEntity, response: DailySalesReportResponse) {
  const dataRows = Array.isArray(response.data) ? asRecords(response.data) : asRecords(root.data);
  if (dataRows.length) {
    const groups = detailBillGroupsFromRows(dataRows);
    if (groups.length) return groups;
  }

  for (const key of ["report_data", "items", "orders", "rows", "list"]) {
    const rows = asRecords(root[key]);
    const groups = detailBillGroupsFromRows(rows);
    if (groups.length) return groups;
  }

  return [];
}

export function createDailySalesBillGroups(rows: ApiEntity[]) {
  const groups = new Map<string, DailySalesBillGroup>();

  rows.forEach((row, index) => {
    const orderUuid = textValue(readValue(row, ["__report_bill_id", "order_uuid", "invoice_number", "invoice_no", "invoice", "order_invoice"]));
    const id = orderUuid || `bill-${index}`;
    const invoiceNumber = textValue(readValue(row, ["invoice_number", "invoice_no", "invoice", "order_invoice"]), "-");
    const cancelled = isCancelledReportRow(row);
    const current = groups.get(id);

    if (!current) {
      groups.set(id, {
        amountTotal: numericValue(readValue(row, ["amount", "order_total", "total_order", "gross_total"])) || rowBaseTotal(row),
        baseTotal: rowBaseTotal(row),
        cashierName: textValue(readValue(row, ["cashier_name", "login_name", "user_name"]), "-"),
        changeAmount: numericValue(readValue(row, ["change_amount", "change_total"])),
        cancelled,
        debtAmount: numericValue(readValue(row, ["debt_amount", "debt_total", "balance_total"])),
        discountBillAmount: numericValue(readValue(row, ["discount_bill", "discount_amount", "discount_total"])),
        id,
        invoiceNumber,
        itemCount: 1,
        itemDiscountAmount: numericValue(readValue(row, ["item_discount", "item_discount_amount", "order_it_discount_amount", "discount"])),
        items: [row],
        lineTotal: numericValue(readValue(row, ["line_total", "net_total", "total"])),
        paymentType: textValue(readValue(row, ["payment_type", "payment_method", "payment_name", "payment_type_name"]), "-"),
        qtyTotal: rowQuantity(row),
        receiveCashAmount: numericValue(readValue(row, ["receive_cash", "cash_received", "cash_amount", "cash_total"])),
        receiveTransferAmount: numericValue(readValue(row, ["receive_transfer", "transfer_received", "transfer_amount", "transfer_total"])),
        saleDate: textValue(readValue(row, ["sale_date", "business_date", "created_at", "order_date", "date"]), "-"),
        serviceChargeAmount: numericValue(readValue(row, ["service_charge", "service_charge_amount", "service_total", "sum_service_total"])),
        status: textValue(readValue(row, ["status_name", "status_text", "status", "status_code", "order_status_text", "order_it_status_text"]), "-"),
        tableName: textValue(readValue(row, ["table_name", "table_name_la", "table_name_eng"]), "-"),
        toppingTotal: numericValue(readValue(row, ["topping_total", "topping_unit_total", "topping_line_total"])),
        vatAmount: numericValue(readValue(row, ["vat", "vat_amount", "vat_total"]))
      });
      return;
    }

    current.items.push(row);
    current.itemCount += 1;
    current.qtyTotal += rowQuantity(row);
    current.amountTotal += numericValue(readValue(row, ["amount", "order_total", "total_order", "gross_total"])) || rowBaseTotal(row);
    current.baseTotal += rowBaseTotal(row);
    current.toppingTotal += numericValue(readValue(row, ["topping_total", "topping_unit_total", "topping_line_total"]));
    current.discountBillAmount += numericValue(readValue(row, ["discount_bill", "discount_amount", "discount_total"]));
    current.itemDiscountAmount += numericValue(readValue(row, ["item_discount", "item_discount_amount", "order_it_discount_amount", "discount"]));
    current.lineTotal += numericValue(readValue(row, ["line_total", "net_total", "total"]));
    current.serviceChargeAmount += numericValue(readValue(row, ["service_charge", "service_charge_amount", "service_total", "sum_service_total"]));
    current.receiveCashAmount += numericValue(readValue(row, ["receive_cash", "cash_received", "cash_amount", "cash_total"]));
    current.receiveTransferAmount += numericValue(readValue(row, ["receive_transfer", "transfer_received", "transfer_amount", "transfer_total"]));
    current.debtAmount += numericValue(readValue(row, ["debt_amount", "debt_total", "balance_total"]));
    current.changeAmount += numericValue(readValue(row, ["change_amount", "change_total"]));
    current.vatAmount += numericValue(readValue(row, ["vat", "vat_amount", "vat_total"]));
    current.cancelled = current.cancelled || cancelled;
    if (cancelled && isPresent(readValue(row, ["status_name", "status_text", "status", "status_code", "order_status_text", "order_it_status_text"]))) {
      current.status = textValue(readValue(row, ["status_name", "status_text", "status", "status_code", "order_status_text", "order_it_status_text"]));
    }
    if (current.status === "-" && isPresent(readValue(row, ["status_name", "status_text", "status", "status_code"]))) {
      current.status = textValue(readValue(row, ["status_name", "status_text", "status", "status_code"]));
    }
  });

  return Array.from(groups.values());
}

function responseRoot(response: DailySalesReportResponse) {
  return isRecord(response.data) ? response.data : response;
}

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

function reportRows(root: ApiEntity, response: DailySalesReportResponse) {
  const detailGroups = detailBillGroupsFromResponse(root, response);
  if (detailGroups.length) return detailGroups.flatMap((group) => group.items);

  const dataRows = Array.isArray(response.data) ? asRecords(response.data) : [];
  if (dataRows.length) return nestedRows(dataRows);

  for (const key of ["data", "report_data", "items", "orders", "rows", "list"]) {
    const rows = asRecords(root[key]);
    if (rows.length) return nestedRows(rows);
  }

  return [];
}

function summaryCards(root: ApiEntity): SummaryCards {
  const cards = root.summary_cards;
  if (Array.isArray(cards)) return asRecords(cards);
  return asRecord(cards);
}

export function normalizeDailySalesReportResponse(response: DailySalesReportResponse) {
  const root = responseRoot(response);
  const detailGroups = detailBillGroupsFromResponse(root, response);
  const rows = detailGroups.length ? detailGroups.flatMap((group) => group.items) : reportRows(root, response);

  return {
    billGroups: detailGroups.length ? detailGroups : createDailySalesBillGroups(rows),
    grandTotalByDate: asRecords(root.grand_total_by_date),
    reportTotal: asRecord(root.report_total ?? root.grand_total),
    rows,
    summaryCards: summaryCards(root)
  };
}

export function reportTotalPages(root: ApiEntity, total: number, limit: PageLimit, page: number) {
  if (isAllPageLimit(limit)) return 1;
  const explicit = firstNumber(root.totalPages, root.total_pages, root.total_page, root.totalPage);
  if (explicit !== null) return Math.max(1, explicit);
  const numericLimit = pageLimitNumber(limit);
  return total > 0 && numericLimit > 0 ? Math.max(1, Math.ceil(total / numericLimit)) : Math.max(1, page);
}

