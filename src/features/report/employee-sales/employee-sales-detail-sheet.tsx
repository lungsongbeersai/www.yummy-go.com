"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowLeftRight,
  Banknote,
  Eye,
  EyeOff,
  HandCoins,
  Package,
  ReceiptText,
  TriangleAlert,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/common/empty-state";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { userInitials } from "@/features/settings/user/user-utils";
import { useResetOnChange } from "@/hooks/use-reset-on-change";
import { cn } from "@/lib/utils";
import { formatShortDate, money } from "@/lib/format";
import type { EmployeeSalesGroupItem, EmployeeSalesOrder, EmployeeSalesRow } from "@/services/report";

interface OrderGroupBreakdown {
  groupName: string;
  groupUuid: string;
  items: EmployeeSalesGroupItem[];
  totalAmount: number;
  totalQty: number;
}

// เดิม "ยอดขายตามหมวดสินค้า" แยกเป็น section ท้ายสุด ทำให้ต้องเลื่อนขึ้นลงเทียบกับบิลเอง
// ย้ายมาไว้ใต้บิลของมันโดยตรง (group.items แต่ละตัวมี order_uuid ติดมาอยู่แล้ว) — พับ/ขยายเป็นรายบิล
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

// การ์ดตัวเลขสรุป — โครงเดียวกับ PaymentMethodShareCard/ReportSummaryCardsGrid ให้เข้าชุดทั้งรายงาน
function StatTile({ emphasis, label, value }: { emphasis?: boolean; label: string; value: string }) {
  return (
    <div className={cn("min-w-0 rounded-md border border-border bg-card px-2.5 py-1.5", emphasis && "border-primary/30 bg-primary/5")}>
      <p className="truncate text-2xs font-medium leading-4 text-muted-foreground">{label}</p>
      <p className={cn("truncate text-sm font-semibold tabular-nums", emphasis ? "text-primary" : "text-foreground")}>
        {value}
      </p>
    </div>
  );
}

// ชิปข้อเท็จจริงบรรทัดเดียว — แพตเทิร์นเดียวกับ BillHeaderFact ใน sales-bill-detail.tsx
// วิธีชำระ/ช่องทางเดิมเป็นการ์ดกับแถวเต็มความกว้าง กินความสูงจนแผงบิลด้านล่างแทบไม่เหลือที่
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

// ตัวเลขระดับบิลในแผงรายละเอียด — service/vat ใช้สีเดียวกับรายงานอื่น (info/warning) เพื่อความสม่ำเสมอ
function OrderMetric({
  label,
  tone,
  value,
}: {
  label: string;
  tone?: "info" | "warning";
  value: string;
}) {
  return (
    <div className="min-w-0">
      <p className="truncate text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-0.5 truncate text-sm font-semibold tabular-nums",
          tone === "info" ? "text-info-text" : tone === "warning" ? "text-warning-text" : "text-foreground"
        )}
      >
        {value}
      </p>
    </div>
  );
}

const EMPLOYEE_SALES_DETAIL_SUMMARY_ID = "employee-sales-detail-summary";

type MobileView = "list" | "detail";

export function EmployeeSalesDetailSheet({
  row,
  language,
  onOpenChange,
}: {
  row: EmployeeSalesRow | null;
  language: string;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const breakdownsByOrder = useMemo(() => groupBreakdownsByOrder(row?.groups ?? []), [row]);
  const [selectedOrderUuid, setSelectedOrderUuid] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<MobileView>("list");
  const [summaryVisible, setSummaryVisible] = useState(true);

  // เปิด modal ให้พนักงานคนใหม่ = เลือกบิลแรกให้อัตโนมัติ กลับไปมุมมองรายการบนมือถือ
  // และขยายแถบสรุปใหม่เสมอ — เหมือนแพตเทิร์น useResetOnChange(bills, ...) ใน use-sales-list-page.ts
  useResetOnChange(row, () => {
    setSelectedOrderUuid(row?.orders[0]?.order_uuid ?? null);
    setMobileView("list");
    setSummaryVisible(true);
  });

  const selectedOrder = row?.orders.find(order => order.order_uuid === selectedOrderUuid) ?? null;
  const selectedBreakdowns = Array.from(breakdownsByOrder.get(selectedOrderUuid ?? "")?.values() ?? []);
  const methodChips = [
    { Icon: Banknote, iconClass: "text-success", label: t("employeeSales.cash"), value: row?.payment_summary.cash ?? 0 },
    { Icon: ArrowLeftRight, iconClass: "text-info", label: t("employeeSales.transfer"), value: row?.payment_summary.transfer ?? 0 },
    { Icon: HandCoins, iconClass: "text-pending", label: t("employeeSales.credit"), value: row?.payment_summary.credit ?? 0 },
  ].filter(chip => chip.value > 0);
  const paymentChips = [
    ...methodChips,
    ...(methodChips.length > 1
      ? [{
          Icon: Wallet,
          iconClass: "text-primary",
          label: t("employeeSales.paymentTotal"),
          value: row?.payment_summary.payment_total ?? 0,
        }]
      : []),
  ].map(chip => ({ ...chip, value: money(chip.value) }));
  const activeChannels = row?.order_channels.filter(channel => channel.bill_count > 0) ?? [];

  function selectOrder(order: EmployeeSalesOrder) {
    setSelectedOrderUuid(order.order_uuid);
    setMobileView("detail");
  }

  return (
    <Dialog open={Boolean(row)} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl">
        {/* หัวโมดัลรวมทุกอย่างไว้แถวเดียว: ตัวตนพนักงาน + ปุ่มพับสรุป — เดิมหัวข้อ "รายงานยอดขายพนักงาน"
            ซ้ำกับชื่อหน้าที่เปิดโมดัลนี้มา และกินไปอีกหนึ่งแถวเต็ม */}
        <DialogHeader className="shrink-0 gap-0 border-b border-border px-4 py-2.5 pr-12 text-left">
          <div className="flex min-w-0 items-center gap-2.5">
            {row && (
              <Avatar className="size-8 shrink-0 border border-border">
                {row.login_profile ? <AvatarImage alt={row.login_email} src={row.login_profile} /> : null}
                <AvatarFallback>{userInitials(row.login_email)}</AvatarFallback>
              </Avatar>
            )}
            <div className="min-w-0 flex-1">
              <DialogTitle className="truncate text-sm font-semibold" translate="no">
                {row?.login_email ?? ""}
              </DialogTitle>
              {row && (
                <DialogDescription className="truncate text-xs">
                  {row.roles_name} · {row.branch_name}
                </DialogDescription>
              )}
            </div>
            {row && (
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="h-8 w-8 shrink-0"
                aria-controls={EMPLOYEE_SALES_DETAIL_SUMMARY_ID}
                aria-expanded={summaryVisible}
                aria-label={summaryVisible ? t("report.hideSummary") : t("report.showSummary")}
                onClick={() => setSummaryVisible(visible => !visible)}
              >
                {summaryVisible ? <EyeOff data-icon="inline-start" /> : <Eye data-icon="inline-start" />}
                <span className="sr-only">{summaryVisible ? t("report.hideSummary") : t("report.showSummary")}</span>
              </Button>
            )}
          </div>
        </DialogHeader>

        {row && (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {summaryVisible && (
              // จำกัดความสูงไว้ ไม่ให้สรุปของพนักงานที่มีหลายช่องทาง/หลายวิธีชำระ เบียดแผงบิลจนใช้งานไม่ได้
              <div
                id={EMPLOYEE_SALES_DETAIL_SUMMARY_ID}
                className="max-h-[38dvh] shrink-0 overflow-y-auto border-b border-border px-4 py-2.5"
              >
                {/* แถบตัวเลขหลักของพนักงาน — ใช้ row.summary ที่เดิม modal ไม่เคยแสดง ให้เห็นภาพรวมทันที */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <StatTile label={t("employeeSales.billCount")} value={String(row.summary.bill_count)} />
                  <StatTile label={t("employeeSales.totalQty")} value={String(row.summary.total_qty)} />
                  <StatTile label={t("employeeSales.netSale")} value={money(row.summary.net_sale)} />
                  <StatTile emphasis label={t("employeeSales.grandTotal")} value={money(row.summary.grand_total)} />
                </div>

                {/* วิธีชำระและช่องทางที่ยอดเป็นศูนย์ไม่บอกอะไร — ซ่อนเหมือน SelectedBillSummary ของ sales-list
                    ยอดชำระรวมแสดงเฉพาะตอนมีมากกว่าหนึ่งวิธี ไม่งั้นมันคือเลขเดียวกับวิธีเดียวที่เหลืออยู่ */}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {paymentChips.map(chip => (
                    <SummaryChip key={chip.label} Icon={chip.Icon} iconClass={chip.iconClass} label={chip.label} value={chip.value} />
                  ))}
                  {activeChannels.map(channel => (
                    <SummaryChip
                      key={channel.order_channel}
                      Icon={Package}
                      label={channel.order_channel_name}
                      value={`${channel.bill_count} · ${money(channel.grand_total)}`}
                    />
                  ))}
                </div>

                {row.cancel_summary.cancel_bill_count > 0 && (
                  <div className="mt-2 flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 px-2.5 py-1.5 text-xs">
                    <TriangleAlert className="size-3.5 shrink-0 text-warning-text" aria-hidden />
                    <span className="min-w-0 font-medium text-warning-text">
                      {t("employeeSales.cancelSummaryDescription", {
                        count: row.cancel_summary.cancel_bill_count,
                        amount: money(row.cancel_summary.cancel_total_amount),
                      })}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Layout ซ้าย/ขวาแบบ sales-list: รายการบิลซ้าย รายละเอียดบิลที่เลือกขวา แทน Accordion เดิม
                จุดตัด md: (ไม่ใช่ xl: แบบ sales-list) เพราะที่นี่คือ modal ไม่ใช่หน้าเต็มจอ ความกว้างถูกจำกัดด้วย max-w-6xl อยู่แล้ว */}
            <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-[18rem_minmax(0,1fr)] md:divide-x md:divide-border">
              <div className={cn("min-h-0 flex-col overflow-hidden", mobileView === "list" ? "flex" : "hidden md:flex")}>
                <EmployeeOrderList
                  language={language}
                  orders={row.orders}
                  selectedOrderUuid={selectedOrderUuid}
                  onSelect={selectOrder}
                />
              </div>
              <div className={cn("min-h-0 flex-col overflow-hidden", mobileView === "detail" ? "flex" : "hidden md:flex")}>
                <EmployeeOrderDetail
                  breakdowns={selectedBreakdowns}
                  language={language}
                  order={selectedOrder}
                  onBack={() => setMobileView("list")}
                />
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function EmployeeOrderList({
  language,
  orders,
  onSelect,
  selectedOrderUuid,
}: {
  language: string;
  orders: EmployeeSalesOrder[];
  onSelect: (order: EmployeeSalesOrder) => void;
  selectedOrderUuid: string | null;
}) {
  const { t } = useTranslation();

  return (
    <>
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2.5">
        <span className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-foreground">
          <ReceiptText className="size-4 shrink-0 text-primary" />
          <span className="truncate">{t("employeeSales.orders")}</span>
        </span>
        <Badge variant="secondary" className="shrink-0 tabular-nums">{orders.length}</Badge>
      </div>
      {orders.length ? (
        <div className="flex min-h-0 flex-1 flex-col divide-y divide-border overflow-y-auto overscroll-contain">
          {orders.map(order => (
            <EmployeeOrderListItem
              key={order.order_uuid}
              language={language}
              order={order}
              selected={order.order_uuid === selectedOrderUuid}
              onSelect={() => onSelect(order)}
            />
          ))}
        </div>
      ) : (
        <div className="flex min-h-48 flex-1 items-center justify-center p-4">
          <EmptyState title={t("employeeSales.empty")} description={t("employeeSales.emptyDescription")} />
        </div>
      )}
    </>
  );
}

function EmployeeOrderListItem({
  language,
  order,
  onSelect,
  selected,
}: {
  language: string;
  order: EmployeeSalesOrder;
  onSelect: () => void;
  selected: boolean;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      className={cn(
        "relative h-auto w-full shrink-0 touch-manipulation flex-col items-stretch justify-start gap-1 overflow-hidden rounded-none px-3 py-2.5 text-left shadow-none transition-colors focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset",
        selected ? "bg-primary/10 hover:bg-primary/10" : "hover:bg-muted/60"
      )}
      aria-pressed={selected}
      onClick={onSelect}
    >
      {selected ? <span aria-hidden="true" className="absolute inset-y-2 left-0 w-0.5 rounded-r-full bg-primary" /> : null}
      <div className="flex min-w-0 items-center justify-between gap-2">
        <span className="truncate text-sm font-semibold leading-6 text-foreground" translate="no">
          {order.order_invoice}
        </span>
        <span className="shrink-0 text-sm font-semibold leading-6 tabular-nums text-foreground">
          {money(order.grand_total)}
        </span>
      </div>
      <div className="flex min-w-0 items-center justify-between gap-2 text-xs leading-5 text-muted-foreground">
        <span className="truncate">{formatShortDate(order.sale_date, language)}</span>
        <span className="flex shrink-0 items-center gap-1 tabular-nums">
          <Package className="size-3 shrink-0" />
          {order.total_qty}
        </span>
      </div>
    </Button>
  );
}

function EmployeeOrderDetail({
  breakdowns,
  language,
  order,
  onBack,
}: {
  breakdowns: OrderGroupBreakdown[];
  language: string;
  order: EmployeeSalesOrder | null;
  onBack: () => void;
}) {
  const { t } = useTranslation();

  if (!order) {
    return (
      <div className="flex min-h-48 flex-1 items-center justify-center p-4">
        <EmptyState title={t("employeeSales.empty")} description={t("employeeSales.emptyDescription")} />
      </div>
    );
  }

  return (
    <>
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="h-8 w-8 shrink-0 md:hidden"
            aria-label={t("actions.back")}
            onClick={onBack}
          >
            <ArrowLeft data-icon="inline-start" />
            <span className="sr-only">{t("actions.back")}</span>
          </Button>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground" translate="no">{order.order_invoice}</p>
            <p className="text-xs text-muted-foreground">{formatShortDate(order.sale_date, language)}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <span className="text-sm font-semibold tabular-nums text-foreground">{money(order.grand_total)}</span>
          <span className="flex items-center gap-1 text-xs tabular-nums text-muted-foreground">
            <Package className="size-3" aria-hidden />
            {order.total_qty}
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {/* ยอดรวมทั้งหมดอยู่บนหัวแผงที่ปักไว้แล้ว ตรงนี้จึงเหลือเฉพาะตัวแยกที่ประกอบกันเป็นยอดนั้น */}
        <div className="grid grid-cols-3 gap-3 rounded-md border border-border bg-muted/40 px-3 py-2">
          <OrderMetric label={t("employeeSales.netSale")} value={money(order.net_sale)} />
          <OrderMetric label={t("employeeSales.serviceCharge")} tone="info" value={money(order.service_charge)} />
          <OrderMetric label={t("employeeSales.vat")} tone="warning" value={money(order.vat)} />
        </div>

        {breakdowns.length ? (
          <div className="mt-3 flex flex-col gap-2.5">
            {breakdowns.map(breakdown => (
              <div key={breakdown.groupUuid} className="overflow-hidden rounded-md border border-border">
                <div className="flex items-center justify-between gap-2 bg-muted/40 px-3 py-1.5 text-sm font-semibold">
                  <span className="min-w-0 truncate">{breakdown.groupName}</span>
                  <span className="flex shrink-0 items-center gap-2 tabular-nums text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Package className="size-3.5" aria-hidden />
                      {breakdown.totalQty}
                    </span>
                    <span className="font-semibold text-foreground">{money(breakdown.totalAmount)}</span>
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
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">{t("common.noData")}</p>
        )}
      </div>
    </>
  );
}
