import { describe, expect, it } from "vitest";
import { commercialLineInput, type CommercialDraftLine } from "@/features/commercial/commercial-domain";
import { firstInvalidCommercialStep, validateCommercialStep } from "@/features/commercial/commercial-wizard";
import type { CreateCommercialDocumentInput } from "@/services/commercial";

const draftLine = (patch: Partial<CommercialDraftLine> = {}): CommercialDraftLine => ({ key: "row", name: "Printer", description: "", unit: "unit", quantity: "1", unit_price: "950000", show_image: true, ...patch });
const input = (patch: Partial<CreateCommercialDocumentInput> = {}): CreateCommercialDocumentInput => ({ branch_uuid: "verified-branch", document_type: "quotation", issued_on: "2026-11-14", customer: { name: "Customer" }, issuer: { name: "PLC" }, items: [commercialLineInput(draftLine())], show_images: true, tax_rate: 0, ...patch });

describe("commercial wizard validation", () => {
  it("lets the document step advance before later required fields are filled", () => {
    const partial = input({ customer: { name: "" }, issuer: { name: "" }, items: [] });
    expect(validateCommercialStep(0, partial)).toBe(true);
    expect(firstInvalidCommercialStep(partial)).toBe(1);
  });

  it.each(["", "2026-02-30", "1999-12-31", "2200-01-01"])("returns to document details for invalid issue date %s", (issued_on) => {
    expect(firstInvalidCommercialStep(input({ issued_on }))).toBe(0);
  });

  it("validates quotation validity and supports the saved receipt's legacy payment method", () => {
    expect(firstInvalidCommercialStep(input({ valid_until: "2026-11-13" }))).toBe(0);
    expect(firstInvalidCommercialStep(input({ valid_until: "2026-12-31" }))).toBeNull();
    expect(firstInvalidCommercialStep(input({ document_type: "receipt", payment_method: " " }))).toBe(0);
    expect(firstInvalidCommercialStep(input({ document_type: "receipt", payment_method: "BCEL original transfer" }))).toBeNull();
  });

  it("finds the earliest invalid party and validates optional field length", () => {
    expect(firstInvalidCommercialStep(input({ customer: { name: "  " }, issuer: { name: "" }, items: [] }))).toBe(1);
    expect(firstInvalidCommercialStep(input({ customer: { name: "Customer", phone: "1".repeat(101) } }))).toBe(1);
    expect(firstInvalidCommercialStep(input({ issuer: { name: "" } }))).toBe(2);
    expect(firstInvalidCommercialStep(input({ issuer: { name: "PLC", bank_details: "x".repeat(1501) } }))).toBe(2);
    expect(firstInvalidCommercialStep(input({ issuer: { name: "PLC", logo_url: "x".repeat(2001) } }))).toBe(2);
  });

  it("blocks invalid item data before the review step", () => {
    for (const items of [[], [commercialLineInput(draftLine({ quantity: "0" }))], [commercialLineInput(draftLine({ quantity: "1.0001" }))], [commercialLineInput(draftLine({ unit_price: "1.5" }))]]) {
      expect(firstInvalidCommercialStep(input({ items }))).toBe(3);
    }
  });

  it("distinguishes a missing price from a valid zero-price item", () => {
    const missing = draftLine({ unit_price: "" });
    expect(validateCommercialStep(3, input({ items: [commercialLineInput(missing)] }), [missing])).toBe(false);
    const free = draftLine({ unit_price: "0" });
    expect(firstInvalidCommercialStep(input({ items: [commercialLineInput(free)] }), [free])).toBeNull();
  });

  it("rejects aggregate item overflow before review", () => {
    expect(firstInvalidCommercialStep(input({ items: [commercialLineInput(draftLine({ quantity: "999999.999", unit_price: "9000000000000" }))] }))).toBe(3);
  });

  it("validates review discounts and VAT after earlier steps are complete", () => {
    expect(firstInvalidCommercialStep(input({ discount_type: "amount", discount_value: 950001 }))).toBe(4);
    expect(firstInvalidCommercialStep(input({ discount_type: "percent", discount_value: 100.01 }))).toBe(4);
    expect(firstInvalidCommercialStep(input({ discount_type: "percent", discount_value: 0.001 }))).toBe(4);
    expect(firstInvalidCommercialStep(input({ discount_type: "percent", discount_value: 100, tax_rate: 10 }))).toBeNull();
    expect(firstInvalidCommercialStep(input({ discount_type: null, discount_value: 0 }))).toBeNull();
    expect(firstInvalidCommercialStep(input({ notes: "x".repeat(5001) }))).toBe(4);
  });

  it("catches VAT overflow while allowing a discount that brings the final total into range", () => {
    const expensive = input({ items: [commercialLineInput(draftLine({ unit_price: "9000000000000" }))], tax_rate: 10 });
    expect(firstInvalidCommercialStep(expensive)).toBe(4);
    expect(firstInvalidCommercialStep({ ...expensive, discount_type: "percent", discount_value: 10 })).toBeNull();
  });

  it("does not mutate snapshots or drafts while checking navigation", () => {
    const saved = input(), lines = [draftLine()];
    const before = structuredClone({ saved, lines });
    Object.freeze(saved); Object.freeze(saved.customer); Object.freeze(saved.issuer); Object.freeze(saved.items); saved.items.forEach(Object.freeze); Object.freeze(lines); lines.forEach(Object.freeze);
    expect(firstInvalidCommercialStep(saved, lines)).toBeNull();
    expect({ saved, lines }).toEqual(before);
    expect(validateCommercialStep(5, saved)).toBe(false);
    expect(validateCommercialStep(-1, saved)).toBe(false);
  });
});
