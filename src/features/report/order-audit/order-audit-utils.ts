import type { AuditValue, OrderAuditRow } from "@/services/report";

type Translate = (key: string) => string;
const MONEY_FIELDS = new Set([
  "order_total", "order_subtotal", "order_grand_total", "order_paid_total", "order_balance",
  "order_discount_amount", "order_service_amount", "order_vat_amount", "order_it_prod_price",
  "order_it_discount_amount", "topping_price", "amount", "cash_payment_amount",
  "transfer_payment_amount", "change_amount", "credit_paid_total", "credit_balance",
]);
const FIELD_ORDER = [
  "order_invoice", "order_it_order_uuid_fk", "order_it_prod_detail_uuid_fk", "order_it_prod_price",
  "order_it_qty", "order_it_discount_type", "order_it_discount_value", "order_it_discount_amount",
  "order_total", "order_discount_type", "order_discount_value", "order_discount_amount", "order_subtotal",
  "order_service_rate", "order_service_amount", "order_vat_status", "order_vat_rate", "order_vat_amount",
  "order_grand_total", "order_paid_total", "order_balance",
];

export function auditToday(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Vientiane", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function auditDateTime(value: string, language: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat(language === "en" ? "en-GB" : "lo-LA", {
    timeZone: "Asia/Vientiane", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).format(date);
}

export function validAuditDateRange(from: string, to: string) {
  const valid = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  return valid(from) && valid(to) && from <= to && Date.parse(to) - Date.parse(from) <= 92 * 86400000;
}

export function activeAuditFilterCount(
  filters: { dateFrom: string; dateTo: string; action: string; entity: string },
  today: string,
) {
  let count = 0;
  if (filters.dateFrom !== today || filters.dateTo !== today) count += 1;
  if (filters.action !== "all") count += 1;
  if (filters.entity !== "all") count += 1;
  return count;
}

export function auditValue(field: string, value: AuditValue | undefined,
  snapshot: OrderAuditRow["after_data"], language: string, t: Translate): string {
  if (value === null || value === undefined || value === "") return "—";
  if (field === "order_vat_status") return t(`orderAudit.vat.${value}`);
  if (field === "order_it_status") return t(`orderAudit.itemStatus.${value}`);
  if (field === "order_is_cancelled") return t(`orderAudit.${["1", "true"].includes(String(value).toLowerCase()) ? "yes" : "no"}`);
  if (field.endsWith("discount_type")) {
    const kind = String(value).toUpperCase();
    return ["PCT", "AMT"].includes(kind) ? t(`orderAudit.discountKind.${kind}`) : String(value);
  }
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (Number.isFinite(number) && (MONEY_FIELDS.has(field) || field.endsWith("_rate") || field.endsWith("discount_value"))) {
    const formatted = number.toLocaleString(language === "en" ? "en-US" : "lo-LA", { maximumFractionDigits: 4 });
    if (field.endsWith("discount_value")) {
      const kind = snapshot?.[field.replace(/value$/, "type")];
      return `${formatted}${kind === "PCT" ? "%" : kind === "AMT" ? " ₭" : ""}`;
    }
    return `${formatted}${MONEY_FIELDS.has(field) ? " ₭" : field === "exchange_rate" ? "" : "%"}`;
  }
  return String(value);
}

export function auditChanges(row: Pick<OrderAuditRow, "before_data" | "after_data" | "changed_fields">, language: string, t: Translate) {
  const rank = (field: string) => FIELD_ORDER.includes(field) ? FIELD_ORDER.indexOf(field) : FIELD_ORDER.length;
  return [...row.changed_fields].sort((a, b) => rank(a) - rank(b)).map(field => ({
    field,
    label: t(`orderAudit.fields.${field}`),
    before: auditValue(field, row.before_data?.[field], row.before_data, language, t),
    after: auditValue(field, row.after_data?.[field], row.after_data, language, t),
  }));
}
