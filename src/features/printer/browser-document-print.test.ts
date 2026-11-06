import { describe, expect, it } from "vitest";
import { deflateSync } from "node:zlib";
import { buildBrowserDocumentPrintData } from "./browser-document-print";
import { renderInvoiceSystemPrintHtml } from "@/services/printer/invoice-print-window";

const translate = (key: string, values?: Record<string, unknown>) =>
  values?.percent ? `${key} (${values.percent}%)` : key;

function png(width: number, height = 2) {
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    let crc = 0xffffffff;
    for (const byte of body) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    const size = Buffer.alloc(4);
    size.writeUInt32BE(data.length);
    const checksum = Buffer.alloc(4);
    checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
    return Buffer.concat([size, body, checksum]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const rgba = Buffer.alloc((width * 4 + 1) * height, 255);
  for (let row = 0; row < height; row++) rgba[row * (width * 4 + 1)] = 0;
  return `data:image/png;base64,${Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header), chunk("IDAT", deflateSync(rgba)), chunk("IEND", Buffer.alloc(0)),
  ]).toString("base64")}`;
}

function canonical(type: "invoice" | "receipt" = "invoice", paper: 58 | 80 = 80) {
  const width = paper === 58 ? 384 : 576;
  return {
    version: 1, document_type: type, lang: "eng", paper_width_mm: paper,
    printable_width_px: width, images: [{ src: png(width), width, height: 2 }],
  };
}

function payload(type: "invoice" | "receipt" = "invoice") {
  return {
    document_type: type,
    lang: "eng",
    shopName: 'Shop <&> "one"',
    branchName: "Branch",
    branchAddress: "Address",
    branchTel: "02012345678",
    branchQr: "https://example.com/qr?a=1&b=2",
    branch_logo: "https://example.com/logo.png",
    show_logo: true,
    tableName: "Table 7",
    billNo: "SPLIT-2",
    invoiceNo: "SPLIT-2",
    cashier: "Staff",
    customer: "Customer",
    paymentLabel: "Cash <&>",
    payLabel: "Paid",
    footer: "Thank <you>",
    subTotal: 70_000,
    discount_amount: 7_000,
    discount_percent: 10,
    service_charge_amount: 3_000,
    service_charge_percent: 5,
    vat_amount: 6_000,
    vat_percent: 10,
    total: 72_000,
    exchange_rates: [{ currency_code: "THB", exchange_rate: 600 }],
    exchange_rate_thb: 600,
    exchange_rate_usd: 0,
    exchange_rate_source: "payment",
    payment_currency: "THB",
    exchange_rate: 600,
    paid_cash: 90_000,
    paid_transfer: 0,
    paid_total: 90_000,
    change: 18_000,
    foreign_paid: 150,
    paid_lak: 90_000,
    change_lak: 18_000,
    items: [{
      name: "Noodles <&>", prod_uuid: "prod-1", prod_detail_uuid_fk: "detail-1",
      qty: 2, price: 40_000, base_price: 30_000, topping_unit_total: 10_000,
      total: 70_000, gross_total: 80_000, item_discount_amount: 10_000,
      item_discount_type: "AMT", item_discount_value: 10_000, note: "",
      toppings: [{ topping_name: "Egg <script>", topping_qty: 1, topping_price: 10_000, topping_total: 10_000 }],
      tastes: [{ taste_name: "Spicy & hot" }],
    }],
  };
}

function fallback(type: "invoice" | "receipt" = "invoice") {
  return { fallback_print: {
    mode: "browser_print", role_code: type, safe_not_queued: true,
    reason: "DOCUMENT_PRINTER_UNAVAILABLE", payload: payload(type), print_document: canonical(type),
  } };
}

describe("authoritative browser document fallback", () => {
  it("requires the explicit safe marker, correct role and document type", () => {
    const response = fallback();
    expect(buildBrowserDocumentPrintData(response, "invoice", translate)).not.toBeNull();
    for (const modified of [
      { ...response, fallback_print: { ...response.fallback_print, safe_not_queued: undefined } },
      { ...response, fallback_print: { ...response.fallback_print, safe_not_queued: "true" } },
      { ...response, fallback_print: { ...response.fallback_print, mode: "system_print" } },
      { ...response, fallback_print: { ...response.fallback_print, role_code: "receipt" } },
      { ...response, fallback_print: { ...response.fallback_print, payload: payload("receipt") } },
      { print_payload: payload(), receipt_payload: payload("receipt") },
    ]) expect(buildBrowserDocumentPrintData(modified, "invoice", translate)).toBeNull();
  });

  it("reads safe snapshots nested in a ServiceError payload without relying on its message", () => {
    const error = Object.assign(new Error("Printer unavailable"), {
      statusCode: 503, payload: { code: 503, data: { ...fallback(), error_code: "DOCUMENT_PRINTER_UNAVAILABLE" } },
    });
    expect(buildBrowserDocumentPrintData(error, "invoice", translate)?.invoice).toBe("SPLIT-2");
  });

  it.each([
    "PRINTER_AGENT_AUTHORIZATION_FAILED", "PRINTER_AGENT_REGISTRATION_FAILED",
    "INVOICE_PRINT_PREPARATION_FAILED", "INTERNAL_ERROR",
  ])("rejects %s even when another envelope contains a purported safe marker", (errorCode) => {
    expect(buildBrowserDocumentPrintData({ error_code: errorCode, payload: fallback() }, "invoice", translate)).toBeNull();
    const source = fallback();
    expect(buildBrowserDocumentPrintData({ fallback_print: { ...source.fallback_print, error_code: errorCode } }, "invoice", translate)).toBeNull();
  });

  it("refuses generic errors and responses without a complete server document", () => {
    expect(buildBrowserDocumentPrintData(new Error("network disconnected"), "invoice", translate)).toBeNull();
    expect(buildBrowserDocumentPrintData({ payload: payload() }, "invoice", translate)).toBeNull();
    const source = payload();
    for (const changed of [
      { ...source, total: undefined }, { ...source, total: NaN },
      { ...source, subTotal: "70000" }, { ...source, items: [] },
      { ...source, items: [{ ...source.items[0], total: undefined }] },
      { ...source, items: [{ ...source.items[0], qty: -1 }] },
      { ...source, items: [{ ...source.items[0], toppings: [{ topping_name: "Egg" }] }] },
      { ...source, invoiceNo: "", billNo: "-" },
    ]) {
      const response = fallback();
      expect(buildBrowserDocumentPrintData({ fallback_print: { ...response.fallback_print, payload: changed } }, "invoice", translate)).toBeNull();
    }
  });

  it("never automatically duplicates an existing queued job", () => {
    for (const queued of [
      { print_job_uuid: "job-1" }, { print_job: { print_job_uuid: "job-1" } },
      { pending_query: { print_job_uuid: "job-1" } }, { print_jobs: [{ print_job_uuid: "job-1" }] },
    ]) {
      expect(buildBrowserDocumentPrintData({ ...fallback(), ...queued }, "invoice", translate)).toBeNull();
      expect(buildBrowserDocumentPrintData({ ...fallback("receipt"), ...queued }, "receipt", translate)).toBeNull();
    }
  });

  it("allows a kitchen job only with explicit proof that the receipt role was skipped", () => {
    const response = {
      ...fallback("receipt"), print_job: { print_job_uuid: "kitchen-job" },
      print_skipped: { reason: "DOCUMENT_PRINT_ROLE_NOT_CONFIGURED", role_code: "receipt" },
    };
    expect(buildBrowserDocumentPrintData(response, "receipt", translate)?.payment?.paidTotal).toBe(90_000);
    expect(buildBrowserDocumentPrintData({ ...response, print_skipped: { reason: "UNKNOWN", role_code: "receipt" } }, "receipt", translate)).toBeNull();
    expect(buildBrowserDocumentPrintData({ ...response, fallback_print: { ...response.fallback_print, safe_not_queued: false } }, "receipt", translate)).toBeNull();
  });

  it("preserves split identity, server amounts, discounts, toppings and exchange snapshots", () => {
    const response = fallback();
    const original = structuredClone(response);
    const data = buildBrowserDocumentPrintData(response, "invoice", translate);
    expect(data).toMatchObject({
      invoice: "SPLIT-2", subtotal: 70_000, total: 72_000, discount: 7_000, service: 3_000, vat: 6_000,
      logoUrl: "https://example.com/logo.png", exchangeRates: [{ code: "THB", rate: 600 }],
      items: [{
        displayTotal: 70_000, originalLineTotal: 80_000, hasItemDiscount: true,
        unitPrice: 30_000, qty: 2, toppingTotal: 20_000,
        toppings: [{ name: "Egg <script>", qty: 1, total: 20_000 }], tastes: [{ name: "Spicy & hot" }],
      }],
      labels: { discount: "pos.invoicePrintDiscount 10%", service: "pos.serviceWithPercent (5%)" },
    });
    expect(data?.payment).toBeUndefined();
    expect(response).toEqual(original);
  });

  it("renders only the canonical receipt images while retaining saved metadata for the workflow", () => {
    const data = buildBrowserDocumentPrintData(fallback("receipt"), "receipt", translate);
    expect(data?.payment).toEqual({
      paidCash: 90_000, paidTransfer: 0, paidTotal: 90_000, change: 18_000,
      label: "Cash <&>", currency: "THB", exchangeRate: 600,
      foreignPaid: 150, paidLak: 90_000, changeLak: 18_000,
    });
    expect(data?.labels.invoice).toBe("pos.receiptPrintNumber");
    expect(data?.title).toBe("pos.receiptPrintTitle");
    const html = renderInvoiceSystemPrintHtml(data!);
    expect(html).toContain(`src="${data!.canonicalPrintDocument!.images[0].src}"`);
    expect(html).not.toContain("class=\"payment-summary\"");
    expect(html).not.toContain("Shop &lt;&amp;&gt; &quot;one&quot;");
    expect(html).not.toContain("90.000 ₭");
    expect(html).not.toContain("150 THB");
    expect(html).not.toContain("Thank &lt;you&gt;");
    expect(html).not.toContain("<script>Egg");
  });

  it("rejects a paid receipt when its saved payment summary is incomplete", () => {
    const response = fallback("receipt");
    expect(buildBrowserDocumentPrintData({ fallback_print: {
      ...response.fallback_print, payload: { ...response.fallback_print.payload, paid_total: undefined },
    } }, "receipt", translate)).toBeNull();
  });

  it("preserves the server's credit debt and repayments without claiming it was paid", () => {
    const source = fallback("receipt");
    const data = buildBrowserDocumentPrintData({ fallback_print: {
      ...source.fallback_print,
      payload: {
        ...source.fallback_print.payload,
        is_credit: true, debt_amount: 72_000, credit_paid_total: 20_000,
        credit_balance: 52_000, due_date: "2026-12-01",
        paid_cash: 0, paid_total: 72_000, foreign_paid: 0, change: 0,
        paid_lak: 0, change_lak: 0, paymentLabel: "Credit",
      },
    } }, "receipt", translate);
    expect(data?.payment).toMatchObject({
      paidTotal: 72_000, isCredit: true, debtAmount: 72_000, creditPaidTotal: 20_000,
      creditBalance: 52_000, dueDate: "2026-12-01",
    });
    const html = renderInvoiceSystemPrintHtml(data!);
    expect(html).toContain("canonical-print-strip");
    expect(html).not.toContain("pos.amountReceived");
    expect(html).not.toContain("52.000 ₭");
    expect(html).not.toContain("2026-12-01");
  });

  it("preserves the original local sale date on a receipt reprint", () => {
    const source = fallback("receipt");
    const data = buildBrowserDocumentPrintData({ fallback_print: {
      ...source.fallback_print,
      payload: { ...source.fallback_print.payload,
        is_reprint: true, sale_date_time: "06/11/2026 08:35", paid_at: "2026-11-06T01:35:00.000Z",
      },
    } }, "receipt", translate);
    expect(data?.saleDateTime).toBe("06/11/2026 08:35");
    expect(renderInvoiceSystemPrintHtml(data!)).not.toContain("06/11/2026 08:35");
    expect(data?.printedAt.toISOString()).toBe("2026-11-06T01:35:00.000Z");
  });

  it.each([58, 80] as const)("preserves exact %imm canonical strips without recalculating their content", (paper) => {
    const source = fallback("receipt");
    source.fallback_print.print_document = canonical("receipt", paper);
    const original = structuredClone(source);
    const data = buildBrowserDocumentPrintData(source, "receipt", translate)!;
    expect(data.canonicalPrintDocument).toEqual(source.fallback_print.print_document);
    expect(data.paperWidthMm).toBe(paper);
    expect(data.contentWidthMm).toBe(paper === 58 ? 48 : 72);
    const html = renderInvoiceSystemPrintHtml({ ...data, total: 999_999_999, items: [], payment: undefined });
    expect(html).toContain(`src="${source.fallback_print.print_document.images[0].src}"`);
    expect(html).toContain(`@page { size: ${paper}mm 0.25mm; margin: 0; }`);
    expect(html).not.toContain("999");
    expect(html).not.toContain("window-open-fonts");
    expect(source).toEqual(original);
  });

  it("requires canonical output and rejects rendering errors instead of using the old HTML layout", () => {
    const source = fallback();
    for (const changed of [
      { ...source.fallback_print, print_document: undefined },
      { ...source.fallback_print, print_document: null },
      { ...source.fallback_print, print_document: canonical("receipt") },
      { ...source.fallback_print, print_document: { ...canonical(), lang: "la" } },
      { ...source.fallback_print, print_document_error: { code: "PRINT_DOCUMENT_RENDER_FAILED" } },
      { ...source.fallback_print, print_document: { ...canonical(), images: [{ src: "https://example.com/a.png", width: 576, height: 2 }] } },
    ]) expect(buildBrowserDocumentPrintData({ fallback_print: changed }, "invoice", translate)).toBeNull();
  });
});
