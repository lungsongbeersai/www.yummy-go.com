"use client";

import { useTranslation } from "react-i18next";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { userInitials } from "@/features/settings/user/user-utils";
import { formatShortDate, money } from "@/lib/format";
import type { EmployeeSalesRow } from "@/services/report";

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

  return (
    <Sheet open={Boolean(row)} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col gap-4 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3">
            {row && (
              <>
                <Avatar>
                  {row.login_profile ? <AvatarImage alt={row.login_email} src={row.login_profile} /> : null}
                  <AvatarFallback>{userInitials(row.login_email)}</AvatarFallback>
                </Avatar>
                <span className="min-w-0 truncate" translate="no">{row.login_email}</span>
              </>
            )}
          </SheetTitle>
        </SheetHeader>
        {row && (
          <div className="flex flex-col gap-4 px-6 pb-6">
            <p className="text-sm text-muted-foreground">{row.roles_name} · {row.branch_name}</p>

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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("employeeSales.invoice")}</TableHead>
                    <TableHead>{t("employeeSales.saleDate")}</TableHead>
                    <TableHead>{t("employeeSales.totalQty")}</TableHead>
                    <TableHead>{t("employeeSales.netSale")}</TableHead>
                    <TableHead>{t("employeeSales.serviceCharge")}</TableHead>
                    <TableHead>{t("employeeSales.vat")}</TableHead>
                    <TableHead>{t("employeeSales.grandTotal")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {row.orders.map(order => (
                    <TableRow key={order.order_uuid}>
                      <TableCell className="font-medium">{order.order_invoice}</TableCell>
                      <TableCell>{formatShortDate(order.sale_date, language)}</TableCell>
                      <TableCell className="tabular-nums">{order.total_qty}</TableCell>
                      <TableCell className="tabular-nums">{money(order.net_sale)}</TableCell>
                      <TableCell className="tabular-nums">{money(order.service_charge)}</TableCell>
                      <TableCell className="tabular-nums">{money(order.vat)}</TableCell>
                      <TableCell className="font-medium tabular-nums">{money(order.grand_total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-medium">{t("employeeSales.groups")}</h3>
              <Accordion type="multiple">
                {row.groups.map(group => (
                  <AccordionItem key={group.group_uuid} value={group.group_uuid}>
                    <AccordionTrigger>
                      <span className="flex flex-1 items-center justify-between gap-3 pr-2">
                        <span>{group.group_name}</span>
                        <span className="text-muted-foreground">{group.total_qty} · {money(group.total_amount)}</span>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
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
                          {group.items.map((item, itemIndex) => (
                            <TableRow key={`${item.order_uuid}-${item.prod_uuid}-${itemIndex}`}>
                              <TableCell>{item.product_full_name}</TableCell>
                              <TableCell className="tabular-nums">{money(item.unit_price)}</TableCell>
                              <TableCell className="tabular-nums">{item.total_qty}</TableCell>
                              <TableCell className="tabular-nums">{money(item.total_amount)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
