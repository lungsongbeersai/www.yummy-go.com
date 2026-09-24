"use client";

import { CreditCard, ReceiptText, Table2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AppPagination } from "@/components/common/app-pagination";
import { EmptyState } from "@/components/common/empty-state";
import { LoadingState } from "@/components/common/loading-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DailySaleItemsBillGroup } from "@/stores/report-store";
import {
  billNeedsPaymentAttention,
  billPaidClock,
  billPaymentLabel,
  groupBillsByDate,
  realMetaText,
  statusBadgeClass
} from "./sales-list-utils";

interface SalesBillListPanelProps {
  bills: DailySaleItemsBillGroup[];
  loading: boolean;
  onPageChange: (page: number) => void;
  onSelect: (billId: string) => void;
  page: number;
  rangeLabel: string;
  selectedBillId: string;
  totalAmount: number;
  totalBills: number;
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
  totalBills,
  totalPages
}: SalesBillListPanelProps) {
  const { t } = useTranslation();
  const groups = groupBillsByDate(bills);

  // py-0 กัน py ฐานของ Card (16px) บวกซ้อนกับ py ของ CardHeader ด้านล่าง — ดูคำอธิบายเดียวกันใน sales-list-filters.tsx
  return (
    <Card className="flex min-h-0 flex-col gap-0 overflow-hidden rounded-none border-x-0 border-b-0 border-border bg-card py-0 shadow-none xl:min-h-0 xl:border-r">
      <CardHeader className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-3 py-2.5 [.border-b]:pb-2.5">
        <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground">
          <ReceiptText className="size-4 shrink-0 text-primary-text" />
          <span className="truncate">{t("salesList.billList")}</span>
          {totalBills > 0 ? (
            <Badge variant="secondary" className="shrink-0 rounded-full px-2 tabular-nums">
              {totalBills.toLocaleString("en-US")}
            </Badge>
          ) : null}
        </CardTitle>
        <span className="flex shrink-0 items-baseline gap-1.5 whitespace-nowrap">
          <span className="text-xs text-muted-foreground">{t("salesList.summary.total")}</span>
          <span className="text-sm font-semibold tabular-nums text-foreground">{money(totalAmount)}</span>
        </span>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col p-0">
        {loading && !bills.length ? (
          <div className="p-4">
            <LoadingState label={t("salesList.loading")} variant="table" />
          </div>
        ) : bills.length ? (
          <>
            {/* ต้องเลื่อนได้ทุกขนาดจอ — ถ้าลิสต์ไม่เลื่อนเอง แถวจะทะลุไปอยู่ใต้แถบเลื่อนหน้าที่ปักไว้ล่างสุด
                aria-busy = โหลดหน้าใหม่ทับแถวเดิม (ยังโชว์แถวเก่าไว้) ให้ screen reader รู้ว่ากำลังโหลด */}
            <div aria-busy={loading} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {groups.map((group) => (
                <section key={group.key} aria-label={group.label}>
                  {/* หัววันที่ปักติดขอบบนระหว่างเลื่อน — ช่วงหลายวันจะรู้ตลอดว่ากำลังดูบิลของวันไหน */}
                  <h3 className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-border bg-muted/80 px-3 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur-sm">
                    <span className="tabular-nums">{group.label}</span>
                    <span className="tabular-nums">
                      {group.bills.length.toLocaleString("en-US")} {t("salesList.summary.bills")}
                    </span>
                  </h3>
                  <ul className="divide-y divide-border">
                    {group.bills.map((bill) => (
                      <li key={bill.id}>
                        <BillListItem
                          bill={bill}
                          selected={bill.id === selectedBillId}
                          onSelect={() => onSelect(bill.id)}
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
            <SalesListPagination
              disabled={loading}
              page={page}
              rangeLabel={rangeLabel}
              totalPages={totalPages}
              onPageChange={onPageChange}
            />
          </>
        ) : (
          <div className="flex min-h-80 flex-1 items-center justify-center p-4">
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
  const clock = billPaidClock(bill);
  const tableName = realMetaText(bill.tableName);

  // ปุ่มเปล่า (ไม่ใช่ Button ghost) — แถวเป็นกริด 3 คอลัมน์ ซึ่ง Button บังคับ flex/ความสูง/ขนาดตัวอักษรของมันเองทับ
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "relative grid w-full touch-manipulation grid-cols-[2.75rem_minmax(0,1fr)_auto] items-start gap-x-3 px-3 py-3 text-left transition-colors outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
        // ค้างชำระ = ต้องระวัง ไม่ใช่ error/ยกเลิก จึงใช้ warning แยกจาก destructive
        needsPaymentAttention ? "bg-warning/10 hover:bg-warning/15" : "hover:bg-muted/60",
        selected && (needsPaymentAttention ? "bg-warning/15" : "bg-primary/10 hover:bg-primary/10")
      )}
      onClick={onSelect}
    >
      {selected ? (
        <span
          aria-hidden="true"
          className={cn(
            "absolute inset-y-0 left-0 w-1 rounded-r-full",
            needsPaymentAttention ? "bg-warning" : "bg-primary"
          )}
        />
      ) : null}

      {/* คอลัมน์เวลาชำระ — สแกนหาบิลตามเวลาได้เร็วกว่าอ่านเลขบิลทีละแถว */}
      <span
        className={cn(
          "text-sm leading-6 font-semibold tabular-nums",
          clock ? (selected ? "text-primary-text" : "text-foreground") : "text-muted-foreground"
        )}
      >
        {clock || "—"}
      </span>

      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-sm leading-6 font-medium text-foreground tabular-nums">{bill.invoiceNumber}</span>
          {bill.status ? (
            <Badge className={cn("max-w-20 shrink-0 truncate px-1.5 py-0 text-2xs leading-4", statusBadgeClass(bill.status))}>
              {bill.status}
            </Badge>
          ) : null}
        </span>
        <span className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs leading-5 text-muted-foreground">
          {tableName ? (
            <span className="flex min-w-0 items-center gap-1">
              <Table2 aria-hidden="true" className="size-3 shrink-0" />
              <span className="truncate">{tableName}</span>
            </span>
          ) : null}
          <span className="flex min-w-0 items-center gap-1">
            <CreditCard aria-hidden="true" className="size-3 shrink-0" />
            <span className="truncate">{billPaymentLabel(bill, t)}</span>
          </span>
          <span className="shrink-0 tabular-nums">{t("pos.itemCount", { count: bill.itemCount })}</span>
        </span>
        {/* บิลค้างชำระได้บรรทัดของตัวเอง — เป็นเคสส่วนน้อย แถวที่สูงกว่าจึงกลายเป็นสัญญาณให้สังเกต */}
        {needsPaymentAttention ? (
          <span className="truncate text-xs leading-5 font-medium text-warning-text">
            {bill.debtAmount > 0 ? `${t("salesList.debt")}: ${money(bill.debtAmount)}` : t("salesList.debt")}
          </span>
        ) : null}
      </span>

      <span
        className={cn(
          "text-right text-sm leading-6 font-semibold tabular-nums text-foreground",
          bill.cancelled && "text-muted-foreground line-through"
        )}
      >
        {money(bill.lineTotal)}
      </span>
    </button>
  );
}

function SalesListPagination({
  disabled,
  onPageChange,
  page,
  rangeLabel,
  totalPages
}: {
  disabled: boolean;
  onPageChange: (page: number) => void;
  page: number;
  rangeLabel: string;
  totalPages: number;
}) {
  return (
    <div className="shrink-0 border-t border-border bg-muted/20 px-3 py-2.5 pb-[calc(0.625rem+max(var(--pos-system-bottom-safe-area,0px),var(--app-shell-bottom-nav-height,0px)))] text-sm text-muted-foreground sm:px-4 sm:py-3">
      <AppPagination disabled={disabled} page={page} rangeLabel={rangeLabel} totalPages={totalPages} onPageChange={onPageChange} />
    </div>
  );
}
