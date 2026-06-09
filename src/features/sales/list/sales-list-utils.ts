import type { InvoicePrintData, InvoicePrintItem, InvoicePrintTopping } from "@/features/pos/print/invoice-print-window";
import { dateTime, money } from "@/lib/format";
import { pageLimitNumber } from "@/lib/pagination";
import type { CancelableBill, CancelableBillDetail, CancelableDateOption } from "@/services/cancel";
import type { ApiEntity, PageLimit, SortOrder } from "@/services/shared/types";
import type { AuthUser } from "@/stores/auth-store";

export type BillSource = CancelableBill | CancelableBillDetail | null | undefined;

export const INITIAL_DATE_SELECT = "today";
export const SALES_LIST_LIMIT_OPTIONS: PageLimit[] = [20, 50, 100, 200];
export const orderOptions: SortOrder[] = ["DESC", "ASC"];

const invoiceKeys = ["order_invoice", "invoice_number", "invoice_no", "invoice", "bill_no", "order_no"];
const orderUuidKeys = ["order_uuid", "order_uuid_fk", "selected_order_uuid", "bill_uuid", "uuid", "id"];
const branchKeys = ["branch_name", "branch_name_la", "branch_name_eng"];
const tableKeys = ["table_name", "table_name_la", "table_name_eng", "table_no"];
const dateKeys = ["created_at", "order_date", "sale_date", "business_date", "date", "datetime_in", "updated_at"];
export const totalKeys = ["order_grand_total", "grand_total", "sum_grand_total", "net_total", "total", "order_total", "amount"];
const statusKeys = ["status_name", "status_text", "order_status_text", "payment_status_text", "status", "order_status"];
const itemKeys = ["items", "details", "order_items", "bill_items", "products", "data"];
export type BillNestedSection = "bill_discount" | "order" | "payment" | "self" | "service_charge" | "totals" | "vat";

export function isRecord(value: unknown): value is ApiEntity {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function asRecords(value: unknown): ApiEntity[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

export function asRecord(value: unknown): ApiEntity | null {
  return isRecord(value) ? value : null;
}

export function isPresent(value: unknown) {
  return value !== null && value !== undefined && value !== "";
}

export function textValue(value: unknown, fallback = "-") {
  return isPresent(value) ? String(value) : fallback;
}

export function cleanText(value: unknown) {
  const text = String(value ?? "").trim();
  return text && text !== "-" ? text : "";
}

export function firstText(...values: unknown[]) {
  for (const value of values) {
    const text = cleanText(value);
    if (text) return text;
  }
  return "";
}

export function readValue(row: BillSource | ApiEntity, keys: string[]) {
  if (!isRecord(row)) return undefined;
  for (const key of keys) {
    const value = row[key];
    if (isPresent(value)) return value;
  }
  return undefined;
}

export function optionalNumber(value: unknown) {
  if (!isPresent(value)) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function firstNumber(...values: unknown[]) {
  for (const value of values) {
    const number = optionalNumber(value);
    if (number !== null) return number;
  }
  return null;
}

export function positiveNumber(...values: unknown[]) {
  const number = firstNumber(...values);
  return number !== null && number > 0 ? number : null;
}

export function moneyOrDash(value: unknown) {
  const number = optionalNumber(value);
  return number === null ? "-" : money(number);
}

export function percentLabel(value: unknown) {
  const number = optionalNumber(value);
  return number === null ? null : `${number.toLocaleString("lo-LA", { maximumFractionDigits: 2 })}%`;
}

export function isTruthy(value: unknown) {
  if (value === true || value === 1) return true;
  const text = String(value ?? "").trim().toLowerCase();
  return text === "true" || text === "1" || text === "yes";
}

export function booleanField(source: BillSource, keys: string[]) {
  const value = readValue(source, keys);
  return isPresent(value) ? isTruthy(value) : null;
}

export function nestedRecord(source: BillSource | ApiEntity, key: string) {
  return isRecord(source) ? asRecord(source[key]) : null;
}

export function billSection(source: BillSource, section: BillNestedSection) {
  if (!isRecord(source)) return null;
  return section === "self" ? source : nestedRecord(source, section);
}

export function readFromBillSections(sources: BillSource[], keys: string[], sections: BillNestedSection[]) {
  for (const source of sources) {
    for (const section of sections) {
      const value = readValue(billSection(source, section), keys);
      if (isPresent(value)) return value;
    }
  }
  return undefined;
}

export function numberFromBillSections(sources: BillSource[], keys: string[], sections: BillNestedSection[]) {
  return optionalNumber(readFromBillSections(sources, keys, sections));
}

export function billUuid(source: BillSource) {
  return textValue(readFromBillSections([source], orderUuidKeys, ["order", "self"]), "");
}

export function billInvoice(...sources: BillSource[]) {
  return textValue(readFromBillSections(sources, invoiceKeys, ["order", "self"]), "-");
}

export function billBranch(...sources: BillSource[]) {
  return textValue(readFromBillSections(sources, branchKeys, ["order", "self"]), "-");
}

export function billTable(...sources: BillSource[]) {
  return textValue(readFromBillSections(sources, tableKeys, ["order", "self"]), "-");
}

export function billDate(...sources: BillSource[]) {
  return dateTime(textValue(readFromBillSections(sources, dateKeys, ["order", "self"]), ""));
}

export function billDateValue(...sources: BillSource[]) {
  const value = readFromBillSections(sources, dateKeys, ["order", "self"]);
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

  const date = new Date(String(value ?? ""));
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

export function billTotal(...sources: BillSource[]) {
  const value = numberFromBillSections(sources, totalKeys, ["totals", "self", "order"]);
  return value === null ? "-" : money(value);
}

export function billStatus(...sources: BillSource[]) {
  return textValue(readFromBillSections(sources, statusKeys, ["order", "self"]), "-");
}

export function billCanCancel(...sources: BillSource[]) {
  for (const source of sources) {
    for (const section of ["order", "self"] as const) {
      const record = billSection(source, section);
      const value = booleanField(record, ["can_cancel"]);
      if (value !== null) return value;
    }
  }
  return false;
}

export function billIsSelected(source: BillSource, selectedOrderUuid: string) {
  return Boolean(booleanField(source, ["is_selected"]) || (selectedOrderUuid && billUuid(source) === selectedOrderUuid));
}

export function billItems(source: BillSource) {
  if (!isRecord(source)) return [];
  for (const key of itemKeys) {
    const rows = asRecords(source[key]);
    if (rows.length) return rows;
  }
  return [];
}

export function itemName(item: ApiEntity) {
  return textValue(readValue(item, ["prod_name", "product_name", "name", "title", "item_name"]), "-");
}

export function itemQty(item: ApiEntity) {
  return textValue(readValue(item, ["qty", "quantity", "order_it_qty", "sale_qty"]), "-");
}

export function itemPrice(item: ApiEntity) {
  const value = optionalNumber(readValue(item, ["price", "unit_price", "base_price", "pro_detail_sprice"]));
  return value === null ? "-" : money(value);
}

export function itemTotal(item: ApiEntity) {
  const value = optionalNumber(readValue(item, ["line_total", "net_total", "total", "gross_total", "base_line_total"]));
  return value === null ? "-" : money(value);
}

export function itemStatus(item: ApiEntity) {
  return textValue(readValue(item, statusKeys), "-");
}

export function itemSize(item: ApiEntity) {
  return textValue(readValue(item, ["size_name", "size_name_la", "size_name_eng", "size"]), "");
}

export function itemNote(item: ApiEntity) {
  return textValue(readValue(item, ["note", "order_it_note", "item_note"]), "");
}

export function itemCashier(item: ApiEntity) {
  return textValue(readValue(item, ["cashier_name", "cashier", "user_name", "login_name"]), "");
}

export function itemToppings(item: ApiEntity) {
  return asRecords(readValue(item, ["toppings", "item_toppings", "order_item_toppings"]));
}

export function itemToppingTotal(item: ApiEntity) {
  const explicit = optionalNumber(readValue(item, ["topping_unit_total", "topping_total", "topping_line_total"]));
  if (explicit !== null) return explicit;
  const toppings = itemToppings(item);
  if (!toppings.length) return null;
  return toppings.reduce((sum, topping) => sum + (optionalNumber(readValue(topping, ["topping_total", "total", "line_total", "topping_price"])) ?? 0), 0);
}

export function itemDiscountRecord(item: ApiEntity) {
  return nestedRecord(item, "item_discount") ?? nestedRecord(item, "discount");
}

export function itemDiscountAmount(item: ApiEntity) {
  const discount = itemDiscountRecord(item);
  return firstNumber(readValue(discount, ["amount", "discount_amount"]), readValue(item, ["item_discount_amount", "order_it_discount_amount", "discount_amount"]));
}

export function discountLabel(discount: ApiEntity | null, fallback = "") {
  const type = textValue(readValue(discount, ["type", "discount_type"]), "").toUpperCase();
  const value = readValue(discount, ["value", "discount_value"]);
  const rate = type === "PCT" ? percentLabel(value) : null;
  if (rate) return fallback ? `${fallback} (${rate})` : rate;
  const fixed = type && value ? moneyOrDash(value) : "";
  return fixed && fallback ? `${fallback} (${fixed})` : fallback || fixed;
}

export function billNumber(bill: BillSource, keys: string[], sections: BillNestedSection[]) {
  return numberFromBillSections([bill], keys, sections);
}

export function billDiscountAmount(bill: BillSource) {
  return firstNumber(
    readFromBillSections([bill], ["amount", "discount_amount"], ["bill_discount"]),
    readFromBillSections([bill], ["bill_discount_amount", "order_discount_amount", "discount_amount"], ["totals", "self", "order"])
  );
}

export function billDiscountLabel(bill: BillSource, fallback: string) {
  return discountLabel(billSection(bill, "bill_discount"), fallback);
}

export function billRateLabel(bill: BillSource, section: "service_charge" | "vat") {
  return percentLabel(readFromBillSections([bill], ["rate", "vat_rate", "service_rate"], [section]));
}

export function billItemsDiscountTotal(bill: BillSource) {
  const explicit = billNumber(bill, ["item_discount_amount", "order_item_discount_amount"], ["totals", "self", "order"]);
  if (explicit !== null) return explicit;
  const items = billItems(bill);
  if (!items.length) return null;
  return items.reduce((sum, item) => sum + (itemDiscountAmount(item) ?? 0), 0);
}

export function billCashier(bill: BillSource, user: AuthUser) {
  return firstText(
    readFromBillSections([bill], ["cashier_name", "cashier", "user_name", "login_name"], ["payment", "self", "order"]),
    ...billItems(bill).map(itemCashier),
    user.email?.split("@")[0],
    user.email,
    "-"
  );
}

export function billCustomer(bill: BillSource) {
  return firstText(
    readFromBillSections([bill], ["customer_name", "customer", "member_code", "customer_phone"], ["payment", "self", "order"])
  ) || null;
}

export function salesListInvoicePrintLabels(
  translate: (key: string, options?: Record<string, unknown>) => string,
  bill: BillSource
) {
  const serviceRate = billRateLabel(bill, "service_charge");
  const vatRate = billRateLabel(bill, "vat");

  return {
    address: translate("fields.branch_address"),
    cashier: translate("pos.invoicePrintStaff"),
    customer: translate("pos.customer"),
    date: translate("pos.invoicePrintDate"),
    discount: translate("pos.invoicePrintDiscount"),
    invoice: translate("pos.invoicePrintNumber"),
    price: translate("pos.price"),
    service: serviceRate ? `${translate("salesList.serviceCharge")} (${serviceRate})` : translate("pos.serviceTotal"),
    subtotal: translate("pos.invoicePrintTotalAmount"),
    table: translate("pos.invoicePrintTable"),
    thankYou: translate("pos.invoicePrintThankYou"),
    title: translate("pos.invoicePrintTitle"),
    topping: translate("pos.toppingTotal"),
    total: translate("pos.invoicePrintAmountToPay"),
    vat: vatRate ? `${translate("pos.vat")} (${vatRate})` : translate("pos.vat")
  };
}

export function salesListInvoicePrintItems(
  bill: BillSource,
  translate: (key: string, options?: Record<string, unknown>) => string
): InvoicePrintItem[] {
  return billItems(bill).map((item) => {
    const qty = optionalNumber(readValue(item, ["qty", "quantity", "order_it_qty", "sale_qty"])) ?? 0;
    const displayTotal = optionalNumber(readValue(item, ["line_total", "net_total", "total", "base_line_total", "gross_total"])) ?? 0;
    const itemDiscount = itemDiscountAmount(item) ?? 0;
    const originalLineTotal = itemDiscount > 0 ? displayTotal + itemDiscount : null;
    const explicitUnitPrice = optionalNumber(readValue(item, ["price", "unit_price", "base_price", "pro_detail_sprice"]));
    const unitPrice = explicitUnitPrice ?? (qty > 0 ? displayTotal / qty : null);
    const size = itemSize(item);
    const toppings: InvoicePrintTopping[] = itemToppings(item).map((topping) => ({
      name: textValue(readValue(topping, ["topping_name", "prod_topping_name", "product_name", "name"]), translate("salesList.toppings")),
      qty: optionalNumber(readValue(topping, ["topping_qty", "qty", "quantity"])),
      total: positiveNumber(readValue(topping, ["topping_total", "total", "line_total", "topping_price"]))
    }));

    return {
      displayTotal,
      hasItemDiscount: originalLineTotal !== null && originalLineTotal > displayTotal,
      name: size ? `${itemName(item)} (${size})` : itemName(item),
      originalLineTotal,
      qty,
      toppingLabel: translate("pos.toppingTotal"),
      toppingTotal: positiveNumber(itemToppingTotal(item)),
      toppings,
      unitPrice
    };
  });
}

export function buildSalesListInvoicePrintData({
  bill,
  translate,
  user
}: {
  bill: BillSource;
  translate: (key: string, options?: Record<string, unknown>) => string;
  user: AuthUser;
}): InvoicePrintData {
  const billDiscount = billDiscountAmount(bill);
  const grandTotal = billNumber(bill, totalKeys, ["totals", "self", "order"]);
  const orderTotal = billNumber(bill, ["order_total", "total"], ["totals", "self", "order"]);
  const service = billNumber(bill, ["amount", "service_charge_amount", "order_service_amount", "service_amount"], ["service_charge", "totals", "self", "order"]);
  const subtotal = billNumber(bill, ["order_subtotal", "subtotal"], ["totals", "self", "order"]);
  const vat = billNumber(bill, ["amount", "vat_amount", "order_vat_amount", "vat_total"], ["vat", "totals", "self", "order"]);

  return {
    branchAddress: firstText(readFromBillSections([bill], ["branch_address", "address"], ["order", "self"]), user.branch_address),
    branchName: firstText(readFromBillSections([bill], branchKeys, ["order", "self"]), user.branch_name),
    branchTel: firstText(readFromBillSections([bill], ["branch_tel", "branch_phone", "tel", "phone"], ["order", "self"]), user.branch_tel),
    cashier: billCashier(bill, user),
    customer: billCustomer(bill),
    discount: positiveNumber(billDiscount) ?? 0,
    invoice: firstText(readFromBillSections([bill], invoiceKeys, ["order", "self"])) || null,
    items: salesListInvoicePrintItems(bill, translate),
    labels: salesListInvoicePrintLabels(translate, bill),
    contentWidthMm: 72.1,
    paperHeightMm: 210,
    paperWidthMm: 80,
    printedAt: billDateValue(bill),
    qrUrl: null,
    service: positiveNumber(service) ?? 0,
    storeName: firstText(user.store_name, user.branch_name, readFromBillSections([bill], branchKeys, ["order", "self"])),
    subtotal: subtotal ?? orderTotal ?? 0,
    tableName: firstText(readFromBillSections([bill], tableKeys, ["order", "self"])),
    title: translate("pos.invoicePrintTitle"),
    total: grandTotal ?? orderTotal ?? 0,
    vat: positiveNumber(vat) ?? 0
  };
}

export function statusClass(source: BillSource) {
  const status = billStatus(source).toLowerCase();
  if (status.includes("cancel") || status.includes("void") || status === "0") {
    return "border-destructive/25 bg-destructive/10 text-destructive";
  }
  if (status.includes("paid") || status.includes("success") || status.includes("active") || status === "1") {
    return "border-primary/20 bg-primary/10 text-primary";
  }
  return "border-border bg-muted text-muted-foreground";
}

export function statusDotClass(source: BillSource) {
  const status = billStatus(source).toLowerCase();
  if (status.includes("cancel") || status.includes("void") || status === "0") return "bg-destructive";
  if (status.includes("paid") || status.includes("success") || status.includes("active") || status === "1") return "bg-primary";
  return billCanCancel(source) ? "bg-primary" : "bg-muted-foreground";
}

export function dateOptionValue(option: CancelableDateOption) {
  return textValue(readValue(option, ["date_select", "value", "key", "code", "id"]), "");
}

export function dateOptionLabel(option: CancelableDateOption) {
  return textValue(readValue(option, ["label", "name", "title", "text", "date_label"]), dateOptionValue(option));
}

export function pageBounds(page: number, limit: PageLimit, rowCount: number, total: number) {
  const size = pageLimitNumber(limit);
  const start = rowCount ? (page - 1) * size + 1 : 0;
  return { start, end: rowCount ? Math.min(total || start + rowCount - 1, start + rowCount - 1) : 0 };
}

export function shouldOpenMobileDetail() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 767px)").matches;
}
