import { describe, expect, it } from "vitest";
import { buildCommercialDraftPreview, type CommercialDraftPreviewInput } from "@/features/commercial/commercial-draft-preview";
import { newCommercialLine, type CommercialDraftLine } from "@/features/commercial/commercial-domain";
import { renderCommercialDocument } from "@/features/commercial/commercial-print";
import type { CatalogItem } from "@/services/commercial";

const imageUrl = "https://example.test/printer.webp";
const draftLabel = "DRAFT / ຮ່າງ";
const line = (patch: Partial<CommercialDraftLine> = {}): CommercialDraftLine => ({
  key: "draft-row", item_uuid: "saved-catalog-item", name: "Printer", description: "Thermal printer", unit: "ເຄື່ອງ",
  quantity: "1", unit_price: "950000", image_url: imageUrl, show_image: true, ...patch,
});
const draft = (patch: Partial<CommercialDraftPreviewInput> = {}): CommercialDraftPreviewInput => ({
  branchUuid: "selected-branch", documentType: "quotation", issuedOn: "2026-11-14", validUntil: "2026-12-14",
  customer: { name: "Customer" }, issuer: { name: "PLC", logo_url: "/brand/plc-logo.png" }, notes: "Draft terms",
  paymentMethod: "cash", showImages: true, taxRate: 0, lines: [line()], draftLabel, ...patch,
});

describe("commercial live draft previews", () => {
  it("renders empty and partial drafts without creating an issued identity or number", () => {
    const preview = buildCommercialDraftPreview(draft({ branchUuid: "", issuedOn: "", validUntil: "",
      customer: { name: "" }, issuer: { name: "" }, notes: "", lines: [] }));
    expect(preview).toMatchObject({ document_uuid: "", branch_uuid: "", number: draftLabel, created_at: "",
      valid_until: null, source_quotation_uuid: null, receipt_uuid: null, items: [], subtotal: 0, tax_amount: 0, total: 0 });
    const html = renderCommercialDocument(preview);
    expect(html).toContain(draftLabel);
    expect(html).not.toMatch(/(?:QT|RC)-\d/);
    expect(html).not.toContain("window.print()");
    const partial = buildCommercialDraftPreview(draft({ issuedOn: "2026-", customer: { name: "  ລູກຄ້າ " },
      lines: [line({ name: "", quantity: "", unit_price: "" })] }));
    expect(partial.customer.name).toBe("  ລູກຄ້າ ");
    expect(partial.items).toHaveLength(1);
    expect(partial.items[0]).toMatchObject({ name: "", quantity: 0, unit_price: 0, line_total: 0 });
    expect(partial.preview_invalid).toBe(true);
    expect(() => renderCommercialDocument(partial)).not.toThrow();
  });

  it("updates quantity, price and tax immediately while previous previews remain unchanged", () => {
    const initial = draft();
    const first = buildCommercialDraftPreview(initial);
    const quantity = buildCommercialDraftPreview({ ...initial, lines: [line({ quantity: "2" })] });
    const price = buildCommercialDraftPreview({ ...initial, lines: [line({ quantity: "2", unit_price: "1000000" })] });
    const taxed = buildCommercialDraftPreview({ ...initial, taxRate: 10, lines: [line({ quantity: "2", unit_price: "1000000" })] });
    expect(first.total).toBe(950000);
    expect(quantity.total).toBe(1900000);
    expect(price.total).toBe(2000000);
    expect(taxed).toMatchObject({ subtotal: 2000000, tax_amount: 200000, total: 2200000, preview_invalid: false });
    expect(initial.lines[0].quantity).toBe("1");
    expect(first.items[0].quantity).toBe(1);
  });

  it("uses exact whole-kip half-up rounding for each line before VAT", () => {
    const preview = buildCommercialDraftPreview(draft({ taxRate: 10, lines: [
      line({ quantity: "1.005", unit_price: "100" }),
      line({ quantity: "0.005", unit_price: "100" }),
      line({ quantity: "1", unit_price: "5" }),
    ] }));
    expect(preview.items.map((item) => item.line_total)).toEqual([101, 1, 5]);
    expect(preview).toMatchObject({ subtotal: 107, tax_amount: 11, total: 118 });
    expect(renderCommercialDocument(preview)).toContain('class="currency">LAK</span> 118');
  });

  it.each(["", " \t\n "])("matches the saved document's generic unit for a blank optional unit %j", (unit) => {
    const input = draft({ lines: [line({ item_uuid: undefined, unit })] });
    const preview = buildCommercialDraftPreview(input);
    expect(preview.items[0].unit).toBe("ລາຍການ");
    expect(renderCommercialDocument(preview)).toContain('<td class="center">ລາຍການ</td>');
    expect(input.lines[0].unit).toBe(unit);
  });

  it.each(["", "-", ".", "1e", "Infinity", "NaN", "-1", "0", "1.0001", "1000000", "9".repeat(400)])(
    "normalizes an incomplete or invalid quantity %j without NaN or Infinity", (quantity) => {
      const preview = buildCommercialDraftPreview(draft({ lines: [line({ quantity })] }));
      expect(preview.items[0]).toMatchObject({ quantity: 0, line_total: 0 });
      expect(preview.total).toBe(0);
      expect(preview.preview_invalid).toBe(true);
      expect(renderCommercialDocument(preview)).not.toMatch(/NaN|Infinity/);
    },
  );

  it.each(["", "-", ".", "1e", "Infinity", "NaN", "-1", "1.5", "9000000000001", "9".repeat(400)])(
    "normalizes an incomplete or invalid unit price %j without changing the editor string", (unit_price) => {
      const input = draft({ lines: [line({ unit_price })] });
      const preview = buildCommercialDraftPreview(input);
      expect(preview.items[0]).toMatchObject({ quantity: 1, unit_price: 0, line_total: 0 });
      expect(preview.total).toBe(0);
      expect(preview.preview_invalid).toBe(true);
      expect(input.lines[0].unit_price).toBe(unit_price);
    },
  );

  it("guards line and aggregate overflow while keeping ordinary zero-price lines valid", () => {
    const overflow = buildCommercialDraftPreview(draft({ lines: [line({ quantity: "999999.999", unit_price: "9000000000000" })] }));
    expect(overflow.items[0]).toMatchObject({ quantity: 0, unit_price: 9000000000000, line_total: 0 });
    expect(overflow.total).toBe(0);
    expect(overflow.preview_invalid).toBe(true);
    for (const input of [
      draft({ lines: Array.from({ length: 100 }, () => line({ unit_price: "9000000000000" })) }),
      draft({ taxRate: 10, lines: [line({ unit_price: "9000000000000" })] }),
    ]) {
      const preview = buildCommercialDraftPreview(input);
      expect(preview).toMatchObject({ subtotal: 0, tax_amount: 0, total: 0, preview_invalid: true });
      expect(Object.values({ subtotal: preview.subtotal, tax: preview.tax_amount, total: preview.total }).every(Number.isSafeInteger)).toBe(true);
    }
    expect(buildCommercialDraftPreview(draft({ lines: [line({ unit_price: "0" })] })))
      .toMatchObject({ total: 0, preview_invalid: false });
  });

  it.each([NaN, Infinity, -1, 1.5, 7])("normalizes unsupported tax %s before integer arithmetic", (taxRate) => {
    const preview = buildCommercialDraftPreview(draft({ taxRate }));
    expect(preview).toMatchObject({ tax_rate: 0, tax_amount: 0, total: 950000, preview_invalid: true });
  });

  it("keeps global and per-line image flags independent and reversible", () => {
    const input = draft();
    expect(renderCommercialDocument(buildCommercialDraftPreview(input))).toContain(`src="${imageUrl}"`);
    const globalHidden = buildCommercialDraftPreview({ ...input, showImages: false });
    expect(globalHidden.items[0]).toMatchObject({ image_url: imageUrl, show_image: true });
    expect(renderCommercialDocument(globalHidden)).not.toContain(`src="${imageUrl}"`);
    const rowHidden = buildCommercialDraftPreview({ ...input, lines: [line({ show_image: false })] });
    expect(rowHidden.items[0]).toMatchObject({ image_url: imageUrl, show_image: false });
    expect(renderCommercialDocument(rowHidden)).not.toContain(`src="${imageUrl}"`);
    expect(renderCommercialDocument(buildCommercialDraftPreview(input))).toContain(`src="${imageUrl}"`);
  });

  it("does not expose a saved image hidden by the catalogue", () => {
    const hidden: CatalogItem = { item_uuid: "hidden-item", catalog_store_uuid: "owner", branch_uuid: "origin",
      name: "Hidden photo", description: "Model", unit: "unit", unit_price: 100, image_url: imageUrl,
      image_visible: false, active: true, created_at: "", updated_at: "" };
    const preview = buildCommercialDraftPreview(draft({ lines: [newCommercialLine(hidden)] }));
    expect(preview.items[0]).toMatchObject({ image_url: null, show_image: false });
    expect(renderCommercialDocument(preview)).not.toContain(`src="${imageUrl}"`);
  });

  it("previews receipt payment fields and quotation validity without issued links", () => {
    const quote = buildCommercialDraftPreview(draft());
    expect(quote).toMatchObject({ valid_until: "2026-12-14", payment_method: "" });
    const receipt = buildCommercialDraftPreview(draft({ documentType: "receipt", paymentMethod: "transfer" }));
    expect(receipt).toMatchObject({ document_type: "receipt", valid_until: null, payment_method: "transfer",
      source_quotation_uuid: null, receipt_uuid: null, document_uuid: "", number: draftLabel });
    const html = renderCommercialDocument(receipt);
    expect(html).toContain("RECEIPT");
    expect(html).toContain("Bank transfer");
    expect(html).not.toContain("14/12/2026");
  });

  it("preserves raw text and produces isolated deterministic snapshots without mutating input", () => {
    const input = draft({ customer: { name: "  Customer <script>unsafe()</script>  ", address: "First\nSecond" },
      issuer: { name: "  PLC  ", bank_details: "  Bank  " }, notes: "  Terms\n<draft>  ",
      lines: [line({ name: "  Printer  ", description: "  Model <b>A</b>\n  details  ", unit: "  ເຄື່ອງ  " })] });
    const original = structuredClone(input);
    Object.freeze(input); Object.freeze(input.customer); Object.freeze(input.issuer);
    Object.freeze(input.lines); input.lines.forEach(Object.freeze);
    const preview = buildCommercialDraftPreview(input);
    expect(input).toEqual(original);
    expect(buildCommercialDraftPreview(input)).toEqual(preview);
    expect(preview.customer).not.toBe(input.customer);
    expect(preview.issuer).not.toBe(input.issuer);
    expect(preview.items[0]).not.toBe(input.lines[0]);
    expect(preview.items[0]).toMatchObject({ name: input.lines[0].name, description: input.lines[0].description, unit: input.lines[0].unit });
    expect(preview.notes).toBe(input.notes);
    const html = renderCommercialDocument(preview);
    expect(html).toContain("&lt;script&gt;unsafe()&lt;/script&gt;");
    expect(html).toContain("&lt;b&gt;A&lt;/b&gt;");
    expect(html).not.toContain("<script>unsafe()");
    expect(html).not.toContain("window.print()");
  });

  it("previews the entered discount before VAT and hides a cleared optional discount", () => {
    const discounted = buildCommercialDraftPreview(draft({ taxRate: 10, discountType: "percent", discountValue: "10", lines: [line({ unit_price: "1000" })] }));
    expect(discounted).toMatchObject({ subtotal: 1000, discount_type: "percent", discount_value: 10, discount_amount: 100, tax_amount: 90, total: 990, preview_invalid: false });
    expect(renderCommercialDocument(discounted)).toContain('class="total-row discount-row"');
    const cleared = buildCommercialDraftPreview(draft({ discountType: "amount", discountValue: "" }));
    expect(cleared).toMatchObject({ discount_type: null, discount_value: 0, discount_amount: 0, total: 950000, preview_invalid: false });
    expect(renderCommercialDocument(cleared)).not.toContain('class="total-row discount-row"');
    const tiny = buildCommercialDraftPreview(draft({ discountType: "percent", discountValue: "0.01", lines: [line({ unit_price: "1" })] }));
    expect(tiny).toMatchObject({ discount_value: 0.01, discount_amount: 0, total: 1 });
    expect(renderCommercialDocument(tiny)).toContain("(0.01%)");
  });

  it.each(["-1", "1000000", "1.5", "NaN", "Infinity"])("keeps an invalid fixed discount %j renderable and flags the draft", (discountValue) => {
    const preview = buildCommercialDraftPreview(draft({ discountType: "amount", discountValue }));
    expect(preview).toMatchObject({ total: 0, discount_value: 0, discount_amount: 0, preview_invalid: true });
    expect(renderCommercialDocument(preview)).not.toMatch(/NaN|Infinity/);
  });

  it("retains saved row IDs, document number and receipt source version when editing", () => {
    const preview = buildCommercialDraftPreview(draft({ documentType: "receipt", draftLabel: "RC-2026-00012", version: 3,
      sourceQuotationUuid: "quote", sourceQuotationVersion: 2, sourceQuotationNumber: "QT-2026-00009", lines: [line({ line_uuid: "original-line" })] }));
    expect(preview).toMatchObject({ number: "RC-2026-00012", version: 3, source_quotation_uuid: "quote", source_quotation_version: 2, source_quotation_number: "QT-2026-00009" });
    expect(preview.items[0].line_uuid).toBe("original-line");
    const html = renderCommercialDocument(preview);
    expect(html).toContain("RC-2026-00012 · ສະບັບ 3");
    expect(html).toContain("QT-2026-00009 · ສະບັບ 2");
    expect(html).not.toContain(draftLabel);
  });
});
