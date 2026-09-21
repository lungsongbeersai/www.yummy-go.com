"use client";

import { useTranslation } from "react-i18next";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatShortDate, money } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ReportIndeterminateCheckbox, selectionStateForVisibleIds } from "@/features/report/shared/report-row-selection";
import type { VatReportRow } from "@/services/report";

export function VatReportTable({
  rows,
  language,
  selectedRowIds,
  onToggleRow,
  onToggleRows,
}: {
  rows: VatReportRow[];
  language: string;
  selectedRowIds: Set<string>;
  onToggleRow: (row: VatReportRow, selected: boolean) => void;
  onToggleRows: (rows: VatReportRow[], selected: boolean) => void;
}) {
  const { t } = useTranslation();
  const { allVisibleSelected, someVisibleSelected } = selectionStateForVisibleIds(
    rows.map(row => row.order_uuid),
    selectedRowIds,
  );

  return (
    <div className="hidden shrink-0 overflow-hidden rounded-lg border bg-card md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10 text-center">
              <ReportIndeterminateCheckbox
                aria-label={t("common.selectAll")}
                checked={allVisibleSelected}
                indeterminate={!allVisibleSelected && someVisibleSelected}
                onCheckedChange={checked => onToggleRows(rows, checked as boolean)}
              />
            </TableHead>
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
            <TableRow
              key={row.order_uuid}
              className={cn(selectedRowIds.has(row.order_uuid) && "bg-primary/5 hover:bg-primary/10")}
            >
              <TableCell className="w-10 text-center">
                <Checkbox
                  aria-label={t("common.selectRow", { name: row.order_invoice })}
                  checked={selectedRowIds.has(row.order_uuid)}
                  onCheckedChange={checked => onToggleRow(row, checked as boolean)}
                />
              </TableCell>
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
  selectedRowIds,
  onToggleRow,
}: {
  rows: VatReportRow[];
  language: string;
  selectedRowIds: Set<string>;
  onToggleRow: (row: VatReportRow, selected: boolean) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-2 md:hidden">
      {rows.map(row => (
        <div
          key={row.order_uuid}
          className={cn(
            "min-h-10 rounded-lg border bg-card px-4 py-3",
            selectedRowIds.has(row.order_uuid) && "bg-primary/5",
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Checkbox
                aria-label={t("common.selectRow", { name: row.order_invoice })}
                checked={selectedRowIds.has(row.order_uuid)}
                onCheckedChange={checked => onToggleRow(row, checked as boolean)}
              />
              <span className="font-medium">{row.order_invoice}</span>
            </div>
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
