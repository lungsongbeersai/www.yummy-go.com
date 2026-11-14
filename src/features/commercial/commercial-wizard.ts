import { COMMERCIAL_MAX_MONEY, commercialTotals, validCommercialDate, validCommercialDiscount, validCommercialDocumentItems, type CommercialDraftLine } from "@/features/commercial/commercial-domain";
import type { CommercialParty, CreateCommercialDocumentInput } from "@/services/commercial";
import { validCommercialPaymentDetails } from "@/features/commercial/commercial-payment";

export const COMMERCIAL_WIZARD_LAST_STEP = 4;

function validParty(party: CommercialParty, issuer = false) {
  return Boolean(party.name.trim() && party.name.length <= 250 && (party.address?.length ?? 0) <= 1500 &&
    (party.phone?.length ?? 0) <= 100 && (party.tax_id?.length ?? 0) <= 100 &&
    (!issuer || ((party.bank_details?.length ?? 0) <= 1500 && (party.logo_url?.length ?? 0) <= 2000)));
}

function previewLines(input: CreateCommercialDocumentInput): CommercialDraftLine[] {
  return input.items.map((item, index) => ({ key: String(index), name: item.name, description: item.description ?? "", unit: item.unit ?? "",
    quantity: String(item.quantity), unit_price: String(item.unit_price), show_image: item.show_image ?? true }));
}

/** Validate the current step without requiring fields from later steps yet. */
export function validateCommercialStep(step: number, input: CreateCommercialDocumentInput, draftLines?: CommercialDraftLine[]) {
  if (step === 0) return Boolean(input.branch_uuid && validCommercialDate(input.issued_on) &&
    (input.document_type === "quotation"
      ? (!input.valid_until || (validCommercialDate(input.valid_until) && input.valid_until >= input.issued_on))
      : input.document_type === "receipt" && input.payment_method?.trim() && input.payment_method.length <= 250));
  if (step === 1) return validParty(input.customer);
  if (step === 2) return validParty(input.issuer, true);
  if (step === 3) return validCommercialDocumentItems(input.items) &&
    (!draftLines || (draftLines.length === input.items.length && draftLines.every((line) => line.quantity.trim() && line.unit_price.trim())));
  if (step === 4) {
    const discount = { discountType: input.discount_type, discountValue: input.discount_value };
    const totals = commercialTotals(draftLines ?? previewLines(input), input.tax_rate, discount);
    return [0, 10].includes(input.tax_rate) && validCommercialPaymentDetails(input.payment_details, input.issuer.bank_details) && validCommercialDiscount(totals.subtotal, discount) &&
      Object.values(totals).every((amount) => Number.isSafeInteger(amount) && amount >= 0 && amount <= COMMERCIAL_MAX_MONEY) &&
      (input.notes?.length ?? 0) <= 5000;
  }
  return false;
}

export function firstInvalidCommercialStep(input: CreateCommercialDocumentInput, draftLines?: CommercialDraftLine[]) {
  for (let step = 0; step <= COMMERCIAL_WIZARD_LAST_STEP; step += 1) {
    if (!validateCommercialStep(step, input, draftLines)) return step;
  }
  return null;
}
