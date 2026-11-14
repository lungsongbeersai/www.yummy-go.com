import type { CatalogItem, CommercialDocument, CommercialParty } from "@/services/commercial";
import { escapeHtml } from "@/services/printer/invoice-print-window";
import type { LaoFont } from "@/stores/app-store";

export interface CommercialPrintOptions {
  autoPrint?: boolean;
  showImages?: boolean;
  showLogo?: boolean;
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
  @page { size: A4; margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; color: #111; }
  body { font-size: 12px; line-height: 1.5; }
  .paper { width: 100%; max-width: 186mm; margin: 0 auto; padding: 5mm 0; }
  .heading { display: flex; align-items: center; justify-content: space-between; gap: 6mm; margin-bottom: 4mm; }
  .logo { width: 29mm; height: 29mm; object-fit: contain; }
  h1 { margin: 0; font-size: 20px; line-height: 1.5; font-weight: 700; text-align: center; flex: 1; }
  p { margin: 0 0 0.5mm; white-space: pre-wrap; overflow-wrap: anywhere; }
  .strong { font-weight: 700; }
  .parties { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6mm; margin-bottom: 3mm; }
  .meta { text-align: right; min-width: 45mm; }
  .customer { margin: 3mm 0; }
  .paper { --table-border: #b8bec6; --row-border: #d9dde2; --table-fill: #f4f5f7; }
  table { width: 100%; border-collapse: separate; border-spacing: 0; table-layout: fixed; border: 0.2mm solid var(--table-border); }
  th, td { border: 0; border-right: 0.2mm solid var(--table-border); padding: 2.5mm 2mm; vertical-align: top; overflow-wrap: anywhere; }
  th:last-child, td:last-child { border-right: 0; }
  th { border-bottom: 0.2mm solid var(--table-border); background: var(--table-fill); text-align: center; vertical-align: middle; padding: 2.5mm 2mm; font-weight: 600; }
  th:first-child { padding-inline: 1mm; white-space: nowrap; }
  tbody tr:not(:last-child) > td { border-bottom: 0.2mm solid var(--row-border); }
  .number { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .center { text-align: center; }
  td.center, td.number { vertical-align: middle; }
  .item { display: flex; align-items: flex-start; gap: 3mm; }
  .item > div { flex: 1; min-width: 0; }
  .item-image { width: 21mm; height: 21mm; object-fit: contain; flex: none; }
  .description { margin-top: 1mm; font-size: 11px; color: #4b5563; }
  .totals { width: 100%; border: 0.2mm solid var(--table-border); border-top: 0; break-inside: avoid; }
  .total-row { display: grid; grid-template-columns: minmax(0, 81fr) minmax(0, 19fr); border-bottom: 0.2mm solid var(--row-border); }
  .total-row > span { padding: 1.8mm 2mm; }
  .total-row > span:first-child { border-right: 0.2mm solid var(--table-border); text-align: right; }
  .total-row:last-child { border-bottom: 0; font-weight: 700; background: var(--table-fill); font-size: 12px; }
  .total-amount { display: flex; align-items: baseline; justify-content: space-between; gap: 1mm; }
  .currency { font-size: 10px; font-weight: 400; }
  .amount-words { margin-top: 7mm; font-weight: 700; }
  .notes { margin-top: 5mm; }
  .signatures { display: flex; justify-content: space-between; gap: 12mm; margin-top: 10mm; break-inside: avoid; }
  .signature { text-align: center; min-width: 55mm; }
  .signature-line { margin-top: 8mm; border-top: 0.2mm solid var(--table-border); padding-top: 1.5mm; color: #4b5563; }
  .footer { margin-top: 6mm; font-size: 10px; color: #4b5563; text-align: center; }
  #print-error { padding: 4mm; border: 1px solid #111; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; page-break-inside: avoid; }
  @media screen { body { padding: 5mm; } }
  @media print { .paper { padding: 0; } #print-error { display: none; } }
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
    <style>${styles}</style></head><body><p id="print-error" hidden>ບໍ່ສາມາດໂຫຼດຮູບໄດ້. ກະລຸນາລອງໃໝ່ກ່ອນພິມ.</p><main class="paper">${body}</main>
    ${options.autoPrint ? `<script>${printScript}</script>` : ""}</body></html>`;
}

export function renderCommercialDocument(document: CommercialDocument, options: CommercialPrintOptions = {}): string {
  const receipt = document.document_type === "receipt";
  const title = receipt ? "ໃບຮັບເງິນ / RECEIPT" : "ໃບສະເໜີລາຄາ / QUOTATION";
  const showImages = options.showImages ?? document.show_images;
  const paymentLabel = ({ cash: "ເງິນສົດ / Cash", transfer: "ໂອນເງິນ / Bank transfer", other: "ອື່ນໆ / Other" } as Record<string, string>)[document.payment_method] ?? document.payment_method;
  const logo = options.showLogo === false ? "" : imageHtml(document.issuer.logo_url, "logo", document.issuer.name);
  const rows = document.items.map((item, index) => `<tr><td class="center">${index + 1}</td>
    <td><div class="item">${showImages && item.show_image ? imageHtml(item.image_url, "item-image", item.name) : ""}<div><p>${escapeHtml(item.name)}</p>${item.description ? `<p class="description">${escapeHtml(item.description)}</p>` : ""}</div></div></td>
    <td class="center">${escapeHtml(item.unit ?? "")}</td><td class="number center">${new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 }).format(item.quantity)}</td>
    <td class="number">${commercialMoney(item.unit_price)}</td><td class="number">${commercialMoney(item.line_total)}</td></tr>`).join("");
  const body = `<header class="heading">${logo}<h1>${title}</h1></header>
    <div class="parties">${partyHtml(document.issuer)}<div class="meta"><p>ເລກທີ: <strong>${escapeHtml(document.number)}</strong></p><p>ວັນທີ: ${escapeHtml(displayDate(document.issued_on))}</p>
    ${document.valid_until && !receipt ? `<p>ມີຜົນເຖິງ: ${escapeHtml(displayDate(document.valid_until))}</p>` : ""}</div></div>
    <section class="customer">${partyHtml(document.customer, "ລູກຄ້າ / CUSTOMER")}</section>
    <table><colgroup><col style="width:5%" /><col style="width:40%" /><col style="width:9%" /><col style="width:9%" /><col style="width:18%" /><col style="width:19%" /></colgroup>
    <thead><tr><th>ລ/ດ</th><th>ລາຍການ</th><th>ຫົວໜ່ວຍ</th><th>ຈຳນວນ</th><th>ລາຄາ</th><th>ລາຄາລວມ</th></tr></thead><tbody>${rows}</tbody></table>
    <section class="totals"><div class="total-row"><span>ລວມທັງໝົດ</span><span class="number">${commercialMoney(document.subtotal)}</span></div>
    <div class="total-row"><span>ອາກອນ (${document.tax_rate}%)</span><span class="number">${commercialMoney(document.tax_amount)}</span></div>
    <div class="total-row"><span>${receipt ? "ຮັບເງິນທັງໝົດ" : "ລວມຍອດທັງໝົດ"}</span><span class="number total-amount"><span class="currency">LAK</span> ${commercialMoney(document.total)}</span></div></section>
    <p class="amount-words">ຈຳນວນເງິນ: ${escapeHtml(commercialAmountWords(document.total))}</p>
    ${receipt && document.payment_method ? `<p>ວິທີຊຳລະ: ${escapeHtml(paymentLabel)}</p>` : ""}
    ${document.issuer.bank_details ? `<p>ຂໍ້ມູນທະນາຄານ: ${escapeHtml(document.issuer.bank_details)}</p>` : ""}
    ${document.notes ? `<section class="notes"><p class="strong">ໝາຍເຫດ</p><p>${escapeHtml(document.notes)}</p></section>` : ""}
    <section class="signatures"><div class="signature"><p>${receipt ? "ຜູ້ຈ່າຍເງິນ" : "ຜູ້ຮັບໃບສະເໜີລາຄາ"}</p><p class="signature-line">ລາຍເຊັນ / ວັນທີ</p></div>
    <div class="signature"><p>${receipt ? "ຜູ້ຮັບເງິນ" : "ຜູ້ສະເໜີລາຄາ"}</p><p class="signature-line">ລາຍເຊັນ / ວັນທີ</p></div></section>
    <p class="footer">${escapeHtml(document.number)}${document.source_quotation_uuid ? " · ອ້າງອີງໃບສະເໜີລາຄາ" : ""}</p>`;
  return htmlDocument(`${title} ${document.number}`, body, options);
}

export function renderCommercialCatalog(items: CatalogItem[], branchName: string, issuer: CommercialParty | undefined, options: CommercialPrintOptions = {}): string {
  const rows = items.filter(item => item.active).map((item, index) => `<tr><td class="center">${index + 1}</td><td><div class="item">${options.showImages !== false && item.image_visible ? imageHtml(item.image_url, "item-image", item.name) : ""}<div><p>${escapeHtml(item.name)}</p>${item.description ? `<p class="description">${escapeHtml(item.description)}</p>` : ""}</div></div></td><td class="center">${escapeHtml(item.unit)}</td><td class="number">${commercialMoney(item.unit_price)}</td></tr>`).join("");
  const body = `<header class="heading">${options.showLogo !== false && issuer ? imageHtml(issuer.logo_url, "logo", issuer.name) : ""}<h1>ລາຍການສິນຄ້າ / PRICE LIST</h1></header>
    ${issuer ? partyHtml(issuer) : ""}<p class="customer strong">ລາຍການລາຄາ: ${escapeHtml(branchName)} · LAK</p>
    <table><colgroup><col style="width:6%" /><col style="width:60%" /><col style="width:12%" /><col style="width:22%" /></colgroup><thead><tr><th>ລ/ດ</th><th>ລາຍການ</th><th>ຫົວໜ່ວຍ</th><th>ລາຄາ (LAK)</th></tr></thead><tbody>${rows}</tbody></table>`;
  return htmlDocument(`PRICE LIST ${branchName}`, body, options);
}
