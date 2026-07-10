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
  totalPages
}: SalesBillListPanelProps) {
  const { t } = useTranslation();

  return (
    <Card className="min-h-0 overflow-hidden border-border bg-card shadow-sm xl:flex xl:min-h-0 xl:flex-col">
      <CardHeader className="shrink-0 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2 text-base font-black">
            <ReceiptText />
            <span className="truncate">{t("salesList.billList")}</span>
          </CardTitle>
          <p className="text-sm text-muted-foreground">{rangeLabel}</p>
        </div>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col p-0">
        {loading && !bills.length ? (
          <div className="p-4">
            <LoadingState label={t("salesList.loading")} variant="table" />
          </div>
        ) : bills.length ? (
          <>
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
              {bills.map((bill) => (
                <BillListItem
                  key={bill.id}
                  bill={bill}
                  selected={bill.id === selectedBillId}
                  onSelect={() => onSelect(bill.id)}
                />
              ))}
            </div>
            <SalesListPagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
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
        "h-auto w-full justify-start rounded-none border-b px-4 py-3 text-left shadow-none transition-colors",
        needsPaymentAttention
          ? "border-destructive/25 bg-destructive/15 hover:bg-destructive/20"
          : "border-border",
        selected &&
          (needsPaymentAttention
            ? "bg-destructive/20 hover:bg-destructive/20 ring-1 ring-inset ring-destructive/35"
            : "bg-primary/10 hover:bg-primary/10")
      )}
      aria-pressed={selected}
      onClick={onSelect}
    >
      <div className="grid w-full min-w-0 grid-cols-[2.75rem_minmax(0,1fr)] gap-3">
        <div
          className={cn(
            "flex size-11 items-center justify-center rounded-md border border-border bg-muted",
            needsPaymentAttention && "border-destructive/30 bg-destructive/15 text-destructive",
            selected &&
              (needsPaymentAttention
                ? "border-destructive/40 bg-destructive/20 text-destructive"
                : "border-primary/25 bg-primary/15 text-primary")
          )}
        >
          <ReceiptText className="size-5" />
        </div>
        <div className="min-w-0">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <span className="truncate text-sm font-black text-foreground">{bill.invoiceNumber}</span>
            <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">{formatSaleDate(bill.saleDate)}</span>
          </div>
          <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
            <Table2 className="size-3.5 shrink-0" />
            <span className="truncate">{bill.tableName}</span>
            <CreditCard className="size-3.5 shrink-0" />
            <span className="truncate">{bill.paymentMethodName}</span>
          </div>
          <div className="mt-2 flex min-w-0 items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1.5">
              {bill.status ? (
                <Badge className={cn("max-w-28 truncate", statusBadgeClass(bill.status))}>{bill.status}</Badge>
              ) : null}
              {needsPaymentAttention ? (
                <Badge className="max-w-36 truncate border-destructive/25 bg-destructive text-destructive-foreground">
                  {bill.debtAmount > 0 ? `${t("salesList.debt")}: ${money(bill.debtAmount)}` : t("salesList.debt")}
                </Badge>
              ) : null}
            </div>
            <span className="shrink-0 text-sm font-black tabular-nums text-foreground">{money(bill.lineTotal)}</span>
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {t("salesList.items")}: {bill.itemCount.toLocaleString("en-US")} · {t("salesList.qty")}: {bill.qtyTotal.toLocaleString("en-US")}
          </p>
        </div>
      </div>
    </Button>
  );
}

function SalesListPagination({
  onPageChange,
  page,
  totalPages
}: {
  onPageChange: (page: number) => void;
  page: number;
  totalPages: number;
}) {
  return (
    <div className="border-t border-border px-4 py-3 text-sm text-muted-foreground">
      <AppPagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
    </div>
  );
}
