import {
  Banknote,
  Clock3,
  Landmark,
  SplitSquareHorizontal,
} from "lucide-react";
import { money } from "@/lib/format";
import type { Customer } from "@/services/customer";
import type { Exchange } from "@/services/exchange";
import {
  OrderChannelEnum,
  PaymentMethod,
  type CartOrder,
  type OrderChannel,
  type PosTable,
  type PrintInvoiceResponse,
} from "@/services/pos";
import type { PrintJob } from "@/services/printer";
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

export type InvoicePrintItem = {
  displayTotal: number;
  hasItemDiscount: boolean;
  name: string;
  originalLineTotal: number | null;
  qty: number;
  toppingLabel: string;
  toppingTotal: number | null;
  toppings: InvoicePrintTopping[];
  unitPrice: number | null;
};

export type InvoicePrintTopping = {
  name: string;
  qty: number | null;
  total: number | null;
};

export type InvoicePrintData = {
  branchAddress: string;
  branchName: string;
  branchTel: string;
  cashier: string;
  customer: string | null;
  discount: number;
  invoice: string | null;
  items: InvoicePrintItem[];
  labels: Record<
    | "address"
    | "cashier"
    | "customer"
    | "date"
    | "discount"
    | "invoice"
    | "price"
    | "service"
    | "subtotal"
    | "table"
    | "thankYou"
    | "title"
    | "topping"
    | "total"
    | "vat",
    string
  >;
  contentWidthMm: number;
  paperHeightMm: number;
  paperWidthMm: number;
  printedAt: Date;
  qrUrl: string | null;
  service: number;
  storeName: string;
  subtotal: number;
  tableName: string;
  title: string;
  total: number;
  vat: number;
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

export const CUSTOMER_AUTO_SEARCH_TERMS = ["??????", "customer", "Customer"];
export const CUSTOMER_SEARCH_LIMIT = 20;
export const CUSTOMER_SEARCH_DEBOUNCE_MS = 300;

export function customerUuidOf(customer: Customer) {
  return optionalString(customer.customer_uuid) ?? "";
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

export function getPrintInvoiceJob(response: PrintInvoiceResponse) {
  return (
    getPrintableJob(response.print_job?.payload?.job) ??
    getPrintableJob(response.print_job)
  );
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

export async function openLocalInvoicePrintWindow(data: InvoicePrintData) {
  const paperWidth = data.paperWidthMm;
  const windowWidth = Math.max(
    Math.round(paperWidth * 4.2),
    window.screen.availWidth || window.innerWidth || 1024,
  );
  const windowHeight = window.screen.availHeight || window.innerHeight || 768;
  const printWindow = window.open(
    "",
    "_blank",
    `left=0,top=0,width=${windowWidth},height=${windowHeight},resizable=yes,scrollbars=yes`,
  );
  if (!printWindow) return false;

  try {
    printWindow.moveTo(0, 0);
    printWindow.resizeTo(windowWidth, windowHeight);
  } catch {
    // Browser popup policies can block resizing; the window can still print.
  }

  const safeTitle = escapeHtml(
    data.invoice ? `${data.labels.invoice}: ${data.invoice}` : data.title,
  );
  printWindow.document.write(
    `<!doctype html><html><head><title>${safeTitle}</title></head><body>Loading print preview...</body></html>`,
  );
  printWindow.document.close();

  printWindow.document.open();
  printWindow.document.write(renderLocalInvoiceHtml(data, safeTitle));
  printWindow.document.close();
  return true;
}

export function renderLocalInvoiceHtml(
  data: InvoicePrintData,
  safeTitle: string,
) {
  const contentWidth = data.contentWidthMm;
  const paperHeight = data.paperHeightMm;
  const paperWidth = data.paperWidthMm;

  return `<!doctype html>
<html>
  <head>
    <title>${safeTitle}</title>
    <style>
      @page { size: ${paperWidth}mm ${paperHeight}mm; margin: 0; }
      * { box-sizing: border-box; }
      html, body { width: ${paperWidth}mm; min-height: ${paperHeight}mm; margin: 0; background: #fff; color: #111; }
      body {
        font-family: Arial, "Noto Sans Lao", "Segoe UI", sans-serif;
        font-size: 13px;
        line-height: 1.16;
      }
      .paper {
        width: ${contentWidth}mm;
        min-height: ${paperHeight}mm;
        padding: 0;
        margin: 0 auto;
      }
      .center { text-align: center; }
      .strong { font-weight: 800; }
      .store {
        margin: 0;
        font-size: 20px;
        font-weight: 900;
        line-height: 1.12;
      }
      .muted {
        margin: 0;
        color: #333;
        line-height: 1.14;
      }
      .title {
        margin: 0.9mm 0 0.4mm;
        font-size: 18px;
        font-weight: 900;
        text-align: center;
        line-height: 1.12;
      }
      .divider {
        height: 0;
        margin: 0.8mm 0;
        border-top: 1px dashed #111;
      }
      .total-row,
      .item-main,
      .item-meta {
        display: flex;
        justify-content: space-between;
        gap: 2mm;
      }
      .meta {
        margin: 0;
        line-height: 1.16;
        font-variant-numeric: tabular-nums;
      }
      .total-row span:first-child {
        min-width: 0;
      }
      .total-row span:last-child,
      .item-total {
        flex-shrink: 0;
        text-align: right;
        font-variant-numeric: tabular-nums;
      }
      .item-original-total {
        flex-shrink: 0;
        color: #555;
        font-variant-numeric: tabular-nums;
        text-align: right;
        text-decoration: line-through;
        text-decoration-thickness: 1px;
      }
      .totals {
        display: grid;
        gap: 0.45mm;
      }
      .total-row {
        margin: 0;
        line-height: 1.16;
      }
      .item {
        padding: 0.7mm 0;
        border-bottom: 1px dashed #d4d4d4;
      }
      .item-name {
        min-width: 0;
        font-weight: 800;
        overflow-wrap: anywhere;
      }
      .item-meta {
        margin-top: 0.25mm;
        color: #333;
        font-size: 12px;
      }
      .toppings {
        display: grid;
        gap: 0.25mm;
        margin-top: 0.35mm;
        color: #333;
        font-size: 12px;
      }
      .topping-line {
        display: flex;
        justify-content: space-between;
        gap: 2mm;
      }
      .topping-line span:first-child {
        min-width: 0;
        overflow-wrap: anywhere;
      }
      .topping-line span:last-child {
        flex-shrink: 0;
        text-align: right;
        font-variant-numeric: tabular-nums;
      }
      .grand-total {
        margin-top: 0.25mm;
        padding-top: 0;
        font-size: 16px;
        font-weight: 900;
      }
      .footer {
        margin-top: 2mm;
        text-align: center;
        font-size: 13px;
        font-weight: 700;
      }
      .branch-qr {
        display: block;
        width: 58mm;
        max-width: 100%;
        height: auto;
        margin: 2.4mm auto 1.6mm;
        object-fit: contain;
      }
      @media print {
        html, body { width: ${paperWidth}mm; min-height: ${paperHeight}mm; }
        .paper { width: ${contentWidth}mm; min-height: ${paperHeight}mm; margin: 0 auto; }
      }
    </style>
  </head>
  <body>
    <main class="paper">
      ${renderInvoiceHeader(data)}
      <div class="divider"></div>
      ${renderInvoiceMeta(data)}
      <div class="divider"></div>
      ${renderInvoiceItems(data)}
      <div class="divider"></div>
      ${renderInvoiceTotals(data)}
      ${renderInvoiceQr(data)}
      <p class="footer">${escapeHtml(data.labels.thankYou)}</p>
    </main>
    <script>
      window.addEventListener("load", () => {
        window.focus();
        window.setTimeout(() => window.print(), 250);
      });
    </script>
  </body>
</html>`;
}

export function renderInvoiceHeader(data: InvoicePrintData) {
  return `
    <header class="center">
      ${data.storeName ? `<p class="store">${escapeHtml(data.storeName)}</p>` : ""}
      ${data.branchName ? `<p class="muted">${escapeHtml(data.branchName)}</p>` : ""}
      ${data.branchTel ? `<p class="muted">${escapeHtml(data.branchTel)}</p>` : ""}
      ${data.branchAddress ? `<p class="muted">${escapeHtml(data.branchAddress)}</p>` : ""}
      <p class="title">${escapeHtml(data.title)}</p>
    </header>`;
}

export function renderInvoiceMeta(data: InvoicePrintData) {
  return [
    invoiceMetaRow(data.labels.invoice, data.invoice ?? "-"),
    invoiceMetaRow(data.labels.date, formatInvoicePrintDate(data.printedAt)),
    invoiceMetaRow(data.labels.table, data.tableName || "-"),
    invoiceMetaRow(data.labels.cashier, data.cashier),
    data.customer ? invoiceMetaRow(data.labels.customer, data.customer) : "",
  ].join("");
}

export function renderInvoiceItems(data: InvoicePrintData) {
  const rows = data.items.length
    ? data.items.map(renderInvoiceItem).join("")
    : `<section class="item"><div class="center muted">-</div></section>`;

  return `
    <section>
      ${rows}
    </section>`;
}

export function renderInvoiceItem(item: InvoicePrintItem) {
  return `
    <section class="item">
      <div class="item-main">
        <span class="item-name">${escapeHtml(item.name)}</span>
        <span class="item-total">${escapeHtml(money(item.displayTotal))}</span>
      </div>
      <div class="item-meta">
        <span>${escapeHtml(formatInvoiceQty(item.qty))} x ${escapeHtml(item.unitPrice === null ? "-" : money(item.unitPrice))}</span>
        ${renderInvoiceOriginalLineTotal(item)}
      </div>
      ${renderInvoiceToppings(item)}
    </section>`;
}

export function renderInvoiceOriginalLineTotal(item: InvoicePrintItem) {
  return item.hasItemDiscount && item.originalLineTotal !== null
    ? `<span class="item-original-total">${escapeHtml(money(item.originalLineTotal))}</span>`
    : "";
}

export function renderInvoiceToppings(item: InvoicePrintItem) {
  if (item.toppings.length) {
    return `<div class="toppings">${item.toppings.map(renderInvoiceTopping).join("")}</div>`;
  }

  if (item.toppingTotal !== null && item.toppingTotal > 0) {
    return `<div class="toppings"><div class="topping-line"><span>+ ${escapeHtml(item.toppingLabel)}</span><span>+${escapeHtml(money(item.toppingTotal))}</span></div></div>`;
  }

  return "";
}

export function renderInvoiceTopping(topping: InvoicePrintTopping) {
  const qty = topping.qty !== null ? ` x ${formatInvoiceQty(topping.qty)}` : "";
  const total =
    topping.total !== null
      ? `<span>+${escapeHtml(money(topping.total))}</span>`
      : "";
  return `<div class="topping-line"><span>+ ${escapeHtml(topping.name)}${escapeHtml(qty)}</span>${total}</div>`;
}

export function renderInvoiceTotals(data: InvoicePrintData) {
  return `<section class="totals">${[
    invoiceTotalRow(data.labels.subtotal, money(data.subtotal)),
    data.discount > 0
      ? invoiceTotalRow(data.labels.discount, `-${money(data.discount)}`)
      : "",
    data.service > 0
      ? invoiceTotalRow(data.labels.service, money(data.service))
      : "",
    data.vat > 0 ? invoiceTotalRow(data.labels.vat, money(data.vat)) : "",
    invoiceTotalRow(data.labels.total, money(data.total), true),
  ].join("")}</section>`;
}

export function renderInvoiceQr(data: InvoicePrintData) {
  return data.qrUrl
    ? `<img class="branch-qr" src="${escapeHtml(data.qrUrl)}" alt="" />`
    : "";
}

export function invoiceMetaRow(label: string, value: string) {
  return `<p class="meta">${escapeHtml(label)}: ${escapeHtml(value)}</p>`;
}

export function invoiceTotalRow(label: string, value: string, strong = false) {
  return `<p class="total-row ${strong ? "grand-total" : ""}"><span>${escapeHtml(label)}</span><span>${escapeHtml(value)}</span></p>`;
}

export function formatInvoiceQty(value: number) {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

export function formatInvoicePrintDate(value: Date) {
  return value.toLocaleString();
}

export function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => {
    if (char === "&") return "&amp;";
    if (char === "<") return "&lt;";
    if (char === ">") return "&gt;";
    if (char === '"') return "&quot;";
    return "&#39;";
  });
}

export function isPrintableJob(value: unknown): value is PrintJob {
  return Boolean(
    value &&
      typeof value === "object" &&
      Array.isArray((value as { ops?: unknown }).ops),
  );
}

export function getPrintableJob(value: unknown): PrintJob | null {
  if (isPrintableJob(value)) return value;
  if (!value || typeof value !== "object") return null;

  const record = value as {
    job?: unknown;
    jobs?: unknown[];
    new_order?: { job?: unknown };
    payload?: unknown;
    source_order?: { job?: unknown };
  };

  if (Array.isArray(record.jobs)) {
    for (const item of record.jobs) {
      const job = getPrintableJob(item);
      if (job) return job;
    }
  }

  return (
    getPrintableJob(record.job) ??
    getPrintableJob(record.source_order?.job) ??
    getPrintableJob(record.new_order?.job) ??
    (record.payload === value ? null : getPrintableJob(record.payload))
  );
}
