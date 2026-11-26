import { COMMERCIAL_MAX_MONEY, commercialCurrencyDecimals, commercialTotals, validCommercialAmount, validCommercialDate, validCommercialDiscount, validCommercialDocumentItems, type CommercialDraftLine } from "@/features/commercial/commercial-domain";
import { validCommercialPaymentDetails, validCommercialPaymentDraft, type CommercialPaymentDraft } from "@/features/commercial/commercial-payment";
import type { CommercialParty, CreateCommercialDocumentInput } from "@/services/commercial";

function invalidPartyField(party: CommercialParty, id: string, issuer = false) {
  if (!party.name.trim() || party.name.length > 250) return `${id}-name`;
  if ((party.address?.length ?? 0) > 1500) return `${id}-address`;
  if ((party.phone?.length ?? 0) > 100) return `${id}-phone`;
  if ((party.tax_id?.length ?? 0) > 100) return `${id}-tax`;
  if (issuer && (party.bank_details?.length ?? 0) > 1500) return `${id}-bank`;
  if (issuer && (party.logo_url?.length ?? 0) > 2000) return `${id}-logo`;
  return null;
}

/** Return the first actionable field in the full editor's visual order. */
export function firstInvalidCommercialField(input: CreateCommercialDocumentInput, draftLines?: CommercialDraftLine[], payment?: CommercialPaymentDraft): string | null {
  if (!input.branch_uuid || !validCommercialDate(input.issued_on)) return "commercial-issued-on";
  if (input.document_type === "quotation" && input.valid_until && (!validCommercialDate(input.valid_until) || input.valid_until < input.issued_on)) return "commercial-valid-until";
  if (input.document_type === "receipt" && (!input.payment_method?.trim() || input.payment_method.length > 250)) return "commercial-payment-method";
  const party = invalidPartyField(input.customer, "commercial-customer") ?? invalidPartyField(input.issuer, "commercial-issuer", true);
  if (party) return party;
  if (!input.items.length || input.items.length > 100 || (draftLines && draftLines.length !== input.items.length)) return "commercial-add-line";
  for (const [index, item] of input.items.entries()) {
    const line = draftLines?.[index];
    const key = line?.key ?? `commercial-line-${index}`;
    if (!item.name.trim() || item.name.length > 250) return `${key}-name`;
    if ((item.description?.length ?? 0) > 3000) return `${key}-description`;
    if (line?.quantity.trim() === "" || !Number.isFinite(item.quantity) || item.quantity <= 0 || item.quantity > 999999.999 || !/^\d+(?:\.\d{1,3})?$/.test(String(item.quantity))) return `${key}-quantity`;
    if ((item.unit?.length ?? 0) > 60) return `${key}-unit`;
    if (line?.unit_price.trim() === "" || !validCommercialAmount(line?.unit_price ?? item.unit_price, input.currency) || !validCommercialDocumentItems([item], input.currency)) return `${key}-price`;
  }
  if (!validCommercialDocumentItems(input.items, input.currency)) return draftLines?.[0] ? `${draftLines[0].key}-price` : "commercial-add-line";
  if (!validCommercialPaymentDetails(input.payment_details, input.issuer.bank_details) || (payment && !validCommercialPaymentDraft(payment, input.issuer.bank_details))) return "commercial-payment-profile";
  const lines = draftLines ?? input.items.map((item, index) => ({ key: String(index), name: item.name, description: item.description ?? "", unit: item.unit ?? "", quantity: String(item.quantity), unit_price: String(item.unit_price), show_image: item.show_image ?? true }));
  const discount = { discountType: input.discount_type, discountValue: input.discount_value };
  const totals = commercialTotals(lines, input.tax_rate, discount, input.currency);
  if ((input.notes?.length ?? 0) > 5000) return "commercial-notes";
  if (!validCommercialDiscount(totals.subtotal, discount, input.currency)) return "commercial-discount";
  if (![0, 10].includes(input.tax_rate) || !Object.values(totals).every((amount) => Number.isFinite(amount) && amount >= 0 && amount <= COMMERCIAL_MAX_MONEY && Number.isSafeInteger(Math.round(amount * 10 ** commercialCurrencyDecimals(input.currency))))) return "commercial-tax";
  return null;
}
