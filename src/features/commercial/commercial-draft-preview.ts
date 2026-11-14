import { commercialLineInput, commercialTotals, type CommercialDraftLine } from "@/features/commercial/commercial-domain";
import type { CommercialDocument, CommercialDocumentItem, CommercialDocumentType, CommercialParty } from "@/services/commercial";

export interface CommercialDraftPreviewInput {
  branchUuid: string;
  documentType: CommercialDocumentType;
  issuedOn: string;
  validUntil: string;
  customer: CommercialParty;
  issuer: CommercialParty;
  notes: string;
  paymentMethod: string;
  showImages: boolean;
  taxRate: number;
  lines: CommercialDraftLine[];
  draftLabel: string;
}

export interface CommercialDraftPreviewDocument extends CommercialDocument {
  preview_invalid: boolean;
}

const maxMoney = 9_000_000_000_000;
const safeAmount = (value: number) => Number.isSafeInteger(value) && value >= 0 && value <= maxMoney;

function previewLine(line: CommercialDraftLine) {
  const input = commercialLineInput(line);
  const quantityValid = Number.isFinite(input.quantity) && input.quantity > 0 && input.quantity <= 999_999.999 &&
    /^\d+(?:\.\d{1,3})?$/.test(String(input.quantity));
  const priceValid = Boolean(line.unit_price.trim()) && safeAmount(input.unit_price);
  const normalized = { ...line, quantity: String(quantityValid ? input.quantity : 0), unit_price: String(priceValid ? input.unit_price : 0) };
  const calculated = commercialTotals([normalized], 0).subtotal;
  const amountValid = safeAmount(calculated);
  // Keep incomplete edits renderable without exposing an unsafe total. The
  // editor retains its original strings and still validates before issuing.
  if (!amountValid) normalized.quantity = "0";
  const item: CommercialDocumentItem = {
    ...input,
    item_uuid: input.item_uuid ?? null,
    name: line.name,
    description: line.description,
    unit: line.unit.trim() ? line.unit : "ລາຍການ",
    quantity: Number(normalized.quantity),
    unit_price: Number(normalized.unit_price),
    line_total: amountValid ? calculated : 0,
    image_url: line.image_url ?? null,
    show_image: line.show_image,
  };
  return { normalized, item, invalid: !quantityValid || !priceValid || !amountValid };
}

export function buildCommercialDraftPreview(input: CommercialDraftPreviewInput): CommercialDraftPreviewDocument {
  const lines = input.lines.map(previewLine);
  const taxRate = input.taxRate === 10 ? 10 : 0;
  const calculated = commercialTotals(lines.map((line) => line.normalized), taxRate);
  const totalsValid = Object.values(calculated).every(safeAmount);
  const totals = totalsValid ? calculated : { subtotal: 0, taxAmount: 0, total: 0 };
  const receipt = input.documentType === "receipt";
  return {
    document_uuid: "",
    branch_uuid: input.branchUuid,
    number: input.draftLabel,
    document_type: input.documentType,
    issued_on: input.issuedOn,
    valid_until: receipt ? null : input.validUntil || null,
    customer: { ...input.customer },
    issuer: { ...input.issuer },
    notes: input.notes,
    payment_method: receipt ? input.paymentMethod : "",
    show_images: input.showImages,
    tax_rate: taxRate,
    subtotal: totals.subtotal,
    tax_amount: totals.taxAmount,
    total: totals.total,
    source_quotation_uuid: null,
    receipt_uuid: null,
    items: lines.map((line) => line.item),
    created_at: "",
    preview_invalid: ![0, 10].includes(input.taxRate) || !totalsValid || lines.some((line) => line.invalid),
  };
}
