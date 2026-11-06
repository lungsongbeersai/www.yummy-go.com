import {
  parseCanonicalInvoicePrintDocument,
  type InvoicePrintData,
  type InvoicePrintExchangeRate,
  type InvoicePrintItem,
  type InvoicePrintPayment,
  type InvoicePrintTopping,
} from "@/services/printer/invoice-print-window";

type DocumentType = "invoice" | "receipt";
type Snapshot = Record<string, unknown>;
type Translate = (key: string, options?: Record<string, unknown>) => string;

function record(value: unknown): Snapshot | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Snapshot
    : null;
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function amount(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

// Only follow known API envelopes. A document's own payload is never a new
// source of authority, nor is a cached cart accepted as a print snapshot.
function responseLayers(response: unknown) {
  const layers: Snapshot[] = [];
  const visit = (value: unknown, depth: number) => {
    const layer = record(value);
    if (!layer || depth > 4 || layers.includes(layer)) return;
    layers.push(layer);
    visit(layer.payload, depth + 1);
    visit(layer.data, depth + 1);
    visit(layer.fallback_print, depth + 1);
    const transport = record(layer.response);
    if (transport) visit(transport.data, depth + 1);
  };
  visit(response, 0);
  return layers;
}

function hasQueuedJob(layers: Snapshot[]) {
  return layers.some((layer) => {
    const job = record(layer.print_job);
    const pending = record(layer.pending_query);
    return Boolean(
      text(layer.print_job_uuid) ||
      text(job?.print_job_uuid) ||
      text(pending?.print_job_uuid) ||
      (Array.isArray(layer.print_jobs) && layer.print_jobs.length),
    );
  });
}

function safeDocumentSnapshot(response: unknown, documentType: DocumentType) {
  const layers = responseLayers(response);
  // Authorization, registration, and bill preparation failures must surface
  // as errors even if a malformed response also contains a fallback object.
  if (layers.some((layer) => {
    const code = text(layer.error_code);
    const status = layer.statusCode ?? layer.status;
    return (code && ![
      "DOCUMENT_PRINTER_UNAVAILABLE", "DOCUMENT_PRINT_ROLE_NOT_CONFIGURED",
    ].includes(code)) || status === 401 || status === 403;
  })) return null;

  const receiptSkipped = documentType === "receipt" && layers.some((layer) => {
    const skipped = record(layer.print_skipped);
    return skipped?.role_code === "receipt" &&
      skipped.reason === "DOCUMENT_PRINT_ROLE_NOT_CONFIGURED";
  });
  // Payment may have a kitchen job and an explicitly skipped receipt role.
  // Every other queued job makes an automatic second print unsafe.
  if (hasQueuedJob(layers) && !receiptSkipped) return null;

  for (const layer of layers) {
    const fallback = record(layer.fallback_print);
    if (fallback?.mode !== "browser_print" ||
        fallback.role_code !== documentType ||
        fallback.safe_not_queued !== true) continue;
    const payload = record(fallback.payload);
    if (payload?.document_type !== documentType || fallback.print_document_error) continue;
    const printDocument = parseCanonicalInvoicePrintDocument(fallback.print_document, documentType);
    if (!printDocument || (payload.lang !== undefined && payload.lang !== printDocument.lang)) continue;
    return { payload, printDocument };
  }
  return null;
}

function snapshotToppings(value: unknown, itemQty: number): InvoicePrintTopping[] | null {
  if (!Array.isArray(value)) return null;
  const output: InvoicePrintTopping[] = [];
  for (const valueItem of value) {
    const topping = record(valueItem);
    if (!topping) return null;
    const name = text(topping.topping_name) || text(topping.name);
    const qty = amount(topping.topping_qty_per_unit ?? topping.topping_qty ?? topping.qty);
    const unitTotal = amount(topping.topping_unit_total ?? topping.topping_total);
    const price = amount(topping.topping_price ?? topping.price);
    const lineTotal = amount(topping.topping_line_total);
    const total = lineTotal ?? (unitTotal !== null ? unitTotal * itemQty
      : qty !== null && price !== null ? qty * price * itemQty : null);
    if (!name || qty === null || (total === null && topping.is_set_component !== true) ||
        (total !== null && !Number.isFinite(total))) return null;
    output.push({ name, qty, total });
  }
  return output;
}

function snapshotItems(value: unknown, translate: Translate): InvoicePrintItem[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const items: InvoicePrintItem[] = [];
  for (const source of value) {
    const row = record(source);
    if (!row) return null;
    const name = text(row.name);
    const qty = amount(row.qty);
    const total = amount(row.total);
    const gross = amount(row.gross_total);
    const price = amount(row.base_price ?? row.price);
    const discount = amount(row.item_discount_amount);
    if (!name || qty === null || qty <= 0 || total === null || gross === null ||
        price === null || discount === null) return null;
    const toppings = snapshotToppings(row.toppings, qty);
    if (!toppings || !Array.isArray(row.tastes)) return null;
    const tastes = row.tastes.map((taste) => {
      const item = record(taste);
      return { name: text(item?.taste_name) || text(item?.name) };
    });
    if (tastes.some((taste) => !taste.name)) return null;
    const toppingUnitTotal = amount(row.topping_unit_total);
    const toppingTotal = toppingUnitTotal === null ? null : toppingUnitTotal * qty;
    if (toppingTotal !== null && !Number.isFinite(toppingTotal)) return null;
    items.push({
      displayTotal: total,
      hasItemDiscount: discount > 0,
      mergeKey: JSON.stringify([
        text(row.prod_detail_uuid_fk), text(row.prod_uuid), text(row.note),
        text(row.item_discount_type), row.item_discount_value,
        row.is_set_item === true, text(row.set_instance_uuid),
      ]),
      name,
      originalLineTotal: gross,
      qty,
      toppingLabel: translate("pos.toppingTotal"),
      toppingTotal,
      toppings,
      tastes,
      unitPrice: price,
    });
  }
  return items;
}

function snapshotRates(payload: Snapshot): InvoicePrintExchangeRate[] | null {
  if (!Array.isArray(payload.exchange_rates)) return null;
  const rates: InvoicePrintExchangeRate[] = [];
  for (const value of payload.exchange_rates) {
    const entry = record(value);
    const code = text(entry?.currency_code).toUpperCase();
    const rate = amount(entry?.exchange_rate);
    if (!code || rate === null || rate <= 0) return null;
    if (code !== "LAK") rates.push({ code, rate });
  }
  if (rates.length === 0) {
    for (const [code, key] of [["THB", "exchange_rate_thb"], ["USD", "exchange_rate_usd"]]) {
      const rate = amount(payload[key]);
      if (rate !== null && rate > 0) rates.push({ code, rate });
    }
  }
  return rates;
}

function snapshotPayment(payload: Snapshot): InvoicePrintPayment | null {
  const paidCash = amount(payload.paid_cash);
  const paidTransfer = amount(payload.paid_transfer);
  const paidTotal = amount(payload.paid_total);
  const change = amount(payload.change);
  const exchangeRate = amount(payload.exchange_rate);
  const foreignPaid = amount(payload.foreign_paid);
  const paidLak = amount(payload.paid_lak);
  const changeLak = amount(payload.change_lak);
  if (paidCash === null || paidTransfer === null || paidTotal === null ||
      change === null || exchangeRate === null || foreignPaid === null ||
      paidLak === null || changeLak === null) return null;
  const isCredit = payload.is_credit === true;
  const debtAmount = amount(payload.debt_amount);
  const creditPaidTotal = amount(payload.credit_paid_total);
  const creditBalance = amount(payload.credit_balance);
  if (isCredit && (debtAmount === null || creditPaidTotal === null || creditBalance === null)) return null;
  return {
    paidCash, paidTransfer, paidTotal, change, exchangeRate, foreignPaid, paidLak, changeLak,
    currency: text(payload.payment_currency).toUpperCase(),
    label: text(payload.paymentLabel) || text(payload.payLabel),
    ...(isCredit ? {
      isCredit,
      debtAmount: debtAmount!,
      creditPaidTotal: creditPaidTotal!,
      creditBalance: creditBalance!,
      dueDate: text(payload.due_date),
    } : {}),
  };
}

/** An unqueued server snapshot may print only its canonical Auto Print raster. */
export function buildBrowserDocumentPrintData(
  response: unknown,
  documentType: DocumentType,
  translate: Translate,
): InvoicePrintData | null {
  const snapshot = safeDocumentSnapshot(response, documentType);
  if (!snapshot) return null;
  const { payload, printDocument } = snapshot;
  const subtotal = amount(payload.subTotal);
  const total = amount(payload.total);
  const discount = amount(payload.discount_amount);
  const service = amount(payload.service_charge_amount);
  const vat = amount(payload.vat_amount);
  const items = snapshotItems(payload.items, translate);
  const exchangeRates = snapshotRates(payload);
  const payment = documentType === "receipt" ? snapshotPayment(payload) : undefined;
  const invoice = text(payload.invoiceNo) || text(payload.billNo);
  if (subtotal === null || total === null || discount === null || service === null ||
      vat === null || !items || !exchangeRates || !invoice || invoice === "-" ||
      (documentType === "receipt" && !payment)) return null;

  const receipt = documentType === "receipt";
  const title = translate(receipt ? "pos.receiptPrintTitle" : "pos.invoicePrintTitle");
  const servicePercent = amount(payload.service_charge_percent);
  const vatPercent = amount(payload.vat_percent);
  const discountPercent = amount(payload.discount_percent);
  const snapshotDate = receipt ? text(payload.paid_at) || text(payload.printed_at) : text(payload.printed_at);
  const printedAt = snapshotDate ? new Date(snapshotDate) : new Date();
  return {
    canonicalPrintDocument: printDocument,
    logoUrl: payload.show_logo === true ? text(payload.branch_logo) || null : null,
    branchAddress: text(payload.branchAddress),
    branchName: text(payload.branchName),
    branchTel: text(payload.branchTel),
    cashier: text(payload.cashier),
    customer: text(payload.customer) || null,
    discount,
    exchangeRates,
    invoice,
    items,
    labels: {
      address: translate("fields.branch_address"),
      amount: translate("pos.invoicePrintAmount"),
      item: translate("pos.invoicePrintItem"),
      amountDueByCurrency: translate("pos.invoicePrintAmountDueByCurrency"),
      cashier: translate(receipt ? "pos.invoicePrintCashier" : "pos.invoicePrintStaff"),
      customer: translate("pos.customer"),
      date: translate("pos.invoicePrintDate"),
      discount: `${translate("pos.invoicePrintDiscount")}${discountPercent ? ` ${discountPercent}%` : ""}`,
      currentExchangeRate: translate("pos.invoicePrintCurrentExchangeRate"),
      invoice: translate(receipt ? "pos.receiptPrintNumber" : "pos.invoicePrintNumber"),
      price: translate("pos.price"),
      service: servicePercent ? translate("pos.serviceWithPercent", { percent: servicePercent }) : translate("pos.serviceTotal"),
      subtotal: translate("pos.invoicePrintTotalAmount"),
      table: translate("pos.invoicePrintTable"),
      thankYou: text(payload.footer) || translate("pos.invoicePrintThankYou"),
      title,
      topping: translate("pos.toppingTotal"),
      total: translate("pos.invoicePrintAmountToPay"),
      vat: vatPercent ? translate("pos.invoicePrintVatWithPercent", { percent: vatPercent }) : translate("pos.vat"),
      paidCash: translate("pos.cashAmount"),
      paidTransfer: translate("pos.transferAmount"),
      paidTotal: translate("pos.amountReceived"),
      change: translate("pos.changeAmount"),
      payment: translate("pos.paymentTitle"),
      foreignPaid: translate("orderAudit.fields.foreign_paid"),
      debtAmount: translate("salesList.debt"),
      creditPaidTotal: translate("orderAudit.fields.credit_paid_total"),
      creditBalance: translate("orderAudit.fields.credit_balance"),
      dueDate: translate("pos.dueDate"),
    },
    contentWidthMm: printDocument.printable_width_px / 8,
    paperHeightMm: printDocument.images.reduce((height, image) => height + image.height, 0) / 8,
    paperWidthMm: printDocument.paper_width_mm,
    ...(payment ? { payment } : {}),
    printedAt: Number.isNaN(printedAt.getTime()) ? new Date() : printedAt,
    // Reprints provide this exact local sale time in DD/MM/YYYY HH:mm format.
    // Preserve it instead of feeding a locale-dependent string into Date.
    ...(receipt && text(payload.sale_date_time) ? { saleDateTime: text(payload.sale_date_time) } : {}),
    qrUrl: text(payload.branchQr) || null,
    service,
    storeName: text(payload.shopName),
    subtotal,
    tableName: text(payload.tableName),
    title,
    total,
    vat,
  };
}
