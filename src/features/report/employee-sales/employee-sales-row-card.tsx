"use client";

import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item";
import { Progress } from "@/components/ui/progress";
import { money } from "@/lib/format";
import type { EmployeeSalesRow } from "@/services/report";
import { EmployeeIdentity, employeeShare } from "./employee-sales-table";

// จอเล็ก: พนักงานละ 1 Item — ยอดรวมด้านขวา, บิล/จำนวนด้านล่าง, แถบสัดส่วนของยอดรวมทั้งสาขา
// แตะที่รายการเปิดรายละเอียด (ช่องติ๊กเลือกไว้สำหรับ export ไม่เปิดรายละเอียด)
export function EmployeeSalesRowCard({
  rows,
  selectedRowIds,
  total,
  onSelect,
  onToggleRow,
}: {
  rows: EmployeeSalesRow[];
  selectedRowIds: Set<string>;
  total: number;
  onSelect: (loginUuid: string) => void;
  onToggleRow: (row: EmployeeSalesRow, selected: boolean) => void;
}) {
  const { t } = useTranslation();

  return (
    <ItemGroup>
      {rows.map((row) => {
        const share = employeeShare(row, total);

        return (
          <Item
            key={row.login_uuid}
            variant="outline"
            role="button"
            tabIndex={0}
            className="cursor-pointer"
            onClick={() => onSelect(row.login_uuid)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              onSelect(row.login_uuid);
            }}
          >
            <div onClick={(event) => event.stopPropagation()}>
              <Checkbox
                aria-label={t("common.selectRow", { name: row.login_email })}
                checked={selectedRowIds.has(row.login_uuid)}
                onCheckedChange={(checked) => onToggleRow(row, checked as boolean)}
              />
            </div>
            <EmployeeIdentity row={row} />
            <ItemContent>
              <ItemTitle translate="no">{row.login_email}</ItemTitle>
              <ItemDescription>{row.roles_name}</ItemDescription>
            </ItemContent>
            <ItemActions>
              <span className="font-medium tabular-nums text-primary-text">{money(row.summary.grand_total)}</span>
            </ItemActions>
            <ItemFooter>
              <span className="text-muted-foreground">
                {t("employeeSales.billCount")} {row.summary.bill_count} · {t("employeeSales.totalQty")} {row.summary.total_qty}
              </span>
              {row.cancel_summary.cancel_bill_count > 0 ? (
                <Badge className="bg-destructive/10 text-destructive">
                  {t("employeeSales.cancelledBadge", { count: row.cancel_summary.cancel_bill_count })}
                </Badge>
              ) : null}
            </ItemFooter>
            {share !== null ? (
              <ItemFooter>
                <Progress value={share} aria-hidden="true" />
                <span className="shrink-0 tabular-nums text-muted-foreground">{share.toFixed(1)}%</span>
              </ItemFooter>
            ) : null}
          </Item>
        );
      })}
    </ItemGroup>
  );
}
