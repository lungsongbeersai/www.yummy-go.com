"use client";

import { useMemo } from "react";
import { HandPlatter, Landmark, ReceiptText, TicketPercent, TrendingUp, Wallet } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatReportSaleDate } from "@/features/report/shared/report-date-format";
import { ReportDetailOrdersTable, type DetailColumn } from "@/features/report/shared/report-detail-orders-table";
import { ReportStatCards } from "@/features/report/shared/report-stat-cards";
import { userInitials } from "@/features/settings/user/user-utils";
import { money } from "@/lib/format";
import type { CustomerSalesOrder, CustomerSalesRow } from "@/services/report";

// A customer's bills, full screen, in the shared report detail table (same features as the
// daily-sales table: sort, columns menu, selection, sticky totals, search, pagination).

function orderColumns(t: (key: string) => string): DetailColumn<CustomerSalesOrder>[] {
  const c = (key: string) => t(`report.customerSales.columns.${key}`);
  return [
    {
      key: "saleDate",
      kind: "date",
      label: c("saleDate"),
      minWidth: "min-w-[104px]",
      sortValue: (order) => order.sale_date_time || order.sale_date,
      value: (order) => formatReportSaleDate(order.sale_date_time || order.sale_date),
    },
    { hideable: false, key: "invoice", kind: "text", label: c("invoice"), minWidth: "min-w-[112px]", value: (order) => order.order_invoice },
    { key: "qty", kind: "number", label: c("qty"), minWidth: "min-w-[64px]", value: (order) => order.total_qty },
    { key: "gross", kind: "money", label: t("report.columns.totalAmount"), minWidth: "min-w-[96px]", value: (order) => order.gross_amount },
    { key: "itemDiscount", kind: "money", label: t("report.columns.itemDiscount"), minWidth: "min-w-[96px]", tone: "discount", value: (order) => order.item_discount_amount },
    { key: "billDiscount", kind: "money", label: c("discountBill"), minWidth: "min-w-[96px]", tone: "discount", value: (order) => order.discount_bill },
    { key: "discount", kind: "money", label: c("discount"), minWidth: "min-w-[96px]", tone: "discount", value: (order) => order.discount_amount },
    { key: "netSale", kind: "money", label: c("netSale"), minWidth: "min-w-[96px]", value: (order) => order.net_sale },
    { key: "serviceCharge", kind: "money", label: c("serviceCharge"), minWidth: "min-w-[96px]", tone: "service", value: (order) => order.service_charge },
    { key: "vat", kind: "money", label: c("vat"), minWidth: "min-w-[96px]", tone: "vat", value: (order) => order.vat },
    { hideable: false, key: "grandTotal", kind: "money", label: c("grandTotal"), minWidth: "min-w-[96px]", tone: "total", value: (order) => order.grand_total },
  ];
}

function orderId(order: CustomerSalesOrder) {
  return order.order_uuid;
}

function orderSearchText(order: CustomerSalesOrder) {
  return order.order_invoice;
}

export function CustomerSalesDetailDialog({
  row,
  onOpenChange,
}: {
  row: CustomerSalesRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={Boolean(row)} onOpenChange={onOpenChange}>
      {/* Full screen: the base dialog centres a small box; this pins it to the whole viewport. */}
      <DialogContent className="top-0 left-0 flex h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none p-0 ring-0 sm:max-w-none">
        {/* Keyed by customer: search, sort, page and selection start fresh for each one. */}
        {row ? <CustomerOrdersView key={row.customer_uuid} row={row} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function CustomerOrdersView({ row }: { row: CustomerSalesRow }) {
  const { t } = useTranslation();
  const columns = useMemo(() => orderColumns(t), [t]);

  return (
    <>
      <DialogHeader className="shrink-0 flex-row items-center gap-3 border-b border-border px-4 py-3 pr-12 text-left sm:px-6">
        <Avatar className="size-11">
          <AvatarFallback>{userInitials(row.customer_name || row.member_code || "-")}</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-col gap-0.5">
          <DialogTitle className="truncate text-base font-semibold" translate="no">
            {row.customer_name || "-"}
          </DialogTitle>
          <DialogDescription className="truncate" translate="no">
            {[row.member_code, row.customer_phone].filter(Boolean).join(" · ")}
          </DialogDescription>
        </div>
      </DialogHeader>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 sm:px-6 lg:overflow-hidden">
        <ReportDetailOrdersTable
          columns={columns}
          countLabel={t("report.customerSales.columns.billCount")}
          getRowId={orderId}
          reportId="customer-sales-detail"
          rows={row.details}
          searchPlaceholder={t("report.customerSales.searchPlaceholder")}
          searchText={orderSearchText}
          summaryId="customer-sales-detail-summary"
          title={t("report.customerSales.orders")}
          totalsKey="grandTotal"
          summary={
            <ReportStatCards
              className="sm:grid-cols-3 xl:grid-cols-6"
              stats={[
                { icon: TrendingUp, key: "grand_total", label: t("report.customerSales.columns.grandTotal"), tone: "highlight", value: money(row.summary.grand_total) },
                { icon: ReceiptText, key: "bills", label: t("report.customerSales.columns.billCount"), tone: "info", value: row.summary.bill_count.toLocaleString("en-US") },
                { icon: Wallet, key: "net_sale", label: t("report.customerSales.columns.netSale"), tone: "success", value: money(row.summary.net_sale) },
                { icon: TicketPercent, key: "discount_bill", label: t("report.customerSales.columns.discountBill"), negative: row.summary.discount_bill > 0, tone: "danger", value: money(row.summary.discount_bill) },
                { icon: HandPlatter, key: "service_charge", label: t("report.customerSales.columns.serviceCharge"), tone: "primary", value: money(row.summary.service_charge) },
                { icon: Landmark, key: "vat", label: t("report.customerSales.columns.vat"), tone: "warning", value: money(row.summary.vat) },
              ]}
            />
          }
        />
      </div>
    </>
  );
}
