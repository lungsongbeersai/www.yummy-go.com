import { commercialLineInput, commercialTotals, validCommercialAmount, validCommercialDiscount, type CommercialDraftLine, type CommercialDiscountOptions } from "@/features/commercial/commercial-domain";
import { commercialPaymentPreview } from "@/features/commercial/commercial-payment";
import type { CommercialDocument, CommercialDocumentItem, CommercialDocumentType, CommercialParty, CommercialPaymentCurrency, CommercialPaymentDetails } from "@/services/commercial";

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
  paymentDetails?: CommercialPaymentDetails;
  currency?: CommercialPaymentCurrency;
  taxRate: number;
  lines: CommercialDraftLine[];
  draftLabel: string;
  discountType?: CommercialDiscountOptions["discountType"];
  discountValue?: string | number;
  version?: number;
  sourceQuotationUuid?: string | null;
  sourceQuotationVersion?: number | null;
  sourceQuotationNumber?: string | null;
}

export interface CommercialDraftPreviewDocument extends CommercialDocument {
  preview_invalid: boolean;
}

const maxMoney = 9_000_000_000_000;
const safeAmount = (value: number) => Number.isFinite(value) && value >= 0 && value <= maxMoney;

function previewLine(line: CommercialDraftLine, currency?: string | null) {
  const input = commercialLineInput(line);
  const quantityValid = Number.isFinite(input.quantity) && input.quantity > 0 && input.quantity <= 999_999.999 &&
    /^\d+(?:\.\d{1,3})?$/.test(String(input.quantity));
  const priceValid = Boolean(line.unit_price.trim()) && validCommercialAmount(line.unit_price, currency);
  const normalized = { ...line, quantity: String(quantityValid ? input.quantity : 0), unit_price: String(priceValid ? input.unit_price : 0) };
  const calculated = commercialTotals([normalized], 0, {}, currency).subtotal;
  const amountValid = safeAmount(calculated);
  // Keep incomplete edits renderable without exposing an unsafe total. The
  // editor retains its original strings and still validates before issuing.
  if (!amountValid) normalized.quantity = "0";
  const item: CommercialDocumentItem = {
    ...input,
    line_uuid: line.line_uuid ?? "",
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
  const lines = input.lines.map((line) => previewLine(line, input.currency));
  const taxRate = input.taxRate === 10 ? 10 : 0;
  const discount = { discountType: input.discountType, discountValue: input.discountValue };
  const calculated = commercialTotals(lines.map((line) => line.normalized), taxRate, discount, input.currency);
  const discountValid = validCommercialDiscount(calculated.subtotal, discount, input.currency);
  const totalsValid = Object.values(calculated).every(safeAmount) && discountValid;
  const totals = totalsValid ? calculated : { subtotal: 0, discountAmount: 0, taxAmount: 0, total: 0 };
  const receipt = input.documentType === "receipt";
  const version = input.version ?? 1;
  const discountValue = discountValid ? Number(input.discountValue ?? 0) : 0;
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
    payment_details: input.paymentDetails ? commercialPaymentPreview(input.paymentDetails) : undefined,
    currency: input.currency ?? "LAK",
    tax_rate: taxRate,
    discount_type: discountValue > 0 ? input.discountType ?? "amount" : null,
    discount_value: discountValue,
    discount_amount: totals.discountAmount,
    subtotal: totals.subtotal,
    tax_amount: totals.taxAmount,
    total: totals.total,
    source_quotation_uuid: input.sourceQuotationUuid ?? null,
    source_quotation_version: input.sourceQuotationVersion ?? null,
    source_quotation_number: input.sourceQuotationNumber ?? null,
    receipt_uuid: null,
    items: lines.map((line) => line.item),
    created_at: "",
    version: Number.isSafeInteger(version) && version > 0 ? version : 1,
    updated_at: "",
    updated_by: "",
    preview_invalid: ![0, 10].includes(input.taxRate) || !totalsValid || lines.some((line) => line.invalid),
  };
}
