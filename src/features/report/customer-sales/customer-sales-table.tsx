"use client";

import { useTranslation } from "react-i18next";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { money } from "@/lib/format";
import type { CustomerSalesRow } from "@/services/report";

export function CustomerSalesTable({
  rows,
  onSelect,
}: {
  rows: CustomerSalesRow[];
  onSelect: (customerUuid: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="hidden shrink-0 overflow-hidden rounded-lg border bg-card md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("report.customerSales.customer")}</TableHead>
            <TableHead className="text-right">{t("report.customerSales.columns.billCount")}</TableHead>
            <TableHead className="text-right">{t("report.customerSales.columns.netSale")}</TableHead>
            <TableHead className="text-right">{t("report.customerSales.columns.serviceCharge")}</TableHead>
            <TableHead className="text-right">{t("report.customerSales.columns.vat")}</TableHead>
            <TableHead className="text-right">{t("report.customerSales.columns.grandTotal")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(row => (
            <TableRow
              key={row.customer_uuid}
              role="button"
              tabIndex={0}
              className="cursor-pointer hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset"
              onClick={() => onSelect(row.customer_uuid)}
              onKeyDown={event => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                onSelect(row.customer_uuid);
              }}
            >
              <TableCell>
                <p className="truncate font-medium" translate="no">{row.customer_name || "-"}</p>
                <p className="truncate text-xs text-muted-foreground">{row.member_code} · {row.customer_phone}</p>
              </TableCell>
              <TableCell className="text-right tabular-nums">{row.summary.bill_count}</TableCell>
              <TableCell className="text-right tabular-nums">{money(row.summary.net_sale)}</TableCell>
              <TableCell className="text-right tabular-nums">{money(row.summary.service_charge)}</TableCell>
              <TableCell className="text-right tabular-nums">{money(row.summary.vat)}</TableCell>
              <TableCell className="text-right font-medium tabular-nums">{money(row.summary.grand_total)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function CustomerSalesRowCard({
  rows,
  onSelect,
}: {
  rows: CustomerSalesRow[];
  onSelect: (customerUuid: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-2 md:hidden">
      {rows.map(row => (
        <div
          key={row.customer_uuid}
          role="button"
          tabIndex={0}
          className="min-h-10 rounded-lg border bg-card px-4 py-3 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          onClick={() => onSelect(row.customer_uuid)}
          onKeyDown={event => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            onSelect(row.customer_uuid);
          }}
        >
          <p className="truncate font-medium" translate="no">{row.customer_name || "-"}</p>
          <p className="truncate text-sm text-muted-foreground">{row.member_code} · {row.customer_phone}</p>
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
            <p className="text-muted-foreground">{t("report.customerSales.columns.billCount")}: <span className="text-foreground">{row.summary.bill_count}</span></p>
            <p className="text-muted-foreground">{t("report.customerSales.columns.netSale")}: <span className="text-foreground">{money(row.summary.net_sale)}</span></p>
            <p className="col-span-2 font-medium">{t("report.customerSales.columns.grandTotal")}: {money(row.summary.grand_total)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
