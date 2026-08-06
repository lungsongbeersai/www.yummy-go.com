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
      .row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 23mm;
        gap: 1mm;
        align-items: start;
      }

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
        margin-top: 24mm;
        padding-top: 4mm;
        page-break-inside: avoid;
        break-inside: avoid;
      }

      .signature-row {
        display: flex;
        justify-content: space-between;
        margin-top: 1.5mm;
        font-size: 10px;
      }

      .signature-line {
        letter-spacing: 1px;
      }
`;

// เส้นลายเซ็นแบบจุด — ใช้ string เดียวกันทั้ง HTML และ ops เพราะเครื่องพิมพ์วาดเส้นแบ่งครึ่งแบบ
// CSS border ไม่ได้ ต้องพิมพ์เป็นตัวอักษรจริง วางเป็นแถว lr/flex เดียวกับแถวชื่อด้านล่าง
// (ไม่ใช่ข้อความ 1 บรรทัดตรงกลาง) เพื่อให้จุดแต่ละท่อนอยู่ตรงเหนือชื่อของตัวเองพอดี
const SIGNATURE_DOTS = ".".repeat(18);

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

          <div class="category-total row">
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

    <div class="row">
      <span>${escapeHtml(labels.product)}</span>
      <span>${escapeHtml(withoutEnglishSuffix(totalAmountLabel))}</span>
    </div>

    ${
      groups ||
      `<p style="text-align:center">${escapeHtml(labels.noData)}</p>`
    }

    <div class="divider"></div>

    <section>
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
      <div class="signature-row signature-line">
        <span>${SIGNATURE_DOTS}</span>
        <span>${SIGNATURE_DOTS}</span>
      </div>
      <div class="signature-row">
        <span class="employee-signature">${escapeHtml(labels.employeeSignature)}</span>
        <span class="store-manager-signature">${escapeHtml(labels.storeManagerSignature)}</span>
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

// เวอร์ชันพิมพ์ผ่าน printer agent — ต้องละเอียดครบเหมือน renderDailyClosingReceiptBody
// เพราะใบปิดยอดใช้กระทบยอดตอนปิดกะ ต่างจาก daily-sales ที่ตัดรายการสินค้าออกได้
export function buildDailyClosingReportOps(
  data: DailyClosingPrintData,
): ReportPrintOp[] {
  const { labels, report } = data;
  const apiLabels = report.labels;

  const lr = (left: string, right: number, bold = false): ReportPrintOp => ({
    type: "lr",
    left,
    right: money(right),
    bold,
    size: bold ? 26 : 24,
  });

  const groupTotalLabel = dailyClosingLabel(apiLabels.groupTotal, labels.groupTotal);
  const discountLabel = dailyClosingLabel(apiLabels.discountAmount, labels.discount);
  const totalAmountLabel = dailyClosingLabel(apiLabels.totalAmount, labels.totalAmount);

  const toppingOp = (topping: DailyClosingReportItem["toppings"][number]): ReportPrintOp => {
    const quantity = topping.qty > 0 ? ` × ${formatNumber(topping.qty)}` : "";
    const price = topping.price === null ? "" : ` · ${money(topping.price)}`;
    return { type: "text", text: `+ ${topping.name}${quantity}${price}`, align: "left", size: 18 };
  };

  const itemOps = (item: DailyClosingReportItem): ReportPrintOp[] => {
    const basePrice = getItemBasePrice(item);
    return [
      lr(item.productName || "-", item.totalAmount),
      {
        type: "text",
        text: `${money(basePrice)} × ${formatNumber(item.totalQty)}`,
        align: "left",
        size: 20,
      },
      ...item.toppings.filter((topping) => topping.name).map(toppingOp),
    ];
  };

  // แต่ละกลุ่มปิดท้ายด้วย line เพื่อแทน border-bottom ของ .category-total ใน HTML
  const groupOps: ReportPrintOp[] = report.groups.flatMap((group) => {
    const groupName = group.name || dailyClosingLabel(apiLabels.noGroup, "-");
    const products: ReportPrintOp[] = group.items.length
      ? group.items.flatMap(itemOps)
      : [{ type: "text", text: labels.noData, align: "center", size: 22 }];

    return [
      { type: "text", text: `${labels.group}: ${groupName}`, align: "left", bold: true, size: 26 },
      ...products,
      lr(`${groupTotalLabel} ${groupName}`, group.totalAmount),
      { type: "line" },
    ];
  });

  return [
    // ลำดับหัวใบเสร็จต้องตรงกับ receiptHeaderHtml: ชื่อร้าน(หนา) -> ชื่อสาขา -> หัวข้อรายงาน(ใหญ่สุด)
    ...(data.storeName ? [{ type: "text", text: data.storeName, align: "center", bold: true, size: 24 } as ReportPrintOp] : []),
    ...(data.branchName ? [{ type: "text", text: data.branchName, align: "center", size: 22 } as ReportPrintOp] : []),
    { type: "text", text: labels.title, align: "center", bold: true, size: 32 },
    { type: "line" },
    { type: "text", text: `${labels.businessDate}: ${data.businessDate}`, align: "left", size: 24 },
    { type: "text", text: `${labels.cashier}: ${data.cashier}`, align: "left", size: 24 },
    { type: "line" },
    // ตัดเหลือแค่ภาษาลาว (withoutEnglishSuffix) แล้วข้อความสั้นพอจะแชร์แถวเดียวกับ "Product" ได้อย่างปลอดภัย
    // ต่างจากตอนที่ยังมี " / English" ต่อท้ายซึ่งเคยล้นจนพิมพ์ออกมาผิดรูป
    { type: "lr", left: labels.product, right: withoutEnglishSuffix(totalAmountLabel), bold: false, size: 24 },
    ...groupOps,
    {
      type: "lr",
      left: dailyClosingLabel(apiLabels.totalQty, labels.totalQuantity),
      right: `${formatNumber(report.summary.totalQty)} ${labels.items}`,
      bold: false,
      size: 24,
    },
    lr(totalAmountLabel, report.summary.totalAmount),
    lr(discountLabel, -report.summary.discountAmount),
    lr(dailyClosingLabel(apiLabels.serviceCharge, labels.serviceCharge), report.summary.serviceCharge),
    lr(dailyClosingLabel(apiLabels.vat, labels.vat), report.summary.vat),
    { type: "line" },
    // ยืนยันจากพิมพ์จริงหลายรอบแล้วว่า bold/size บนแถว type "lr" printer agent ไม่ใช้เลย
    // (ต่างจาก type "text" ที่หัวใบเสร็จ/ชื่อร้านมีขนาดต่างจากเนื้อหาปกติชัดเจนบนกระดาษจริง)
    // จึงเก็บจุดเน้นสูงสุดไว้ที่ยอดรวมทั้งหมดจุดเดียว โดยแยกเป็น text 2 บรรทัดแทน lr บรรทัดเดียว
    // ส่วนแถว lr อื่น (ยอดรวมกลุ่ม, จำนวนรวม, ยอดรับชำระ) ตัด bold/size ที่ไม่มีผลจริงออกเพื่อไม่ให้โค้ดหลอกตา
    { type: "text", text: dailyClosingLabel(apiLabels.grandTotal, labels.grandTotal), align: "left", bold: true, size: 26 },
    { type: "text", text: money(report.summary.grandTotal), align: "right", bold: true, size: 32 },
    { type: "line" },
    { type: "text", text: labels.revenueSummary, align: "center", bold: true, size: 26 },
    lr(`1. ${dailyClosingLabel(apiLabels.cash, labels.cash)}`, report.paymentSummary.cash),
    lr(`2. ${dailyClosingLabel(apiLabels.transfer, labels.transfer)}`, report.paymentSummary.transfer),
    lr(`3. ${dailyClosingLabel(apiLabels.credit, labels.credit)}`, report.paymentSummary.credit),
    lr(
      `4. ${dailyClosingLabel(apiLabels.paymentTotal, labels.paymentTotal)}`,
      report.paymentSummary.paymentTotal,
    ),
    lr(
      `5. ${dailyClosingLabel(apiLabels.cancelBill, labels.cancelledBills)} (${formatNumber(
        report.cancelSummary.billCount,
      )})`,
      report.cancelSummary.totalAmount,
    ),
    // เว้นบรรทัดว่างเพิ่มให้พื้นที่เซ็นชื่อหายใจ + ใช้แถว lr เดียวกับแถวชื่อสำหรับเส้นจุด
    // (ตรงกับ SIGNATURE_DOTS ที่ใช้ใน HTML) เพื่อให้จุดแต่ละฝั่งอยู่ตรงเหนือชื่อของตัวเองพอดี
    { type: "blank", n: 3 },
    { type: "lr", left: SIGNATURE_DOTS, right: SIGNATURE_DOTS, bold: false, size: 20 },
    { type: "lr", left: labels.employeeSignature, right: labels.storeManagerSignature, bold: false, size: 20 },
    { type: "blank", n: 2 },
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

// backend ส่ง label การเงินเป็นคู่ "ລາວ / English" เสมอ — แถวหัวตารางนี้ต้องอยู่คนละบรรทัด
// กับ "สินค้า" (กันล้นบรรทัดแบบที่เคยพังตอนพิมพ์จริง) จึงมีที่ว่างพอสำหรับภาษาลาวอย่างเดียว
function withoutEnglishSuffix(label: string) {
  return label.split(" / ")[0];
}