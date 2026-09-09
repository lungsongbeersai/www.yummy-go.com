"use client";

import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { userInitials } from "@/features/settings/user/user-utils";
import { money } from "@/lib/format";
import type { EmployeeSalesRow } from "@/services/report";

export function EmployeeSalesTable({
  rows,
  onSelect,
}: {
  rows: EmployeeSalesRow[];
  onSelect: (loginUuid: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="hidden shrink-0 overflow-hidden rounded-lg border bg-card md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("employeeSales.employee")}</TableHead>
            <TableHead>{t("employeeSales.billCount")}</TableHead>
            <TableHead>{t("employeeSales.totalQty")}</TableHead>
            <TableHead>{t("employeeSales.netSale")}</TableHead>
            <TableHead>{t("employeeSales.serviceCharge")}</TableHead>
            <TableHead>{t("employeeSales.vat")}</TableHead>
            <TableHead>{t("employeeSales.grandTotal")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(row => (
            <TableRow
              key={row.login_uuid}
              role="button"
              tabIndex={0}
              className="cursor-pointer hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset"
              onClick={() => onSelect(row.login_uuid)}
              onKeyDown={event => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                onSelect(row.login_uuid);
              }}
            >
              <TableCell>
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar>
                    {row.login_profile ? <AvatarImage alt={row.login_email} src={row.login_profile} /> : null}
                    <AvatarFallback>{userInitials(row.login_email)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate font-medium" translate="no">{row.login_email}</p>
                    <p className="truncate text-muted-foreground">{row.roles_name}</p>
                  </div>
                  {row.cancel_summary.cancel_bill_count > 0 && (
                    <Badge variant="outline" className="border-warning/25 bg-warning/10 text-warning">
                      {t("employeeSales.cancelledBadge", { count: row.cancel_summary.cancel_bill_count })}
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className="tabular-nums">{row.summary.bill_count}</TableCell>
              <TableCell className="tabular-nums">{row.summary.total_qty}</TableCell>
              <TableCell className="tabular-nums">{money(row.summary.net_sale)}</TableCell>
              <TableCell className="tabular-nums">{money(row.summary.service_charge)}</TableCell>
              <TableCell className="tabular-nums">{money(row.summary.vat)}</TableCell>
              <TableCell className="font-medium tabular-nums">{money(row.summary.grand_total)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
