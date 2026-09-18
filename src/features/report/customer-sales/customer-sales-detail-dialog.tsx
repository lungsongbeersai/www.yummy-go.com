"use client";

import type { ReactNode } from "react";
import { UserRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatShortDate, money } from "@/lib/format";
import type { CustomerSalesRow } from "@/services/report";

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-xs font-black uppercase tracking-wide text-muted-foreground">{children}</h3>
  );
}

// การ์ดตัวเลขสรุป — โครงเดียวกับ modal พนักงาน (employee-sales) ให้ modal รายงานหน้าตาชุดเดียวกัน
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

export function CustomerSalesDetailDialog({
  row,
  language,
  onOpenChange,
}: {
  row: CustomerSalesRow | null;
  language: string;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const columns = t("report.customerSales.columns", { returnObjects: true }) as Record<string, string>;

  return (
    <Dialog open={Boolean(row)} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="shrink-0 border-b border-border px-6 py-4 pr-12 text-left">
          <DialogTitle className="flex items-center gap-3">
            {row && (
              <>
                <Avatar className="size-10 border border-border">
                  <AvatarFallback>
                    <UserRound className="size-5 text-muted-foreground" aria-hidden />
                  </AvatarFallback>
                </Avatar>
                <span className="min-w-0 truncate" translate="no">{row.customer_name || "-"}</span>
              </>
            )}
          </DialogTitle>
          {row && <DialogDescription translate="no">{row.member_code} · {row.customer_phone}</DialogDescription>}
        </DialogHeader>
        {row && (
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <div className="flex flex-col gap-6">
              <section className="flex flex-col gap-2.5">
                <SectionHeading>{t("report.summary")}</SectionHeading>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  <StatTile label={columns.billCount} value={String(row.summary.bill_count)} />
                  <StatTile label={columns.netSale} value={money(row.summary.net_sale)} />
                  <StatTile label={columns.serviceCharge} value={money(row.summary.service_charge)} />
                  <StatTile label={columns.vat} value={money(row.summary.vat)} />
                  <StatTile label={columns.discountBill} value={money(row.summary.discount_bill)} />
                  <StatTile emphasis label={columns.grandTotal} value={money(row.summary.grand_total)} />
                </div>
              </section>

              <section className="flex flex-col gap-2.5">
                <SectionHeading>{t("report.customerSales.orders")}</SectionHeading>
                <div className="overflow-hidden rounded-lg border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{columns.saleDate}</TableHead>
                        <TableHead>{columns.invoice}</TableHead>
                        <TableHead className="text-right">{columns.qty}</TableHead>
                        <TableHead className="text-right">{columns.discount}</TableHead>
                        <TableHead className="text-right">{columns.netSale}</TableHead>
                        <TableHead className="text-right">{columns.serviceCharge}</TableHead>
                        <TableHead className="text-right">{columns.vat}</TableHead>
                        <TableHead className="text-right">{columns.grandTotal}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {row.details.map(order => (
                        <TableRow key={order.order_uuid}>
                          <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                            {formatShortDate(order.sale_date, language)}
                          </TableCell>
                          <TableCell className="font-medium" translate="no">{order.order_invoice}</TableCell>
                          <TableCell className="text-right tabular-nums">{order.total_qty}</TableCell>
                          <TableCell className={cn("text-right tabular-nums", order.discount_amount > 0 ? "text-destructive" : "text-muted-foreground")}>
                            {money(order.discount_amount)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{money(order.net_sale)}</TableCell>
                          <TableCell className={cn("text-right tabular-nums", order.service_charge > 0 ? "text-info-text" : "text-muted-foreground")}>
                            {money(order.service_charge)}
                          </TableCell>
                          <TableCell className={cn("text-right tabular-nums", order.vat > 0 ? "text-warning-text" : "text-muted-foreground")}>
                            {money(order.vat)}
                          </TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">{money(order.grand_total)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </section>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
