import { isAllPageLimit, pageLimitNumber } from "@/lib/pagination";
import type { DailySalesOrderReportResponse } from "@/services/report";
import type { ApiEntity, PageLimit } from "@/services/shared/types";
import { normalizeDailySalesReportResponse, type DailySalesBillGroup, type SummaryCards } from "./normalizers";

export interface DailySalesOrderReportPagination {
  limit: PageLimit;
  page: number;
  total: number;
  totalPages: number;
}

export interface DailySalesOrderReportNormalized {
  billGroups: DailySalesBillGroup[];
  filters: ApiEntity;
  grandTotalByDate: ApiEntity[];
  pagination: DailySalesOrderReportPagination;
  reportTotal: ApiEntity;
  response: DailySalesOrderReportResponse;
  rows: ApiEntity[];
  summaryCards: SummaryCards;
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

function numberValue(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function textValue(value: unknown, fallback = "") {
  return value !== null && value !== undefined && value !== "" ? String(value) : fallback;
}

function readValue(row: ApiEntity, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value !== null && value !== undefined && value !== "") return value;
  }
  return undefined;
}

function normalizeOrderItem(order: ApiEntity, item: ApiEntity, itemIndex: number) {
  const orderId = textValue(readValue(order, ["order_uuid", "bill_uuid", "uuid"]), "");
  const invoiceNumber = textValue(readValue(order, ["order_invoice", "invoice_number", "invoice_no", "invoice"]), "");
  const productName = textValue(readValue(item, ["product_full_name", "product_name", "prod_name"]), "-");
  const salePrice = numberValue(readValue(item, ["product_price", "sale_price", "price", "unit_price"]));
  const lineTotal = numberValue(readValue(item, ["total", "line_total", "net_total"]));

  return {
    ...order,
    ...item,
    __report_bill_id: orderId || invoiceNumber || `order:${itemIndex + 1}`,
    __report_record_id:
      textValue(readValue(item, ["order_it_uuid", "order_item_uuid"]), "") ||
      ["sale-report-list", orderId || invoiceNumber, itemIndex, productName].join(":"),
    amount: numberValue(readValue(item, ["amount", "product_price_total"])),
    base_price: salePrice,
    discount: numberValue(readValue(item, ["discount_item_amount", "discount", "item_discount_amount"])),
    invoice_number: invoiceNumber,
    item_discount_amount: numberValue(readValue(item, ["discount_item_amount", "item_discount_amount"])),
    line_total: lineTotal,
    order_invoice: invoiceNumber,
    payment_method: textValue(readValue(order, ["payment_method_name", "payment_type_name"]), ""),
    payment_type_name: textValue(readValue(order, ["payment_method_name", "payment_type_name"]), ""),
    product_image: readValue(item, ["prod_image", "product_image", "image"]),
    product_name: productName,
    sale_date: textValue(readValue(order, ["order_date", "sale_date", "created_at"]), "-"),
    sale_price: salePrice,
    status_name: textValue(readValue(order, ["status_name", "status_text", "bill_status"]), ""),
    table_name: textValue(readValue(order, ["table_name", "table_name_la", "table_name_eng"]), "-"),
    topping_total: numberValue(readValue(item, ["topping_total", "topping_unit_total"])),
    unit_price: salePrice
  };
}

function normalizeOrderGroup(order: ApiEntity, index: number): DailySalesBillGroup {
  const invoiceNumber = textValue(readValue(order, ["order_invoice", "invoice_number", "invoice_no", "invoice"]), `bill-${index + 1}`);
  const id = textValue(readValue(order, ["order_uuid", "bill_uuid", "uuid"]), `order:${invoiceNumber}`);
  const items = asRecords(order.items).map((item, itemIndex) => normalizeOrderItem(order, item, itemIndex));

  return {
    amountTotal: numberValue(readValue(order, ["amount"])),
    baseTotal: numberValue(readValue(order, ["amount", "before_bill_discount"])),
    branchName: textValue(readValue(order, ["branch_name", "branch_name_la", "branch_name_eng"]), "-"),
    cashierName: textValue(readValue(order, ["cashier_name", "login_name", "user_name"]), "-"),
    changeAmount: numberValue(readValue(order, ["change_amount"])),
    cancelled: false,
    debtAmount: numberValue(readValue(order, ["debt_amount", "balance_total"])),
    discountBillAmount: numberValue(readValue(order, ["discount_bill"])),
    id,
    invoiceNumber,
    itemCount: numberValue(readValue(order, ["item_count"])) || items.length,
    itemDiscountAmount: numberValue(readValue(order, ["discount_item", "discount_item_amount"])),
    items,
    lineTotal: numberValue(readValue(order, ["sum_total", "paid_amount", "total"])),
    paymentType: textValue(readValue(order, ["payment_method_name", "payment_type_name"]), "-"),
    qtyTotal:
      numberValue(readValue(order, ["item_qty", "total_qty"])) ||
      items.reduce((total, item) => total + numberValue(readValue(item, ["qty", "quantity"])), 0),
    receiveCashAmount: numberValue(readValue(order, ["paid_cash", "receive_cash", "cash_received"])),
    receiveTransferAmount: numberValue(readValue(order, ["paid_transfer", "receive_transfer", "transfer_received"])),
    saleDate: textValue(readValue(order, ["order_date", "sale_date", "created_at"]), "-"),
    serviceChargeAmount: numberValue(readValue(order, ["sum_servicecharge", "service_charge", "service_charge_amount"])),
    status: textValue(readValue(order, ["status_name", "status_text", "bill_status"]), ""),
    tableName: textValue(readValue(order, ["table_name", "table_name_la", "table_name_eng"]), "-"),
    toppingTotal: items.reduce((total, item) => total + numberValue(item.topping_total), 0),
    vatAmount: numberValue(readValue(order, ["sum_vate", "vat", "vat_amount"]))
  };
}

function totalPages(root: ApiEntity, total: number, limit: PageLimit, page: number) {
  if (isAllPageLimit(limit)) return 1;
  const explicit = numberValue(readValue(root, ["totalPages", "total_pages", "total_page", "totalPage"]));
  if (explicit > 0) return Math.max(1, explicit);
  const numericLimit = pageLimitNumber(limit);
  return total > 0 && numericLimit > 0 ? Math.max(1, Math.ceil(total / numericLimit)) : Math.max(1, page);
}

export function normalizeDailySalesOrderReportResponse(
  response: DailySalesOrderReportResponse,
  fallback: { limit: PageLimit; page: number }
): DailySalesOrderReportNormalized {
  const root = response as ApiEntity;
  const orderRows = asRecords(root.orders);
  const orderGroups = orderRows.map(normalizeOrderGroup);
  const base = orderGroups.length ? null : normalizeDailySalesReportResponse(response);
  const summary = asRecord(root.summary);
  const billGroups = orderGroups.length ? orderGroups : base?.billGroups ?? [];
  const total = numberValue(readValue(root, ["total", "total_rows", "count"])) || billGroups.length;
  const page = numberValue(root.page) || fallback.page;
  const limit = isAllPageLimit(fallback.limit) ? fallback.limit : numberValue(root.limit) || fallback.limit;

  return {
    billGroups,
    filters: asRecord(root.filters),
    grandTotalByDate: base?.grandTotalByDate ?? [],
    pagination: {
      limit,
      page,
      total,
      totalPages: totalPages(root, total, fallback.limit, page)
    },
    reportTotal: Object.keys(summary).length ? summary : base?.reportTotal ?? {},
    response,
    rows: billGroups.flatMap((group) => group.items),
    summaryCards: Object.keys(summary).length ? summary : base?.summaryCards ?? {}
  };
}
