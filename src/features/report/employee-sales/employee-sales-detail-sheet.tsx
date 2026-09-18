"use client";

import { useMemo, type ReactNode } from "react";
import { ArrowLeftRight, Banknote, HandCoins, Package, TriangleAlert, Wallet, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { userInitials } from "@/features/settings/user/user-utils";
import { cn } from "@/lib/utils";
import { formatShortDate, money } from "@/lib/format";
import type { EmployeeSalesGroupItem, EmployeeSalesRow } from "@/services/report";

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

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-xs font-black uppercase tracking-wide text-muted-foreground">{children}</h3>
  );
}

// การ์ดตัวเลขสรุป — โครงเดียวกับ PaymentMethodShareCard/ReportSummaryCardsGrid ให้เข้าชุดทั้งรายงาน
function StatTile({ emphasis, label, value }: { emphasis?: boolean; label: string; value: string }) {
  return (
    <div className={cn("min-w-0 rounded-lg border border-border bg-card p-3", emphasis && "border-primary/30 bg-primary/5")}>
      <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
      <p className={cn("mt-1 truncate text-lg font-semibold tabular-nums", emphasis ? "text-primary" : "text-foreground")}>
        {value}
      </p>
    </div>
  );
}

// การ์ดวิธีชำระ: chip สี + ป้าย + ยอด — สีชิปตรงกับรายงานวิธีชำระ (เงินสด=success, โอน=info, เชื่อ=pending)
function PaymentTile({
  Icon,
  chipClass,
  emphasis,
  label,
  value,
}: {
  Icon: LucideIcon;
  chipClass: string;
  emphasis?: boolean;
  label: string;
  value: string;
}) {
  return (
    <div className={cn("min-w-0 rounded-lg border border-border bg-card p-3", emphasis && "border-primary/30 bg-primary/5")}>
      <div className="flex min-w-0 items-center gap-2">
        <span className={cn("grid size-8 shrink-0 place-items-center rounded-md", chipClass)}>
          <Icon className="size-4" aria-hidden />
        </span>
        <p className="min-w-0 truncate text-xs font-medium text-muted-foreground">{label}</p>
      </div>
      <p className={cn("mt-2 truncate text-lg font-semibold tabular-nums", emphasis ? "text-primary" : "text-foreground")}>
        {value}
      </p>
    </div>
  );
}

// ตัวเลขระดับบิลในแถบขยาย — service/vat ใช้สีเดียวกับรายงานอื่น (info/warning) เพื่อความสม่ำเสมอ
function OrderMetric({
  emphasis,
  label,
  tone,
  value,
}: {
  emphasis?: boolean;
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
          emphasis
            ? "text-primary"
            : tone === "info"
              ? "text-info-text"
              : tone === "warning"
                ? "text-warning-text"
                : "text-foreground"
        )}
      >
        {value}
      </p>
    </div>
  );
}

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

  return (
    <Dialog open={Boolean(row)} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="shrink-0 border-b border-border px-6 py-4 pr-12 text-left">
          <DialogTitle className="flex items-center gap-3">
            {row && (
              <>
                <Avatar className="size-10 border border-border">
                  {row.login_profile ? <AvatarImage alt={row.login_email} src={row.login_profile} /> : null}
                  <AvatarFallback>{userInitials(row.login_email)}</AvatarFallback>
                </Avatar>
                <span className="min-w-0 truncate" translate="no">{row.login_email}</span>
              </>
            )}
          </DialogTitle>
          {row && <DialogDescription>{row.roles_name} · {row.branch_name}</DialogDescription>}
        </DialogHeader>
        {row && (
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <div className="flex flex-col gap-6">
              {/* แถบตัวเลขหลักของพนักงาน — ใช้ row.summary ที่เดิม modal ไม่เคยแสดง ให้เห็นภาพรวมทันที */}
              <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <StatTile label={t("employeeSales.billCount")} value={String(row.summary.bill_count)} />
                <StatTile label={t("employeeSales.totalQty")} value={String(row.summary.total_qty)} />
                <StatTile label={t("employeeSales.netSale")} value={money(row.summary.net_sale)} />
                <StatTile emphasis label={t("employeeSales.grandTotal")} value={money(row.summary.grand_total)} />
              </section>

              <section className="flex flex-col gap-2.5">
                <SectionHeading>{t("employeeSales.paymentSummary")}</SectionHeading>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  <PaymentTile
                    Icon={Banknote}
                    chipClass="bg-success/10 text-success"
                    label={t("employeeSales.cash")}
                    value={money(row.payment_summary.cash)}
                  />
                  <PaymentTile
                    Icon={ArrowLeftRight}
                    chipClass="bg-info/10 text-info"
                    label={t("employeeSales.transfer")}
                    value={money(row.payment_summary.transfer)}
                  />
                  <PaymentTile
                    Icon={HandCoins}
                    chipClass="bg-pending/10 text-pending"
                    label={t("employeeSales.credit")}
                    value={money(row.payment_summary.credit)}
                  />
                  <PaymentTile
                    Icon={Wallet}
                    chipClass="bg-primary/10 text-primary"
                    emphasis
                    label={t("employeeSales.paymentTotal")}
                    value={money(row.payment_summary.payment_total)}
                  />
                </div>
              </section>

              {row.order_channels.length > 0 && (
                <section className="flex flex-col gap-2.5">
                  <SectionHeading>{t("employeeSales.orderChannels")}</SectionHeading>
                  <div className="overflow-hidden rounded-lg border border-border">
                    {row.order_channels.map((channel, index) => (
                      <div
                        key={channel.order_channel}
                        className={cn(
                          "flex items-center justify-between gap-3 px-3 py-2.5",
                          index > 0 && "border-t border-border"
                        )}
                      >
                        <span className="min-w-0 truncate text-sm font-medium text-foreground">
                          {channel.order_channel_name}
                        </span>
                        <span className="flex shrink-0 items-center gap-3 text-sm tabular-nums">
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Package className="size-3.5" aria-hidden />
                            {channel.bill_count}
                          </span>
                          <span className="font-semibold text-foreground">{money(channel.grand_total)}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {row.cancel_summary.cancel_bill_count > 0 && (
                <div className="flex items-center gap-2.5 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
                  <TriangleAlert className="size-4 shrink-0 text-warning-text" aria-hidden />
                  <span className="min-w-0 font-medium text-warning-text">
                    {t("employeeSales.cancelSummaryDescription", {
                      count: row.cancel_summary.cancel_bill_count,
                      amount: money(row.cancel_summary.cancel_total_amount),
                    })}
                  </span>
                </div>
              )}

              <section className="flex flex-col gap-2.5">
                <SectionHeading>{t("employeeSales.orders")}</SectionHeading>
                <Accordion type="multiple" className="bg-card">
                  {row.orders.map(order => {
                    const breakdowns = Array.from(breakdownsByOrder.get(order.order_uuid)?.values() ?? []);

                    return (
                      <AccordionItem key={order.order_uuid} value={order.order_uuid}>
                        <AccordionTrigger className="gap-3 px-3 py-3 hover:no-underline">
                          <span className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left">
                            <span className="min-w-0">
                              <span className="block truncate font-semibold text-foreground" translate="no">
                                {order.order_invoice}
                              </span>
                              <span className="block text-xs font-normal text-muted-foreground">
                                {formatShortDate(order.sale_date, language)}
                              </span>
                            </span>
                            <span className="flex shrink-0 flex-col items-end gap-0.5">
                              <span className="font-semibold tabular-nums text-foreground">{money(order.grand_total)}</span>
                              <span className="flex items-center gap-1 text-xs font-normal tabular-nums text-muted-foreground">
                                <Package className="size-3" aria-hidden />
                                {order.total_qty}
                              </span>
                            </span>
                          </span>
                        </AccordionTrigger>
                        <AccordionContent className="px-3">
                          <div className="grid grid-cols-2 gap-3 rounded-md border border-border bg-muted/40 p-3 sm:grid-cols-4">
                            <OrderMetric label={t("employeeSales.netSale")} value={money(order.net_sale)} />
                            <OrderMetric label={t("employeeSales.serviceCharge")} tone="info" value={money(order.service_charge)} />
                            <OrderMetric label={t("employeeSales.vat")} tone="warning" value={money(order.vat)} />
                            <OrderMetric emphasis label={t("employeeSales.grandTotal")} value={money(order.grand_total)} />
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
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </section>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
