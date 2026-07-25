"use client";

import { CreditCard, ReceiptText, Table2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AppPagination } from "@/components/common/app-pagination";
import { EmptyState } from "@/components/common/empty-state";
import { LoadingState } from "@/components/common/loading-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DailySaleItemsBillGroup } from "@/stores/report-store";
import { billNeedsPaymentAttention, formatSaleDate, statusBadgeClass } from "./sales-list-utils";

interface SalesBillListPanelProps {
  bills: DailySaleItemsBillGroup[];
  loading: boolean;
  onPageChange: (page: number) => void;
  onSelect: (billId: string) => void;
  page: number;
  rangeLabel: string;
  selectedBillId: string;
  totalAmount: number;
  totalPages: number;
}

export function SalesBillListPanel({
  bills,
  loading,
  onPageChange,
  onSelect,
  page,
  rangeLabel,
  selectedBillId,
  totalAmount,
  totalPages
}: SalesBillListPanelProps) {
  const { t } = useTranslation();

  return (
    <Card className="min-h-0 overflow-hidden border-border bg-card shadow-sm xl:flex xl:min-h-0 xl:flex-col">
      <CardHeader className="shrink-0 border-b border-border bg-card px-3 py-2.5">
        <div className="flex w-full min-w-0 items-center justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex min-w-0 items-center gap-1.5 text-sm font-bold text-foreground">
              <ReceiptText className="size-4 shrink-0 text-primary" />
              <span className="truncate">{t("salesList.billList")}</span>
            </CardTitle>
          </div>
          <div className="ml-auto flex shrink-0 items-baseline justify-end gap-1.5 whitespace-nowrap text-right">
            <span className="text-xs text-muted-foreground">{t("salesList.summary.total")}</span>
            <span className="text-sm font-bold tabular-nums text-foreground">{money(totalAmount)}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col p-0">
        {loading && !bills.length ? (
          <div className="p-4">
            <LoadingState label={t("salesList.loading")} variant="table" />
          </div>
        ) : bills.length ? (
          <>
            <div className="flex min-h-0 flex-1 flex-col divide-y divide-border overflow-y-auto overscroll-contain">
              {bills.map((bill) => (
                <BillListItem
                  key={bill.id}
                  bill={bill}
                  selected={bill.id === selectedBillId}
                  onSelect={() => onSelect(bill.id)}
                />
              ))}
            </div>
            <SalesListPagination page={page} rangeLabel={rangeLabel} totalPages={totalPages} onPageChange={onPageChange} />
          </>
        ) : (
          <div className="flex min-h-80 items-center justify-center p-4">
            <EmptyState title={t("salesList.noBills")} description={t("salesList.adjustFilters")} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BillListItem({
  bill,
  onSelect,
  selected
}: {
  bill: DailySaleItemsBillGroup;
  onSelect: () => void;
  selected: boolean;
}) {
  const { t } = useTranslation();
  const needsPaymentAttention = billNeedsPaymentAttention(bill);

  return (
    <Button
      type="button"
      variant="ghost"
      className={cn(
        "relative h-auto w-full shrink-0 touch-manipulation justify-start overflow-hidden rounded-none px-3 py-2 text-left shadow-none transition-colors focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset",
        needsPaymentAttention
          ? "bg-destructive/10 hover:bg-destructive/15"
          : "hover:bg-muted/60",
        selected &&
          (needsPaymentAttention
            ? "bg-destructive/15 hover:bg-destructive/15"
            : "bg-primary/10 hover:bg-primary/10")
      )}
      aria-pressed={selected}
      onClick={onSelect}
    >
      {selected ? (
        <span
          aria-hidden="true"
          className={cn(
            "absolute inset-y-2 left-0 w-0.5 rounded-r-full",
            needsPaymentAttention ? "bg-destructive" : "bg-primary"
          )}
        />
      ) : null}
      <div className="grid w-full min-w-0 grid-cols-[2rem_minmax(0,1fr)] items-start gap-2.5">
        <div
          className={cn(
            "flex size-8 items-center justify-center rounded-md border border-border bg-muted/60 text-muted-foreground",
            needsPaymentAttention && "border-destructive/25 bg-destructive/10 text-destructive",
            selected &&
              (needsPaymentAttention
                ? "border-destructive/30 bg-destructive/15 text-destructive"
                : "border-primary/25 bg-primary/10 text-primary")
          )}
        >
          <ReceiptText className="size-4" />
        </div>
        <div className="min-w-0">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="truncate text-sm font-bold text-foreground">{bill.invoiceNumber}</span>
              {bill.status ? (
                <Badge
                  className={cn("max-w-20 truncate px-1.5 py-0 text-[10px] leading-4", statusBadgeClass(bill.status))}
                >
                  {bill.status}
                </Badge>
              ) : null}
            </div>
            <time
              dateTime={bill.saleDate}
              className="shrink-0 text-[11px] tabular-nums text-muted-foreground"
            >
              {formatSaleDate(bill.saleDate)}
            </time>
          </div>
          <div className="mt-1 flex min-w-0 items-center gap-2 overflow-hidden text-xs text-muted-foreground">
            <span className="flex min-w-0 items-center gap-1">
              <Table2 className="size-3 shrink-0" />
              <span className="truncate">{bill.tableName}</span>
            </span>
            <span className="flex min-w-0 items-center gap-1">
              <CreditCard className="size-3 shrink-0" />
              <span className="truncate">{bill.paymentMethodName}</span>
            </span>
          </div>
          <div className="mt-1 flex min-w-0 items-end justify-between gap-2">
            <p className="min-w-0 truncate text-[11px] leading-4 text-muted-foreground">
              {needsPaymentAttention ? (
                <span className="font-semibold text-destructive">
                  {bill.debtAmount > 0
                    ? `${t("salesList.debt")}: ${money(bill.debtAmount)}`
                    : t("salesList.debt")}{" "}
                  ·{" "}
                </span>
              ) : null}
              {t("salesList.items")}: {bill.itemCount.toLocaleString("en-US")} · {t("salesList.qty")}:{" "}
              {bill.qtyTotal.toLocaleString("en-US")}
            </p>
            <span className="shrink-0 text-sm font-bold tabular-nums text-foreground">
              {money(bill.lineTotal)}
            </span>
          </div>
        </div>
      </div>
    </Button>
  );
}

function SalesListPagination({
  onPageChange,
  page,
  rangeLabel,
  totalPages
}: {
  onPageChange: (page: number) => void;
  page: number;
  rangeLabel: string;
  totalPages: number;
}) {
  return (
    <div className="shrink-0 border-t border-border bg-muted/20 px-3 py-2.5 text-sm text-muted-foreground sm:px-4 sm:py-3">
      <AppPagination page={page} rangeLabel={rangeLabel} totalPages={totalPages} onPageChange={onPageChange} />
    </div>
  );
}
