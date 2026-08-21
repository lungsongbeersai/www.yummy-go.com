"use client";

import { ReceiptText, Table2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/common/empty-state";
import { LoadingState } from "@/components/common/loading-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { CancelableBill } from "@/services/cancel";
import {
  billCanCancel,
  billDate,
  billInvoice,
  billIsSelected,
  billTable,
  billTotal,
  billUuid,
  statusDotClass
} from "./cancel-sale-utils";
import { CancelableBadge } from "./cancel-sale-status";
import { SalesListPaginationFooter } from "./cancel-sale-controls";

export function SalesBillListPanel({
  bills,
  error,
  loading,
  page,
  pageEnd,
  pageStart,
  selectedOrderUuid,
  total,
  totalPages,
  onPageChange,
  onSelect
}: {
  bills: CancelableBill[];
  error: string | null;
  loading: boolean;
  page: number;
  pageEnd: number;
  pageStart: number;
  selectedOrderUuid: string;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onSelect: (bill: CancelableBill) => void;
}) {
  const { t } = useTranslation();

  // py-0 กัน py ฐานของ Card (16px) บวกซ้อนกับ py ของ CardHeader ด้านล่าง — ดูคำอธิบายเดียวกันใน sales-list-filters.tsx
  return (
    <Card className="flex min-h-0 flex-col overflow-hidden rounded-none border-x-0 border-b-0 border-border bg-card py-0 shadow-none xl:min-h-0 xl:border-r">
      <CardHeader className="shrink-0 border-b border-border bg-card px-3 py-2.5">
        <div className="flex w-full min-w-0 items-center justify-between gap-3">
          <CardTitle className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-foreground">
            <ReceiptText className="size-4 shrink-0 text-primary" />
            <span className="truncate">{t("cancelSale.billList")}</span>
          </CardTitle>
          <div className="ml-auto flex shrink-0 items-baseline justify-end gap-1.5 whitespace-nowrap text-right">
            <span className="text-xs text-muted-foreground">{t("common.total")}</span>
            <span className="text-sm font-semibold tabular-nums text-foreground">{total.toLocaleString("en-US")}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col p-0">
        {error ? (
          <div className="p-3">
            <Alert variant="destructive">
              <AlertTitle>{t("cancelSale.loadFailed")}</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        ) : null}
        {loading && !bills.length ? (
          <div className="p-4">
            <LoadingState label={t("common.loading")} variant="table" />
          </div>
        ) : bills.length ? (
          <>
            <div className="flex min-h-0 flex-1 flex-col divide-y divide-border overflow-y-auto overscroll-contain">
              {bills.map((bill) => (
                <BillListItem
                  key={billUuid(bill) || billInvoice(bill)}
                  bill={bill}
                  selected={billIsSelected(bill, selectedOrderUuid)}
                  onSelect={() => onSelect(bill)}
                />
              ))}
            </div>
            <SalesListPaginationFooter
              loading={loading}
              page={page}
              pageEnd={pageEnd}
              pageStart={pageStart}
              total={total}
              totalPages={totalPages}
              onPageChange={onPageChange}
            />
          </>
        ) : (
          <div className="flex min-h-80 items-center justify-center p-4">
            <EmptyState title={t("cancelSale.noBills")} description={t("cancelSale.noBillsDescription")} />
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
  bill: CancelableBill;
  onSelect: () => void;
  selected: boolean;
}) {
  const canCancel = billCanCancel(bill);

  return (
    <Button
      type="button"
      variant="ghost"
      className={cn(
        "relative h-auto w-full shrink-0 touch-manipulation flex-col items-stretch justify-start gap-1 overflow-hidden rounded-none px-3 py-2.5 text-left shadow-none transition-colors focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset",
        "hover:bg-muted/60",
        selected && "bg-primary/10 hover:bg-primary/10"
      )}
      aria-pressed={selected}
      onClick={onSelect}
    >
      {selected ? <span aria-hidden="true" className="absolute inset-y-2 left-0 w-0.5 rounded-r-full bg-primary" /> : null}
      <div className="flex min-w-0 items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", statusDotClass(bill))} />
          <span className="truncate text-sm font-semibold leading-6 text-foreground">{billInvoice(bill)}</span>
          <CancelableBadge canCancel={canCancel} compact />
        </span>
        <span className="shrink-0 text-sm font-semibold leading-6 tabular-nums text-foreground">{billTotal(bill)}</span>
      </div>

      <div className="flex min-w-0 items-center justify-between gap-2 text-xs leading-5 text-muted-foreground">
        <span className="flex min-w-0 items-center gap-1">
          <Table2 className="size-3 shrink-0" />
          <span className="truncate">{billTable(bill)}</span>
        </span>
        <time className="shrink-0 tabular-nums">{billDate(bill)}</time>
      </div>
    </Button>
  );
}
