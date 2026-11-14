import { describe, it, expect } from "vitest";
import type { CatalogItem, CommercialDocument } from "@/services/commercial";
import { LAO_FONTS } from "@/stores/app-store";
import { commercialAmountWords, commercialImageUrl, renderCommercialCatalog, renderCommercialDocument } from "./commercial-print";

const document: CommercialDocument = {
  document_uuid: "document", branch_uuid: "branch", number: "QT-20261114-0001", document_type: "quotation",
  issued_on: "2026-11-14", valid_until: null, customer: { name: "Customer <script>unsafe()</script>" },
  issuer: { name: "PLC", logo_url: "/brand/plc-logo.png" }, notes: "Terms & conditions", payment_method: "cash",
  show_images: true, tax_rate: 0, discount_type: null, discount_value: 0, discount_amount: 0, subtotal: 18400000, tax_amount: 0, total: 18400000,
  source_quotation_uuid: null, source_quotation_version: null, receipt_uuid: null, created_at: "2026-11-14T00:00:00Z", version: 1, updated_at: "2026-11-14T00:00:00Z", updated_by: "issuer",
  items: [{ line_uuid: "line", item_uuid: "printer", name: "Printer", description: "<b>Original model</b>", unit: "ເຄື່ອງ", quantity: 1, unit_price: 950000, line_total: 950000, image_url: "https://example.com/printer.png", show_image: true }],
};

describe("commercial print documents", () => {
  it("uses saved totals and Lao A4 headers, while escaping customer and item text", () => {
    const html = renderCommercialDocument(document);
    expect(html).toContain("QUOTATION");
    expect(html).toContain('class="currency">LAK</span> 18,400,000');
    expect(html).toContain("14/11/2026");
    expect(html).toContain("&lt;script&gt;unsafe()&lt;/script&gt;");
    expect(html).toContain("&lt;b&gt;Original model&lt;/b&gt;");
    expect(html).not.toContain("<script>unsafe()");
    expect(html).toContain("size: A4");
    expect(html).not.toContain("window.print()");
  });

  it("passes the system Lao font choice to both document and price-list previews", () => {
    expect(renderCommercialDocument(document)).toContain('data-lao-font="noto-sans"');
    for (const laoFont of LAO_FONTS) {
      for (const html of [renderCommercialDocument(document, { laoFont }), renderCommercialCatalog([], "Branch", undefined, { laoFont })]) {
        expect(html).toContain(`data-lao-font="${laoFont}"`);
        expect(html).toContain("/fonts/app-document-fonts.css");
        expect(html).not.toContain("window-open-fonts");
      }
    }
  });

  it("honours both global and per-item image visibility without changing the saved document", () => {
    expect(renderCommercialDocument(document)).toContain('src="https://example.com/printer.png"');
    expect(renderCommercialDocument(document, { showImages: false })).not.toContain('src="https://example.com/printer.png"');
    expect(renderCommercialDocument({ ...document, items: document.items.map(item => ({ ...item, show_image: false })) })).not.toContain('src="https://example.com/printer.png"');
    expect(document.show_images).toBe(true);
  });

  it("rejects executable and protocol-relative image URLs", () => {
    expect(commercialImageUrl("javascript:alert(1)")).toBeNull();
    expect(commercialImageUrl("data:image/svg+xml,unsafe")).toBeNull();
    expect(commercialImageUrl("//example.com/logo.png")).toBeNull();
    expect(commercialImageUrl("https://user:secret@example.com/logo.png")).toBeNull();
    expect(commercialImageUrl("/brand/plc-logo.png")).toBe("/brand/plc-logo.png");
  });

  it("renders receipts with payment and receiver fields instead of quote validity", () => {
    const html = renderCommercialDocument({ ...document, document_type: "receipt", valid_until: "2026-12-01" }, { autoPrint: true });
    expect(html).toContain("RECEIPT");
    expect(html).toContain("ຜູ້ຮັບເງິນ");
    expect(html).toContain("ເງິນສົດ / Cash");
    expect(html).not.toContain("01/12/2026");
    expect(html).toContain("document.fonts");
    expect(html).toContain("image.decode()");
  });

  it("renders price lists without summing prices as a bill", () => {
    const item: CatalogItem = { item_uuid: "item", catalog_store_uuid: "catalog-owner", branch_uuid: "origin-branch", name: "Visible item", description: "", unit: "unit", unit_price: 950000, image_url: null, image_visible: true, active: true, created_at: "", updated_at: "" };
    const html = renderCommercialCatalog([item, { ...item, item_uuid: "hidden", name: "Inactive item", active: false }], "Catalog owner", document.issuer);
    expect(html).toContain("PRICE LIST");
    expect(html).toContain("950,000");
    expect(html).not.toContain("Inactive item");
    expect(html).not.toContain('class="totals"');
    expect(html).toContain("ລາຍການລາຄາ: Catalog owner");
    expect(html).not.toContain("ສາຂາ:");
  });

  it("only prints an entered footer discount, before the tax row", () => {
    expect(renderCommercialDocument(document)).not.toContain('class="total-row discount-row"');
    const fixed = renderCommercialDocument({ ...document, discount_type: "amount", discount_value: 400000, discount_amount: 400000, total: 18000000 });
    expect(fixed).toContain('class="number">−400,000');
    expect(fixed.indexOf('class="total-row discount-row"')).toBeLessThan(fixed.indexOf("ອາກອນ"));
    expect(fixed).toContain('class="currency">LAK</span> 18,000,000');
    const percentage = renderCommercialDocument({ ...document, discount_type: "percent", discount_value: 12.35, discount_amount: 2272400 });
    expect(percentage).toContain("ສ່ວນຫຼຸດ (12.35%)");
  });

  it("identifies edited versions and the original quotation revision in receipt output", () => {
    const html = renderCommercialDocument({ ...document, document_type: "receipt", version: 4,
      source_quotation_uuid: "quote", source_quotation_number: "QT-2026-00009 <old>", source_quotation_version: 2 });
    expect(html).toContain(`${document.number} · ສະບັບ 4`);
    expect(html).toContain("QT-2026-00009 &lt;old&gt; · ສະບັບ 2");
  });
});

describe("Lao amount words", () => {
  it("formats the user's reference total and zero", () => {
    expect(commercialAmountWords(18400000)).toBe("ສິບແປດລ້ານສີ່ແສນກີບຖ້ວນ");
    expect(commercialAmountWords(0)).toBe("ສູນກີບຖ້ວນ");
    expect(commercialAmountWords(21)).toBe("ຊາວເອັດກີບຖ້ວນ");
    expect(commercialAmountWords(-1)).toBe("");
  });
});
