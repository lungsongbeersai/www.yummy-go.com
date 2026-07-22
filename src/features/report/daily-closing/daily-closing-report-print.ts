import { money } from "@/lib/format";
import { escapeHtml } from "@/services/printer/invoice-print-window";
import {
  receiptDocumentHtml,
  receiptHeaderHtml,
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
  credit: string;
  discount: string;
  employeeSignature: string;
  grandTotal: string;
  group: string;
  groupTotal: string;
  items: string;
  revenueSummary: string;
  noData: string;
  paymentTotal: string;
  product: string;
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

// สไตล์เฉพาะของใบปิดยอด (ต่อยอดจาก RECEIPT_80MM_BASE_STYLES):
// สองคอลัมน์ (ชื่อสินค้า + ราคาฐาน × จำนวน | ยอดรวม) และช่องลายเซ็น
const DAILY_CLOSING_EXTRA_STYLES = `
      .columns,
      .row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 23mm;
        gap: 1mm;
        align-items: start;
      }

      .columns > span:last-child,
      .row > span:last-child {
        text-align: right;
        font-variant-numeric: tabular-nums;
      }

      .product-main {
        min-width: 0;
        overflow-wrap: anywhere;
      }

      .product-name {
        display: block;
      }

      .product-price-quantity {
        display: block;
        margin-top: 0.3mm;
        color: #444;
        font-size: 10px;
        font-weight: 600;
        line-height: 1.2;
        font-variant-numeric: tabular-nums;
      }

      .product-topping {
        display: block;
        margin-top: 0.35mm;
        padding-left: 1.5mm;
        color: #333;
        font-size: 10px;
        font-weight: 500;
        line-height: 1.2;
      }

      .signatures {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8mm;
        margin-top: 20mm;
        page-break-inside: avoid;
        break-inside: avoid;
      }

      .signature {
        min-width: 0;
        text-align: center;
      }

      .signature-line {
        border-top: 1px dotted #111;
      }

      .signature p {
        margin-top: 1.5mm;
        font-size: 10px;
      }
`;

// เนื้อหาใบเสร็จไม่รวม html/head/style/script
// ใช้ร่วมกันระหว่างหน้าพิมพ์และ preview บนหน้าจอ
export function renderDailyClosingReceiptBody(
  data: DailyClosingPrintData,
) {
  const { labels, report } = data;
  const apiLabels = report.labels;

  const groupLabel = labels.group;
  const groupTotalLabel = dailyClosingLabel(
    apiLabels.groupTotal,
    labels.groupTotal,
  );
  const discountLabel = dailyClosingLabel(
    apiLabels.discountAmount,
    labels.discount,
  );
  const totalAmountLabel = dailyClosingLabel(
    apiLabels.totalAmount,
    labels.totalAmount,
  );

  const groups = report.groups
    .map((group) => {
      const groupName =
        group.name || dailyClosingLabel(apiLabels.noGroup, "-");

      const products = group.items
        .map((item) => {
          const basePrice = getItemBasePrice(item);

          const priceAndQuantity = `${money(basePrice)} × ${formatNumber(
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
                  : ` · ${money(topping.price)}`;

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

              <span>${escapeHtml(money(item.totalAmount))}</span>
            </div>
          `;
        })
        .join("");

      return `
        <section class="category">
          <h2>
            ${escapeHtml(groupLabel)}: ${escapeHtml(groupName)}
          </h2>

          ${
            products ||
            `<p style="text-align:center">${escapeHtml(labels.noData)}</p>`
          }

          <div class="category-total row strong">
            <span>
              ${escapeHtml(groupTotalLabel)} ${escapeHtml(groupName)}
            </span>

            <span>${escapeHtml(money(group.totalAmount))}</span>
          </div>
        </section>
      `;
    })
    .join("");

  return `
    ${receiptHeaderHtml({
      branchName: data.branchName,
      storeName: data.storeName,
      title: labels.title,
    })}

    <div class="divider"></div>

    <section class="meta">
      ${receiptMetaRowHtml(labels.businessDate, data.businessDate)}
      ${receiptMetaRowHtml(labels.cashier, data.cashier)}
    </section>

    <div class="divider"></div>

    <div class="columns strong">
      <span>${escapeHtml(labels.product)}</span>
      <span>${escapeHtml(totalAmountLabel)}</span>
    </div>

    ${
      groups ||
      `<p style="text-align:center">${escapeHtml(labels.noData)}</p>`
    }

    <div class="divider"></div>

    <section>
      <div class="total-row strong">
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

      ${totalRow(
        dailyClosingLabel(
          apiLabels.grandTotal,
          labels.grandTotal,
        ),
        report.summary.grandTotal,
        "grand-total",
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
        "strong",
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

    <footer class="signatures">
      <div class="signature employee-signature">
        <div class="signature-line"></div>
        <p>${escapeHtml(labels.employeeSignature)}</p>
      </div>

      <div class="signature store-manager-signature">
        <div class="signature-line"></div>
        <p>${escapeHtml(labels.storeManagerSignature)}</p>
      </div>
    </footer>
  `;
}

export function renderDailyClosingPrintHtml(
  data: DailyClosingPrintData,
) {
  return receiptDocumentHtml({
    bodyHtml: renderDailyClosingReceiptBody(data),
    extraStyles: DAILY_CLOSING_EXTRA_STYLES,
    title: data.labels.title,
  });
}

// เอกสาร preview บนหน้าจอ ใช้เนื้อหาและสไตล์เดียวกับหน้าพิมพ์
// แต่ไม่มีสคริปต์สั่งพิมพ์
export function renderDailyClosingReceiptPreviewDoc(
  data: DailyClosingPrintData,
) {
  return receiptDocumentHtml({
    autoPrint: false,
    bodyHtml: renderDailyClosingReceiptBody(data),
    extraStyles: `${DAILY_CLOSING_EXTRA_STYLES}

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
  return receiptTotalRowHtml(label, value, className);
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