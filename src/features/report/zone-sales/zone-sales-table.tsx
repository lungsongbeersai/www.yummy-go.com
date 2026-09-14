"use client";

import { useTranslation } from "react-i18next";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { money } from "@/lib/format";
import type { ZoneSalesRow, ZoneSalesSummary } from "@/services/report";
import { zoneOptionLabel } from "./zone-sales-utils";

export function ZoneSalesTable({
  rows,
  summary,
  language,
}: {
  rows: ZoneSalesRow[];
  summary: ZoneSalesSummary;
  language: string;
}) {
  const { t } = useTranslation();

  return (
    <div className="hidden shrink-0 overflow-hidden rounded-lg border bg-card md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("report.zoneSales.zone")}</TableHead>
            <TableHead className="text-right">{t("report.zoneSales.columns.billCount")}</TableHead>
            <TableHead className="text-right">{t("report.zoneSales.columns.customerCount")}</TableHead>
            <TableHead className="text-right">{t("report.zoneSales.columns.discount")}</TableHead>
            <TableHead className="text-right">{t("report.zoneSales.columns.netSale")}</TableHead>
            <TableHead className="text-right">{t("report.zoneSales.columns.serviceCharge")}</TableHead>
            <TableHead className="text-right">{t("report.zoneSales.columns.vat")}</TableHead>
            <TableHead className="text-right">{t("report.zoneSales.columns.grandTotal")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(row => (
            <TableRow key={row.zone_uuid}>
              <TableCell className="font-medium">{zoneOptionLabel(row, language)}</TableCell>
              <TableCell className="text-right tabular-nums">{row.bill_count}</TableCell>
              <TableCell className="text-right tabular-nums">{row.customer_count}</TableCell>
              <TableCell className="text-right tabular-nums">{money(row.discount_amount)}</TableCell>
              <TableCell className="text-right tabular-nums">{money(row.net_sale)}</TableCell>
              <TableCell className="text-right tabular-nums">{money(row.service_charge)}</TableCell>
              <TableCell className="text-right tabular-nums">{money(row.vat)}</TableCell>
              <TableCell className="text-right font-medium tabular-nums">{money(row.grand_total)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell className="font-semibold">{t("common.total")}</TableCell>
            <TableCell className="text-right font-semibold tabular-nums">{summary.bill_count}</TableCell>
            <TableCell className="text-right font-semibold tabular-nums">{summary.customer_count}</TableCell>
            <TableCell className="text-right font-semibold tabular-nums">{money(summary.discount_amount)}</TableCell>
            <TableCell className="text-right font-semibold tabular-nums">{money(summary.net_sale)}</TableCell>
            <TableCell className="text-right font-semibold tabular-nums">{money(summary.service_charge)}</TableCell>
            <TableCell className="text-right font-semibold tabular-nums">{money(summary.vat)}</TableCell>
            <TableCell className="text-right font-semibold tabular-nums">{money(summary.grand_total)}</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}

export function ZoneSalesRowCard({
  rows,
  language,
}: {
  rows: ZoneSalesRow[];
  language: string;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-2 md:hidden">
      {rows.map(row => (
        <div key={row.zone_uuid} className="min-h-10 rounded-lg border bg-card px-4 py-3">
          <p className="truncate font-medium">{zoneOptionLabel(row, language)}</p>
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
            <p className="text-muted-foreground">{t("report.zoneSales.columns.billCount")}: <span className="text-foreground">{row.bill_count}</span></p>
            <p className="text-muted-foreground">{t("report.zoneSales.columns.customerCount")}: <span className="text-foreground">{row.customer_count}</span></p>
            <p className="text-muted-foreground">{t("report.zoneSales.columns.netSale")}: <span className="text-foreground">{money(row.net_sale)}</span></p>
            <p className="col-span-2 font-medium">{t("report.zoneSales.columns.grandTotal")}: {money(row.grand_total)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
