import { describe, expect, it } from "vitest";
import { commercialLineInput, type CommercialDraftLine } from "@/features/commercial/commercial-domain";
import { firstInvalidCommercialField } from "@/features/commercial/commercial-document-validation";
import { commercialPaymentDraft, commercialPaymentInput, commercialPaymentProfileSnapshot } from "@/features/commercial/commercial-payment";
import type { CreateCommercialDocumentInput } from "@/services/commercial";

const draftLine = (patch: Partial<CommercialDraftLine> = {}): CommercialDraftLine => ({ key: "row", name: "Printer", description: "", unit: "unit", quantity: "1", unit_price: "950000", show_image: true, ...patch });
const input = (patch: Partial<CreateCommercialDocumentInput> = {}): CreateCommercialDocumentInput => ({ branch_uuid: "verified-branch", document_type: "quotation", issued_on: "2026-11-14", customer: { name: "Customer" }, issuer: { name: "PLC" }, items: [commercialLineInput(draftLine())], show_images: true, tax_rate: 0, ...patch });

describe("commercial full document validation", () => {
  it("finds the first required field across the complete form", () => {
    expect(firstInvalidCommercialField(input({ customer: { name: "" }, issuer: { name: "" }, items: [] }))).toBe("commercial-customer-name");
    expect(firstInvalidCommercialField(input({ issuer: { name: "" }, items: [] }))).toBe("commercial-issuer-name");
    expect(firstInvalidCommercialField(input({ items: [] }))).toBe("commercial-add-line");
  });

  it.each(["", "2026-02-30", "1999-12-31", "2200-01-01"])("focuses the issue date for invalid date %s", (issued_on) => {
    expect(firstInvalidCommercialField(input({ issued_on }))).toBe("commercial-issued-on");
  });

  it("validates quotation validity and retains legacy receipt payment methods", () => {
    expect(firstInvalidCommercialField(input({ valid_until: "2026-11-13" }))).toBe("commercial-valid-until");
    expect(firstInvalidCommercialField(input({ valid_until: "2026-12-31" }))).toBeNull();
    expect(firstInvalidCommercialField(input({ document_type: "receipt", payment_method: " " }))).toBe("commercial-payment-method");
    expect(firstInvalidCommercialField(input({ document_type: "receipt", payment_method: "BCEL original transfer" }))).toBeNull();
  });

  it.each([
    [{ customer: { name: "  " } }, "commercial-customer-name"],
    [{ customer: { name: "Customer", phone: "1".repeat(101) } }, "commercial-customer-phone"],
    [{ issuer: { name: "PLC", bank_details: "x".repeat(1501) } }, "commercial-issuer-bank"],
    [{ issuer: { name: "PLC", logo_url: "x".repeat(2001) } }, "commercial-issuer-logo"],
  ] as const)("focuses an invalid party field", (patch, id) => {
    expect(firstInvalidCommercialField(input(patch))).toBe(id);
  });

  it.each([
    [{ name: " " }, "row-name"], [{ description: "x".repeat(3001) }, "row-description"],
    [{ quantity: "0" }, "row-quantity"], [{ quantity: "1.0001" }, "row-quantity"],
    [{ unit: "x".repeat(61) }, "row-unit"], [{ unit_price: "1.5" }, "row-price"],
  ] as const)("focuses the exact invalid item field", (patch, id) => {
    const line = draftLine(patch);
    expect(firstInvalidCommercialField(input({ items: [commercialLineInput(line)] }), [line])).toBe(id);
  });

  it("distinguishes a blank price from valid zero and rejects blank quantity", () => {
    for (const [patch, id] of [[{ unit_price: "" }, "row-price"], [{ quantity: "" }, "row-quantity"]] as const) {
      const line = draftLine(patch);
      expect(firstInvalidCommercialField(input({ items: [commercialLineInput(line)] }), [line])).toBe(id);
    }
    const free = draftLine({ unit_price: "0" });
    expect(firstInvalidCommercialField(input({ items: [commercialLineInput(free)] }), [free])).toBeNull();
  });

  it("rejects line and aggregate monetary overflow", () => {
    const large = draftLine({ quantity: "999999.999", unit_price: "9000000000000" });
    expect(firstInvalidCommercialField(input({ items: [commercialLineInput(large)] }), [large])).toBe("row-price");
    const lines = [draftLine({ unit_price: "9000000000000" }), draftLine({ key: "second", unit_price: "1" })];
    expect(firstInvalidCommercialField(input({ items: lines.map(commercialLineInput) }), lines)).toBe("row-price");
  });

  it("validates optional discounts, notes and VAT after all document details", () => {
    for (const patch of [{ discount_type: "amount", discount_value: 950001 }, { discount_type: "percent", discount_value: 100.01 }, { discount_type: "percent", discount_value: 0.001 }] as const) {
      expect(firstInvalidCommercialField(input(patch))).toBe("commercial-discount");
    }
    expect(firstInvalidCommercialField(input({ discount_type: "percent", discount_value: 100, tax_rate: 10 }))).toBeNull();
    expect(firstInvalidCommercialField(input({ discount_type: null, discount_value: 0 }))).toBeNull();
    expect(firstInvalidCommercialField(input({ notes: "x".repeat(5001) }))).toBe("commercial-notes");
    const expensive = input({ items: [commercialLineInput(draftLine({ unit_price: "9000000000000" }))], tax_rate: 10 });
    expect(firstInvalidCommercialField(expensive)).toBe("commercial-tax");
    expect(firstInvalidCommercialField({ ...expensive, discount_type: "percent", discount_value: 10 })).toBeNull();
  });

  it("focuses payment selection when a chosen footer field was not included in a retained snapshot", () => {
    const account = commercialPaymentProfileSnapshot({ profile_uuid: "private", label: "Bank", bank_name: "Bank", account_name: "Owner", account_number: "001234", currency: "LAK", qr_image: null });
    const payment = { ...commercialPaymentDraft(), show_accounts: true, show_qr: true, accounts: [account] };
    expect(firstInvalidCommercialField(input({ payment_details: commercialPaymentInput(payment) }), [draftLine()], payment)).toBe("commercial-payment-profile");
    expect(firstInvalidCommercialField(input(), [draftLine()], commercialPaymentDraft())).toBeNull();
  });

  it("does not mutate saved snapshots or drafts while validating the full form", () => {
    const saved = input(), lines = [draftLine()];
    const before = structuredClone({ saved, lines });
    Object.freeze(saved); Object.freeze(saved.customer); Object.freeze(saved.issuer); Object.freeze(saved.items); saved.items.forEach(Object.freeze); Object.freeze(lines); lines.forEach(Object.freeze);
    expect(firstInvalidCommercialField(saved, lines)).toBeNull();
    expect({ saved, lines }).toEqual(before);
  });
});
