import type { CatalogItem, CommercialDocument, CommercialDocumentItemInput, CommercialParty, CreateCommercialDocumentInput } from "@/services/commercial";
import { validCommercialPaymentDetails } from "@/features/commercial/commercial-payment";

export const PLC_ISSUER: CommercialParty = {
  name: "ບໍລິສັດ ພີແອວຊີ ລາວ ຈໍາກັດຜູ້ດຽວ",
  phone: "020 5455 5597",
  address: "ບ້ານ ໂນນຄໍ້ເໜືອ, ເມືອງ ໄຊເສດຖາ, ນະຄອນຫຼວງວຽງຈັນ",
  logo_url: "/brand/plc-logo.png",
};

export const PLC_EXAMPLES = [
  { name: "POS All-in-One ຈໍສໍາຜັດ 2 ດ້ານ", unit_price: 12_500_000, unit: "ຊຸດ" },
  { name: "ເຄື່ອງພິມໃບສັ່ງອາຫານ ສໍາລັບຫ້ອງຄົວ", unit_price: 950_000, unit: "ເຄື່ອງ" },
  { name: "ເຄື່ອງພິມໃບສັ່ງເຄື່ອງດື່ມ ສໍາລັບບານ້ໍາ", unit_price: 950_000, unit: "ເຄື່ອງ" },
  { name: "ຄ່າລະບົບໂປຣແກຣມ YummyGo POS", unit_price: 4_000_000, unit: "ປີ" },
] as const;

export interface CommercialDraftLine {
  key: string;
  line_uuid?: string;
  item_uuid?: string;
  name: string;
  description: string;
  unit: string;
  quantity: string;
  unit_price: string;
  show_image: boolean;
  image_url?: string | null;
}

let draftLineSequence = 0;

export function commercialToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Vientiane", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function newCommercialLine(item?: CatalogItem): CommercialDraftLine {
  return {
    key: `commercial-line-${++draftLineSequence}`, item_uuid: item?.item_uuid,
    name: item?.name ?? "", description: item?.description ?? "", unit: item?.unit ?? "",
    quantity: "1", unit_price: String(item?.unit_price ?? 0), show_image: item?.image_visible ?? true,
    // A document cannot re-enable a catalogue photo hidden by its manager.
    image_url: item?.image_visible === false ? null : item?.image_url,
  };
}

export function commercialLineInput(line: CommercialDraftLine): CommercialDocumentItemInput {
  return {
    ...(line.line_uuid ? { line_uuid: line.line_uuid } : {}),
    ...(line.item_uuid ? { item_uuid: line.item_uuid } : {}), name: line.name.trim(), description: line.description.trim(),
    unit: line.unit.trim(), quantity: Number(line.quantity), unit_price: Number(line.unit_price), show_image: line.show_image,
  };
}

export function commercialDocumentLines(document: Pick<CommercialDocument, "items">): CommercialDraftLine[] {
  return document.items.map((item) => ({
    key: `commercial-line-${++draftLineSequence}`, line_uuid: item.line_uuid, item_uuid: item.item_uuid ?? undefined,
    name: item.name, description: item.description ?? "", unit: item.unit ?? "ລາຍການ",
    quantity: String(item.quantity), unit_price: String(item.unit_price),
    image_url: item.image_url, show_image: item.show_image,
  }));
}

export interface CommercialDiscountOptions {
  discountType?: "amount" | "percent" | null;
  discountValue?: number | string;
}

export const COMMERCIAL_MAX_MONEY = 9_000_000_000_000;

export const COMMERCIAL_CURRENCIES = ["LAK", "THB", "USD"] as const;
export type CommercialCurrency = (typeof COMMERCIAL_CURRENCIES)[number];

/** LAK is whole kip; THB and USD allow two decimal places. */
export function commercialCurrencyDecimals(currency: string | null | undefined) {
  return currency === "THB" || currency === "USD" ? 2 : 0;
}

/** Locale key of the short currency label shown next to amounts. */
export function commercialCurrencyLabelKey(currency: string | null | undefined): "lak" | "thb" | "usd" {
  return currency === "THB" ? "thb" : currency === "USD" ? "usd" : "lak";
}

/** Exact integer minor units (kip, satang or cents), or null when invalid for the currency. */
function minorUnits(value: string | number | null | undefined, decimals: number): bigint | null {
  const text = typeof value === "number" ? (Number.isFinite(value) ? String(value) : "") : String(value ?? "").trim();
  const match = (decimals ? /^(\d{1,13})(?:\.(\d{1,2}))?$/ : /^(\d{1,13})$/).exec(text);
  if (!match) return null;
  const unit = BigInt(10 ** decimals);
  const amount = BigInt(match[1]) * unit + BigInt((match[2] ?? "").padEnd(decimals, "0") || "0");
  return amount <= BigInt(COMMERCIAL_MAX_MONEY) * unit ? amount : null;
}

const majorUnits = (minor: bigint, decimals: number) => decimals ? Number(minor) / 10 ** decimals : Number(minor);

/** Whether a price or amount is a valid non-negative value for the currency. */
export function validCommercialAmount(value: string | number, currency?: string | null) {
  return minorUnits(value, commercialCurrencyDecimals(currency)) !== null;
}

function discountForSubtotal(subtotal: bigint, options: CommercialDiscountOptions, decimals = 0): bigint | null {
  if (options.discountType != null && !["amount", "percent"].includes(options.discountType)) return null;
  const value = Number(options.discountValue ?? 0);
  if (!Number.isFinite(value) || value < 0) return null;
  if (options.discountType === null) return value === 0 ? BigInt(0) : null;
  let discount: bigint;
  if (options.discountType === "percent") {
    const match = /^(\d{1,3})(?:\.(\d{1,2}))?$/.exec(String(value));
    if (!match || value > 100) return null;
    const basisPoints = BigInt(match[1]) * BigInt(100) + BigInt((match[2] ?? "").padEnd(2, "0"));
    discount = (subtotal * basisPoints + BigInt(5000)) / BigInt(10000);
  } else {
    const amount = minorUnits(value, decimals);
    if (amount === null) return null;
    discount = amount;
  }
  return discount <= subtotal ? discount : null;
}

export function validCommercialDiscount(subtotal: number, options: CommercialDiscountOptions = {}, currency?: string | null) {
  const decimals = commercialCurrencyDecimals(currency);
  const minor = minorUnits(subtotal, decimals);
  return minor !== null && discountForSubtotal(minor, options, decimals) !== null;
}

export function validCommercialItem(name: string, price: string) {
  return Boolean(name.trim() && price.trim() && Number.isSafeInteger(Number(price)) && Number(price) >= 0 && Number(price) <= 9_000_000_000_000);
}

function quantityThousandths(value: string | number) {
  const quantity = Number(value);
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 999_999.999) return null;
  const match = /^(\d+)(?:\.(\d{1,3}))?$/.exec(String(quantity));
  if (!match) return null;
  return BigInt(match[1]) * BigInt(1000) + BigInt((match[2] ?? "").padEnd(3, "0"));
}

/** Line total in minor units, rounded half up to a whole kip/satang/cent. */
function lineTotal(quantity: string | number, price: string | number, decimals = 0) {
  const scaledQuantity = quantityThousandths(quantity);
  const unitPrice = minorUnits(price, decimals);
  return scaledQuantity && unitPrice !== null
    ? (unitPrice * scaledQuantity + BigInt(500)) / BigInt(1000) : BigInt(0);
}

export function validCommercialDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < "2000-01-01" || value > "2199-12-31") return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validCommercialDocumentItems(items: CommercialDocumentItemInput[], currency?: string | null) {
  const decimals = commercialCurrencyDecimals(currency);
  const subtotal = items.reduce((sum, line) => sum + lineTotal(line.quantity, line.unit_price, decimals), BigInt(0));
  return items.length > 0 && items.length <= 100 && items.every((line) =>
    line.name.trim() && quantityThousandths(line.quantity) !== null && minorUnits(line.unit_price, decimals) !== null,
  ) && subtotal <= BigInt(COMMERCIAL_MAX_MONEY) * BigInt(10 ** decimals);
}

export function validCommercialDocument(input: CreateCommercialDocumentInput) {
  if (![0, 10].includes(input.tax_rate) || !validCommercialPaymentDetails(input.payment_details, input.issuer.bank_details)) return false;
  const decimals = commercialCurrencyDecimals(input.currency);
  const subtotal = input.items.reduce((sum, line) => sum + lineTotal(line.quantity, line.unit_price, decimals), BigInt(0));
  const discount = discountForSubtotal(subtotal, { discountType: input.discount_type, discountValue: input.discount_value }, decimals);
  if (discount === null) return false;
  const net = subtotal - discount;
  const total = net + (net * BigInt(input.tax_rate) + BigInt(50)) / BigInt(100);
  return Boolean(input.branch_uuid && input.customer.name.trim() && input.issuer.name.trim() &&
    validCommercialDate(input.issued_on) &&
    (!input.valid_until || (validCommercialDate(input.valid_until) && input.valid_until >= input.issued_on)) &&
    validCommercialDocumentItems(input.items, input.currency) && total <= BigInt(COMMERCIAL_MAX_MONEY) * BigInt(10 ** decimals));
}

export function commercialTotals(lines: CommercialDraftLine[], taxRate: number, discount: CommercialDiscountOptions = {}, currency?: string | null) {
  const decimals = commercialCurrencyDecimals(currency);
  const subtotal = lines.reduce((sum, line) => sum + lineTotal(line.quantity, line.unit_price, decimals), BigInt(0));
  const discountAmount = discountForSubtotal(subtotal, discount, decimals) ?? BigInt(0);
  const net = subtotal - discountAmount;
  const taxAmount = (net * BigInt([0, 10].includes(taxRate) ? taxRate : 0) + BigInt(50)) / BigInt(100);
  return { subtotal: majorUnits(subtotal, decimals), discountAmount: majorUnits(discountAmount, decimals),
    taxAmount: majorUnits(taxAmount, decimals), total: majorUnits(net + taxAmount, decimals) };
}

/** Amounts use the currency's fixed decimals: 1,250,000 kip or 64.63 USD. */
export function formatCommercialMoney(value: number, currency?: string | null) {
  const decimals = commercialCurrencyDecimals(currency);
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value);
}
