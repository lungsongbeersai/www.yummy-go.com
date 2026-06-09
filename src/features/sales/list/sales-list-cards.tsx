"use client";

import { Check, CalendarClock, Table2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/common/empty-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
} from "./sales-list-utils";
import { CancelableBadge } from "./sales-list-status";

export function SalesListContent({
  bills,
  error,
  loading,
  selectedOrderUuid,
  onSelect
}: {
  bills: CancelableBill[];
  error: string | null;
  loading: boolean;
  selectedOrderUuid: string;
  onSelect: (bill: CancelableBill) => void;
}) {
  const { t } = useTranslation();

  if (loading) return <SalesListSkeleton />;

  return (
    <div className="min-h-0 flex-1 overflow-hidden">
      {error ? (
        <div className="p-3">
          <Alert variant="destructive">
            <AlertTitle>{t("salesList.loadFailed")}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      ) : null}
      {bills.length ? (
        <SalesBillCardList bills={bills} selectedOrderUuid={selectedOrderUuid} onSelect={onSelect} />
      ) : (
        <div className="flex min-h-72 items-center justify-center p-4">
          <EmptyState title={t("salesList.noBills")} description={t("salesList.noBillsDescription")} />
        </div>
      )}
    </div>
  );
}

function SalesBillCardList({
  bills,
  selectedOrderUuid,
  onSelect
}: {
  bills: CancelableBill[];
  selectedOrderUuid: string;
  onSelect: (bill: CancelableBill) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="h-full min-h-0 overflow-y-auto p-2 sm:p-3">
      <div aria-label={t("salesList.title")} className="grid grid-cols-[repeat(auto-fill,minmax(min(16rem,100%),1fr))] gap-2 pb-3 xl:gap-3" role="listbox">
        {bills.map((bill) => (
          <SalesBillCard
            key={billUuid(bill) || billInvoice(bill)}
            bill={bill}
            selected={billIsSelected(bill, selectedOrderUuid)}
            onSelect={() => onSelect(bill)}
          />
        ))}
      </div>
    </div>
  );
}

function SalesBillCard({
  bill,
  selected,
  onSelect
}: {
  bill: CancelableBill;
  selected: boolean;
  onSelect: () => void;
}) {
  const { t } = useTranslation();
  const invoice = billInvoice(bill);

  return (
    <Card
      aria-selected={selected}
      className={cn(
        "relative overflow-hidden rounded-lg bg-card shadow-sm transition hover:border-primary/40 hover:shadow-md",
        selected && "border-primary/60 ring-2 ring-primary ring-offset-2 ring-offset-background"
      )}
      data-state={selected ? "selected" : undefined}
      role="option"
    >
      {selected ? (
        <div aria-hidden="true" className="pointer-events-none absolute left-0 top-0 size-12 overflow-hidden">
          <div className="absolute -left-6 -top-6 size-12 rotate-45 bg-primary" />
          <Check className="absolute left-1 top-1 text-primary-foreground" />
        </div>
      ) : null}
      <Button
        aria-pressed={selected}
        className="h-full min-h-[156px] w-full items-stretch justify-start rounded-none p-0 text-left hover:bg-transparent sm:min-h-[172px]"
        type="button"
        variant="ghost"
        onClick={onSelect}
      >
        <CardContent className="flex min-w-0 flex-1 flex-col p-0">
          <div className="relative flex min-h-[94px] flex-1 flex-col items-center justify-center px-4 py-4 text-center sm:min-h-[104px]">
            <span aria-hidden="true" className={cn("absolute right-3 top-3 size-3 rounded-full border-[3px] border-background shadow-sm", statusDotClass(bill))} />
            <p className="text-xs font-black uppercase leading-none text-muted-foreground">{t("salesList.invoice")}</p>
            <p className="mt-2 max-w-full truncate text-[28px] font-black leading-none tracking-normal text-foreground tabular-nums sm:text-[34px]">
              {invoice}
            </p>
            <p className="mt-2 max-w-full truncate text-xs font-semibold text-muted-foreground">
              {billTable(bill)} / {billDate(bill)}
            </p>
          </div>

          <div className="grid grid-cols-2 border-t border-border bg-muted/45 text-xs">
            <BillCardMetric className="border-b border-r border-border" icon={<Table2 />} label={t("salesList.table")} value={billTable(bill)} />
            <BillCardMetric className="border-b border-border" icon={<CalendarClock />} label={t("salesList.date")} value={billDate(bill)} valueClassName="tabular-nums" />
            <BillCardMetric className="border-r border-border" icon={<KipIcon />} label={t("salesList.total")} value={billTotal(bill)} valueClassName="font-black tabular-nums" />
            <div className="flex min-h-9 min-w-0 items-center justify-between gap-2 px-3 py-2">
              <span className="min-w-0 truncate text-muted-foreground">{t("salesList.cancelable")}</span>
              <span className="shrink-0">
                <CancelableBadge canCancel={billCanCancel(bill)} compact />
              </span>
            </div>
          </div>
        </CardContent>
      </Button>
    </Card>
  );
}

function BillCardMetric({
  className,
  icon,
  label,
  value,
  valueClassName
}: {
  className?: string;
  icon: ReactNode;
  label: ReactNode;
  value: ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className={cn("flex min-h-9 min-w-0 items-center gap-2 px-3 py-2", className)}>
      <span aria-hidden="true" className="shrink-0 text-muted-foreground [&_svg]:size-4">
        {icon}
      </span>
      <span className="sr-only">{label}</span>
      <span className={cn("min-w-0 truncate font-bold", valueClassName)}>{value}</span>
    </div>
  );
}

function KipIcon() {
  return (
    <span aria-hidden="true" className="inline-flex size-4 items-center justify-center text-sm font-black leading-none">
      {"\u20ad"}
    </span>
  );
}

function SalesListSkeleton() {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(min(16rem,100%),1fr))] gap-2 p-2 sm:p-3 xl:gap-3">
      {Array.from({ length: 10 }).map((_, index) => (
        <Card key={index} className="overflow-hidden shadow-sm">
          <CardContent className="flex min-h-[156px] flex-col p-0 sm:min-h-[172px]">
            <div className="relative flex min-h-[94px] flex-1 flex-col items-center justify-center px-4 py-4 sm:min-h-[104px]">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="mt-3 h-8 w-36 sm:h-9" />
              <Skeleton className="mt-3 h-3 w-44" />
              <Skeleton className="absolute right-3 top-3 size-3 rounded-full" />
            </div>
            <div className="grid grid-cols-2 border-t border-border bg-muted/45">
              {Array.from({ length: 4 }).map((_, cellIndex) => (
                <div
                  key={cellIndex}
                  className={cn(
                    "flex min-w-0 items-center gap-2 px-3 py-2",
                    cellIndex === 0 && "border-b border-r border-border",
                    cellIndex === 1 && "border-b border-border",
                    cellIndex === 2 && "border-r border-border"
                  )}
                >
                  <Skeleton className="size-4 shrink-0" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
