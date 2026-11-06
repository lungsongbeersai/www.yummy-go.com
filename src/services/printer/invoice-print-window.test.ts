import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runInNewContext } from "node:vm";
import lao from "../../../public/locales/la/common.json";
import {
  INVOICE_TOTAL_FIT_SCRIPT,
  CANONICAL_INVOICE_PRINT_ON_LOAD_SCRIPT,
  mergeInvoicePrintItems,
  renderInvoiceItems,
  renderInvoiceHeader,
  renderInvoiceExchangeRates,
  renderInvoiceTotals,
  renderInvoicePayment,
  openLocalInvoiceBatchPrintWindow,
  openLocalInvoicePrintWindow,
  reserveLocalInvoicePrintWindow,
  parseCanonicalInvoicePrintDocument,
  renderLocalInvoiceHtml,
  renderLocalInvoiceBatchHtml,
  type CanonicalInvoicePrintDocument,
  type InvoicePrintData,
  type InvoicePrintItem,
} from "./invoice-print-window";

const openPrintWindow = vi.hoisted(() => vi.fn());
vi.mock("@/lib/capacitor-platform", () => ({ openWindowOutsideNativeApp: openPrintWindow }));

function item(overrides: Partial<InvoicePrintItem> = {}): InvoicePrintItem {
  return {
    displayTotal: 180_000,
    hasItemDiscount: false,
    name: "Burger",
    originalLineTotal: 180_000,
    qty: 3,
    toppingLabel: "Topping",
    toppingTotal: null,
    toppings: [],
    unitPrice: 60_000,
    ...overrides,
  };
}

it("prints the branch logo above the store heading only when supplied", () => {
  const data = { storeName: "Store", title: "Invoice", logoUrl: 'https://example.com/logo.png?v=1&name="shop"' } as InvoicePrintData;
  const header = renderInvoiceHeader(data);
  expect(header).toContain('class="branch-logo" src="https://example.com/logo.png?v=1&amp;name=&quot;shop&quot;"');
  expect(header.indexOf('class="branch-logo"')).toBeLessThan(header.indexOf('class="store"'));
  expect(renderInvoiceHeader({ ...data, logoUrl: null })).not.toContain('class="branch-logo"');
  expect(renderInvoiceHeader({ ...data, logoUrl: undefined })).not.toContain('class="branch-logo"');
});

it("emphasizes only the Lao item and amount headings before the first food item", () => {
  const productName = "ເຂົ້າຜັດ";
  const data = {
    items: [item({ name: productName })],
    labels: { item: lao.pos.invoicePrintItem, amount: lao.pos.invoicePrintAmount },
  } as InvoicePrintData;
  const html = renderInvoiceItems(data);
  expect(html).toContain('<span class="item-name item-heading-lao">ລາຍການ</span>');
  expect(html).toContain('<span class="item-total item-heading-lao">ຈຳນວນເງິນ</span>');
  expect(html.match(/item-heading-lao/g)).toHaveLength(2);
  expect(html).toContain(`<span class="item-name">${productName}</span>`);
  expect(html.indexOf("ລາຍການ")).toBeLessThan(html.indexOf(productName));
  expect(html.indexOf("ຈຳນວນເງິນ")).toBeLessThan(html.indexOf(productName));
  expect(renderInvoiceItems({
    ...data, labels: { ...data.labels, item: "Item", amount: "Amount" },
  })).not.toContain("item-heading-lao");
});

describe("mergeInvoicePrintItems", () => {
  it("merges equivalent order rounds only in the payment document projection", () => {
    const rows = [
      item(),
      item({ displayTotal: 120_000, originalLineTotal: 120_000, qty: 2 }),
    ];
    const snapshot = structuredClone(rows);

    expect(mergeInvoicePrintItems(rows)).toEqual([
      item({ displayTotal: 300_000, originalLineTotal: 300_000, qty: 5 }),
    ]);
    expect(rows).toEqual(snapshot);
  });

  it("keeps different prices, discounts, and toppings on separate lines", () => {
    const rows = [
      item(),
      item({ unitPrice: 65_000, displayTotal: 195_000 }),
      item({
        displayTotal: 162_000,
        hasItemDiscount: true,
      }),
      item({
        displayTotal: 195_000,
        toppingTotal: 15_000,
        toppings: [{ name: "Cheese", qty: 1, total: 15_000 }],
      }),
    ];

    expect(mergeInvoicePrintItems(rows)).toHaveLength(4);
  });

  it("keeps different tastes on separate payment lines", () => {
    expect(
      mergeInvoicePrintItems([
        item({ tastes: [{ name: "Spicy" }] }),
        item({ tastes: [{ name: "Sweet" }] }),
      ]),
    ).toHaveLength(2);
  });

  it("adds topping totals while keeping the per-item topping quantity", () => {
    const rows = [
      item({
        displayTotal: 195_000,
        toppingTotal: 15_000,
        toppings: [{ name: "Cheese", qty: 1, total: 15_000 }],
      }),
      item({
        displayTotal: 130_000,
        originalLineTotal: 120_000,
        qty: 2,
        toppingTotal: 10_000,
        toppings: [{ name: "Cheese", qty: 1, total: 10_000 }],
      }),
    ];

    expect(mergeInvoicePrintItems(rows)).toEqual([
      item({
        displayTotal: 325_000,
        originalLineTotal: 300_000,
        qty: 5,
        toppingTotal: 25_000,
        toppings: [{ name: "Cheese", qty: 1, total: 25_000 }],
      }),
    ]);
  });
});

describe("invoice payable row", () => {
  it("keeps the full saved payable amount beside the exact Lao label", () => {
    const data = {
      discount: 0, service: 0, subtotal: 0, vat: 0, total: 123456789,
      labels: { total: lao.pos.invoicePrintAmountToPay },
    } as InvoicePrintData;
    const html = renderInvoiceTotals(data);
    expect(html).toContain('<p class="total-row grand-total"><span class="payable-label-lao">ມູນຄ່າຕ້ອງຊຳລະ</span><span>123.456.789 ₭</span></p>');
    expect(data.total).toBe(123456789);
  });

  it("fits long totals after fonts load and before printing without cumulative shrinking", async () => {
    let fontsLoaded = false;
    let resolveFonts = () => { fontsLoaded = true; };
    const fontsReady = new Promise<void>((resolve) => {
      resolveFonts = () => { fontsLoaded = true; resolve(); };
    });
    const listeners = new Map<string, () => void | Promise<void>>();
    const parts = [
      { fontSize: 18, width: 140 }, { fontSize: 26, width: 145 },
    ].map(({ fontSize, width }) => ({
      baseFontSize: fontSize,
      style: { fontSize: "", removeProperty() { this.fontSize = ""; } },
      getBoundingClientRect() {
        expect(fontsLoaded).toBe(true);
        return { width: width * (parseFloat(this.style.fontSize) || fontSize) / fontSize };
      },
    }));
    const row = { querySelectorAll: () => parts, getBoundingClientRect: () => ({ width: 181 }) };
    runInNewContext(INVOICE_TOTAL_FIT_SCRIPT, {
      window: { addEventListener: (event: string, listener: () => void | Promise<void>) => listeners.set(event, listener) },
      document: { querySelectorAll: () => [row], fonts: { ready: fontsReady } },
      getComputedStyle: (element: typeof row | typeof parts[number]) =>
        "baseFontSize" in element
          ? { fontSize: element.style.fontSize || `${element.baseFontSize}px` }
          : { columnGap: "4px" },
    });
    const loading = listeners.get("load")?.();
    expect(parts.every((part) => part.style.fontSize === "")).toBe(true);
    resolveFonts();
    await loading;
    const fitted = parts.map((part) => part.style.fontSize);
    expect(parts.reduce((sum, part) => sum + part.getBoundingClientRect().width, 0) + 4).toBeLessThanOrEqual(181);
    expect(parseFloat(fitted[1])).toBeGreaterThan(parseFloat(fitted[0]));
    listeners.get("beforeprint")?.();
    expect(parts.map((part) => part.style.fontSize)).toEqual(fitted);
  });
});

describe("invoice exchange heading", () => {
  it("uses the exact Lao heading without a colon and scopes glyph emphasis to Lao", () => {
    const data = {
      exchangeRates: [{ code: "THB", rate: 690 }], total: 583000,
      labels: { currentExchangeRate: lao.pos.invoicePrintCurrentExchangeRate },
    } as InvoicePrintData;
    expect(renderInvoiceExchangeRates(data)).toContain('<p class="exchange-heading exchange-heading-lao strong">ອັດຕາແລກປ່ຽນ</p>');
    expect(renderInvoiceExchangeRates({
      ...data, labels: { ...data.labels, currentExchangeRate: "Current Exchange Rate" },
    })).toContain('<p class="exchange-heading strong">Current Exchange Rate</p>');
  });

  it("keeps each currency's converted amount beside its code and its rate immediately below", () => {
    const data = {
      total: 231000,
      exchangeRates: [
        { code: "THB", rate: 690 },
        { code: "USD", rate: 23000 },
        { code: "JPY", rate: 100 },
      ],
      labels: { currentExchangeRate: "Current Exchange Rate", amountDueByCurrency: "Old due heading" },
    } as InvoicePrintData;
    const original = structuredClone(data);
    const html = renderInvoiceExchangeRates(data);
    expect(html.match(/class="exchange-group"/g)).toHaveLength(3);
    const groups = [
      ["THB", "334.79", "690"],
      ["USD", "10.05", "23,000"],
      ["JPY", "2,310.00", "100"],
    ].map(([code, amount, rate]) => `<div class="exchange-group"><p class="exchange-row"><span>${code}</span><span class="exchange-amount">${amount}</span></p><p class="exchange-rate">1 ${code} = ${rate} LAK</p></div>`);
    expect(html).toContain(groups.join(""));
    expect(html).not.toContain("Old due heading");
    expect(html).not.toContain("231,000 LAK");
    expect(data).toEqual(original);
  });

  it("escapes currency labels and keeps long converted values complete", () => {
    const html = renderInvoiceExchangeRates({
      total: 123456789, exchangeRates: [{ code: 'USD <&> "test"', rate: 1 }],
      labels: { currentExchangeRate: "Exchange <rates>" },
    } as InvoicePrintData);
    expect(html).toContain("Exchange &lt;rates&gt;");
    expect(html).toContain('<span>USD &lt;&amp;&gt; &quot;test&quot;</span><span class="exchange-amount">123,456,789.00</span>');
    expect(html).toContain('1 USD &lt;&amp;&gt; &quot;test&quot; = 1 LAK');
    expect(html).not.toContain("USD <&>");
  });
});

describe("receipt payment summary", () => {
  it("leaves existing unpaid invoice rendering unchanged", () => {
    expect(renderInvoicePayment({} as InvoicePrintData)).toBe("");
  });

  it("renders saved receipt amounts including zero change and escapes its payment label", () => {
    const data = {
      payment: {
        paidCash: 0, paidTransfer: 35_000, paidTotal: 35_000, change: 0,
        label: 'Bank <&> "one"', currency: "LAK", exchangeRate: 1,
        foreignPaid: 0, paidLak: 35_000, changeLak: 0,
      },
      labels: { paidTransfer: "Transfer", paidTotal: "Received", change: "Change" },
    } as InvoicePrintData;
    const html = renderInvoicePayment(data);
    expect(html).toContain("Bank &lt;&amp;&gt; &quot;one&quot;");
    expect(html).toContain("<span>Transfer</span><span>35.000 ₭</span>");
    expect(html).toContain("<span>Received</span><span>35.000 ₭</span>");
    expect(html).toContain("<span>Change</span><span>0 ₭</span>");
    expect(html).not.toContain("Cash received");
  });
});

function previewData(): InvoicePrintData {
  return {
    branchAddress: "", branchName: "", branchTel: "", cashier: "Staff",
    customer: null, discount: 0, invoice: "I<&>", items: [item()],
    labels: {
      address: "Address", cashier: "Staff", customer: "Customer", date: "Date",
      discount: "Discount", invoice: "Invoice", price: "Price", service: "Service",
      subtotal: "Subtotal", table: "Table", thankYou: "Thank you", title: "Invoice",
      topping: "Topping", total: "Total", vat: "VAT",
    },
    contentWidthMm: 72.1, paperHeightMm: 210, paperWidthMm: 80,
    printedAt: new Date("2026-11-06T00:00:00Z"), qrUrl: null,
    service: 0, storeName: "Shop", subtotal: 180_000, tableName: "7",
    title: "Invoice", total: 180_000, vat: 0,
  };
}

const png576 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAkAAAAACCAYAAACwlWN4AAAAIUlEQVR4nO3OMQEAAAgDoPUvrS3mISQgAwDwTK4DAABtC3YZ7wCqktBBAAAAAElFTkSuQmCC";
const png384 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAYAAAAACCAYAAABRyAvYAAAAH0lEQVR4nO3OMQEAAAwCIPuX3mJ4CAnIATAp7QAAHQ80uvSm5BoSwQAAAABJRU5ErkJggg==";

function canonicalDocument(paper: 58 | 80 = 80): CanonicalInvoicePrintDocument {
  const width = paper === 58 ? 384 : 576;
  return {
    version: 1, document_type: "receipt", lang: "la", paper_width_mm: paper,
    printable_width_px: width,
    images: [{ src: paper === 58 ? png384 : png576, width, height: 2 }],
  };
}

describe("canonical Auto Print document", () => {
  it.each([58, 80] as const)("keeps every %imm PNG strip byte-for-byte at the Auto Print physical scale", (paper) => {
    const document = canonicalDocument(paper);
    document.images.push({ ...document.images[0] });
    const source = structuredClone(document);
    const data = { ...previewData(), canonicalPrintDocument: document };
    expect(parseCanonicalInvoicePrintDocument(document, "receipt")).toEqual(source);
    const html = renderLocalInvoiceHtml(data, "Receipt &lt;1&gt;");
    const widthMm = paper === 58 ? 48 : 72;
    expect(html).toContain(`@page { size: ${paper}mm 0.5mm; margin: 0; }`);
    expect(html.match(new RegExp(`src="${document.images[0].src.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`, "g"))).toHaveLength(2);
    expect(html).toContain(`style="width:${widthMm}mm;height:0.25mm"`);
    expect(html).not.toContain("210mm");
    expect(html).not.toContain("180.000");
    expect(html).not.toContain("<link");
    expect(html).not.toContain("font-size: 13px");
    expect(html).not.toContain("fitInvoiceTotals");
    expect(document).toEqual(source);
  });

  it("rejects invalid source formats, changed dimensions and noncanonical documents", () => {
    const document = canonicalDocument();
    const image = document.images[0];
    for (const changed of [
      undefined, null, {}, { ...document, version: 2 },
      { ...document, document_type: "report" }, { ...document, lang: "en" },
      { ...document, paper_width_mm: 57 }, { ...document, printable_width_px: 384 },
      { ...document, images: [] }, { ...document, images: [{ ...image, width: 384 }] },
      { ...document, images: [{ ...image, height: 1 }] },
      { ...document, images: [{ ...image, height: 2.5 }] },
      { ...document, images: [{ ...image, height: 0 }] },
      { ...document, images: [{ ...image, height: 32_001 }] },
      ...["https://example.com/receipt.png", "data:image/svg+xml;base64,PHN2Zz4=", "data:image/png;base64,bm90IGEgcG5n", `${image.src}\" onerror=\"alert(1)`]
        .map((src) => ({ ...document, images: [{ ...image, src }] })),
    ]) expect(parseCanonicalInvoicePrintDocument(changed)).toBeNull();
    expect(parseCanonicalInvoicePrintDocument(document, "invoice")).toBeNull();
  });

  it("bounds image count, aggregate declared height and encoded PNG allocation", () => {
    const document = canonicalDocument();
    const image = document.images[0];
    expect(parseCanonicalInvoicePrintDocument({ ...document, images: Array.from({ length: 129 }, () => image) })).toBeNull();
    const bytes = Buffer.from(image.src.split(",")[1], "base64");
    bytes.writeUInt32BE(32_000, 20);
    const tallImage = { ...image, height: 32_000, src: `data:image/png;base64,${bytes.toString("base64")}` };
    expect(parseCanonicalInvoicePrintDocument({ ...document, images: [tallImage, tallImage, tallImage] })).toBeNull();
    expect(parseCanonicalInvoicePrintDocument({ ...document, images: [{ ...image,
      src: `data:image/png;base64,${"A".repeat(Math.ceil(20 * 1024 * 1024 / 3) * 4 + 4)}`,
    }] })).toBeNull();
  });

  it("fails closed for a missing canonical member or mixed paper sizes in a batch", () => {
    const canonical = { ...previewData(), canonicalPrintDocument: canonicalDocument() };
    expect(() => renderLocalInvoiceBatchHtml([canonical, previewData()], "Batch")).toThrow("Canonical print document unavailable");
    expect(() => renderLocalInvoiceBatchHtml([canonical, {
      ...previewData(), canonicalPrintDocument: canonicalDocument(58),
    }], "Batch")).toThrow("Canonical print paper size mismatch");
  });

  it("waits for every image decoder before triggering the print dialog", async () => {
    let finishDecode!: () => void;
    const decoded = new Promise<void>((resolve) => { finishDecode = resolve; });
    const print = vi.fn();
    const focus = vi.fn();
    const image = { complete: true, naturalWidth: 576, decode: () => decoded };
    const listeners = new Map<string, () => void>();
    runInNewContext(CANONICAL_INVOICE_PRINT_ON_LOAD_SCRIPT, {
      window: { addEventListener: (name: string, listener: () => void) => listeners.set(name, listener), focus,
        setTimeout: (callback: () => void) => callback(), print },
      document: { querySelectorAll: () => [image], body: { setAttribute: vi.fn() }, getElementById: () => null },
    });
    listeners.get("load")?.();
    await Promise.resolve();
    expect(print).not.toHaveBeenCalled();
    finishDecode();
    await vi.waitFor(() => expect(print).toHaveBeenCalledOnce());
    expect(focus).toHaveBeenCalledOnce();
  });

  it("shows a clear error and never prints a partial document when an image is broken", async () => {
    const print = vi.fn();
    const error = { hidden: true };
    const setAttribute = vi.fn();
    const listeners = new Map<string, () => void>();
    runInNewContext(CANONICAL_INVOICE_PRINT_ON_LOAD_SCRIPT, {
      window: { addEventListener: (name: string, listener: () => void) => listeners.set(name, listener),
        focus: vi.fn(), setTimeout: (callback: () => void) => callback(), print },
      document: { querySelectorAll: () => [{ complete: true, naturalWidth: 0, decode: () => Promise.reject(new Error("broken PNG")) }],
        body: { setAttribute }, getElementById: () => error },
    });
    listeners.get("load")?.();
    await vi.waitFor(() => expect(error.hidden).toBe(false));
    expect(setAttribute).toHaveBeenCalledWith("data-print-error", "image_decode_failed");
    expect(print).not.toHaveBeenCalled();
  });
});

function popup() {
  return {
    closed: false,
    document: { open: vi.fn(), write: vi.fn(), close: vi.fn() },
    close: vi.fn(), moveTo: vi.fn(), resizeTo: vi.fn(),
  };
}

describe("reserved browser print window", () => {
  beforeEach(() => {
    openPrintWindow.mockReset();
    vi.stubGlobal("window", { screen: { availWidth: 1440, availHeight: 900 } });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("reserves synchronously before awaiting a server snapshot and renders once", () => {
    const target = popup();
    openPrintWindow.mockReturnValue(target);
    const reservation = reserveLocalInvoicePrintWindow();
    expect(openPrintWindow).toHaveBeenCalledOnce();
    expect(target.document.write).toHaveBeenCalledWith(expect.stringContaining("Loading print preview"));
    expect(target.document.write).not.toHaveBeenCalledWith(expect.stringContaining("180.000"));
    expect(reservation?.render(previewData())).toBe(true);
    expect(target.document.write).toHaveBeenLastCalledWith(expect.stringContaining("180.000 ₭"));
    expect(target.document.write).toHaveBeenLastCalledWith(expect.stringContaining("<title>Invoice: I&lt;&amp;&gt;</title>"));
    expect(reservation?.render(previewData())).toBe(false);
    reservation?.closeUnused();
    expect(target.close).not.toHaveBeenCalled();
  });

  it("closes a reservation when a physical job is used or preparation fails", () => {
    const target = popup();
    openPrintWindow.mockReturnValue(target);
    const reservation = reserveLocalInvoicePrintWindow();
    reservation?.closeUnused();
    expect(target.close).toHaveBeenCalledOnce();
    reservation?.closeUnused();
    expect(target.close).toHaveBeenCalledOnce();
    expect(reservation?.render(previewData())).toBe(false);
  });

  it("handles blocked or closed popups without throwing", () => {
    openPrintWindow.mockReturnValue(null);
    expect(reserveLocalInvoicePrintWindow()).toBeNull();
    const target = popup();
    openPrintWindow.mockReturnValue(target);
    const reservation = reserveLocalInvoicePrintWindow();
    target.closed = true;
    expect(reservation?.render(previewData())).toBe(false);
    reservation?.closeUnused();
    expect(target.close).not.toHaveBeenCalled();
  });

  it("closes an unused inaccessible popup and keeps existing open APIs compatible", async () => {
    const inaccessible = popup();
    inaccessible.document.write.mockImplementation(() => { throw new Error("document unavailable"); });
    openPrintWindow.mockReturnValue(inaccessible);
    expect(reserveLocalInvoicePrintWindow()).toBeNull();
    expect(inaccessible.close).toHaveBeenCalledOnce();

    const single = popup();
    openPrintWindow.mockReturnValue(single);
    await expect(openLocalInvoicePrintWindow(previewData())).resolves.toBe(true);
    const batch = popup();
    openPrintWindow.mockReturnValue(batch);
    await expect(openLocalInvoiceBatchPrintWindow([previewData(), previewData()])).resolves.toBe(true);
    expect(batch.document.write).toHaveBeenLastCalledWith(expect.stringContaining("<title>Invoice (2)</title>"));
    openPrintWindow.mockClear();
    await expect(openLocalInvoiceBatchPrintWindow([])).resolves.toBe(false);
    expect(openPrintWindow).not.toHaveBeenCalled();
  });
});
