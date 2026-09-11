"use client";

import { useTranslation } from "react-i18next";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatShortDate, money } from "@/lib/format";
import type { VatReportRow } from "@/services/report";

export function VatReportTable({
  rows,
  language,
}: {
  rows: VatReportRow[];
  language: string;
}) {
  const { t } = useTranslation();

  return (
    <div className="hidden shrink-0 overflow-hidden rounded-lg border bg-card md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("report.vat.columns.saleDate")}</TableHead>
            <TableHead>{t("report.vat.columns.invoice")}</TableHead>
            <TableHead>{t("report.vat.columns.customer")}</TableHead>
            <TableHead className="text-right">{t("report.vat.columns.discount")}</TableHead>
            <TableHead className="text-right">{t("report.vat.columns.netSale")}</TableHead>
            <TableHead className="text-right">{t("report.vat.columns.serviceCharge")}</TableHead>
            <TableHead className="text-right">{t("report.vat.columns.vatRate")}</TableHead>
            <TableHead className="text-right">{t("report.vat.columns.vat")}</TableHead>
            <TableHead className="text-right">{t("report.vat.columns.grandTotal")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(row => (
            <TableRow key={row.order_uuid}>
              <TableCell className="whitespace-nowrap tabular-nums">{formatShortDate(row.sale_date, language)}</TableCell>
              <TableCell className="font-medium">{row.order_invoice}</TableCell>
              <TableCell className="max-w-48 truncate">{row.customer_name || "-"}</TableCell>
              <TableCell className="text-right tabular-nums">{money(row.discount_amount)}</TableCell>
              <TableCell className="text-right tabular-nums">{money(row.net_sale)}</TableCell>
              <TableCell className="text-right tabular-nums">{money(row.service_charge)}</TableCell>
              <TableCell className="text-right tabular-nums">{row.vat_rate}%</TableCell>
              <TableCell className="text-right tabular-nums">{money(row.vat)}</TableCell>
              <TableCell className="text-right font-medium tabular-nums">{money(row.grand_total)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function VatReportRowCard({
  rows,
  language,
}: {
  rows: VatReportRow[];
  language: string;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-2 md:hidden">
      {rows.map(row => (
        <div key={row.order_uuid} className="min-h-10 rounded-lg border bg-card px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">{row.order_invoice}</span>
            <span className="tabular-nums text-sm text-muted-foreground">{formatShortDate(row.sale_date, language)}</span>
          </div>
          <p className="truncate text-sm text-muted-foreground">{row.customer_name || "-"}</p>
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
            <p className="text-muted-foreground">{t("report.vat.columns.discount")}: <span className="text-foreground">{money(row.discount_amount)}</span></p>
            <p className="text-muted-foreground">{t("report.vat.columns.netSale")}: <span className="text-foreground">{money(row.net_sale)}</span></p>
            <p className="text-muted-foreground">{t("report.vat.columns.vatRate")}: <span className="text-foreground">{row.vat_rate}%</span></p>
            <p className="text-muted-foreground">{t("report.vat.columns.vat")}: <span className="text-foreground">{money(row.vat)}</span></p>
            <p className="col-span-2 font-medium">{t("report.vat.columns.grandTotal")}: {money(row.grand_total)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
