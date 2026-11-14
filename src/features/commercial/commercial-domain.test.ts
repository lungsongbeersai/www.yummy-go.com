import { describe, expect, it } from "vitest";
import { commercialDocumentLines, commercialLineInput, commercialTotals, PLC_EXAMPLES, validCommercialDiscount, validCommercialDocument, validCommercialItem, type CommercialDraftLine } from "@/features/commercial/commercial-domain";
import type { CreateCommercialDocumentInput } from "@/services/commercial";

function line(quantity: string, unitPrice: string): CommercialDraftLine {
  return { key: "line", name: "Printer", description: "", unit: "unit", quantity, unit_price: unitPrice, show_image: true };
}

function documentInput(quantity = 1): CreateCommercialDocumentInput {
  return { branch_uuid: "branch", document_type: "quotation", issued_on: "2026-11-14", customer: { name: "Customer" }, issuer: { name: "PLC" }, show_images: true, tax_rate: 10, items: [{ name: "Printer", quantity, unit_price: 100 }] };
}

describe("commercial LAK arithmetic", () => {
  it("matches the backend's exact decimal half-up rounding", () => {
    expect(commercialTotals([line("1.005", "100")], 10)).toEqual({ subtotal: 101, discountAmount: 0, taxAmount: 10, total: 111 });
    expect(commercialTotals([line("0.005", "100")], 0)).toEqual({ subtotal: 1, discountAmount: 0, taxAmount: 0, total: 1 });
    expect(commercialTotals([line("1", "5")], 10)).toEqual({ subtotal: 5, discountAmount: 0, taxAmount: 1, total: 6 });
  });

  it("calculates the provided PLC example without creating saved records", () => {
    expect(commercialTotals(PLC_EXAMPLES.map((item) => line("1", String(item.unit_price))), 10)).toEqual({ subtotal: 18_400_000, discountAmount: 0, taxAmount: 1_840_000, total: 20_240_000 });
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

  it("deducts a footer discount before VAT with exact percentage half-up rounding", () => {
    expect(commercialTotals([line("1", "1000")], 10, { discountType: "amount", discountValue: "100" }))
      .toEqual({ subtotal: 1000, discountAmount: 100, taxAmount: 90, total: 990 });
    expect(commercialTotals([line("1", "5")], 10, { discountType: "percent", discountValue: "10" }))
      .toEqual({ subtotal: 5, discountAmount: 1, taxAmount: 0, total: 4 });
    expect(commercialTotals([line("1", "10000")], 10, { discountType: "percent", discountValue: "12.35" }))
      .toEqual({ subtotal: 10000, discountAmount: 1235, taxAmount: 877, total: 9642 });
    expect(commercialTotals([line("1", "950000")], 10, { discountType: "percent", discountValue: "100" }).total).toBe(0);
    expect(validCommercialDocument({ ...documentInput(), discount_type: "amount", discount_value: 100 })).toBe(true);
  });

  it("validates optional discounts and rejects excessive, negative or imprecise values", () => {
    expect(validCommercialDiscount(100)).toBe(true);
    expect(validCommercialDiscount(100, { discountType: null, discountValue: "" })).toBe(true);
    for (const options of [
      { discountType: "amount" as const, discountValue: 101 },
      { discountType: "amount" as const, discountValue: 0.5 },
      { discountType: "amount" as const, discountValue: -1 },
      { discountType: "percent" as const, discountValue: 100.01 },
      { discountType: "percent" as const, discountValue: 1.001 },
      { discountType: "percent" as const, discountValue: Infinity },
      { discountType: null, discountValue: 1 },
    ]) {
      expect(validCommercialDiscount(100, options)).toBe(false);
      expect(validCommercialDocument({ ...documentInput(), discount_type: options.discountType, discount_value: Number(options.discountValue) })).toBe(false);
    }
    expect(validCommercialDiscount(9_000_000_000_001, { discountType: "percent", discountValue: 100 })).toBe(false);
  });

  it("seeds edits from saved rows while preserving their identity and archived photo", () => {
    const items = [{ line_uuid: "saved-line", item_uuid: "inactive-catalog-item", name: "Original name", description: "Original details", unit: "unit",
      quantity: 2.5, unit_price: 100, line_total: 250, image_url: "https://example.test/archived.webp", show_image: true }];
    const first = commercialDocumentLines({ items });
    const second = commercialDocumentLines({ items });
    expect(first[0]).toMatchObject({ line_uuid: "saved-line", item_uuid: "inactive-catalog-item", name: "Original name", quantity: "2.5", unit_price: "100", image_url: items[0].image_url });
    expect(first[0].key).not.toBe(second[0].key);
    expect(commercialLineInput(first[0])).toMatchObject({ line_uuid: "saved-line", item_uuid: "inactive-catalog-item", quantity: 2.5 });
    first[0].name = "Edited";
    expect(items[0].name).toBe("Original name");
  });
});
