"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { userInitials } from "@/features/settings/user/user-utils";
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
                <Avatar>
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
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <div className="flex flex-col gap-4">
              <div>
                <h3 className="mb-2 text-sm font-medium">{t("employeeSales.paymentSummary")}</h3>
                <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                  <div><dt className="text-muted-foreground">{t("employeeSales.cash")}</dt><dd>{money(row.payment_summary.cash)}</dd></div>
                  <div><dt className="text-muted-foreground">{t("employeeSales.transfer")}</dt><dd>{money(row.payment_summary.transfer)}</dd></div>
                  <div><dt className="text-muted-foreground">{t("employeeSales.credit")}</dt><dd>{money(row.payment_summary.credit)}</dd></div>
                  <div><dt className="text-muted-foreground">{t("employeeSales.paymentTotal")}</dt><dd className="font-medium">{money(row.payment_summary.payment_total)}</dd></div>
                </dl>
              </div>

              {row.order_channels.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-medium">{t("employeeSales.orderChannels")}</h3>
                  <div className="flex flex-wrap gap-2">
                    {row.order_channels.map(channel => (
                      <Badge key={channel.order_channel} variant="outline">
                        {channel.order_channel_name} · {channel.bill_count} · {money(channel.grand_total)}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {row.cancel_summary.cancel_bill_count > 0 && (
                <Alert className="border-warning/45 bg-warning/10 text-warning">
                  <AlertDescription className="text-warning/90">
                    {t("employeeSales.cancelSummaryDescription", {
                      count: row.cancel_summary.cancel_bill_count,
                      amount: money(row.cancel_summary.cancel_total_amount),
                    })}
                  </AlertDescription>
                </Alert>
              )}

              <div>
                <h3 className="mb-2 text-sm font-medium">{t("employeeSales.orders")}</h3>
                <Accordion type="multiple">
                  {row.orders.map(order => {
                    const breakdowns = Array.from(breakdownsByOrder.get(order.order_uuid)?.values() ?? []);

                    return (
                      <AccordionItem key={order.order_uuid} value={order.order_uuid}>
                        <AccordionTrigger>
                          <span className="flex flex-1 flex-wrap items-center justify-between gap-2 pr-2 text-left">
                            <span className="min-w-0">
                              <span className="block font-medium">{order.order_invoice}</span>
                              <span className="block text-xs text-muted-foreground">{formatShortDate(order.sale_date, language)}</span>
                            </span>
                            <span className="shrink-0 tabular-nums text-muted-foreground">
                              {order.total_qty} · {money(order.grand_total)}
                            </span>
                          </span>
                        </AccordionTrigger>
                        <AccordionContent>
                          <dl className="mb-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                            <div><dt className="text-muted-foreground">{t("employeeSales.netSale")}</dt><dd className="tabular-nums">{money(order.net_sale)}</dd></div>
                            <div><dt className="text-muted-foreground">{t("employeeSales.serviceCharge")}</dt><dd className="tabular-nums">{money(order.service_charge)}</dd></div>
                            <div><dt className="text-muted-foreground">{t("employeeSales.vat")}</dt><dd className="tabular-nums">{money(order.vat)}</dd></div>
                            <div><dt className="text-muted-foreground">{t("employeeSales.grandTotal")}</dt><dd className="font-medium tabular-nums">{money(order.grand_total)}</dd></div>
                          </dl>

                          {breakdowns.length ? (
                            <div className="flex flex-col gap-3">
                              {breakdowns.map(breakdown => (
                                <div key={breakdown.groupUuid} className="overflow-hidden rounded-md border border-border">
                                  <div className="flex items-center justify-between gap-2 bg-muted/40 px-3 py-1.5 text-sm font-medium">
                                    <span className="min-w-0 truncate">{breakdown.groupName}</span>
                                    <span className="shrink-0 tabular-nums text-muted-foreground">
                                      {breakdown.totalQty} · {money(breakdown.totalAmount)}
                                    </span>
                                  </div>
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>{t("employeeSales.productName")}</TableHead>
                                        <TableHead>{t("employeeSales.unitPrice")}</TableHead>
                                        <TableHead>{t("employeeSales.totalQty")}</TableHead>
                                        <TableHead>{t("employeeSales.totalAmount")}</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {breakdown.items.map((item, itemIndex) => (
                                        <TableRow key={`${item.prod_uuid}-${itemIndex}`}>
                                          <TableCell>{item.product_full_name}</TableCell>
                                          <TableCell className="tabular-nums">{money(item.unit_price)}</TableCell>
                                          <TableCell className="tabular-nums">{item.total_qty}</TableCell>
                                          <TableCell className="tabular-nums">{money(item.total_amount)}</TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">{t("common.noData")}</p>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
