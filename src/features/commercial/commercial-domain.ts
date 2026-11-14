import type { CatalogItem, CommercialDocumentItemInput, CommercialParty, CreateCommercialDocumentInput } from "@/services/commercial";

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
    quantity: "1", unit_price: String(item?.unit_price ?? 0), show_image: item?.image_visible ?? true, image_url: item?.image_url,
  };
}

export function commercialLineInput(line: CommercialDraftLine): CommercialDocumentItemInput {
  return {
    ...(line.item_uuid ? { item_uuid: line.item_uuid } : {}), name: line.name.trim(), description: line.description.trim(),
    unit: line.unit.trim(), quantity: Number(line.quantity), unit_price: Number(line.unit_price), show_image: line.show_image,
  };
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

function lineTotal(quantity: string | number, price: string | number) {
  const scaledQuantity = quantityThousandths(quantity);
  const unitPrice = Number(price);
  return scaledQuantity && Number.isSafeInteger(unitPrice) && unitPrice >= 0
    ? (BigInt(unitPrice) * scaledQuantity + BigInt(500)) / BigInt(1000) : BigInt(0);
}

function validCommercialDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < "2000-01-01" || value > "2199-12-31") return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validCommercialDocument(input: CreateCommercialDocumentInput) {
  const subtotal = input.items.reduce((sum, line) => sum + lineTotal(line.quantity, line.unit_price), BigInt(0));
  const total = subtotal + (subtotal * BigInt(input.tax_rate) + BigInt(50)) / BigInt(100);
  return Boolean(input.branch_uuid && input.customer.name.trim() && input.issuer.name.trim() &&
    validCommercialDate(input.issued_on) &&
    (!input.valid_until || (validCommercialDate(input.valid_until) && input.valid_until >= input.issued_on)) && input.items.length > 0 && input.items.length <= 100 && input.items.every((line) =>
      line.name.trim() && quantityThousandths(line.quantity) !== null &&
      Number.isSafeInteger(line.unit_price) && line.unit_price >= 0 && line.unit_price <= 9_000_000_000_000,
    ) && total <= BigInt(9_000_000_000_000));
}

export function commercialTotals(lines: CommercialDraftLine[], taxRate: number) {
  const subtotal = lines.reduce((sum, line) => sum + lineTotal(line.quantity, line.unit_price), BigInt(0));
  const taxAmount = (subtotal * BigInt(taxRate) + BigInt(50)) / BigInt(100);
  return { subtotal: Number(subtotal), taxAmount: Number(taxAmount), total: Number(subtotal + taxAmount) };
}

export function formatCommercialMoney(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}
