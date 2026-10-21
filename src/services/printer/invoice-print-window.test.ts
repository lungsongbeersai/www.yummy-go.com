import { describe, expect, it } from "vitest";
import { runInNewContext } from "node:vm";
import lao from "../../../public/locales/la/common.json";
import {
  INVOICE_TOTAL_FIT_SCRIPT,
  mergeInvoicePrintItems,
  renderInvoiceItems,
  renderInvoiceExchangeRates,
  renderInvoiceTotals,
  type InvoicePrintData,
  type InvoicePrintItem,
} from "./invoice-print-window";

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

it("prints the Lao item and amount headings before the first food item", () => {
  const html = renderInvoiceItems({
    items: [item({ name: "First food item" })],
    labels: { item: lao.pos.invoicePrintItem, amount: lao.pos.invoicePrintAmount },
  } as InvoicePrintData);
  expect(html).toContain("ລາຍການ");
  expect(html).toContain("ຈຳນວນເງິນ");
  expect(html.indexOf("ລາຍການ")).toBeLessThan(html.indexOf("First food item"));
  expect(html.indexOf("ຈຳນວນເງິນ")).toBeLessThan(html.indexOf("First food item"));
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
    expect(html).toContain('<p class="total-row grand-total"><span>ມູນຄ່າຕ້ອງຊຳລະ</span><span>123.456.789 ₭</span></p>');
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
      { fontSize: 16, width: 140 }, { fontSize: 24, width: 145 },
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
});
