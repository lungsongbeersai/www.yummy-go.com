"use client";

import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatShortDate, money } from "@/lib/format";
import type { CustomerSalesRow } from "@/services/report";

export function CustomerSalesDetailDialog({
  row,
  language,
  onOpenChange,
}: {
  row: CustomerSalesRow | null;
  language: string;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();

  return (
    <Dialog open={Boolean(row)} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="shrink-0 border-b border-border px-6 py-4 pr-12 text-left">
          <DialogTitle className="truncate" translate="no">{row?.customer_name || "-"}</DialogTitle>
          {row && <DialogDescription>{row.member_code} · {row.customer_phone}</DialogDescription>}
        </DialogHeader>
        {row && (
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <div className="flex flex-col gap-4">
              <div>
                <h3 className="mb-2 text-sm font-medium">{t("report.summary")}</h3>
                <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                  <div><dt className="text-muted-foreground">{t("report.customerSales.columns.billCount")}</dt><dd className="tabular-nums">{row.summary.bill_count}</dd></div>
                  <div><dt className="text-muted-foreground">{t("report.customerSales.columns.netSale")}</dt><dd className="tabular-nums">{money(row.summary.net_sale)}</dd></div>
                  <div><dt className="text-muted-foreground">{t("report.customerSales.columns.serviceCharge")}</dt><dd className="tabular-nums">{money(row.summary.service_charge)}</dd></div>
                  <div><dt className="text-muted-foreground">{t("report.customerSales.columns.vat")}</dt><dd className="tabular-nums">{money(row.summary.vat)}</dd></div>
                  <div><dt className="text-muted-foreground">{t("report.customerSales.columns.discountBill")}</dt><dd className="tabular-nums">{money(row.summary.discount_bill)}</dd></div>
                  <div><dt className="text-muted-foreground">{t("report.customerSales.columns.grandTotal")}</dt><dd className="font-medium tabular-nums">{money(row.summary.grand_total)}</dd></div>
                </dl>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-medium">{t("report.customerSales.orders")}</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("report.customerSales.columns.saleDate")}</TableHead>
                      <TableHead>{t("report.customerSales.columns.invoice")}</TableHead>
                      <TableHead className="text-right">{t("report.customerSales.columns.qty")}</TableHead>
                      <TableHead className="text-right">{t("report.customerSales.columns.discount")}</TableHead>
                      <TableHead className="text-right">{t("report.customerSales.columns.netSale")}</TableHead>
                      <TableHead className="text-right">{t("report.customerSales.columns.serviceCharge")}</TableHead>
                      <TableHead className="text-right">{t("report.customerSales.columns.vat")}</TableHead>
                      <TableHead className="text-right">{t("report.customerSales.columns.grandTotal")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {row.details.map(order => (
                      <TableRow key={order.order_uuid}>
                        <TableCell className="whitespace-nowrap tabular-nums">{formatShortDate(order.sale_date, language)}</TableCell>
                        <TableCell className="font-medium">{order.order_invoice}</TableCell>
                        <TableCell className="text-right tabular-nums">{order.total_qty}</TableCell>
                        <TableCell className="text-right tabular-nums">{money(order.discount_amount)}</TableCell>
                        <TableCell className="text-right tabular-nums">{money(order.net_sale)}</TableCell>
                        <TableCell className="text-right tabular-nums">{money(order.service_charge)}</TableCell>
                        <TableCell className="text-right tabular-nums">{money(order.vat)}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">{money(order.grand_total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
