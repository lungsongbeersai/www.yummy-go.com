import { describe, expect, it } from "vitest";
import { commercialLineInput, commercialTotals, PLC_EXAMPLES, validCommercialDocument, validCommercialItem, type CommercialDraftLine } from "@/features/commercial/commercial-domain";
import type { CreateCommercialDocumentInput } from "@/services/commercial";

function line(quantity: string, unitPrice: string): CommercialDraftLine {
  return { key: "line", name: "Printer", description: "", unit: "unit", quantity, unit_price: unitPrice, show_image: true };
}

function documentInput(quantity = 1): CreateCommercialDocumentInput {
  return { branch_uuid: "branch", document_type: "quotation", issued_on: "2026-11-14", customer: { name: "Customer" }, issuer: { name: "PLC" }, show_images: true, tax_rate: 10, items: [{ name: "Printer", quantity, unit_price: 100 }] };
}

describe("commercial LAK arithmetic", () => {
  it("matches the backend's exact decimal half-up rounding", () => {
    expect(commercialTotals([line("1.005", "100")], 10)).toEqual({ subtotal: 101, taxAmount: 10, total: 111 });
    expect(commercialTotals([line("0.005", "100")], 0)).toEqual({ subtotal: 1, taxAmount: 0, total: 1 });
    expect(commercialTotals([line("1", "5")], 10)).toEqual({ subtotal: 5, taxAmount: 1, total: 6 });
  });

  it("calculates the provided PLC example without creating saved records", () => {
    expect(commercialTotals(PLC_EXAMPLES.map((item) => line("1", String(item.unit_price))), 10)).toEqual({ subtotal: 18_400_000, taxAmount: 1_840_000, total: 20_240_000 });
  });

  it("rejects unsupported precision, negative prices and excessive totals", () => {
    expect(validCommercialDocument(documentInput(1.0001))).toBe(false);
    expect(validCommercialDocument(documentInput(0))).toBe(false);
    expect(validCommercialDocument(documentInput(1_000_000))).toBe(false);
    const expensive = documentInput(999_999);
    expensive.items[0].unit_price = 9_000_000_000_000;
    expect(validCommercialDocument(expensive)).toBe(false);
    expect(validCommercialItem("Printer", "950000.5")).toBe(false);
    expect(validCommercialItem("Printer", "0")).toBe(true);
    expect(validCommercialItem(" ", "100")).toBe(false);
  });

  it("rejects expiry before issue date and keeps row image flags in the payload", () => {
    expect(validCommercialDocument({ ...documentInput(), valid_until: "2026-11-13" })).toBe(false);
    expect(validCommercialDocument({ ...documentInput(), issued_on: "2026-02-30" })).toBe(false);
    expect(validCommercialDocument({ ...documentInput(), valid_until: "2027-02-30" })).toBe(false);
    expect(commercialLineInput({ ...line("2.5", "100"), item_uuid: "saved-item", show_image: false })).toMatchObject({ item_uuid: "saved-item", quantity: 2.5, unit_price: 100, show_image: false });
  });
});
