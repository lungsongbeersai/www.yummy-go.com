"use client";

import { Ban, Printer } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/common/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ApiEntity } from "@/services/shared/types";
import {
  billBranch,
  billDate,
  billDiscountAmount,
  billDiscountLabel,
  billInvoice,
  billItems,
  billItemsDiscountTotal,
  billNumber,
  billRateLabel,
  billStatus,
  billTable,
  billTotal,
  discountLabel,
  firstNumber,
  itemCashier,
  itemDiscountAmount,
  itemDiscountRecord,
  itemName,
  itemNote,
  itemPrice,
  itemQty,
  itemSize,
  itemStatus,
  itemToppingTotal,
  itemToppings,
  itemTotal,
  moneyOrDash,
  optionalNumber,
  readValue,
  statusClass,
  textValue,
  totalKeys,
  type BillSource
} from "./sales-list-utils";
import { CancelableBadge } from "./sales-list-status";

export function SalesBillDetailPanel({
  bill,
  canCancel,
  canReprintReceipt,
  loading,
  reprintingReceipt,
  onCancel,
  onReprintReceipt
}: {
  bill: BillSource;
  canCancel: boolean;
  canReprintReceipt: boolean;
  loading: boolean;
  reprintingReceipt: boolean;
  onCancel: () => void;
  onReprintReceipt: () => void;
}) {
  return (
    <aside className="hidden min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card md:flex">
      <SalesBillDetailContent
        bill={bill}
        canCancel={canCancel}
        canReprintReceipt={canReprintReceipt}
        loading={loading}
        reprintingReceipt={reprintingReceipt}
        onCancel={onCancel}
        onReprintReceipt={onReprintReceipt}
      />
    </aside>
  );
}

export function SalesBillMobileSheet({
  bill,
  canCancel,
  canReprintReceipt,
  loading,
  open,
  reprintingReceipt,
  onCancel,
  onOpenChange,
  onReprintReceipt
}: {
  bill: BillSource;
  canCancel: boolean;
  canReprintReceipt: boolean;
  loading: boolean;
  open: boolean;
  reprintingReceipt: boolean;
  onCancel: () => void;
  onOpenChange: (open: boolean) => void;
  onReprintReceipt: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[88dvh] gap-0 overflow-hidden rounded-t-lg p-0 md:hidden">
        <SheetHeader className="border-b border-border px-4 py-3 pr-12 text-left">
          <SheetTitle>{bill ? billInvoice(bill) : t("cancelSale.billDetail")}</SheetTitle>
          <SheetDescription>{bill ? billDate(bill) : t("cancelSale.selectBillHint")}</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 overflow-y-auto">
          <SalesBillDetailContent
            bill={bill}
            canCancel={canCancel}
            canReprintReceipt={canReprintReceipt}
            loading={loading}
            reprintingReceipt={reprintingReceipt}
            onCancel={onCancel}
            onReprintReceipt={onReprintReceipt}
            embedded
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SalesBillDetailContent({
  bill,
  canCancel,
  canReprintReceipt,
  embedded = false,
  loading,
  reprintingReceipt,
  onCancel,
  onReprintReceipt
}: {
  bill: BillSource;
  canCancel: boolean;
  canReprintReceipt: boolean;
  embedded?: boolean;
  loading: boolean;
  reprintingReceipt: boolean;
  onCancel: () => void;
  onReprintReceipt: () => void;
}) {
  const { t } = useTranslation();

  if (loading) return <SalesDetailSkeleton />;

  if (!bill) {
    return (
      <div className="flex min-h-72 flex-1 items-center justify-center p-4">
        <EmptyState title={t("cancelSale.noSelection")} description={t("cancelSale.selectBillHint")} />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className={cn("shrink-0 px-4 py-3", !embedded && "border-b border-border")}>
        <DetailTitleRow
          bill={bill}
          canCancel={canCancel}
          canReprintReceipt={canReprintReceipt}
          loading={loading}
          reprintingReceipt={reprintingReceipt}
          onCancel={onCancel}
          onReprintReceipt={onReprintReceipt}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 sm:px-4">
        <DetailSummaryStrip bill={bill} />
        <Separator className="my-4" />
        <DetailItemsReceipt bill={bill} />
        <Separator className="my-4" />
        <DetailTotals bill={bill} />
        <Separator className="my-4" />
        <DetailPayment bill={bill} />
      </div>
    </div>
  );
}

function DetailTitleRow({
  bill,
  canCancel,
  canReprintReceipt,
  loading,
  reprintingReceipt,
  onCancel,
  onReprintReceipt
}: {
  bill: BillSource;
  canCancel: boolean;
  canReprintReceipt: boolean;
  loading: boolean;
  reprintingReceipt: boolean;
  onCancel: () => void;
  onReprintReceipt: () => void;
}) {
  const { t } = useTranslation();
  const branch = billBranch(bill);
  const date = billDate(bill);
  const grandTotal = billTotal(bill);
  const table = billTable(bill);

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Badge className={statusClass(bill)}>{billStatus(bill)}</Badge>
            <CancelableBadge canCancel={canCancel} compact />
          </div>
          <h2 className="mt-2 truncate text-xl font-black leading-tight tabular-nums">{billInvoice(bill)}</h2>
          <p className="mt-1 truncate text-xs font-semibold text-muted-foreground">
            {table} / {date}
          </p>
          <p className="mt-1 truncate text-xs text-muted-foreground">{branch}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs font-bold uppercase text-muted-foreground">{t("cancelSale.grandTotal")}</p>
          <p className="mt-1 whitespace-nowrap text-lg font-black tabular-nums">{grandTotal}</p>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button className="w-full min-w-0" disabled={!canReprintReceipt || reprintingReceipt || loading} size="sm" type="button" variant="outline" onClick={onReprintReceipt}>
          {reprintingReceipt ? <Spinner data-icon="inline-start" /> : <Printer data-icon="inline-start" />}
          <span className="truncate">{reprintingReceipt ? t("cancelSale.reprintingReceipt") : t("cancelSale.reprintReceipt")}</span>
        </Button>
        <Button className="w-full min-w-0 shrink-0" disabled={!bill || !canCancel || loading} size="sm" type="button" variant="danger" onClick={onCancel}>
          <Ban data-icon="inline-start" />
          <span className="truncate">{t("cancelSale.cancelBill")}</span>
        </Button>
      </div>
    </div>
  );
}

function DetailSummaryStrip({ bill }: { bill: BillSource }) {
  const { t } = useTranslation();
  const itemQtyTotal = billItems(bill).reduce((sum, item) => sum + (optionalNumber(readValue(item, ["qty", "quantity", "order_it_qty"])) ?? 0), 0);
  const orderQty = firstNumber(billNumber(bill, ["order_qty", "qty", "quantity"], ["totals", "self", "order"]), itemQtyTotal);
  const orderTotal = billNumber(bill, ["order_total", "total"], ["totals", "self", "order"]);
  const paidTotal = billNumber(bill, ["paid_total", "order_paid_total"], ["payment", "self", "order"]);
  const balance = billNumber(bill, ["balance", "order_balance", "debt_amount"], ["payment", "self", "order"]);

  return (
    <div className="mt-4 grid grid-cols-2 overflow-hidden rounded-lg border border-border bg-muted/35 text-sm">
      <DetailStat label={t("cancelSale.orderQty")} value={String(orderQty ?? "-")} />
      <DetailStat label={t("cancelSale.total")} value={moneyOrDash(orderTotal)} />
      <DetailStat label={t("cancelSale.paidTotal")} value={moneyOrDash(paidTotal)} />
      <DetailStat label={t("common.balance")} value={moneyOrDash(balance)} />
    </div>
  );
}

function DetailStat({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="min-w-0 border-b border-r border-border px-3 py-2 even:border-r-0 [&:nth-last-child(-n+2)]:border-b-0">
      <p className="truncate text-xs font-semibold text-muted-foreground">{label}</p>
      <p className="mt-1 truncate font-black tabular-nums">{value}</p>
    </div>
  );
}

function DetailItemsReceipt({ bill }: { bill: BillSource }) {
  const { t } = useTranslation();
  const items = billItems(bill);

  return (
    <section className="flex flex-col gap-2">
      <DetailSectionTitle>{t("cancelSale.items")}</DetailSectionTitle>
      {items.length ? (
        <div className="flex flex-col overflow-hidden rounded-lg border border-border">
          {items.map((item, index) => (
            <DetailItemLine key={`${itemName(item)}-${index}`} item={item} index={index} />
          ))}
        </div>
      ) : (
        <EmptyState title={t("cancelSale.noItems")} description={t("cancelSale.noItemsDescription")} />
      )}
    </section>
  );
}

function DetailItemLine({ item, index }: { item: ApiEntity; index: number }) {
  const { t } = useTranslation();
  const cashier = itemCashier(item);
  const discount = itemDiscountRecord(item);
  const discountAmount = itemDiscountAmount(item);
  const discountText = discountLabel(discount, t("cancelSale.itemDiscount"));
  const note = itemNote(item);
  const size = itemSize(item);
  const toppings = itemToppings(item);
  const toppingTotal = itemToppingTotal(item);

  return (
    <div className={cn("flex flex-col gap-2 px-3 py-3", index > 0 && "border-t border-border")}>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words text-sm font-black">{itemName(item)}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            {size ? <span>{t("cancelSale.size")}: {size}</span> : null}
            <span>{itemQty(item)} x {itemPrice(item)}</span>
            <Badge className={statusClass(item)}>{itemStatus(item)}</Badge>
          </div>
        </div>
        <p className="shrink-0 text-right text-sm font-black tabular-nums">{itemTotal(item)}</p>
      </div>

      {discountAmount && discountAmount > 0 ? <ReceiptSubRow label={discountText} value={`-${money(discountAmount)}`} tone="destructive" /> : null}
      {toppingTotal && toppingTotal > 0 ? <ReceiptSubRow label={t("cancelSale.toppings")} value={`+${money(toppingTotal)}`} /> : null}
      {toppings.length ? (
        <div className="flex flex-col gap-1 rounded-md bg-muted/45 px-2 py-2 text-xs">
          {toppings.map((topping, toppingIndex) => {
            const name = textValue(readValue(topping, ["topping_name", "prod_topping_name", "product_name", "name"]), `${t("cancelSale.toppings")} ${toppingIndex + 1}`);
            const qty = textValue(readValue(topping, ["topping_qty", "qty", "quantity"]), "1");
            const total = moneyOrDash(readValue(topping, ["topping_total", "total", "line_total", "topping_price"]));
            return (
              <div key={`${name}-${toppingIndex}`} className="flex min-w-0 justify-between gap-3">
                <span className="min-w-0 truncate text-muted-foreground">+ {name} x {qty}</span>
                <span className="shrink-0 font-semibold tabular-nums">{total}</span>
              </div>
            );
          })}
        </div>
      ) : null}
      {note ? <ReceiptSubRow label={t("cancelSale.note")} value={note} /> : null}
      {cashier ? <ReceiptSubRow label={t("cancelSale.cashier")} value={cashier} /> : null}
    </div>
  );
}

function ReceiptSubRow({ label, tone, value }: { label: ReactNode; tone?: "destructive"; value: ReactNode }) {
  return (
    <div className="flex min-w-0 justify-between gap-3 text-xs">
      <span className={cn("min-w-0 truncate text-muted-foreground", tone === "destructive" && "text-destructive")}>{label}</span>
      <span className={cn("shrink-0 font-semibold tabular-nums", tone === "destructive" && "text-destructive")}>{value}</span>
    </div>
  );
}

function DetailTotals({ bill }: { bill: BillSource }) {
  const { t } = useTranslation();
  const billDiscount = billDiscountAmount(bill);
  const grandTotal = billNumber(bill, totalKeys, ["totals", "self", "order"]);
  const itemDiscount = billItemsDiscountTotal(bill);
  const orderTotal = billNumber(bill, ["order_total", "total"], ["totals", "self", "order"]);
  const service = billNumber(bill, ["amount", "service_charge_amount", "order_service_amount", "service_amount"], ["service_charge", "totals", "self", "order"]);
  const serviceRate = billRateLabel(bill, "service_charge");
  const subtotal = billNumber(bill, ["order_subtotal", "subtotal"], ["totals", "self", "order"]);
  const vat = billNumber(bill, ["amount", "vat_amount", "order_vat_amount", "vat_total"], ["vat", "totals", "self", "order"]);
  const vatRate = billRateLabel(bill, "vat");

  return (
    <section className="flex flex-col gap-2">
      <DetailSectionTitle>{t("cancelSale.billBreakdown")}</DetailSectionTitle>
      <div className="overflow-hidden rounded-lg border border-border">
        <ReceiptTotalRow label={t("cancelSale.total")} value={moneyOrDash(orderTotal)} />
        {itemDiscount && itemDiscount > 0 ? <ReceiptTotalRow label={t("cancelSale.itemDiscount")} value={`-${money(itemDiscount)}`} tone="destructive" /> : null}
        <ReceiptTotalRow label={t("cancelSale.subtotal")} value={moneyOrDash(subtotal)} />
        {billDiscount && billDiscount > 0 ? <ReceiptTotalRow label={billDiscountLabel(bill, t("cancelSale.billDiscount"))} value={`-${money(billDiscount)}`} tone="destructive" /> : null}
        {service && service > 0 ? <ReceiptTotalRow label={serviceRate ? `${t("cancelSale.serviceCharge")} (${serviceRate})` : t("cancelSale.serviceCharge")} value={money(service)} /> : null}
        {vat && vat > 0 ? <ReceiptTotalRow label={vatRate ? `${t("cancelSale.vat")} (${vatRate})` : t("cancelSale.vat")} value={money(vat)} /> : null}
        <ReceiptTotalRow emphasis label={t("cancelSale.grandTotal")} value={moneyOrDash(grandTotal)} />
      </div>
    </section>
  );
}

function DetailPayment({ bill }: { bill: BillSource }) {
  const { t } = useTranslation();
  const balance = billNumber(bill, ["balance", "order_balance"], ["payment", "self", "order"]);
  const cash = billNumber(bill, ["receive_cash", "cash_received", "cash"], ["payment", "self"]);
  const change = billNumber(bill, ["change_amount", "change"], ["payment", "self"]);
  const debt = billNumber(bill, ["debt_amount", "debt"], ["payment", "self"]);
  const paidTotal = billNumber(bill, ["paid_total", "order_paid_total"], ["payment", "self", "order"]);
  const transfer = billNumber(bill, ["receive_transfer", "transfer_received", "transfer"], ["payment", "self"]);

  return (
    <section className="flex flex-col gap-2">
      <DetailSectionTitle>{t("cancelSale.payment")}</DetailSectionTitle>
      <div className="overflow-hidden rounded-lg border border-border">
        <ReceiptTotalRow label={t("cancelSale.cashReceived")} value={moneyOrDash(cash)} />
        <ReceiptTotalRow label={t("cancelSale.transferReceived")} value={moneyOrDash(transfer)} />
        <ReceiptTotalRow label={t("cancelSale.paidTotal")} value={moneyOrDash(paidTotal)} />
        <ReceiptTotalRow label={t("common.balance")} value={moneyOrDash(balance ?? debt)} />
        <ReceiptTotalRow label={t("cancelSale.change")} value={moneyOrDash(change)} />
      </div>
    </section>
  );
}

function ReceiptTotalRow({
  emphasis = false,
  label,
  tone,
  value
}: {
  emphasis?: boolean;
  label: ReactNode;
  tone?: "destructive";
  value: ReactNode;
}) {
  return (
    <div className={cn("flex min-w-0 justify-between gap-3 border-b border-border px-3 py-2 text-sm last:border-b-0", emphasis && "bg-muted/45")}>
      <span className={cn("min-w-0 truncate text-muted-foreground", emphasis && "font-black text-foreground", tone === "destructive" && "text-destructive")}>{label}</span>
      <span className={cn("shrink-0 font-bold tabular-nums", emphasis && "font-black", tone === "destructive" && "text-destructive")}>{value}</span>
    </div>
  );
}

function DetailSectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="text-sm font-black">{children}</h3>;
}

function SalesDetailSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-2">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-4 w-52" />
          </div>
          <div className="flex flex-col items-end gap-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-6 w-28" />
          </div>
        </div>
        <Skeleton className="h-8 w-full" />
      </div>
      <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-border">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="border-b border-r border-border p-3 even:border-r-0 [&:nth-last-child(-n+2)]:border-b-0">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-2 h-5 w-24" />
          </div>
        ))}
      </div>
      {Array.from({ length: 3 }).map((_, sectionIndex) => (
        <div key={sectionIndex} className="flex flex-col gap-2">
          <Skeleton className="h-5 w-32" />
          <div className="overflow-hidden rounded-lg border border-border">
            {Array.from({ length: sectionIndex === 0 ? 3 : 5 }).map((_, rowIndex) => (
              <div key={rowIndex} className="flex items-center justify-between gap-3 border-b border-border p-3 last:border-b-0">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
