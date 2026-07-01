import type {
  ReportColumn,
  ReportTab,
  SummaryCardConfig,
} from "./daily-sales-report-types";
import { reportImageKeys } from "./daily-sales-report-utils";

export function cardSummaryConfigs(
  t: (key: string) => string,
): SummaryCardConfig[] {
  return [
    {
      label: t("report.cards.billsCount"),
      kind: "number",
      keys: ["bill_count"],
    },
    {
      label: t("report.cards.totalQuantity"),
      kind: "number",
      keys: ["total_qty"],
    },
    {
      label: t("report.cards.orderTotal"),
      kind: "money",
      keys: ["amount"],
    },
    {
      label: t("report.cards.discountAmount"),
      kind: "money",
      keys: ["discount_bill"],
    },
    {
      label: t("report.cards.sumDiscount"),
      kind: "money",
      keys: ["sum_discount"],
    },
    {
      label: t("report.cards.afterDiscount"),
      kind: "money",
      keys: ["after_discount"],
    },
    {
      label: t("report.cards.serviceCharge"),
      kind: "money",
      keys: ["sum_servicecharge"],
    },
    {
      label: t("report.cards.vatAmount"),
      kind: "money",
      keys: ["sum_vate"],
    },
    {
      label: t("report.cards.netTotal"),
      kind: "money",
      keys: ["sum_total"],
    },
  ];
}

export function summaryConfigs(
  t: (key: string) => string,
  typePage: ReportTab,
): SummaryCardConfig[] {
  if (typePage === "detail") {
    return [
      {
        label: t("report.cards.billsCount"),
        kind: "number",
        keys: ["bill_count"],
      },
      {
        label: t("report.cards.totalQuantity"),
        kind: "number",
        keys: ["total_qty"],
      },
      {
        label: t("report.cards.orderTotal"),
        kind: "money",
        keys: ["amount"],
      },
      {
        label: t("report.cards.itemDiscountAmount"),
        kind: "money",
        keys: ["discount_item"],
      },
      {
        label: t("report.cards.discountAmount"),
        kind: "money",
        keys: ["discount_bill"],
      },
      {
        label: t("report.cards.sumDiscount"),
        kind: "money",
        keys: ["sum_discount"],
      },
      {
        label: t("report.cards.serviceCharge"),
        kind: "money",
        keys: ["sum_servicecharge"],
      },
      {
        label: t("report.cards.vatAmount"),
        kind: "money",
        keys: ["sum_vate"],
      },
      {
        label: t("report.cards.netTotal"),
        kind: "money",
        keys: ["sum_total"],
      },
    ];
  }

  return cardSummaryConfigs(t);
}

export function reportColumns(
  t: (key: string) => string,
  typePage: ReportTab,
): ReportColumn[] {
  if (typePage === "detail") {
    return [
      {
        header: t("report.columns.saleDate"),
        kind: "date",
        keys: [
          "sale_date",
          "business_date",
          "created_at",
          "order_date",
          "date",
        ],
        minWidth: "min-w-[118px]",
      },
      {
        header: t("report.columns.invoiceNumber"),
        keys: ["invoice_number", "invoice_no", "invoice", "order_invoice"],
        minWidth: "min-w-[132px]",
      },
      {
        header: t("report.columns.tableName"),
        keys: ["table_name", "table_name_la", "table_name_eng"],
        minWidth: "min-w-[84px]",
      },
      {
        header: t("report.columns.productImage"),
        kind: "image",
        keys: ["product_image", "prod_image", "image", "image_url"],
        minWidth: "min-w-[76px]",
      },
      {
        header: t("report.columns.productName"),
        keys: ["product_name", "prod_name", "prod_name_la", "prod_name_eng"],
        minWidth: "min-w-[220px]",
        wide: true,
      },
      {
        header: t("report.columns.basePrice"),
        kind: "money",
        align: "right",
        keys: ["base_price", "unit_price", "pro_detail_sprice"],
        minWidth: "min-w-[120px]",
      },
      {
        header: t("report.columns.toppingTotal"),
        kind: "money",
        align: "right",
        keys: ["topping_total", "topping_unit_total", "topping_line_total"],
        minWidth: "min-w-[126px]",
      },
      {
        header: t("report.columns.price"),
        kind: "money",
        align: "right",
        keys: ["price", "sale_price", "unit_price"],
        minWidth: "min-w-[112px]",
      },
      {
        header: t("report.columns.quantity"),
        kind: "number",
        align: "right",
        keys: ["qty", "quantity", "order_it_qty"],
        minWidth: "min-w-[84px]",
      },
      {
        header: t("report.columns.itemDiscount"),
        kind: "money",
        align: "right",
        keys: ["item_discount_amount", "order_it_discount_amount"],
        minWidth: "min-w-[128px]",
      },
      {
        header: t("report.columns.lineTotal"),
        kind: "money",
        align: "right",
        keys: ["line_total", "net_total", "total"],
        minWidth: "min-w-[128px]",
      },
      {
        header: t("report.columns.note"),
        keys: ["note", "order_it_note", "order_note"],
        minWidth: "min-w-[220px]",
        wide: true,
      },
      {
        header: t("report.columns.paymentType"),
        keys: [
          "payment_type",
          "payment_method",
          "payment_name",
          "payment_type_name",
        ],
        minWidth: "min-w-[130px]",
      },
      {
        header: t("report.columns.status"),
        kind: "status",
        keys: [
          "status_name",
          "status_text",
          "status",
          "status_code",
          "order_status_text",
          "order_it_status_text",
        ],
        minWidth: "min-w-[118px]",
      },
    ];
  }

  return [
    {
      header: t("report.columns.invoiceNumber"),
      keys: ["order_invoice", "invoice_number", "invoice_no", "invoice"],
      minWidth: "min-w-[132px]",
    },
    {
      header: t("report.columns.saleDate"),
      kind: "date",
      keys: ["order_date", "sale_date", "business_date", "created_at", "date"],
      minWidth: "min-w-[118px]",
    },
    {
      header: t("report.columns.tableName"),
      keys: ["table_name", "table_name_la", "table_name_eng"],
      minWidth: "min-w-[84px]",
    },
    {
      header: t("report.columns.paymentType"),
      keys: ["payment_method_name", "payment_type", "payment_method"],
      minWidth: "min-w-[130px]",
    },
    {
      header: t("report.columns.quantity"),
      kind: "number",
      align: "right",
      keys: ["total_qty", "qty_total", "qty", "quantity"],
      minWidth: "min-w-[84px]",
    },
    {
      header: t("report.columns.totalAmount"),
      kind: "money",
      align: "right",
      keys: ["amount"],
      minWidth: "min-w-[126px]",
    },
    {
      header: t("report.columns.billDiscount"),
      kind: "money",
      align: "right",
      keys: ["discount_bill"],
      minWidth: "min-w-[118px]",
    },
    {
      header: t("report.columns.afterDiscount"),
      kind: "money",
      align: "right",
      keys: ["after_discount"],
      minWidth: "min-w-[128px]",
    },
    {
      header: t("report.columns.serviceCharge"),
      kind: "money",
      align: "right",
      keys: ["sum_servicecharge"],
      minWidth: "min-w-[130px]",
    },
    {
      header: t("report.columns.vat"),
      kind: "money",
      align: "right",
      keys: ["sum_vate"],
      minWidth: "min-w-[112px]",
    },
    {
      header: t("report.columns.netTotal"),
      kind: "money",
      align: "right",
      keys: ["sum_total"],
      minWidth: "min-w-[130px]",
    },
    {
      header: t("report.columns.paidCash"),
      kind: "money",
      align: "right",
      keys: ["paid_cash"],
      minWidth: "min-w-[132px]",
    },
    {
      header: t("report.columns.paidTransfer"),
      kind: "money",
      align: "right",
      keys: ["paid_transfer"],
      minWidth: "min-w-[132px]",
    },
    {
      header: t("report.columns.changeAmount"),
      kind: "money",
      align: "right",
      keys: ["change_amount", "change_total"],
      minWidth: "min-w-[124px]",
    },
    {
      header: t("report.columns.lastPaidAt"),
      kind: "date",
      keys: ["last_paid_at"],
      minWidth: "min-w-[148px]",
    },
  ];
}

export function reportDetailItemColumns(
  t: (key: string) => string,
): ReportColumn[] {
  return [
    {
      header: t("report.columns.productImage"),
      kind: "image",
      keys: reportImageKeys,
      minWidth: "min-w-[76px]",
    },
    {
      header: t("report.columns.productName"),
      kind: "product",
      keys: ["product_name", "prod_name", "prod_name_la", "prod_name_eng"],
      minWidth: "min-w-[260px]",
      wide: true,
    },
    {
      header: t("report.columns.salePrice"),
      kind: "money",
      align: "right",
      keys: [
        "sale_price",
        "price",
        "unit_price",
        "base_price",
        "pro_detail_sprice",
      ],
      minWidth: "min-w-[126px]",
    },
    {
      header: t("report.columns.toppingTotal"),
      kind: "money",
      align: "right",
      keys: ["topping_total", "topping_unit_total", "topping_line_total"],
      minWidth: "min-w-[126px]",
    },
    {
      header: t("report.columns.amount"),
      kind: "money",
      align: "right",
      keys: ["amount", "line_amount", "gross_amount"],
      minWidth: "min-w-[126px]",
    },
    {
      header: t("report.columns.quantity"),
      kind: "number",
      align: "right",
      keys: ["qty", "quantity", "order_it_qty"],
      minWidth: "min-w-[84px]",
    },
    {
      header: t("report.columns.itemDiscount"),
      kind: "money",
      align: "right",
      keys: [
        "discount",
        "item_discount",
        "item_discount_amount",
        "order_it_discount_amount",
      ],
      minWidth: "min-w-[128px]",
    },
    {
      header: t("report.columns.lineTotal"),
      kind: "money",
      align: "right",
      keys: ["total", "line_total", "net_total"],
      minWidth: "min-w-[128px]",
    },
  ];
}
