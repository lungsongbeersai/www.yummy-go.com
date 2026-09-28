"use client";

import { Lock, ReceiptText, Table2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/common/empty-state";
import { LoadingState } from "@/components/common/loading-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { CancelableBill } from "@/services/cancel";
import {
  billCanCancel,
  billClock,
  billInvoice,
  billIsSelected,
  billQtyTotal,
  billState,
  billTotal,
  billUuid,
  cleanText,
  groupCancelableBillsByDate,
  readFromBillSections
} from "./cancel-sale-utils";
import { BillStateBadge } from "./cancel-sale-status";
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
  const groups = groupCancelableBillsByDate(bills);
  // นับเฉพาะหน้าที่โหลดอยู่ — API ไม่ส่งจำนวนที่ยกเลิกได้ของทั้งช่วงมาให้
  const cancellableCount = bills.filter((bill) => billCanCancel(bill)).length;

  // py-0 กัน py ฐานของ Card (16px) บวกซ้อนกับ py ของ CardHeader ด้านล่าง — ดูคำอธิบายเดียวกันใน sales-list-filters.tsx
  return (
    <Card className="flex min-h-0 flex-col gap-0 overflow-hidden rounded-none border-x-0 border-b-0 border-border bg-card py-0 shadow-none xl:min-h-0 xl:border-r">
      <CardHeader className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-3 py-2.5 [.border-b]:pb-2.5">
        <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground">
          <ReceiptText className="size-4 shrink-0 text-primary-text" />
          <span className="truncate">{t("cancelSale.billList")}</span>
          {total > 0 ? (
            <Badge variant="secondary" className="shrink-0 rounded-full px-2 tabular-nums">
              {total.toLocaleString("en-US")}
            </Badge>
          ) : null}
        </CardTitle>
        {bills.length ? (
          <span className="shrink-0 whitespace-nowrap text-xs font-medium tabular-nums text-info">
            {t("cancelSale.cancellableCount", { count: cancellableCount })}
          </span>
        ) : null}
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
            {/* aria-busy = โหลดหน้าใหม่ทับแถวเดิม (ยังโชว์แถวเก่าไว้) ให้ screen reader รู้ว่ากำลังโหลด */}
            <div aria-busy={loading} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {groups.map((group) => (
                <section key={group.key} aria-label={group.label}>
                  {/* หัววันที่ปักติดขอบบน — แทนการพิมพ์วันที่ (และเวลาปลอม 7:00 AM) ซ้ำทุกแถวแบบเดิม */}
                  <h3 className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-border bg-muted/80 px-3 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur-sm">
                    <span className="tabular-nums">{group.label}</span>
                    <span className="tabular-nums">
                      {group.bills.length.toLocaleString("en-US")} {t("salesList.summary.bills")}
                    </span>
                  </h3>
                  <ul className="divide-y divide-border">
                    {group.bills.map((bill) => (
                      <li key={billUuid(bill) || billInvoice(bill)}>
                        <BillListItem
                          bill={bill}
                          selected={billIsSelected(bill, selectedOrderUuid)}
                          onSelect={() => onSelect(bill)}
                        />
                      </li>
                    ))}
                  </ul>
                </section>
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
          <div className="flex min-h-80 flex-1 items-center justify-center p-4">
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
  const { t } = useTranslation();
  const canCancel = billCanCancel(bill);
  const state = billState(bill);
  const tableName = cleanText(readFromBillSections([bill], ["table_name", "table_name_la", "table_name_eng", "table_no"], ["order", "self"]));
  const qty = billQtyTotal(bill);
  const clock = billClock(bill);

  // ปุ่มเปล่า (ไม่ใช่ Button ghost) — แถวเป็นกริด 3 คอลัมน์ ซึ่ง Button บังคับ flex/ความสูง/ขนาดตัวอักษรของมันเองทับ
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "relative grid w-full touch-manipulation grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-x-3 px-3 py-3 text-left transition-colors outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
        selected ? "bg-primary/10" : "hover:bg-muted/60"
      )}
      onClick={onSelect}
    >
      {selected ? <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 rounded-r-full bg-primary" /> : null}

      {/* โต๊ะเป็นสิ่งที่พนักงานใช้จำบิล ("บิลโต๊ะ 4") เร็วกว่าเลขบิล — ยกขึ้นเป็นไทล์คอลัมน์แรก */}
      <span
        className={cn(
          "flex size-11 items-center justify-center rounded-lg border text-sm font-bold tabular-nums",
          selected ? "border-primary/30 bg-card text-primary-text" : "border-border bg-muted/60 text-foreground",
          !canCancel && "text-muted-foreground"
        )}
      >
        {tableName ? <span className="truncate px-1">{tableName}</span> : <Table2 aria-hidden="true" className="size-4" />}
      </span>

      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className={cn("truncate text-sm leading-6 font-semibold tabular-nums", canCancel ? "text-foreground" : "text-muted-foreground")}>
            {billInvoice(bill)}
          </span>
          {state !== "paid" ? <BillStateBadge state={state} compact /> : null}
        </span>
        <span className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs leading-5 text-muted-foreground">
          {qty !== null ? <span className="shrink-0 tabular-nums">{t("pos.itemCount", { count: qty })}</span> : null}
          {clock ? <span className="shrink-0 tabular-nums">{clock}</span> : null}
          {canCancel ? null : (
            <span className="flex min-w-0 items-center gap-1">
              <Lock aria-hidden="true" className="size-3 shrink-0" />
              <span className="truncate">{t("cancelSale.cannotCancel")}</span>
            </span>
          )}
        </span>
      </span>

      <span
        className={cn(
          "text-right text-sm leading-6 font-semibold tabular-nums text-foreground",
          state === "cancelled" && "text-muted-foreground line-through"
        )}
      >
        {billTotal(bill)}
      </span>
    </button>
  );
}
