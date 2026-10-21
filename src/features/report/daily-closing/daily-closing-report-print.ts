import { money } from "@/lib/format";
import type { ReportPrintOp } from "@/services/report";
import { escapeHtml } from "@/services/printer/invoice-print-window";
import {
  receiptDocumentHtml,
  receiptHeaderHtml,
  receiptHeadlineTotalHtml,
  receiptMetaRowHtml,
  receiptTotalRowHtml,
} from "../shared/report-receipt-print";
import type { DailyStoreClosingReport } from "@/stores/report-store";
import { dailyClosingLabel } from "./daily-closing-report-utils";

export interface DailyClosingPrintLabels {
  businessDate: string;
  cancelledBills: string;
  cash: string;
  cashier: string;
  category: string;
  credit: string;
  currencyUnit: string;
  discount: string;
  employeeSignature: string;
  grandTotal: string;
  group: string;
  groupTotal: string;
  items: string;
  revenueSummary: string;
  noData: string;
  noCategory: string;
  orderChannelSummary: string;
  paymentTotal: string;
  product: string;
  salesTotals: string;
  serviceCharge: string;
  storeManagerSignature: string;
  title: string;
  totalAmount: string;
  totalQuantity: string;
  transfer: string;
  quantity: string;
  vat: string;
}

export interface DailyClosingPrintData {
  branchName: string;
  businessDate: string;
  paymentPeriod?: { from: string; to: string };
  cashier: string;
  labels: DailyClosingPrintLabels;
  report: DailyStoreClosingReport;
  storeName: string;
}

type DailyClosingReportItem =
  DailyStoreClosingReport["groups"][number]["items"][number];

type PriceValue = number | string | null | undefined;

interface DailyClosingItemPriceFields {
  basePrice?: PriceValue;
  base_price?: PriceValue;
  unitPrice?: PriceValue;
  unit_price?: PriceValue;
  price?: PriceValue;
}

// Print-window styles stay inside this report so the other receipt reports keep
// their own density. Explicit amounts and wrapping preserve long values at58mm.
const DAILY_CLOSING_EXTRA_STYLES = `
      .daily-closing {
        --closing-amount-width: 26mm;
        font-size: 13px;
        font-weight: 400;
        line-height: 1.4;
        overflow-wrap: anywhere;
      }

      .daily-closing header .strong {
        font-size: 17px;
      }

      .daily-closing header > p:not(.strong) {
        font-size: 13px;
      }

      .daily-closing h1 {
        margin: 1.5mm 0;
        font-size: 22px;
        line-height: 1.3;
      }

      .daily-closing h2,
      .daily-closing .column-heading {
        font-size: 14px;
        line-height: 1.4;
      }

      /* Saysettha has one regular face. A light stroke gives the report's Lao
         headings visible emphasis instead of relying on a missing bold face. */
      .daily-closing header .strong,
      .daily-closing h1,
      .daily-closing h2,
      .daily-closing .column-heading,
      .daily-closing .group-heading,
      .daily-closing .category-heading,
      .daily-closing .group-total > span:first-child,
      .daily-closing .headline-total-label {
        font-weight: 900;
        -webkit-text-stroke: 0.25px currentColor;
      }

      .daily-closing .row,
      .daily-closing .total-row,
      .daily-closing .headline-total {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, var(--closing-amount-width));
        gap: 1.5mm;
        align-items: baseline;
      }

      .daily-closing .row > span,
      .daily-closing .total-row > span {
        min-width: 0;
        overflow-wrap: anywhere;
      }

      .daily-closing .row > span:last-child,
      .daily-closing .total-row > span:last-child,
      .daily-closing .headline-total-value {
        text-align: right;
        font-variant-numeric: tabular-nums;
      }

      .daily-closing .product-amount,
      .daily-closing .group-total > span:last-child,
      .daily-closing .total-row > span:last-child,
      .daily-closing .headline-total-value {
        font-family: Arial, "Yummy Go Saysettha OT", sans-serif !important;
        font-weight: 700;
      }

      .daily-closing .column-heading {
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        padding: 0.8mm 0;
        border-bottom: 1px solid currentColor;
      }

      .daily-closing .product {
        padding: 1.3mm 0;
        break-inside: avoid;
      }

      .daily-closing .product-main {
        min-width: 0;
      }

      .daily-closing .product-name {
        display: block;
        font-size: 14px;
        font-weight: 700;
        -webkit-text-stroke: 0.15px currentColor;
      }

      .daily-closing .product-amount {
        font-size: 16px;
        line-height: 1.3;
      }

      .daily-closing .product-price-quantity,
      .daily-closing .product-topping {
        display: block;
        margin-top: 0.5mm;
        font-size: 12px;
        font-weight: 400;
        line-height: 1.4;
      }

      .daily-closing .product-price-quantity {
        font-variant-numeric: tabular-nums;
      }

      .daily-closing .product-topping {
        padding-left: 1mm;
      }

      .daily-closing .report-groups {
        border-bottom: 1.5px solid currentColor;
      }

      .daily-closing .report-group {
        border-top: 1.5px solid currentColor;
        padding: 1mm 0;
      }

      .daily-closing .group-heading {
        margin: 0 0 0.8mm;
        font-size: 18px;
        line-height: 1.35;
        break-after: avoid;
      }

      .daily-closing .product-category {
        padding-top: 0.8mm;
      }

      .daily-closing .category-heading {
        margin: 0 0 0.4mm;
        font-size: 13px;
        line-height: 1.4;
        break-after: avoid;
      }

      .daily-closing .group-total {
        border-top: 1px dashed currentColor;
        padding: 1.2mm 0 0.5mm;
        font-size: 15px;
        break-inside: avoid;
      }

      .daily-closing .group-total > span:last-child {
        font-size: 18px;
      }

      .daily-closing .sales-totals {
        padding-top: 1.2mm;
      }

      .daily-closing .total-row {
        padding: 0.7mm 0;
      }

      .daily-closing .total-row > span:last-child {
        flex-shrink: 1;
        font-size: 14px;
      }

      .daily-closing .payment-total > span:first-child {
        font-weight: 900;
        -webkit-text-stroke: 0.25px currentColor;
      }

      .daily-closing .section-title {
        margin: 0;
        padding: 0.8mm 0 1.2mm;
        font-size: 15px;
      }

      .daily-closing .headline-total {
        grid-template-columns: minmax(0, 1fr) minmax(0, 55%);
        margin-top: 1mm;
        padding: 1.5mm 0;
      }

      .daily-closing .headline-total-label {
        margin: 0;
        font-size: 16px;
        line-height: 1.4;
      }

      .daily-closing .headline-total-value {
        min-width: 0;
        margin: 0;
        font-size: 22px;
        line-height: 1.25;
        overflow-wrap: anywhere;
      }

      .daily-closing .signatures {
        margin-top: 8mm;
        page-break-inside: avoid;
        break-inside: avoid;
      }

      .daily-closing .signature-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        gap: 2mm;
        margin-top: 1mm;
        font-size: 12px;
        text-align: center;
      }

      .daily-closing .signature-row > span {
        min-width: 0;
        overflow-wrap: anywhere;
      }

      .daily-closing .signature-line {
        letter-spacing: 0;
        white-space: nowrap;
      }

      @media (max-width: 240px) {
        .daily-closing {
          --closing-amount-width: 22mm;
        }
      }
`;

function dailyClosingDocumentStyles(paperWidthMm: 58 | 80) {
  // The selected printer supplies roll length; CSS page size cannot combine a
  // fixed width with auto height. Keep only the printable content width here.
  const contentWidth = paperWidthMm - 6;
  return `${DAILY_CLOSING_EXTRA_STYLES}
      @page { size: auto; margin: 3mm; }
      html, body { width: ${contentWidth}mm; }
      @media print { html, body { width: ${contentWidth}mm; } }
      ${paperWidthMm === 58 ? ".daily-closing { --closing-amount-width: 22mm; }" : ""}
`;
}

// เส้นลายเซ็นแบบจุด — ใช้ string เดียวกันทั้ง HTML และ ops เพราะเครื่องพิมพ์วาดเส้นแบ่งครึ่งแบบ
// CSS border ไม่ได้ ต้องพิมพ์เป็นตัวอักษรจริง วางเป็นแถว lr/flex เดียวกับแถวชื่อด้านล่าง
// (ไม่ใช่ข้อความ 1 บรรทัดตรงกลาง) เพื่อให้จุดแต่ละท่อนอยู่ตรงเหนือชื่อของตัวเองพอดี
const SIGNATURE_DOTS = ".".repeat(26);

// Category UUIDs keep equally named categories separate. Retain first-seen
// category/item order and use the API's group subtotal rather than summing again.
function itemCategories(items: DailyClosingReportItem[]) {
  const categories = new Map<string, { name: string; items: DailyClosingReportItem[] }>();
  for (const item of items) {
    const uuid = item.categoryUuid?.trim();
    const name = item.categoryName?.trim() || "";
    const key = uuid ? `uuid:${uuid}` : name ? `name:${name}` : "unassigned";
    let category = categories.get(key);
    if (!category) {
      category = { name, items: [] };
      categories.set(key, category);
    }
    if (!category.name && name) category.name = name;
    category.items.push(item);
  }
  return [...categories.values()];
}

// เนื้อหาใบเสร็จไม่รวม html/head/style/script
// ใช้ร่วมกันระหว่างหน้าพิมพ์และ preview บนหน้าจอ
export function renderDailyClosingReceiptBody(
  data: DailyClosingPrintData,
) {
  const { labels, report } = data;
  const apiLabels = report.labels;

  const groupLabel = labels.group;
  const groupTotalLabel = dailyClosingLabel(labels.groupTotal, apiLabels.groupTotal);
  const discountLabel = dailyClosingLabel(
    apiLabels.discountAmount,
    labels.discount,
  );
  // เติมหน่วยเงิน (เช่น "(ກີບ)") ต่อท้ายป้าย "ລວມເປັນເງິນ / Total Amount" เพราะใบปิดยอดตัดสัญลักษณ์ ₭ ออกจากทุกตัวเลขแล้ว
  // (withoutEnglishSuffix ที่ใช้กับป้ายนี้ในหัวคอลัมน์สินค้ายังตัดได้ปกติ เพราะตัดที่ " / " ตัวแรกก่อนถึง "(...)")
  const totalAmountLabel = `${dailyClosingLabel(
    apiLabels.totalAmount,
    labels.totalAmount,
  )} (${labels.currencyUnit})`;

  const groups = report.groups
    .map((group, groupIndex) => {
      const groupName =
        group.name || dailyClosingLabel(apiLabels.noGroup, "-");

      const categories = itemCategories(group.items).map((category) => {
        const products = category.items
        .map((item) => {
          const basePrice = getItemBasePrice(item);

          const priceAndQuantity = `${money(basePrice, "")} × ${formatNumber(
            item.totalQty,
          )}`;

          const toppings = item.toppings
            .filter((topping) => topping.name)
            .map((topping) => {
              const quantity =
                topping.qty > 0
                  ? ` × ${formatNumber(topping.qty)}`
                  : "";

              const price =
                topping.price === null
                  ? ""
                  : ` · ${money(topping.price, "")}`;

              return `
                <span class="product-topping">
                  + ${escapeHtml(topping.name)}${escapeHtml(quantity)}${escapeHtml(price)}
                </span>
              `;
            })
            .join("");

          return `
            <div class="product row">
              <span class="product-main">
                <span class="product-name">
                  ${escapeHtml(item.productName || "-")}
                </span>

                <span class="product-price-quantity">
                  ${escapeHtml(priceAndQuantity)}
                </span>

                ${toppings}
              </span>

              <span class="product-amount">${escapeHtml(money(item.totalAmount, ""))}</span>
            </div>
          `;
        })
        .join("");

        return `<section class="product-category">
          <h3 class="category-heading">${escapeHtml(labels.category)}: ${escapeHtml(category.name || labels.noCategory)}</h3>
          ${products}
        </section>`;
      }).join("");

      return `
        <section class="report-group">
          <h2 class="group-heading">
            ${escapeHtml(groupLabel)} ${groupIndex + 1}: ${escapeHtml(groupName)}
          </h2>

          <div class="column-heading row">
            <span>${escapeHtml(labels.product)}</span>
            <span>${escapeHtml(withoutEnglishSuffix(totalAmountLabel))}</span>
          </div>

          ${
            categories ||
            `<p style="text-align:center">${escapeHtml(labels.noData)}</p>`
          }

          <div class="group-total row">
            <span>
              ${escapeHtml(groupTotalLabel)}: ${escapeHtml(groupName)}
            </span>

            <span>${escapeHtml(money(group.totalAmount, ""))}</span>
          </div>
        </section>
      `;
    })
    .join("");

  return `
    <main class="daily-closing">
    ${receiptHeaderHtml({
      branchName: data.branchName,
      storeName: data.storeName,
      title: labels.title,
    })}

    <div class="divider"></div>

    <section class="meta">
      ${data.paymentPeriod ? `
        ${receiptMetaRowHtml(labels.businessDate, "")}
        <p>${escapeHtml(data.paymentPeriod.from)} -</p>
        <p>${escapeHtml(data.paymentPeriod.to)}</p>
      ` : receiptMetaRowHtml(labels.businessDate, data.businessDate)}
      ${receiptMetaRowHtml(labels.cashier, data.cashier)}
    </section>

    <div class="report-groups">
    ${
      groups ||
      `<p style="text-align:center">${escapeHtml(labels.noData)}</p>`
    }

    </div>

    <section class="sales-totals">
      <h2 class="section-title">${escapeHtml(labels.salesTotals)}</h2>
      <div class="total-row">
        <span>
          ${escapeHtml(
            dailyClosingLabel(
              apiLabels.totalQty,
              labels.totalQuantity,
            ),
          )}
        </span>

        <span>
          ${escapeHtml(formatNumber(report.summary.totalQty))}
          ${escapeHtml(labels.items)}
        </span>
      </div>

      ${totalRow(totalAmountLabel, report.summary.totalAmount)}

      ${totalRow(
        discountLabel,
        -report.summary.discountAmount,
      )}

      ${totalRow(
        dailyClosingLabel(
          apiLabels.serviceCharge,
          labels.serviceCharge,
        ),
        report.summary.serviceCharge,
      )}

      ${totalRow(
        dailyClosingLabel(apiLabels.vat, labels.vat),
        report.summary.vat,
      )}

      ${receiptHeadlineTotalHtml(
        dailyClosingLabel(
          apiLabels.grandTotal,
          labels.grandTotal,
        ),
        report.summary.grandTotal,
        "",
      )}
    </section>

    <div class="divider"></div>

    <section>
      <h2 class="section-title">
        ${escapeHtml(labels.revenueSummary)}
      </h2>

      ${numberedTotalRow(
        1,
        dailyClosingLabel(apiLabels.cash, labels.cash),
        report.paymentSummary.cash,
      )}

      ${numberedTotalRow(
        2,
        dailyClosingLabel(apiLabels.transfer, labels.transfer),
        report.paymentSummary.transfer,
      )}

      ${numberedTotalRow(
        3,
        dailyClosingLabel(apiLabels.credit, labels.credit),
        report.paymentSummary.credit,
      )}

      ${numberedTotalRow(
        4,
        dailyClosingLabel(
          apiLabels.paymentTotal,
          labels.paymentTotal,
        ),
        report.paymentSummary.paymentTotal,
        "payment-total",
      )}

      ${numberedTotalRow(
        5,
        `${dailyClosingLabel(
          apiLabels.cancelBill,
          labels.cancelledBills,
        )} (${formatNumber(report.cancelSummary.billCount)})`,
        report.cancelSummary.totalAmount,
      )}
    </section>

    ${
      report.orderChannels.length
        ? `
    <div class="divider"></div>

    <section>
      <h2 class="section-title">
        ${escapeHtml(labels.orderChannelSummary)}
      </h2>

      ${report.orderChannels
        .map((channel, channelIndex) =>
          numberedTotalRow(
            channelIndex + 1,
            `${channel.name || "-"} (${formatNumber(channel.billCount)})`,
            channel.grandTotal,
          ),
        )
        .join("")}
    </section>
  `
        : ""
    }

    <footer class="signatures">
      <div class="signature-row signature-line">
        <span>${SIGNATURE_DOTS}</span>
        <span>${SIGNATURE_DOTS}</span>
      </div>
      <div class="signature-row">
        <span class="employee-signature">${escapeHtml(labels.employeeSignature)}</span>
        <span class="store-manager-signature">${escapeHtml(labels.storeManagerSignature)}</span>
      </div>
    </footer>
    </main>
  `;
}

export function renderDailyClosingPrintHtml(
  data: DailyClosingPrintData,
  paperWidthMm: 58 | 80 = 80,
) {
  return receiptDocumentHtml({
    bodyHtml: renderDailyClosingReceiptBody(data),
    extraStyles: dailyClosingDocumentStyles(paperWidthMm),
    title: data.labels.title,
  });
}

// เอกสาร preview บนหน้าจอ ใช้เนื้อหาและสไตล์เดียวกับหน้าพิมพ์
// แต่ไม่มีสคริปต์สั่งพิมพ์
export function renderDailyClosingReceiptPreviewDoc(
  data: DailyClosingPrintData,
  paperWidthMm: 58 | 80 = 80,
) {
  return receiptDocumentHtml({
    autoPrint: false,
    bodyHtml: renderDailyClosingReceiptBody(data),
    extraStyles: `${dailyClosingDocumentStyles(paperWidthMm)}

      html,
      body {
        margin-left: auto;
        margin-right: auto;
      }

      body {
        padding: 3mm 0;
      }
`,
  });
}

// เวอร์ชันพิมพ์ผ่าน printer agent — ต้องละเอียดครบเหมือน renderDailyClosingReceiptBody
// เพราะใบปิดยอดใช้กระทบยอดตอนปิดกะ ต่างจาก daily-sales ที่ตัดรายการสินค้าออกได้
export function buildDailyClosingReportOps(
  data: DailyClosingPrintData,
): ReportPrintOp[] {
  const { labels, report } = data;
  const apiLabels = report.labels;
  // The renderer knows the printer's printable width; a fixed run of glyphs
  // cannot fill both 58 mm and 80 mm paper without wrapping or leaving a gap.
  const divider: ReportPrintOp = { type: "line", style: "dashed" };

  const lr = (left: string, right: number, bold = false, size = 26): ReportPrintOp => ({
    type: "lr",
    left,
    right: money(Object.is(right, -0) ? 0 : right, ""),
    bold,
    size,
    text_role: "report_row",
  });

  const groupTotalLabel = dailyClosingLabel(labels.groupTotal, apiLabels.groupTotal);
  const discountLabel = dailyClosingLabel(apiLabels.discountAmount, labels.discount);
  // เติมหน่วยเงินต่อท้ายเหมือนฝั่ง HTML — ดู renderDailyClosingReceiptBody
  const totalAmountLabel = `${dailyClosingLabel(apiLabels.totalAmount, labels.totalAmount)} (${labels.currencyUnit})`;

  const toppingOp = (topping: DailyClosingReportItem["toppings"][number]): ReportPrintOp => {
    const quantity = topping.qty > 0 ? ` × ${formatNumber(topping.qty)}` : "";
    const price = topping.price === null ? "" : ` · ${money(topping.price, "")}`;
    return { type: "text", text: `+ ${topping.name}${quantity}${price}`, align: "left", bold: false, size: 22, text_role: "report_detail" };
  };

  const itemOps = (item: DailyClosingReportItem): ReportPrintOp[] => {
    const basePrice = getItemBasePrice(item);
    return [
      lr(item.productName || "-", item.totalAmount, true, 28),
      {
        type: "text",
        text: `${money(basePrice, "")} × ${formatNumber(item.totalQty)}`,
        align: "left",
        bold: false,
        size: 22,
        text_role: "report_detail",
      },
      ...item.toppings.filter((topping) => topping.name).map(toppingOp),
      { type: "spacer", px: 5 },
    ];
  };

  const orderChannelOps: ReportPrintOp[] = report.orderChannels.length
    ? [
        divider,
        { type: "text", text: labels.orderChannelSummary, align: "center", bold: true, size: 30, text_role: "report_heading" },
        ...report.orderChannels.map((channel, channelIndex) =>
          lr(
            `${channelIndex + 1}. ${channel.name || "-"} (${formatNumber(channel.billCount)})`,
            channel.grandTotal,
          ),
        ),
      ]
    : [];

  const groupDivider: ReportPrintOp = { type: "line", style: "solid" };
  const groupOps: ReportPrintOp[] = report.groups.flatMap((group, groupIndex) => {
    const groupName = group.name || dailyClosingLabel(apiLabels.noGroup, "-");
    const products: ReportPrintOp[] = group.items.length
      ? itemCategories(group.items).flatMap((category) => [
          { type: "spacer", px: 5 },
          { type: "text", text: `${labels.category}: ${category.name || labels.noCategory}`, align: "left", bold: true, size: 26, text_role: "report_heading" },
          ...category.items.flatMap(itemOps),
        ] satisfies ReportPrintOp[])
      : [{ type: "text", text: labels.noData, align: "center", bold: false, size: 22, text_role: "report_detail" }];

    return [
      groupDivider,
      { type: "text", text: `${labels.group} ${groupIndex + 1}: ${groupName}`, align: "left", bold: true, size: 32, text_role: "report_heading" },
      { type: "lr", left: labels.product, right: withoutEnglishSuffix(totalAmountLabel), bold: true, size: 26, text_role: "report_heading" },
      ...products,
      divider,
      lr(`${groupTotalLabel}: ${groupName}`, group.totalAmount, true, 30),
      { type: "spacer", px: 6 },
    ];
  });

  return [
    // ลำดับหัวใบเสร็จต้องตรงกับ receiptHeaderHtml: ชื่อร้าน(หนา) -> ชื่อสาขา -> หัวข้อรายงาน(ใหญ่สุด)
    ...(data.storeName ? [{ type: "text", text: data.storeName, align: "center", bold: true, size: 30, text_role: "report_heading" } as ReportPrintOp] : []),
    ...(data.branchName ? [{ type: "text", text: data.branchName, align: "center", bold: false, size: 24, text_role: "report_detail" } as ReportPrintOp] : []),
    { type: "text", text: labels.title, align: "center", bold: true, size: 36, text_role: "report_heading" },
    divider,
    ...(data.paymentPeriod ? [
      { type: "text", text: `${labels.businessDate}:`, align: "left", bold: false, size: 24, text_role: "report_detail" } as ReportPrintOp,
      { type: "text", text: `${data.paymentPeriod.from} -`, align: "left", bold: false, size: 24, text_role: "report_detail" } as ReportPrintOp,
      { type: "text", text: data.paymentPeriod.to, align: "left", bold: false, size: 24, text_role: "report_detail" } as ReportPrintOp,
    ] : [
      { type: "text", text: `${labels.businessDate}: ${data.businessDate}`, align: "left", bold: false, size: 24, text_role: "report_detail" } as ReportPrintOp,
    ]),
    { type: "text", text: `${labels.cashier}: ${data.cashier}`, align: "left", bold: false, size: 24, text_role: "report_detail" },
    ...groupOps,
    groupDivider,
    { type: "text", text: labels.salesTotals, align: "center", bold: true, size: 30, text_role: "report_heading" },
    {
      type: "lr",
      left: dailyClosingLabel(apiLabels.totalQty, labels.totalQuantity),
      right: `${formatNumber(report.summary.totalQty)} ${labels.items}`,
      bold: false,
      size: 26,
      text_role: "report_row",
    },
    lr(totalAmountLabel, report.summary.totalAmount),
    lr(discountLabel, -report.summary.discountAmount),
    lr(dailyClosingLabel(apiLabels.serviceCharge, labels.serviceCharge), report.summary.serviceCharge),
    lr(dailyClosingLabel(apiLabels.vat, labels.vat), report.summary.vat),
    divider,
    {
      type: "lr",
      left: dailyClosingLabel(apiLabels.grandTotal, labels.grandTotal),
      right: money(report.summary.grandTotal, ""),
      bold: true,
      size: 32,
      right_size: 38,
      text_role: "amount_due",
    },
    divider,
    { type: "text", text: labels.revenueSummary, align: "center", bold: true, size: 30, text_role: "report_heading" },
    lr(`1. ${dailyClosingLabel(apiLabels.cash, labels.cash)}`, report.paymentSummary.cash),
    lr(`2. ${dailyClosingLabel(apiLabels.transfer, labels.transfer)}`, report.paymentSummary.transfer),
    lr(`3. ${dailyClosingLabel(apiLabels.credit, labels.credit)}`, report.paymentSummary.credit),
    lr(
      `4. ${dailyClosingLabel(apiLabels.paymentTotal, labels.paymentTotal)}`,
      report.paymentSummary.paymentTotal,
      true,
      28,
    ),
    lr(
      `5. ${dailyClosingLabel(apiLabels.cancelBill, labels.cancelledBills)} (${formatNumber(
        report.cancelSummary.billCount,
      )})`,
      report.cancelSummary.totalAmount,
    ),
    ...orderChannelOps,
    // Leave room to sign without the former24mm empty block.
    { type: "spacer", px: 48 },
    { type: "lr", left: SIGNATURE_DOTS, right: SIGNATURE_DOTS, bold: false, size: 22, text_role: "report_signature" },
    { type: "lr", left: labels.employeeSignature, right: labels.storeManagerSignature, bold: false, size: 22, text_role: "report_signature" },
    { type: "spacer", px: 12 },
  ];
}

function getItemBasePrice(
  item: DailyClosingReportItem,
): number {
  const itemWithPrice = item as DailyClosingReportItem &
    DailyClosingItemPriceFields;

  const candidates: PriceValue[] = [
    itemWithPrice.basePrice,
    itemWithPrice.base_price,
    itemWithPrice.unitPrice,
    itemWithPrice.unit_price,
    itemWithPrice.price,
  ];

  for (const candidate of candidates) {
    const parsedPrice = parsePrice(candidate);

    if (parsedPrice !== null) {
      return parsedPrice;
    }
  }

  // Compatibility fallback สำหรับ response เก่าที่ไม่มีราคาต่อหน่วย
  // ใช้เฉพาะเพื่อไม่ให้หน้า Preview ล้ม
  if (item.totalQty > 0) {
    return item.totalAmount / item.totalQty;
  }

  return item.totalAmount;
}

function parsePrice(value: PriceValue): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const parsedValue = Number(value);

  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function totalRow(
  label: string,
  value: number,
  className = "",
) {
  // ตัดสัญลักษณ์ ₭ ออกจากตัวเลขในใบปิดยอดทุกจุด (ดูเหตุผลที่ totalAmountLabel ด้านบน)
  return receiptTotalRowHtml(label, value, className, "");
}

function numberedTotalRow(
  index: number,
  label: string,
  value: number,
  className = "",
) {
  return totalRow(`${index}. ${label}`, value, className);
}

function formatNumber(value: number) {
  return Number.isInteger(value)
    ? value.toLocaleString("en-US")
    : value.toLocaleString("en-US", {
        maximumFractionDigits: 2,
      });
}

// backend ส่ง label การเงินเป็นคู่ "ລາວ / English" เสมอ — ตัดเหลือแค่ภาษาลาวให้สั้นพอ
// จะแชร์แถวเดียวกับป้ายอื่นได้อย่างปลอดภัย (กันล้นบรรทัดแบบที่เคยพังตอนพิมพ์จริง)
function withoutEnglishSuffix(label: string) {
  return label.split(" / ")[0];
}
