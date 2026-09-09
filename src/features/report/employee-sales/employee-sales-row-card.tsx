"use client";

import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { userInitials } from "@/features/settings/user/user-utils";
import { money } from "@/lib/format";
import type { EmployeeSalesRow } from "@/services/report";

export function EmployeeSalesRowCard({
  rows,
  onSelect,
}: {
  rows: EmployeeSalesRow[];
  onSelect: (loginUuid: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-2 md:hidden">
      {rows.map(row => (
        <Card
          key={row.login_uuid}
          role="button"
          tabIndex={0}
          className="min-h-10 gap-2 px-4 py-3 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          onClick={() => onSelect(row.login_uuid)}
          onKeyDown={event => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            onSelect(row.login_uuid);
          }}
        >
          <div className="flex min-w-0 items-center gap-3">
            <Avatar>
              {row.login_profile ? <AvatarImage alt={row.login_email} src={row.login_profile} /> : null}
              <AvatarFallback>{userInitials(row.login_email)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium" translate="no">{row.login_email}</p>
              <p className="truncate text-sm text-muted-foreground">{row.roles_name}</p>
            </div>
            {row.cancel_summary.cancel_bill_count > 0 && (
              <Badge variant="outline" className="shrink-0 border-warning/25 bg-warning/10 text-warning">
                {t("employeeSales.cancelledBadge", { count: row.cancel_summary.cancel_bill_count })}
              </Badge>
            )}
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
            <p className="text-muted-foreground">{t("employeeSales.billCount")}: <span className="text-foreground">{row.summary.bill_count}</span></p>
            <p className="text-muted-foreground">{t("employeeSales.totalQty")}: <span className="text-foreground">{row.summary.total_qty}</span></p>
            <p className="text-muted-foreground">{t("employeeSales.netSale")}: <span className="text-foreground">{money(row.summary.net_sale)}</span></p>
            <p className="font-medium">{t("employeeSales.grandTotal")}: {money(row.summary.grand_total)}</p>
          </div>
        </Card>
      ))}
    </div>
  );
}
