import type { DailySalesReportType } from "@/services/report";
import type {
  ReportColumn,
  SummaryCardConfig,
} from "./daily-sales-report-types";
import { reportImageKeys } from "./daily-sales-report-utils";

export function summaryConfigs(
  t: (key: string) => string,
  typePage: DailySalesReportType,
): SummaryCardConfig[] {
  if (typePage === "detail") {
    return [
      {
        label: t("report.cards.billsCount"),
        kind: "number",
        keys: ["bills_count", "bill_count", "total_bills", "orders_count"],
      },
      {
        label: t("report.cards.orderTotal"),
        kind: "money",
        keys: [
          "amount",
          "order_total",
          "total_order",
          "gross_total",
          "sum_order_total",
        ],
      },
      {
        label: t("report.cards.toppingTotal"),
        kind: "money",
        keys: ["topping_total", "topping_line_total", "sum_topping_total"],
      },
      {
        label: t("report.cards.discountAmount"),
        kind: "money",
        keys: [
          "discount_bill",
          "discount_amount",
          "discount_total",
          "order_discount_amount",
          "sum_discount_total",
        ],
      },
      {
        label: t("report.cards.itemDiscountAmount"),
        kind: "money",
        keys: [
          "item_discount",
          "item_discount_amount",
          "order_item_discount_amount",
        ],
      },
      {
        label: t("report.cards.serviceCharge"),
        kind: "money",
        keys: [
          "service_charge",
          "service_charge_amount",
          "service_total",
          "sum_service_total",
        ],
      },
      {
        label: t("report.cards.vatAmount"),
        kind: "money",
        keys: [
          "vat",
          "vat_amount",
          "vat_total",
          "order_vat_amount",
          "sum_vat_total",
        ],
      },
      {
        label: t("report.cards.netTotal"),
        kind: "money",
        keys: [
          "total",
          "net_total",
          "grand_total",
          "order_grand_total",
          "sum_grand_total",
        ],
      },
      {
        label: t("report.cards.receiveCash"),
        kind: "money",
        keys: ["receive_cash", "cash_received", "cash_amount", "cash_total"],
      },
      {
        label: t("report.cards.receiveTransfer"),
        kind: "money",
        keys: [
          "receive_transfer",
          "transfer_received",
          "transfer_amount",
          "transfer_total",
        ],
      },
      {
        label: t("report.cards.debtAmount"),
        kind: "money",
        keys: ["debt_amount", "debt_total", "balance_total"],
      },
      {
        label: t("report.cards.changeAmount"),
        kind: "money",
        keys: ["change_amount", "change_total"],
      },
      {
        label: t("report.cards.cancelledCount"),
        kind: "number",
        keys: ["cancelled_count", "cancel_count", "cancelled_bills_count"],
      },
      {
        label: t("report.cards.activeCount"),
        kind: "number",
        keys: ["active_count", "active_bills_count"],
      },
    ];
  }

  return [
    {
      label: t("report.cards.billsCount"),
      kind: "number",
      keys: ["bills_count", "bill_count", "total_bills", "orders_count"],
    },
    {
      label: t("report.cards.orderTotal"),
      kind: "money",
      keys: ["order_total", "total_order", "gross_total", "sum_order_total"],
    },
    {
      label: t("report.cards.discountAmount"),
      kind: "money",
      keys: [
        "discount_amount",
        "discount_total",
        "order_discount_amount",
        "sum_discount_total",
      ],
    },
    {
      label: t("report.cards.serviceCharge"),
      kind: "money",
      keys: [
        "service_charge",
        "service_charge_amount",
        "service_total",
        "sum_service_total",
      ],
    },
    {
      label: t("report.cards.vatAmount"),
      kind: "money",
      keys: ["vat_amount", "vat_total", "order_vat_amount", "sum_vat_total"],
    },
    {
      label: t("report.cards.netTotal"),
      kind: "money",
      keys: [
        "net_total",
        "grand_total",
        "order_grand_total",
        "sum_grand_total",
      ],
    },
    {
      label: t("report.cards.receiveCash"),
      kind: "money",
      keys: ["receive_cash", "cash_received", "cash_amount", "cash_total"],
    },
    {
      label: t("report.cards.receiveTransfer"),
      kind: "money",
      keys: [
        "receive_transfer",
        "transfer_received",
        "transfer_amount",
        "transfer_total",
      ],
    },
    {
      label: t("report.cards.debtAmount"),
      kind: "money",
      keys: ["debt_amount", "debt_total", "balance_total"],
    },
    {
      label: t("report.cards.changeAmount"),
      kind: "money",
      keys: ["change_amount", "change_total"],
    },
    {
      label: t("report.cards.cancelledCount"),
      kind: "number",
      keys: ["cancelled_count", "cancel_count", "cancelled_bills_count"],
    },
    {
      label: t("report.cards.activeCount"),
      kind: "number",
      keys: ["active_count", "active_bills_count"],
    },
  ];
}

export function reportColumns(
  t: (key: string) => string,
  typePage: DailySalesReportType,
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
        header: t("report.columns.cashierName"),
        keys: ["cashier_name", "login_name", "user_name"],
        minWidth: "min-w-[132px]",
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
      keys: ["invoice_number", "invoice_no", "invoice", "order_invoice"],
      minWidth: "min-w-[132px]",
    },
    {
      header: t("report.columns.tableName"),
      keys: ["table_name", "table_name_la", "table_name_eng"],
      minWidth: "min-w-[84px]",
    },
    {
      header: t("report.columns.saleDate"),
      kind: "date",
      keys: ["sale_date", "business_date", "created_at", "order_date", "date"],
      minWidth: "min-w-[118px]",
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
      header: t("report.columns.orderTotal"),
      kind: "money",
      align: "right",
      keys: ["order_total", "total_order", "gross_total"],
      minWidth: "min-w-[126px]",
    },
    {
      header: t("report.columns.discount"),
      kind: "money",
      align: "right",
      keys: ["discount", "discount_amount", "discount_total"],
      minWidth: "min-w-[118px]",
    },
    {
      header: t("report.columns.serviceCharge"),
      kind: "money",
      align: "right",
      keys: ["service_charge", "service_charge_amount", "service_total"],
      minWidth: "min-w-[130px]",
    },
    {
      header: t("report.columns.vat"),
      kind: "money",
      align: "right",
      keys: ["vat", "vat_amount", "vat_total"],
      minWidth: "min-w-[112px]",
    },
    {
      header: t("report.columns.netTotal"),
      kind: "money",
      align: "right",
      keys: ["net_total", "grand_total", "order_grand_total"],
      minWidth: "min-w-[130px]",
    },
    {
      header: t("report.columns.cashReceived"),
      kind: "money",
      align: "right",
      keys: ["cash_received", "receive_cash", "cash_amount", "cash_total"],
      minWidth: "min-w-[132px]",
    },
    {
      header: t("report.columns.transferReceived"),
      kind: "money",
      align: "right",
      keys: [
        "transfer_received",
        "receive_transfer",
        "transfer_amount",
        "transfer_total",
      ],
      minWidth: "min-w-[132px]",
    },
    {
      header: t("report.columns.debtAmount"),
      kind: "money",
      align: "right",
      keys: ["debt_amount", "debt_total", "balance_total"],
      minWidth: "min-w-[124px]",
    },
    {
      header: t("report.columns.changeAmount"),
      kind: "money",
      align: "right",
      keys: ["change_amount", "change_total"],
      minWidth: "min-w-[124px]",
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
        "payment_status",
      ],
      minWidth: "min-w-[118px]",
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
      header: t("report.columns.price"),
      kind: "money",
      align: "right",
      keys: [
        "price",
        "sale_price",
        "unit_price",
        "base_price",
        "pro_detail_sprice",
      ],
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
      header: t("report.columns.toppingTotal"),
      kind: "money",
      align: "right",
      keys: ["topping_total", "topping_unit_total", "topping_line_total"],
      minWidth: "min-w-[126px]",
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
