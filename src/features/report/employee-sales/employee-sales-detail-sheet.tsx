"use client";

import { useCallback, useMemo } from "react";
import {
  ArrowLeftRight,
  Banknote,
  HandCoins,
  HandPlatter,
  Landmark,
  Package,
  ReceiptText,
  TrendingUp,
  TriangleAlert,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatReportSaleDate } from "@/features/report/shared/report-date-format";
import { ReportDetailOrdersTable, type DetailColumn } from "@/features/report/shared/report-detail-orders-table";
import { ReportStatCards } from "@/features/report/shared/report-stat-cards";
import { userInitials } from "@/features/settings/user/user-utils";
import { cn } from "@/lib/utils";
import { money } from "@/lib/format";
import type { EmployeeSalesGroupItem, EmployeeSalesOrder, EmployeeSalesRow } from "@/services/report";

// An employee's bills, full screen, in the shared report detail table (the daily-sales table's
// features: sort, columns menu, selection, sticky totals, search, pagination). A bill expands to
// what it contained, per product group, as the daily-sales bills do.

interface OrderGroupBreakdown {
  groupName: string;
  groupUuid: string;
  items: EmployeeSalesGroupItem[];
  totalAmount: number;
  totalQty: number;
}

// group.items แต่ละตัวมี order_uuid ติดมาอยู่แล้ว — จัดกลับเป็นรายบิล เพื่อแสดงใต้บิลของมันโดยตรง
function groupBreakdownsByOrder(groups: EmployeeSalesRow["groups"]) {
  const byOrder = new Map<string, Map<string, OrderGroupBreakdown>>();

  for (const group of groups) {
    for (const item of group.items) {
      const orderBreakdowns = byOrder.get(item.order_uuid) ?? new Map<string, OrderGroupBreakdown>();
      byOrder.set(item.order_uuid, orderBreakdowns);

      const breakdown = orderBreakdowns.get(group.group_uuid) ?? {
        groupName: group.group_name,
        groupUuid: group.group_uuid,
        items: [],
        totalAmount: 0,
        totalQty: 0,
      };
      breakdown.items.push(item);
      breakdown.totalQty += item.total_qty;
      breakdown.totalAmount += item.total_amount;
      orderBreakdowns.set(group.group_uuid, breakdown);
    }
  }

  return byOrder;
}

function orderColumns(
  t: (key: string) => string,
  channelName: (channel: number) => string,
): DetailColumn<EmployeeSalesOrder>[] {
  const e = (key: string) => t(`employeeSales.${key}`);
  return [
    {
      key: "saleDate",
      kind: "date",
      label: e("saleDate"),
      minWidth: "min-w-[104px]",
      sortValue: (order) => order.sale_date_time || order.sale_date,
      value: (order) => formatReportSaleDate(order.sale_date_time || order.sale_date),
    },
    { hideable: false, key: "invoice", kind: "text", label: e("invoice"), minWidth: "min-w-[112px]", value: (order) => order.order_invoice },
    { key: "channel", kind: "text", label: e("orderChannels"), minWidth: "min-w-[96px]", value: (order) => channelName(order.order_channel) },
    { key: "qty", kind: "number", label: e("totalQty"), minWidth: "min-w-[64px]", value: (order) => order.total_qty },
    { key: "gross", kind: "money", label: e("totalAmount"), minWidth: "min-w-[96px]", value: (order) => order.gross_amount },
    { key: "itemDiscount", kind: "money", label: t("report.columns.itemDiscount"), minWidth: "min-w-[96px]", tone: "discount", value: (order) => order.item_discount_amount },
    { key: "billDiscount", kind: "money", label: t("report.columns.billDiscount"), minWidth: "min-w-[96px]", tone: "discount", value: (order) => order.discount_bill },
    { key: "netSale", kind: "money", label: e("netSale"), minWidth: "min-w-[96px]", value: (order) => order.net_sale },
    { key: "serviceCharge", kind: "money", label: e("serviceCharge"), minWidth: "min-w-[96px]", tone: "service", value: (order) => order.service_charge },
    { key: "vat", kind: "money", label: e("vat"), minWidth: "min-w-[96px]", tone: "vat", value: (order) => order.vat },
    { key: "cash", kind: "money", label: e("cash"), minWidth: "min-w-[96px]", tone: "success", value: (order) => order.cash },
    { key: "transfer", kind: "money", label: e("transfer"), minWidth: "min-w-[96px]", tone: "service", value: (order) => order.transfer },
    { key: "credit", kind: "money", label: e("credit"), minWidth: "min-w-[96px]", tone: "pending", value: (order) => order.credit },
    { hideable: false, key: "grandTotal", kind: "money", label: e("grandTotal"), minWidth: "min-w-[96px]", tone: "total", value: (order) => order.grand_total },
  ];
}

function orderId(order: EmployeeSalesOrder) {
  return order.order_uuid;
}

function orderSearchText(order: EmployeeSalesOrder) {
  return order.order_invoice;
}

// ชิปข้อเท็จจริงบรรทัดเดียว — วิธีชำระ/ช่องทางของพนักงานคนนี้ ใต้การ์ดสรุป
function SummaryChip({
  Icon,
  iconClass,
  label,
  value,
}: {
  Icon: LucideIcon;
  iconClass?: string;
  label: string;
  value: string;
}) {
  return (
    <span
      className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-1 text-xs leading-5 text-muted-foreground"
      title={`${label}: ${value}`}
    >
      <Icon className={cn("size-3.5 shrink-0", iconClass)} aria-hidden />
      <span className="min-w-0 truncate">
        <span>{label}: </span>
        <span className="font-medium text-foreground">{value}</span>
      </span>
    </span>
  );
}

export function EmployeeSalesDetailSheet({
  row,
  onOpenChange,
}: {
  row: EmployeeSalesRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={Boolean(row)} onOpenChange={onOpenChange}>
      {/* Full screen: the base dialog centres a small box; this pins it to the whole viewport. */}
      <DialogContent className="top-0 left-0 flex h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none p-0 ring-0 sm:max-w-none">
        {/* Keyed by employee: search, sort, page, selection and expanded bills start fresh. */}
        {row ? <EmployeeOrdersView key={row.login_uuid} row={row} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function EmployeeOrdersView({ row }: { row: EmployeeSalesRow }) {
  const { t } = useTranslation();
  const breakdownsByOrder = useMemo(() => groupBreakdownsByOrder(row.groups), [row.groups]);
  const channelNames = useMemo(
    () => new Map(row.order_channels.map((channel) => [channel.order_channel, channel.order_channel_name])),
    [row.order_channels],
  );
  const channelName = useCallback((channel: number) => channelNames.get(channel) ?? "-", [channelNames]);
  const columns = useMemo(() => orderColumns(t, channelName), [channelName, t]);

  const methodChips = [
    { Icon: Banknote, iconClass: "text-success", label: t("employeeSales.cash"), value: row.payment_summary.cash },
    { Icon: ArrowLeftRight, iconClass: "text-info", label: t("employeeSales.transfer"), value: row.payment_summary.transfer },
    { Icon: HandCoins, iconClass: "text-pending", label: t("employeeSales.credit"), value: row.payment_summary.credit },
  ].filter((chip) => chip.value > 0);
  const activeChannels = row.order_channels.filter((channel) => channel.bill_count > 0);

  const renderExpanded = useCallback(
    (order: EmployeeSalesOrder) => (
      <OrderItems breakdowns={Array.from(breakdownsByOrder.get(order.order_uuid)?.values() ?? [])} />
    ),
    [breakdownsByOrder],
  );

  return (
    <>
      <DialogHeader className="shrink-0 flex-row items-center gap-3 border-b border-border px-4 py-3 pr-12 text-left sm:px-6">
        <Avatar className="size-11">
          {row.login_profile ? <AvatarImage alt="" src={row.login_profile} /> : null}
          <AvatarFallback>{userInitials(row.login_email)}</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-col gap-0.5">
          <DialogTitle className="truncate text-base font-semibold" translate="no">
            {row.login_email}
          </DialogTitle>
          <DialogDescription className="truncate">
            {[row.roles_name, row.branch_name].filter(Boolean).join(" · ")}
          </DialogDescription>
        </div>
      </DialogHeader>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 sm:px-6 lg:overflow-hidden">
        <ReportDetailOrdersTable
          columns={columns}
          countLabel={t("employeeSales.billCount")}
          getRowId={orderId}
          renderExpanded={renderExpanded}
          reportId="employee-sales-detail"
          rows={row.orders}
          searchPlaceholder={t("report.customerSales.searchPlaceholder")}
          searchText={orderSearchText}
          summaryId="employee-sales-detail-summary"
          title={t("employeeSales.orders")}
          totalsKey="grandTotal"
          summary={
            <div className="flex flex-col gap-3">
              <ReportStatCards
                className="sm:grid-cols-3 xl:grid-cols-6"
                stats={[
                  { icon: TrendingUp, key: "grand_total", label: t("employeeSales.grandTotal"), tone: "highlight", value: money(row.summary.grand_total) },
                  { icon: ReceiptText, key: "bills", label: t("employeeSales.billCount"), tone: "info", value: row.summary.bill_count.toLocaleString("en-US") },
                  { icon: Package, key: "qty", label: t("employeeSales.totalQty"), tone: "info", value: row.summary.total_qty.toLocaleString("en-US") },
                  { icon: Wallet, key: "net_sale", label: t("employeeSales.netSale"), tone: "success", value: money(row.summary.net_sale) },
                  { icon: HandPlatter, key: "service_charge", label: t("employeeSales.serviceCharge"), tone: "primary", value: money(row.summary.service_charge) },
                  { icon: Landmark, key: "vat", label: t("employeeSales.vat"), tone: "warning", value: money(row.summary.vat) },
                ]}
              />
              {/* How this employee's sales were paid and ordered; zero lines say nothing, so they are left out. */}
              {methodChips.length || activeChannels.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {methodChips.map((chip) => (
                    <SummaryChip key={chip.label} Icon={chip.Icon} iconClass={chip.iconClass} label={chip.label} value={money(chip.value)} />
                  ))}
                  {activeChannels.map((channel) => (
                    <SummaryChip
                      key={channel.order_channel}
                      Icon={Package}
                      label={channel.order_channel_name}
                      value={`${channel.bill_count} · ${money(channel.grand_total)}`}
                    />
                  ))}
                </div>
              ) : null}
              {row.cancel_summary.cancel_bill_count > 0 ? (
                <div className="flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 px-2.5 py-1.5 text-xs">
                  <TriangleAlert className="size-3.5 shrink-0 text-warning-text" aria-hidden />
                  <span className="min-w-0 font-medium text-warning-text">
                    {t("employeeSales.cancelSummaryDescription", {
                      count: row.cancel_summary.cancel_bill_count,
                      amount: money(row.cancel_summary.cancel_total_amount),
                    })}
                  </span>
                </div>
              ) : null}
            </div>
          }
        />
      </div>
    </>
  );
}

// What a bill contained, per product group — the expanded part of a bill row.
function OrderItems({ breakdowns }: { breakdowns: OrderGroupBreakdown[] }) {
  const { t } = useTranslation();

  if (!breakdowns.length) {
    return <p className="px-4 py-3 text-xs text-muted-foreground">{t("common.noData")}</p>;
  }

  return (
    <div className="flex flex-col gap-2 px-4 py-3 sm:pl-24">
      {breakdowns.map((breakdown) => (
        <div key={breakdown.groupUuid} className="max-w-3xl overflow-hidden rounded-md border border-border bg-background">
          <div className="flex items-center justify-between gap-2 bg-muted/40 px-3 py-1.5 text-xs font-semibold">
            <span className="min-w-0 truncate">{breakdown.groupName}</span>
            <span className="flex shrink-0 items-center gap-2 tabular-nums text-muted-foreground">
              <span className="flex items-center gap-1">
                <Package className="size-3.5" aria-hidden />
                {breakdown.totalQty}
              </span>
              <span className="text-foreground">{money(breakdown.totalAmount)}</span>
            </span>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("employeeSales.productName")}</TableHead>
                <TableHead className="text-right">{t("employeeSales.unitPrice")}</TableHead>
                <TableHead className="text-right">{t("employeeSales.totalQty")}</TableHead>
                <TableHead className="text-right">{t("employeeSales.totalAmount")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {breakdown.items.map((item, itemIndex) => (
                <TableRow key={`${item.prod_uuid}-${itemIndex}`}>
                  <TableCell className="font-medium">{item.product_full_name}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{money(item.unit_price)}</TableCell>
                  <TableCell className="text-right tabular-nums">{item.total_qty}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{money(item.total_amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ))}
    </div>
  );
}
