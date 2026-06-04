import {
  Banknote,
  Clock3,
  Landmark,
  SplitSquareHorizontal,
} from "lucide-react";
import { money } from "@/lib/format";
import { toLanguage } from "@/lib/language";
import type { InvoicePrintData } from "@/features/pos/print/invoice-print-window";
import type { Customer } from "@/services/customer";
import type { Exchange } from "@/services/exchange";
import {
  OrderChannelEnum,
  PaymentMethod,
  type CartOrder,
  type OrderChannel,
  type PosTable,
} from "@/services/pos";
import type { AuthUser } from "@/stores/auth-store";
import {
  cartItemDisplayName,
  cartItemName,
  cartItemQty,
  cartItemTotal,
  cartSummary,
  formatRate,
  optionalNumber,
  optionalString,
  positiveNumber,
  visibleCartItems,
} from "./utils";

export {
  getPrintInvoiceJob,
  getPrintableJob,
  isPrintableJob,
} from "@/services/pos/print-jobs";
export {
  escapeHtml,
  formatInvoicePrintDate,
  formatInvoiceQty,
  invoiceMetaRow,
  invoiceTotalRow,
  openLocalInvoicePrintWindow,
  renderInvoiceHeader,
  renderInvoiceItem,
  renderInvoiceItems,
  renderInvoiceMeta,
  renderInvoiceOriginalLineTotal,
  renderInvoiceQr,
  renderInvoiceTopping,
  renderInvoiceToppings,
  renderInvoiceTotals,
  renderLocalInvoiceHtml,
} from "@/features/pos/print/invoice-print-window";
export type {
  InvoicePrintData,
  InvoicePrintItem,
  InvoicePrintTopping,
} from "@/features/pos/print/invoice-print-window";

export type PaymentTab = "cash" | "transfer" | "cash_transfer" | "arrears";
export type PaymentKind = "full" | "split";
export type SplitTenderField = "cash" | "transfer";
export type TenderField = "cash" | "split_cash" | "split_transfer";

export type PaymentCurrencyOption = {
  value: string;
  code: string;
  label: string;
  rate: number;
  base?: boolean;
  icon?: string;
};

export type Translate = (
  key: string,
  options?: Record<string, unknown>,
) => string;

export const LAK_CURRENCY_VALUE = "base-lak";
export const LAK_CURRENCY_OPTION: PaymentCurrencyOption = {
  value: LAK_CURRENCY_VALUE,
  code: "LAK",
  label: "LAK",
  rate: 1,
  base: true,
};

export const paymentTabs: Array<{
  value: PaymentTab;
  method: PaymentMethod;
  icon: typeof Banknote;
  labelKey: string;
}> = [
  {
    value: "cash",
    method: PaymentMethod.CASH,
    icon: Banknote,
    labelKey: "pos.paymentCash",
  },
  {
    value: "transfer",
    method: PaymentMethod.TRANSFER,
    icon: Landmark,
    labelKey: "pos.paymentTransfer",
  },
  {
    value: "cash_transfer",
    method: PaymentMethod.CASH_TRANSFER,
    icon: SplitSquareHorizontal,
    labelKey: "pos.paymentMixed",
  },
  {
    value: "arrears",
    method: PaymentMethod.ARREARS,
    icon: Clock3,
    labelKey: "pos.paymentArrears",
  },
];

export const orderChannelOptions: Array<{
  value: OrderChannel;
  labelKey: string;
}> = [
  { value: OrderChannelEnum.DINE_IN, labelKey: "pos.orderChannelDineIn" },
  { value: OrderChannelEnum.TAKEAWAY, labelKey: "pos.orderChannelTakeaway" },
  { value: OrderChannelEnum.DELIVERY, labelKey: "pos.orderChannelDelivery" },
];

export const CUSTOMER_SEARCH_LIMIT = 20;
export const CUSTOMER_SEARCH_DEBOUNCE_MS = 300;

export function customerUuidOf(customer: Customer) {
  return optionalString(customer.customer_uuid) ?? "";
}

export function defaultCustomerSearchTerm(language?: string | null) {
  return toLanguage(language) === "en" ? "customer" : "ລູກຄ້າທົ່ວໄປ";
}

export function defaultCustomerFromRows(customers: Customer[], term: string) {
  const target = term.trim().toLowerCase();
  if (!target) return null;

  return (
    customers.find(
      (customer) =>
        optionalString(customer.customer_name)?.trim().toLowerCase() ===
        target,
    ) ?? null
  );
}

export function customerLabel(customer: Customer) {
  return (
    optionalString(
      customer.customer_name,
      customer.member_code,
      customer.customer_phone,
      customer.customer_uuid,
    ) ?? "-"
  );
}

export function customerMeta(customer: Customer) {
  return [
    optionalString(customer.member_code),
    optionalString(customer.customer_phone),
  ]
    .filter((value): value is string => Boolean(value))
    .join(" / ");
}

export function dedupeCustomers(customers: Customer[]) {
  const seen = new Set<string>();
  return customers.filter((customer) => {
    const uuid = customerUuidOf(customer);
    if (!uuid || seen.has(uuid)) return false;
    seen.add(uuid);
    return true;
  });
}

export function withSelectedCustomer(
  customers: Customer[],
  selectedCustomer: Customer | null,
) {
  const selectedUuid = selectedCustomer ? customerUuidOf(selectedCustomer) : "";
  if (
    !selectedCustomer ||
    !selectedUuid ||
    customers.some((customer) => customerUuidOf(customer) === selectedUuid)
  )
    return customers;
  return [selectedCustomer, ...customers];
}

export function currencyAllowsDecimal(currency: PaymentCurrencyOption) {
  return !currency.base;
}

export function activeAmountField(
  tab: PaymentTab,
  splitField: SplitTenderField,
): TenderField | null {
  if (tab === "cash") return "cash";
  if (tab === "cash_transfer")
    return splitField === "cash" ? "split_cash" : "split_transfer";
  return null;
}

export function tenderInputValue(
  field: TenderField,
  cashInput: string,
  splitCashInput: string,
  splitTransferInput: string,
) {
  if (field === "cash") return cashInput;
  if (field === "split_cash") return splitCashInput;
  return splitTransferInput;
}

export function activeExactAmountLak(
  field: TenderField,
  total: number,
  payment: ReturnType<typeof paymentAmounts>,
) {
  if (field === "split_cash") return Math.max(0, total - payment.transfer);
  if (field === "split_transfer") return Math.max(0, total - payment.cash);
  return total;
}

export function tenderInputLak(
  field: TenderField,
  payment: ReturnType<typeof paymentAmounts>,
) {
  if (field === "split_transfer") return payment.transfer;
  return payment.cash;
}

export function tenderLabel(
  field: TenderField,
  tab: PaymentTab,
  translate: (key: string) => string,
) {
  if (field === "split_transfer") return translate("pos.transferAmount");
  if (tab === "cash") return translate("pos.amountReceived");
  return translate("pos.cashAmount");
}

export function shouldIgnoreKeypadTarget(
  target: HTMLElement,
  activeInput: HTMLInputElement | null,
) {
  if (target === activeInput) return true;
  if (target.closest("[data-pos-keypad-ignore='true']")) return true;
  if (target.isContentEditable) return true;
  const tagName = target.tagName.toLowerCase();
  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    target.getAttribute("role") === "combobox"
  );
}

export function paymentAmounts(
  tab: PaymentTab,
  total: number,
  cashInput: string,
  splitCashInput: string,
  splitTransferInput: string,
  rate: number,
) {
  const cash =
    tab === "cash"
      ? toLakAmount(cashInput, rate)
      : tab === "cash_transfer"
        ? toLakAmount(splitCashInput, rate)
        : 0;
  const transfer =
    tab === "transfer"
      ? total
      : tab === "cash_transfer"
        ? toLakAmount(splitTransferInput, rate)
        : 0;
  const received = cash + transfer;
  return {
    cash,
    transfer,
    received,
    change: Math.max(0, received - total),
    balance: Math.max(0, total - received),
  };
}

export function paymentValidation(
  tab: PaymentTab,
  orderUuid: string,
  total: number,
  payment: ReturnType<typeof paymentAmounts>,
  customerUuid: string,
  splitBillItemUuids?: string[],
) {
  if (!orderUuid) return "pos.paymentMissingOrder";
  if (splitBillItemUuids && splitBillItemUuids.length === 0)
    return "pos.splitPaymentSelectRequired";
  if (!customerUuid) return "pos.paymentCustomerRequired";
  if (total <= 0) return "pos.paymentNoAmount";
  if (tab === "cash" && payment.cash < total)
    return "pos.paymentCashInsufficient";
  if (tab === "cash_transfer" && (payment.cash <= 0 || payment.transfer <= 0))
    return "pos.paymentMixedRequired";
  if (tab === "cash_transfer" && payment.received < total)
    return "pos.paymentMixedInsufficient";
  return null;
}

export function amountInput(value: string, allowDecimal = true) {
  const normalized = value.replace(allowDecimal ? /[^\d.]/g : /\D/g, "");
  if (!allowDecimal) return normalized.replace(/^0+(?=\d)/, "");
  const [whole = "", ...decimalParts] = normalized.split(".");
  const cleanWhole = whole.replace(/^0+(?=\d)/, "");
  if (!decimalParts.length) return cleanWhole;
  return `${cleanWhole || "0"}.${decimalParts.join("").slice(0, 2)}`;
}

export function parseAmount(value: string) {
  return Number(value.replace(/,/g, "") || 0) || 0;
}

export function formatAmountInputDisplay(
  value: string,
  currency: PaymentCurrencyOption,
) {
  const rawValue = amountInput(value, currencyAllowsDecimal(currency));
  if (!rawValue) return "";
  const [whole = "", decimal = ""] = rawValue.split(".");
  const formattedWhole = formatInputWholeNumber(whole);
  if (!rawValue.includes(".")) return formattedWhole;
  return `${formattedWhole || "0"}.${decimal}`;
}

export function formatInputWholeNumber(value: string) {
  if (!value) return "";
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function rawCaretFromDisplayCaret(
  displayValue: string,
  caret: number,
  allowDecimal: boolean,
) {
  return amountInput(displayValue.slice(0, Math.max(0, caret)), allowDecimal)
    .length;
}

export function displayCaretFromRawCaret(
  rawValue: string,
  caret: number,
  currency: PaymentCurrencyOption,
) {
  const displayValue = formatAmountInputDisplay(rawValue, currency);
  const target = Math.max(0, Math.min(caret, rawValue.length));
  if (target <= 0) return 0;

  let rawCount = 0;
  for (let index = 0; index < displayValue.length; index += 1) {
    if (displayValue[index] !== ",") rawCount += 1;
    if (rawCount >= target) return index + 1;
  }

  return displayValue.length;
}

export function toLakAmount(value: string, rate: number) {
  return Math.round(parseAmount(value) * safeRate(rate));
}

export function safeRate(rate: number) {
  return Number.isFinite(rate) && rate > 0 ? rate : 1;
}

export function quickCashAmounts(
  total: number,
  currency: PaymentCurrencyOption,
) {
  const exact = defaultCurrencyAmount(total, currency);
  const step = quickAmountStep(exact, currency);
  const rounded = Math.ceil(exact / step) * step;
  return Array.from(
    new Set(
      [exact, rounded, rounded + step, rounded + step * 2]
        .map((value) => roundCurrencyAmount(value, currency))
        .filter((value) => value > 0),
    ),
  );
}

export function quickAmountStep(
  amount: number,
  currency: PaymentCurrencyOption,
) {
  if (currency.base) return 50000;
  if (amount < 20) return 5;
  if (amount < 100) return 10;
  if (amount < 1000) return 50;
  return 100;
}

export function defaultCurrencyAmount(
  totalLak: number,
  currency: PaymentCurrencyOption,
) {
  const amount = totalLak / safeRate(currency.rate);
  if (currency.base) return Math.ceil(amount);
  return Math.ceil(amount * 100) / 100;
}

export function defaultCurrencyInput(
  totalLak: number,
  currency: PaymentCurrencyOption,
) {
  return formatCurrencyInput(
    defaultCurrencyAmount(totalLak, currency),
    currency,
  );
}

export function roundCurrencyAmount(
  value: number,
  currency: PaymentCurrencyOption,
) {
  if (currency.base) return Math.round(value);
  return Math.round(value * 100) / 100;
}

export function formatCurrencyInput(
  value: number,
  currency: PaymentCurrencyOption,
) {
  const amount = roundCurrencyAmount(value, currency);
  if (currency.base || Number.isInteger(amount)) return String(amount);
  return amount.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

export function currencyMoney(value: number, currency: PaymentCurrencyOption) {
  const amount = roundCurrencyAmount(value, currency);
  if (currency.base) return money(amount);
  return `${amount.toLocaleString("lo-LA", { maximumFractionDigits: 2 })} ${currency.code}`;
}

export function currencyOptionLabel(option: PaymentCurrencyOption) {
  if (option.base || !option.icon || option.icon === option.code)
    return option.label;
  return `${option.label} (${option.icon})`;
}

export function exchangeCurrencyOptions(exchanges: Exchange[]) {
  const seen = new Set([LAK_CURRENCY_OPTION.code]);
  const options = [LAK_CURRENCY_OPTION];

  exchanges.forEach((exchange) => {
    const rate = Number(exchange.ex_price ?? 0);
    const code = optionalString(
      exchange.currency_name,
      exchange.currency_icon,
      exchange.currency_uuid_fk,
    )?.toUpperCase();
    const value = optionalString(
      exchange.currency_uuid_fk,
      exchange.ex_uuid,
      code,
    );
    const status = Number(exchange.ex_status ?? 1);
    if (
      !code ||
      !value ||
      code === LAK_CURRENCY_OPTION.code ||
      seen.has(code) ||
      status !== 1 ||
      !Number.isFinite(rate) ||
      rate <= 0
    )
      return;

    seen.add(code);
    options.push({
      value,
      code,
      label: code,
      rate,
      icon: optionalString(exchange.currency_icon)?.toUpperCase(),
    });
  });

  return options;
}

export function firstOrderUuid(orders: CartOrder[]) {
  return optionalString(...orders.map((order) => order.order_uuid)) ?? "";
}

export function paymentNote(tab: PaymentTab, note: string) {
  const trimmed = note.trim();
  if (trimmed) return trimmed;
  if (tab === "cash") return "cash payment";
  if (tab === "transfer") return "TransferPayment";
  if (tab === "cash_transfer") return "CashPayment + TransferPayment";
  return "due payment";
}

export function buildInvoicePrintData({
  invoice,
  orders,
  qrUrl,
  selectedCustomer,
  summary,
  table,
  translate,
  user,
}: {
  invoice: string | null;
  orders: CartOrder[];
  qrUrl: string | null;
  selectedCustomer: Customer | null;
  summary: ReturnType<typeof cartSummary>;
  table: PosTable;
  translate: Translate;
  user: AuthUser;
}): InvoicePrintData {
  const serviceRate = formatRate(summary.serviceRate);
  const taxRate = formatRate(summary.taxRate);

  return {
    branchAddress: optionalString(user.branch_address) ?? "",
    branchName: optionalString(user.branch_name) ?? "",
    branchTel: optionalString(user.branch_tel) ?? "",
    cashier: optionalString(user.email?.split("@")[0], user.email) ?? "-",
    customer: selectedCustomer
      ? optionalString(
          selectedCustomer.customer_name,
          selectedCustomer.member_code,
          selectedCustomer.customer_phone,
        )
      : null,
    discount: positiveNumber(summary.orderDiscount) ?? 0,
    invoice,
    items: visibleCartItems(orders).map((item) => {
      const qty = cartItemQty(item);
      const displayTotal =
        optionalNumber(item.detail?.net_total) ?? cartItemTotal(item);
      const baseLineTotal = optionalNumber(item.detail?.base_line_total);
      const grossTotal = optionalNumber(item.detail?.gross_total);
      const toppingLineTotal = optionalNumber(item.detail?.topping_line_total);
      const baseWithToppingTotal =
        baseLineTotal !== null || toppingLineTotal !== null
          ? (baseLineTotal ?? 0) + (toppingLineTotal ?? 0)
          : null;
      const itemDiscountAmount = positiveNumber(
        item.detail?.order_it_discount_amount,
      );
      const discountRestoredLineTotal =
        itemDiscountAmount !== null ? displayTotal + itemDiscountAmount : null;
      const explicitUnitPrice = optionalNumber(
        item.detail?.unit_price,
        item.price,
        item.prod_price,
        item.product_price,
      );
      const explicitLineTotal =
        qty > 0 && explicitUnitPrice !== null ? explicitUnitPrice * qty : null;
      const originalLineTotal =
        grossTotal ??
        baseWithToppingTotal ??
        discountRestoredLineTotal ??
        explicitLineTotal;
      const originalUnitPrice =
        qty > 0 && originalLineTotal !== null ? originalLineTotal / qty : null;
      const fallbackUnitPrice = qty > 0 ? displayTotal / qty : null;
      const unitPrice =
        originalUnitPrice ?? explicitUnitPrice ?? fallbackUnitPrice;
      const name = cartItemDisplayName(
        cartItemName(item),
        optionalString(item.detail?.size_name),
      );
      const toppings = (item.toppings ?? []).map((topping) => ({
        name: optionalString(topping.topping_name) ?? "-",
        qty: optionalNumber(topping.topping_qty),
        total: positiveNumber(
          topping.topping_line_total,
          topping.topping_price,
        ),
      }));

      return {
        displayTotal,
        hasItemDiscount:
          originalLineTotal !== null && originalLineTotal > displayTotal,
        name,
        originalLineTotal,
        qty,
        toppingLabel: translate("pos.toppingTotal"),
        toppingTotal: positiveNumber(toppingLineTotal),
        toppings,
        unitPrice,
      };
    }),
    labels: {
      address: translate("fields.branch_address"),
      cashier: translate("pos.invoicePrintStaff"),
      customer: translate("pos.customer"),
      date: translate("pos.invoicePrintDate"),
      discount: translate("pos.invoicePrintDiscount"),
      invoice: translate("pos.invoicePrintNumber"),
      price: translate("pos.price"),
      service: serviceRate
        ? translate("pos.serviceWithPercent", { percent: serviceRate })
        : translate("pos.serviceTotal"),
      subtotal: translate("pos.invoicePrintTotalAmount"),
      table: translate("pos.invoicePrintTable"),
      thankYou: translate("pos.invoicePrintThankYou"),
      title: translate("pos.invoicePrintTitle"),
      topping: translate("pos.toppingTotal"),
      total: translate("pos.invoicePrintAmountToPay"),
      vat: taxRate
        ? translate("pos.invoicePrintVatWithPercent", { percent: taxRate })
        : translate("pos.vat"),
    },
    contentWidthMm: 72.1,
    paperHeightMm: 210,
    paperWidthMm: 80,
    printedAt: new Date(),
    qrUrl,
    service: positiveNumber(summary.serviceTotal) ?? 0,
    storeName: optionalString(user.store_name, user.branch_name) ?? "",
    subtotal: Number(summary.subtotal ?? 0),
    tableName: table.table_name,
    title: translate("pos.invoicePrintTitle"),
    total: Number(summary.grandTotal ?? 0),
    vat: positiveNumber(summary.tax, summary.vatTotal, summary.orderVat) ?? 0,
  };
}


