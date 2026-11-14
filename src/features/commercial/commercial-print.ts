import type { CatalogItem, CommercialDocument, CommercialParty } from "@/services/commercial";
import { escapeHtml } from "@/services/printer/invoice-print-window";
import type { LaoFont } from "@/stores/app-store";
import { COMMERCIAL_PAPER } from "./commercial-paper";

export interface CommercialPrintOptions {
  autoPrint?: boolean;
  showImages?: boolean;
  showLogo?: boolean;
  showPaymentAccounts?: boolean;
  showPaymentQr?: boolean;
  baseUrl?: string;
  laoFont?: LaoFont;
}

const fontStylesheet = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/fonts/app-document-fonts.css`;

const digits = ["ສູນ", "ໜຶ່ງ", "ສອງ", "ສາມ", "ສີ່", "ຫ້າ", "ຫົກ", "ເຈັດ", "ແປດ", "ເກົ້າ"];

function laoUnderMillion(amount: number): string {
  let remaining = amount;
  let result = "";
  for (const [power, suffix] of [[100_000, "ແສນ"], [10_000, "ໝື່ນ"], [1_000, "ພັນ"], [100, "ຮ້ອຍ"]] as const) {
    const digit = Math.floor(remaining / power);
    if (digit) result += digits[digit] + suffix;
    remaining %= power;
  }
  const tens = Math.floor(remaining / 10);
  if (tens === 1) result += "ສິບ";
  else if (tens === 2) result += "ຊາວ";
  else if (tens > 2) result += digits[tens] + "ສິບ";
  const units = remaining % 10;
  if (units) result += units === 1 && tens > 0 ? "ເອັດ" : digits[units];
  return result;
}

export function commercialAmountWords(amount: number): string {
  if (!Number.isSafeInteger(amount) || amount < 0) return "";
  const words = (value: number): string => value >= 1_000_000
    ? words(Math.floor(value / 1_000_000)) + "ລ້ານ" + laoUnderMillion(value % 1_000_000)
    : laoUnderMillion(value);
  return `${amount === 0 ? digits[0] : words(amount)}ກີບຖ້ວນ`;
}

export function commercialMoney(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

export function commercialImageUrl(value: string | null | undefined): string | null {
  if (!value || value.includes("\\") || /[\u0000-\u001f]/.test(value)) return null;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

function displayDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

function imageHtml(value: string | null | undefined, className: string, alt: string): string {
  const src = commercialImageUrl(value);
  return src ? `<img class="${className}" src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" />` : "";
}

// Private QR images are canonical PNG bytes returned by the authenticated API.
// Keep this separate from product URLs so arbitrary data/SVG URLs remain blocked.
export function commercialPaymentQrUrl(value: string | null | undefined): string | null {
  return value && value.length <= 7_000_000 && /^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/.test(value) ? value : null;
}

function paymentHtml(document: CommercialDocument, options: CommercialPrintOptions): string {
  const details = document.payment_details;
  const method = document.document_type === "receipt" ? document.payment_method : "";
  const paymentLabel = ({ cash: "ເງິນສົດ / Cash", transfer: "ໂອນເງິນ / Bank transfer", other: "ອື່ນໆ / Other" } as Record<string, string>)[method] ?? method;
  // Output controls may hide saved information; revealing it requires editing
  // the document and explicitly saving that choice first.
  const showAccounts = (details ? details.show_accounts === true : Boolean(document.issuer.bank_details)) && options.showPaymentAccounts !== false;
  const showQr = details?.show_qr === true && options.showPaymentQr !== false;
  if (!method && !showAccounts && !showQr) return "";
  const accounts = (details?.accounts ?? []).slice(0, 3);
  const hasStructuredNumbers = showAccounts && accounts.some(account => Boolean(account.account_number?.trim()));
  const cards = accounts.map(account => {
    const qr = showQr ? commercialPaymentQrUrl(account.qr_image) : null;
    const number = showAccounts ? account.account_number?.trim() : undefined;
    if (!showAccounts && !qr) return "";
    return `<div class="payment-account"><p class="payment-currency strong">${escapeHtml(account.currency)}</p>
      ${showAccounts ? `${account.account_name ? `<p>${escapeHtml(account.account_name)}</p>` : ""}${number ? `<p class="account-number">${escapeHtml(number)}</p>` : ""}` : ""}
      ${qr ? `<img class="payment-qr" src="${escapeHtml(qr)}" alt="${escapeHtml(`${account.currency} payment QR`)}" />` : ""}</div>`;
  }).filter(Boolean);
  // Selected accounts are the displayed source; legacy text is a fallback for
  // documents without structured numbers, including older issued snapshots.
  const legacy = showAccounts && !hasStructuredNumbers && document.issuer.bank_details ? `<p class="legacy-bank">${escapeHtml(document.issuer.bank_details)}</p>` : "";
  return method || cards.length || legacy ? `<section class="payment-details"><p class="payment-heading strong">ຂໍ້ມູນຊຳລະ / PAYMENT DETAILS</p>${method ? `<p class="payment-method">ວິທີຊຳລະ: ${escapeHtml(paymentLabel)}</p>` : ""}${legacy}${cards.length ? `<div class="payment-accounts" style="grid-template-columns:repeat(${cards.length},minmax(0,1fr))">${cards.join("")}</div>` : ""}</section>` : "";
}

function partyHtml(party: CommercialParty, label?: string): string {
  return `<div class="party">${label ? `<p class="strong">${escapeHtml(label)}</p>` : ""}
    <p class="strong">${escapeHtml(party.name)}</p>
    ${party.address ? `<p>${escapeHtml(party.address)}</p>` : ""}
    ${party.phone ? `<p>ໂທ: ${escapeHtml(party.phone)}</p>` : ""}
    ${party.tax_id ? `<p>ເລກຜູ້ເສຍອາກອນ: ${escapeHtml(party.tax_id)}</p>` : ""}</div>`;
}

// The isolated document needs fixed paper dimensions and monochrome colours;
// these print-only rules never enter the application's light/dark theme.
const styles = `
  @page { size: A4; margin: ${COMMERCIAL_PAPER.verticalMarginMm}mm ${COMMERCIAL_PAPER.horizontalMarginMm}mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; background: #fff; color: #111; }
  body { font-size: 12px; line-height: 1.5; }
  .paper { width: 100%; max-width: ${COMMERCIAL_PAPER.contentWidthMm}mm; margin: 0 auto; padding: 5mm 0; }
  .heading { display: flex; align-items: center; justify-content: space-between; gap: 6mm; margin-bottom: 4mm; }
  .logo { width: 26mm; height: 26mm; object-fit: contain; }
  h1 { margin: 0; font-size: 20px; line-height: 1.5; font-weight: 700; text-align: center; flex: 1; }
  p { margin: 0 0 0.5mm; white-space: pre-wrap; overflow-wrap: anywhere; }
  .strong { font-weight: 700; }
  .parties { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6mm; margin-bottom: 3mm; }
  .meta { text-align: right; min-width: 45mm; }
  .customer { margin: 3mm 0; }
  .paper { --table-border: #9ca5af; --row-border: #cbd1d8; --table-fill: #e9ecef; }
  table { width: 100%; border-collapse: separate; border-spacing: 0; table-layout: fixed; border: 0.2mm solid var(--table-border); }
  th, td { border: 0; border-right: 0.2mm solid var(--table-border); padding: 2.5mm 2mm; vertical-align: top; overflow-wrap: anywhere; }
  th:last-child, td:last-child { border-right: 0; }
  th { border-right: 0; border-bottom: 0.3mm solid var(--table-border); background: var(--table-fill); text-align: center; vertical-align: middle; padding: 3mm 1mm; font-size: 14px; font-weight: 700; }
  th:first-child { padding-inline: 0.5mm; white-space: nowrap; }
  .table-fill > td { padding: 0; font-size: 0; line-height: 0; }
  .number { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .center { text-align: center; }
  td.center, td.number { vertical-align: middle; }
  .item { display: flex; align-items: flex-start; gap: 3mm; }
  .item > div { flex: 1; min-width: 0; }
  .item-image { width: 21mm; height: 21mm; object-fit: contain; flex: none; }
  .description { margin-top: 1mm; font-size: 11px; color: #4b5563; }
  .totals { width: 100%; border: 0.2mm solid var(--table-border); border-top: 0; break-inside: avoid; }
  .total-row { display: grid; grid-template-columns: minmax(0, 80fr) minmax(0, 20fr); border-bottom: 0.2mm solid var(--row-border); }
  .total-row > span { padding: 1.8mm 2mm; }
  .total-row > span:first-child { border-right: 0.2mm solid var(--table-border); text-align: right; }
  .total-row:last-child { border-bottom: 0; font-weight: 700; background: var(--table-fill); font-size: 16px; }
  .total-amount { display: flex; align-items: baseline; justify-content: space-between; flex-wrap: wrap; gap: 0 1mm; }
  .total-value { margin-left: auto; }
  .currency { font-size: 12px; font-weight: 700; }
  .compact-total .total-value { font-size: 14px; }
  .amount-words { margin-top: 2mm; padding-right: 2.2mm; font-weight: 700; text-align: right; }
  .notes { margin-top: 2mm; }
  .payment-details { margin-top: 3mm; break-inside: avoid; page-break-inside: avoid; }
  .payment-heading { font-size: 10px; letter-spacing: 0.2px; margin-bottom: 2mm; }
  .payment-method { margin-bottom: 2mm; }
  .payment-method:last-child { margin-bottom: 0; }
  .payment-accounts { display: grid; gap: 3mm; }
  .payment-account { min-width: 0; padding: 2.5mm; border: 0.2mm solid var(--table-border); border-radius: 1mm; text-align: center; font-size: 10px; }
  .payment-currency { font-size: 11px; margin-bottom: 1mm; }
  .account-number { font-variant-numeric: tabular-nums; letter-spacing: 0.3px; }
  .payment-qr { display: block; width: 34mm; height: 42mm; max-width: 100%; margin: 2mm auto 0; object-fit: contain; image-rendering: crisp-edges; }
  .legacy-bank { font-size: 11px; margin-bottom: 2mm; }
  .signatures { display: flex; justify-content: space-between; gap: 12mm; margin-top: 5mm; break-inside: avoid; }
  .signature { text-align: center; min-width: 55mm; }
  .signature-line { margin-top: 6mm; border-top: 0.2mm solid var(--table-border); padding-top: 1.5mm; color: #4b5563; }
  #print-error { padding: 4mm; border: 1px solid #111; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; page-break-inside: avoid; }
  @media screen { body { padding: 5mm; } }
  body.commercial-paginated { padding: 0; }
  .commercial-pages { width: ${COMMERCIAL_PAPER.widthMm}mm; margin: 0 auto; }
  .commercial-preview-page { width: ${COMMERCIAL_PAPER.widthMm}mm; min-height: ${COMMERCIAL_PAPER.heightMm}mm; padding: ${COMMERCIAL_PAPER.verticalMarginMm}mm ${COMMERCIAL_PAPER.horizontalMarginMm}mm; background: #fff; }
  .commercial-preview-page + .commercial-preview-page { margin-top: 5mm; }
  .commercial-preview-page > .paper { width: ${COMMERCIAL_PAPER.contentWidthMm}mm; max-width: none; margin: 0; padding: 0; display: flow-root; }
  @media print {
    .paper { padding: 0; }
    #print-error, .commercial-paginated > [data-commercial-source] { display: none !important; }
    .commercial-pages { width: ${COMMERCIAL_PAPER.contentWidthMm}mm; margin: 0; }
    .commercial-preview-page { width: ${COMMERCIAL_PAPER.contentWidthMm}mm; min-height: 0; height: ${COMMERCIAL_PAPER.contentHeightMm}mm; margin: 0 !important; padding: 0; break-after: page; page-break-after: always; }
    .commercial-preview-page:last-child { break-after: auto; page-break-after: auto; }
  }
`;

const printScript = `window.addEventListener("load", async () => {
  try {
    await (document.fonts?.ready ?? Promise.resolve());
    await Promise.all(Array.from(document.images).map(image => typeof image.decode === "function" ? image.decode() : image.complete && image.naturalWidth > 0 ? Promise.resolve() : Promise.reject()));
    document.body.dataset.printState = "ready";
    window.focus();
    window.print();
  } catch {
    document.body.dataset.printState = "error";
    document.getElementById("print-error").hidden = false;
  }
});`;

function htmlDocument(title: string, body: string, options: CommercialPrintOptions): string {
  const base = options.baseUrl && commercialImageUrl(options.baseUrl);
  return `<!doctype html><html lang="lo" data-lao-font="${escapeHtml(options.laoFont ?? "noto-sans")}"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
    ${base ? `<base href="${escapeHtml(base)}" />` : ""}<title>${escapeHtml(title)}</title><link rel="stylesheet" href="${escapeHtml(fontStylesheet)}" />
    <style>${styles}</style></head><body><p id="print-error" hidden>ບໍ່ສາມາດໂຫຼດຮູບໄດ້. ກະລຸນາລອງໃໝ່ກ່ອນພິມ.</p><main class="paper" data-commercial-source>${body}</main>
    ${options.autoPrint ? `<script>${printScript}</script>` : ""}</body></html>`;
}

export function renderCommercialDocument(document: CommercialDocument, options: CommercialPrintOptions = {}): string {
  const receipt = document.document_type === "receipt";
  const title = receipt ? "ໃບຮັບເງິນ / RECEIPT" : "ໃບສະເໜີລາຄາ / QUOTATION";
  const showImages = options.showImages ?? document.show_images;
  const quantityFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 });
  const wideQuantity = document.items.some(item => quantityFormat.format(item.quantity).length > 7);
  const logo = options.showLogo === false ? "" : imageHtml(document.issuer.logo_url, "logo", document.issuer.name);
  const discount = Number(document.discount_value) > 0 || Number(document.discount_amount) > 0
    ? `<div class="total-row discount-row"><span>ສ່ວນຫຼຸດ${document.discount_type === "percent" ? ` (${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(document.discount_value)}%)` : ""}</span><span class="number">−${commercialMoney(document.discount_amount)}</span></div>` : "";
  const rows = document.items.map((item, index) => `<tr><td class="center">${index + 1}</td>
    <td><div class="item">${showImages && item.show_image ? imageHtml(item.image_url, "item-image", item.name) : ""}<div><p>${escapeHtml(item.name)}</p>${item.description ? `<p class="description">${escapeHtml(item.description)}</p>` : ""}</div></div></td>
    <td class="center">${escapeHtml(item.unit ?? "")}</td><td class="number center">${quantityFormat.format(item.quantity)}</td>
    <td class="number">${commercialMoney(item.unit_price)}</td><td class="number">${commercialMoney(item.line_total)}</td></tr>`).join("");
  const body = `<header class="heading">${logo}<h1>${title}</h1></header>
    <div class="parties">${partyHtml(document.issuer)}<div class="meta"><p>ເລກທີ: <strong>${escapeHtml(document.number)}</strong></p><p>ວັນທີ: ${escapeHtml(displayDate(document.issued_on))}</p>
    ${document.valid_until && !receipt ? `<p>ມີຜົນເຖິງ: ${escapeHtml(displayDate(document.valid_until))}</p>` : ""}
    ${receipt && document.source_quotation_uuid ? `<p>ອ້າງອີງ: ${escapeHtml(document.source_quotation_number || "ໃບສະເໜີລາຄາ")}${document.source_quotation_version ? ` · ສະບັບ ${document.source_quotation_version}` : ""}</p>` : ""}</div></div>
    <section class="customer">${partyHtml(document.customer, "ລູກຄ້າ / CUSTOMER")}</section>
    <table><colgroup><col style="width:7%" /><col style="width:${wideQuantity ? 31 : 35}%" /><col style="width:11%" /><col style="width:${wideQuantity ? 13 : 9}%" /><col style="width:18%" /><col style="width:20%" /></colgroup>
    <thead><tr><th>ລຳດັບ</th><th>ລາຍການ</th><th>ຫົວໜ່ວຍ</th><th>ຈຳນວນ</th><th>ລາຄາ</th><th>ລາຄາລວມ</th></tr></thead><tbody>${rows}</tbody></table>
    <section class="totals"><div class="total-row"><span>ລວມທັງໝົດ</span><span class="number">${commercialMoney(document.subtotal)}</span></div>
    ${discount}
    <div class="total-row"><span>ອາກອນ (${document.tax_rate}%)</span><span class="number">${commercialMoney(document.tax_amount)}</span></div>
    <div class="total-row${commercialMoney(document.total).length > 12 ? " compact-total" : ""}"><span>${receipt ? "ຮັບເງິນທັງໝົດ" : "ລວມຍອດທັງໝົດ"}</span><span class="number total-amount"><span class="currency">LAK</span> <span class="total-value">${commercialMoney(document.total)}</span></span></div></section>
    <p class="amount-words">( ${escapeHtml(commercialAmountWords(document.total))} )</p>
    ${document.notes ? `<section class="notes"><p class="strong">ໝາຍເຫດ</p><p>${escapeHtml(document.notes)}</p></section>` : ""}
    ${paymentHtml(document, options)}
    <section class="signatures"><div class="signature"><p>${receipt ? "ຜູ້ຈ່າຍເງິນ" : "ຜູ້ຮັບໃບສະເໜີລາຄາ"}</p><p class="signature-line">ລາຍເຊັນ / ວັນທີ</p></div>
    <div class="signature"><p>${receipt ? "ຜູ້ຮັບເງິນ" : "ຜູ້ສະເໜີລາຄາ"}</p><p class="signature-line">ລາຍເຊັນ / ວັນທີ</p></div></section>`;
  return htmlDocument(`${title} ${document.number}`, body, options);
}

export function renderCommercialCatalog(items: CatalogItem[], branchName: string, issuer: CommercialParty | undefined, options: CommercialPrintOptions = {}): string {
  const rows = items.filter(item => item.active).map((item, index) => `<tr><td class="center">${index + 1}</td><td><div class="item">${options.showImages !== false && item.image_visible ? imageHtml(item.image_url, "item-image", item.name) : ""}<div><p>${escapeHtml(item.name)}</p>${item.description ? `<p class="description">${escapeHtml(item.description)}</p>` : ""}</div></div></td><td class="center">${escapeHtml(item.unit)}</td><td class="number">${commercialMoney(item.unit_price)}</td></tr>`).join("");
  const body = `<header class="heading">${options.showLogo !== false && issuer ? imageHtml(issuer.logo_url, "logo", issuer.name) : ""}<h1>ລາຍການສິນຄ້າ / PRICE LIST</h1></header>
    ${issuer ? partyHtml(issuer) : ""}<p class="customer strong">ລາຍການລາຄາ: ${escapeHtml(branchName)} · LAK</p>
    <table><colgroup><col style="width:7%" /><col style="width:59%" /><col style="width:12%" /><col style="width:22%" /></colgroup><thead><tr><th>ລຳດັບ</th><th>ລາຍການ</th><th>ຫົວໜ່ວຍ</th><th>ລາຄາ (LAK)</th></tr></thead><tbody>${rows}</tbody></table>`;
  return htmlDocument(`PRICE LIST ${branchName}`, body, options);
}
