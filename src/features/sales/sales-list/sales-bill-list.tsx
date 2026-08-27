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

  // py-0 กัน py ฐานของ Card (16px) บวกซ้อนกับ py ของ CardHeader ด้านล่าง — ดูคำอธิบายเดียวกันใน sales-list-filters.tsx
  return (
    <Card className="flex min-h-0 flex-col overflow-hidden rounded-none border-x-0 border-b-0 border-border bg-card py-0 shadow-none xl:min-h-0 xl:border-r">
      <CardHeader className="shrink-0 border-b border-border bg-card px-3 py-2.5">
        <div className="flex w-full min-w-0 items-center justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-foreground">
              <ReceiptText className="size-4 shrink-0 text-primary" />
              <span className="truncate">{t("salesList.billList")}</span>
            </CardTitle>
          </div>
          <div className="ml-auto flex shrink-0 items-baseline justify-end gap-1.5 whitespace-nowrap text-right">
            <span className="text-xs text-muted-foreground">{t("salesList.summary.total")}</span>
            <span className="text-sm font-semibold tabular-nums text-foreground">{money(totalAmount)}</span>
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
            {/* ต้องเลื่อนได้ทุกขนาดจอ ไม่ใช่เฉพาะ xl — ตอนนี้การ์ดเป็น flex เต็มความสูงทุกจอแล้ว
                ถ้าลิสต์ไม่เลื่อนเอง แถวจะทะลุออกไปอยู่ใต้แถบเลื่อนหน้าที่ปักไว้ล่างสุด */}
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
        "relative h-auto w-full shrink-0 touch-manipulation flex-col items-stretch justify-start gap-1 overflow-hidden rounded-none px-3 py-2.5 text-left shadow-none transition-colors focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset",
        // ค้างชำระ = ต้องระวัง ไม่ใช่ error/ยกเลิก จึงใช้ warning แยกจาก destructive
        needsPaymentAttention
          ? "bg-warning/10 hover:bg-warning/15"
          : "hover:bg-muted/60",
        selected &&
          (needsPaymentAttention
            ? "bg-warning/15 hover:bg-warning/15"
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
            needsPaymentAttention ? "bg-warning" : "bg-primary"
          )}
        />
      ) : null}
      <div className="flex min-w-0 items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-sm font-semibold leading-6 text-foreground">{bill.invoiceNumber}</span>
          {bill.status ? (
            <Badge className={cn("max-w-20 shrink-0 truncate px-1.5 py-0 text-2xs leading-4", statusBadgeClass(bill.status))}>
              {bill.status}
            </Badge>
          ) : null}
        </span>
        <span className="shrink-0 text-sm font-semibold leading-6 tabular-nums text-foreground">
          {money(bill.lineTotal)}
        </span>
      </div>

      <div className="flex min-w-0 items-center justify-between gap-2 text-xs leading-5 text-muted-foreground">
        <span className="flex min-w-0 items-center gap-2">
          <span className="flex min-w-0 items-center gap-1">
            <Table2 className="size-3 shrink-0" />
            <span className="truncate">{bill.tableName}</span>
          </span>
          <span className="flex min-w-0 items-center gap-1">
            <CreditCard className="size-3 shrink-0" />
            <span className="truncate">{bill.paymentMethodName}</span>
          </span>
          <span className="flex shrink-0 items-center gap-1" title={t("salesList.items")}>
            <ReceiptText className="size-3" />
            <span className="sr-only">{t("salesList.items")}: </span>
            <span className="tabular-nums">{bill.itemCount.toLocaleString("en-US")}</span>
          </span>
        </span>
        <time dateTime={bill.saleDate} className="shrink-0 tabular-nums">
          {formatSaleDate(bill.saleDate)}
        </time>
      </div>

      {/* บิลค้างชำระได้บรรทัดของตัวเอง — เป็นเคสส่วนน้อย แถวที่สูงกว่าจึงกลายเป็นสัญญาณให้สังเกต */}
      {needsPaymentAttention ? (
        <p className="min-w-0 truncate text-xs font-medium leading-5 text-warning">
          {bill.debtAmount > 0 ? `${t("salesList.debt")}: ${money(bill.debtAmount)}` : t("salesList.debt")}
        </p>
      ) : null}
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
