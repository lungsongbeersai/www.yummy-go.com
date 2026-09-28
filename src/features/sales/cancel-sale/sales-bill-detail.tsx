"use client";

import type { ReactNode } from "react";
import { ArrowLeftRight, BadgePercent, Ban, Banknote, Coins, Lock, Package, Printer, StickyNote, Tag, UserRound, Wallet } from "lucide-react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/common/empty-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ApiEntity } from "@/services/shared/types";
import {
  billBranch,
  billDay,
  billDiscountAmount,
  billDiscountLabel,
  billInvoice,
  billItems,
  billItemsDiscountTotal,
  billNumber,
  billQtyTotal,
  billRateLabel,
  billState,
  billTotal,
  cleanText,
  discountLabel,
  itemCashier,
  itemDiscountAmount,
  itemDiscountRecord,
  itemName,
  itemNote,
  itemPrice,
  itemQty,
  itemSize,
  itemTastes,
  itemToppingTotal,
  itemToppings,
  itemTotal,
  moneyOrDash,
  readFromBillSections,
  readValue,
  textValue,
  totalKeys,
  type BillSource
} from "./cancel-sale-utils";
import { BillStateBadge, CancelableBadge } from "./cancel-sale-status";

interface SalesBillDetailProps {
  bill: BillSource;
  canCancel: boolean;
  canReprintReceipt: boolean;
  loading: boolean;
  reprintingReceipt: boolean;
  onCancel: () => void;
  onReprintReceipt: () => void;
}

export function SalesBillDetailPanel({
  bill,
  canCancel,
  canReprintReceipt,
  className,
  loading,
  reprintingReceipt,
  onCancel,
  onReprintReceipt,
  variant = "panel"
}: SalesBillDetailProps & { className?: string; variant?: "panel" | "drawer" }) {
  const { t } = useTranslation();
  const drawer = variant === "drawer";
  // py-0/gap-0 กัน py และ gap ฐานของ Card บวกซ้อนกับระยะของ CardHeader/CardContent — ดู sales-list-filters.tsx
  const cardClass = cn(
    "min-h-0 gap-0 overflow-hidden rounded-none border-x-0 border-b-0 border-border bg-card py-0 shadow-none xl:flex xl:min-h-0 xl:flex-col",
    className
  );

  // โหลดรายละเอียดอยู่ = โชว์โครงว่างเสมอ (แบบเดิม) — ระหว่างโหลด store อาจยังถือบิลใบก่อนอยู่
  // ถ้าโชว์ของเดิมค้างไว้ พนักงานอาจเห็นยอด/รายการของอีกบิลตอนกำลังจะกดยกเลิก
  if (loading) {
    return (
      <Card className={cardClass}>
        <SalesDetailSkeleton />
      </Card>
    );
  }

  if (!bill) {
    return (
      <Card className={cardClass}>
        <div className="flex min-h-96 flex-1 items-center justify-center p-4">
          <EmptyState title={t("cancelSale.noSelection")} description={t("cancelSale.selectBillHint")} />
        </div>
      </Card>
    );
  }

  const actions = (
    <BillDetailActions
      canCancel={canCancel}
      canReprintReceipt={canReprintReceipt}
      drawer={drawer}
      loading={loading}
      reprintingReceipt={reprintingReceipt}
      onCancel={onCancel}
      onReprintReceipt={onReprintReceipt}
    />
  );
  const body = (
    <div className="flex flex-col gap-4 p-3 sm:p-4">
      {canCancel ? null : <CannotCancelNotice bill={bill} />}
      <BillInfoGrid bill={bill} />
      <BillItemsSection bill={bill} />
    </div>
  );

  // มือถือมีความสูงจำกัด — หัวแผงและสรุปยอดเลื่อนไปพร้อมเนื้อหา เหลือปักไว้ล่างสุดแค่ยอดสุทธิ + ปุ่ม
  // ในระยะนิ้วโป้ง (แบบเดียวกับ sales-list) ปุ่มยกเลิกบิลจึงไม่หลุดไปอยู่ใต้รายการยาว ๆ
  if (drawer) {
    return (
      <Card className={cardClass}>
        <CardContent className="flex min-h-0 flex-1 flex-col p-0">
          <div aria-busy={loading} className="min-h-0 flex-1 overflow-auto">
            <div className="border-b border-border px-4 pt-1 pb-3">
              <BillHeading bill={bill} canCancel={canCancel} />
            </div>
            {body}
            <BillSummary bill={bill} />
          </div>
          <div className="flex shrink-0 flex-col gap-2.5 border-t border-border bg-card px-4 py-3 pb-[calc(0.75rem+var(--pos-system-bottom-safe-area,0px))]">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-xs text-muted-foreground">{t("cancelSale.grandTotal")}</span>
              <span className="truncate text-lg leading-6 font-bold tabular-nums text-primary-text">{billTotal(bill)}</span>
            </div>
            {actions}
          </div>
        </CardContent>
      </Card>
    );
  }

  // จอกว้างมาก (2xl) สรุปยอดย้ายไปคอลัมน์ขวา — รายการสินค้าได้ความสูงเต็มแผงแทนที่จะถูกกล่องสรุปกินด้านล่าง
  return (
    <Card className={cardClass}>
      <CardHeader className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3 [.border-b]:pb-3">
        <BillHeading bill={bill} canCancel={canCancel} />
        {actions}
      </CardHeader>
      <CardContent aria-busy={loading} className="flex min-h-0 flex-1 flex-col p-0 2xl:flex-row">
        <div className="min-h-0 flex-1 overflow-auto">{body}</div>
        <BillSummary bill={bill} className="2xl:w-88 2xl:border-t-0 2xl:border-l" />
      </CardContent>
    </Card>
  );
}

export function SalesBillDetailDrawer({
  open,
  onOpenChange,
  ...props
}: SalesBillDetailProps & { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation();

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="h-[calc(100dvh-0.75rem)] max-h-[92dvh] gap-0 overflow-hidden rounded-t-xl xl:hidden">
        <DrawerHeader className="sr-only">
          <DrawerTitle>{props.bill ? billInvoice(props.bill) : t("cancelSale.billDetail")}</DrawerTitle>
          <DrawerDescription>{t("cancelSale.selectBillHint")}</DrawerDescription>
        </DrawerHeader>
        <div className="min-h-0 flex-1 overflow-hidden">
          <SalesBillDetailPanel {...props} className="flex h-full flex-col rounded-none border-0 shadow-none" variant="drawer" />
        </div>
      </DrawerContent>
    </Drawer>
  );
}

// หัวแผงเดิมเรียง badge สถานะ (เลขดิบ "2") + ป้ายยกเลิกได้ ไว้เหนือเลขบิล และแยกโต๊ะ/วันที่/สาขาเป็นหลายบรรทัด
// — ยกเลขบิลเป็นหัวข้อ สถานะเป็นคำที่อ่านได้ แล้วโต๊ะ · วันที่ · สาขาเป็นบรรทัดรองบรรทัดเดียว แบบ sales-list
function BillHeading({ bill, canCancel }: { bill: BillSource; canCancel: boolean }) {
  const { t } = useTranslation();
  const table = cleanText(readFromBillSections([bill], ["table_name", "table_name_la", "table_name_eng", "table_no"], ["order", "self"]));
  const branch = cleanText(billBranch(bill));
  const meta = [table ? `${t("cancelSale.table")} ${table}` : "", billDay(bill).label, branch]
    .filter((value) => value && value !== "-")
    .join(" · ");

  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <p className="text-xs leading-5 text-muted-foreground">{t("cancelSale.billDetail")}</p>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <CardTitle className="truncate text-xl leading-7 font-bold tabular-nums">{billInvoice(bill)}</CardTitle>
        <BillStateBadge state={billState(bill)} compact />
        <CancelableBadge canCancel={canCancel} compact />
      </div>
      {meta ? <p className="truncate text-sm leading-5 text-muted-foreground tabular-nums">{meta}</p> : null}
    </div>
  );
}

function BillDetailActions({
  canCancel,
  canReprintReceipt,
  drawer,
  loading,
  reprintingReceipt,
  onCancel,
  onReprintReceipt
}: Omit<SalesBillDetailProps, "bill"> & { drawer: boolean }) {
  const { t } = useTranslation();

  return (
    <div className={cn("flex shrink-0 gap-2", drawer && "grid grid-cols-2")}>
      <Button
        type="button"
        variant="outline"
        className={cn("min-w-0", drawer ? "h-11" : "h-9")}
        disabled={!canReprintReceipt || reprintingReceipt || loading}
        onClick={onReprintReceipt}
      >
        {reprintingReceipt ? <Spinner data-icon="inline-start" /> : <Printer data-icon="inline-start" />}
        <span className="truncate">{reprintingReceipt ? t("cancelSale.reprintingReceipt") : t("cancelSale.reprintReceipt")}</span>
      </Button>
      {/* ปุ่มยกเลิกเป็นปุ่มหลักของหน้านี้ — ผ่าน AlertDialog ขอเหตุผลก่อนเสมอ (cancel-bill-dialog.tsx) */}
      <Button
        type="button"
        variant="destructive"
        className={cn(
          "min-w-0 bg-destructive text-destructive-foreground hover:bg-destructive hover:brightness-90 dark:bg-destructive dark:hover:bg-destructive",
          drawer ? "h-11" : "h-9"
        )}
        disabled={!canCancel || loading}
        onClick={onCancel}
      >
        {canCancel ? <Ban data-icon="inline-start" /> : <Lock data-icon="inline-start" />}
        <span className="truncate">{t("cancelSale.cancelBill")}</span>
      </Button>
    </div>
  );
}

// เดิมปุ่มยกเลิกแค่ถูกปิดไว้เงียบ ๆ ไม่บอกเหตุผล — บอกกติกาตรงนี้ให้รู้ว่าทำไมกดไม่ได้
function CannotCancelNotice({ bill }: { bill: BillSource }) {
  const { t } = useTranslation();
  const cancelled = billState(bill) === "cancelled";

  return (
    <Alert>
      <Lock />
      <AlertTitle>{cancelled ? t("cancelSale.stateCancelled") : t("cancelSale.cannotCancel")}</AlertTitle>
      <AlertDescription>{t("cancelSale.cancelUnavailable")}</AlertDescription>
    </Alert>
  );
}

interface BillInfoItem {
  icon: ReactNode;
  label: string;
  tone?: "warning";
  value: string;
  wide?: boolean;
}

// จำนวน/การรับเงิน — เดิมเป็นตารางสองชุด (แถบสรุป 4 ช่อง + ตารางการชำระ 5 แถว) ที่ซ้ำกันเองหลายค่า
// รวมเป็นกริด label-over-value ชุดเดียวในกล่องพื้นอ่อน โชว์เฉพาะค่าที่มีจริงแบบ sales-list
function BillInfoGrid({ bill }: { bill: BillSource }) {
  const { t } = useTranslation();
  const customer = cleanText(readFromBillSections([bill], ["customer_name", "customer", "member_code", "customer_phone"], ["payment", "self", "order"]));
  const qty = billQtyTotal(bill);
  const cash = billNumber(bill, ["receive_cash", "cash_received", "cash"], ["payment", "self"]);
  const transfer = billNumber(bill, ["receive_transfer", "transfer_received", "transfer"], ["payment", "self"]);
  const change = billNumber(bill, ["change_amount", "change"], ["payment", "self"]);
  const paidTotal = billNumber(bill, ["paid_total", "order_paid_total"], ["payment", "self", "order"]);
  const balance = billNumber(bill, ["balance", "order_balance", "debt_amount"], ["payment", "self", "order"]);
  const candidates: Array<BillInfoItem | null> = [
    customer ? { icon: <UserRound />, label: t("pos.customer"), value: customer, wide: true } : null,
    qty !== null ? { icon: <Package />, label: t("cancelSale.orderQty"), value: qty.toLocaleString("en-US") } : null,
    paidTotal !== null ? { icon: <Wallet />, label: t("cancelSale.paidTotal"), value: money(paidTotal) } : null,
    cash !== null && cash > 0 ? { icon: <Banknote />, label: t("cancelSale.cashReceived"), value: money(cash) } : null,
    transfer !== null && transfer > 0 ? { icon: <ArrowLeftRight />, label: t("cancelSale.transferReceived"), value: money(transfer) } : null,
    change !== null && change > 0 ? { icon: <Coins />, label: t("cancelSale.change"), value: money(change) } : null,
    balance !== null && balance > 0 ? { icon: <Wallet />, label: t("common.balance"), tone: "warning", value: money(balance) } : null
  ];
  const items = candidates.filter((item): item is BillInfoItem => Boolean(item));

  if (!items.length) return null;

  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg bg-muted/50 p-3 md:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className={cn("flex min-w-0 flex-col gap-0.5", item.wide && "col-span-2")}>
          <dt className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground [&_svg]:size-3.5 [&_svg]:shrink-0">
            {item.icon}
            <span className="truncate">{item.label}</span>
          </dt>
          <dd
            className={cn(
              "text-sm leading-5 font-medium wrap-break-word tabular-nums",
              item.tone === "warning" ? "text-warning-text" : "text-foreground"
            )}
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function BillItemsSection({ bill }: { bill: BillSource }) {
  const { t } = useTranslation();
  const items = billItems(bill);

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2 px-0.5">
        <h3 className="text-sm font-semibold text-foreground">{t("cancelSale.items")}</h3>
        <span className="text-xs text-muted-foreground tabular-nums">{t("pos.itemCount", { count: items.length })}</span>
      </div>
      {items.length ? (
        <div className="flex flex-col overflow-hidden rounded-md border border-border bg-card">
          {items.map((item, index) => (
            <BillItemRow key={textValue(readValue(item, ["order_item_uuid"]), String(index))} item={item} />
          ))}
        </div>
      ) : (
        <EmptyState title={t("cancelSale.noItems")} description={t("cancelSale.noItemsDescription")} />
      )}
    </section>
  );
}

// แถวสินค้าแบบเดียวกับ sales-list-items: ชื่อ+ยอดบรรทัดแรก แล้วจำนวน×ราคา/ท็อปปิ้ง/ส่วนลด/โน้ตเป็นบรรทัดย่อย
// ตัด badge สถานะรายการ (order_it_status) ออก — API ส่งเป็นเลขดิบที่ utils อ่านไม่ออกจนขึ้น "-" ทุกแถว
function BillItemRow({ item }: { item: ApiEntity }) {
  const { t } = useTranslation();
  const size = itemSize(item);
  const note = itemNote(item);
  const cashier = itemCashier(item);
  const discountAmount = itemDiscountAmount(item);
  const discountText = discountLabel(itemDiscountRecord(item), t("cancelSale.itemDiscount"));
  const tastes = itemTastes(item);
  const toppings = itemToppings(item);
  const toppingTotal = itemToppingTotal(item);

  return (
    <div className="flex flex-col gap-1 border-b border-border/80 bg-background px-3 py-2.5 last:border-b-0 sm:px-4">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <p className="min-w-0 wrap-break-word text-base leading-6 font-semibold text-foreground sm:text-sm">
          {itemName(item)}
          {size ? <span className="font-normal text-muted-foreground"> ({size})</span> : null}
        </p>
        <p className="shrink-0 text-base leading-6 font-semibold text-foreground tabular-nums sm:text-sm">{itemTotal(item)}</p>
      </div>

      <ItemDetailRow icon={<Tag />}>
        <span className="tabular-nums">
          {itemQty(item)} x {itemPrice(item)}
        </span>
      </ItemDetailRow>
      {tastes.map((taste, index) => (
        <ItemDetailRow key={`taste-${index}`} className="pl-5">
          • {textValue(readValue(taste, ["taste_name", "prod_taste_name", "taste_name_la", "taste_name_eng", "name"]), `${t("pos.tastes")} ${index + 1}`)}
        </ItemDetailRow>
      ))}
      {toppings.map((topping, index) => {
        const name = textValue(readValue(topping, ["topping_name", "prod_topping_name", "product_name", "name"]), `${t("cancelSale.toppings")} ${index + 1}`);
        const qty = textValue(readValue(topping, ["topping_qty", "qty", "quantity"]), "1");
        return (
          <ItemDetailRow
            key={`topping-${index}`}
            className="pl-5"
            right={moneyOrDash(readValue(topping, ["topping_total", "total", "line_total", "topping_price"]))}
          >
            + {name} x {qty}
          </ItemDetailRow>
        );
      })}
      {!toppings.length && toppingTotal && toppingTotal > 0 ? (
        <ItemDetailRow className="pl-5" right={`+${money(toppingTotal)}`}>
          + {t("cancelSale.toppings")}
        </ItemDetailRow>
      ) : null}
      {discountAmount && discountAmount > 0 ? (
        <ItemDetailRow icon={<BadgePercent />} tone="discount" right={`-${money(discountAmount)}`}>
          {discountText}
        </ItemDetailRow>
      ) : null}
      {note ? (
        <ItemDetailRow icon={<StickyNote />}>
          <span className="text-foreground/70">{t("cancelSale.note")}: </span>
          {note}
        </ItemDetailRow>
      ) : null}
      {cashier ? (
        <ItemDetailRow icon={<UserRound />}>
          <span className="text-foreground/70">{t("cancelSale.cashier")}: </span>
          {cashier}
        </ItemDetailRow>
      ) : null}
    </div>
  );
}

function ItemDetailRow({
  children,
  className,
  icon,
  right,
  tone
}: {
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
  right?: ReactNode;
  tone?: "discount";
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-start justify-between gap-3 text-xs leading-5",
        tone === "discount" ? "text-destructive" : "text-muted-foreground",
        className
      )}
    >
      <span className="flex min-w-0 items-start gap-1.5">
        {icon ? <span className="mt-0.5 flex size-3.5 shrink-0 items-center justify-center [&_svg]:size-3.5">{icon}</span> : null}
        <span className="min-w-0 wrap-break-word">{children}</span>
      </span>
      {right ? <span className="shrink-0 font-medium tabular-nums">{right}</span> : null}
    </div>
  );
}

interface SummaryLine {
  key: string;
  label: string;
  tone?: "discount";
  value: string;
}

// สรุปยอดแบบท้ายใบเสร็จ: แถวย่อยเรียบ เส้นประคั่น แล้วยอดสุทธิใหญ่สุดเป็นจุดโฟกัสเดียวของแผง (แบบ sales-list)
function BillSummary({ bill, className }: { bill: BillSource; className?: string }) {
  const { t } = useTranslation();
  const orderTotal = billNumber(bill, ["order_total", "total"], ["totals", "self", "order"]);
  const itemDiscount = billItemsDiscountTotal(bill);
  const subtotal = billNumber(bill, ["order_subtotal", "subtotal"], ["totals", "self", "order"]);
  const billDiscount = billDiscountAmount(bill);
  const service = billNumber(bill, ["amount", "service_charge_amount", "order_service_amount", "service_amount"], ["service_charge", "totals", "self", "order"]);
  const serviceRate = billRateLabel(bill, "service_charge");
  const vat = billNumber(bill, ["amount", "vat_amount", "order_vat_amount", "vat_total"], ["vat", "totals", "self", "order"]);
  const vatRate = billRateLabel(bill, "vat");
  const grandTotal = billNumber(bill, totalKeys, ["totals", "self", "order"]);
  const candidates: Array<SummaryLine | null> = [
    orderTotal !== null ? { key: "total", label: t("cancelSale.total"), value: money(orderTotal) } : null,
    itemDiscount && itemDiscount > 0
      ? { key: "itemDiscount", label: t("cancelSale.itemDiscount"), tone: "discount", value: `-${money(itemDiscount)}` }
      : null,
    // ยอดก่อนรวมเท่ากับยอดรวมเมื่อไม่มีส่วนลดรายการ — โชว์เฉพาะตอนต่างกันจริง ไม่งั้นเป็นตัวเลขซ้ำ
    subtotal !== null && subtotal !== orderTotal ? { key: "subtotal", label: t("cancelSale.subtotal"), value: money(subtotal) } : null,
    billDiscount && billDiscount > 0
      ? { key: "billDiscount", label: billDiscountLabel(bill, t("cancelSale.billDiscount")), tone: "discount", value: `-${money(billDiscount)}` }
      : null,
    service && service > 0
      ? { key: "service", label: serviceRate ? `${t("cancelSale.serviceCharge")} (${serviceRate})` : t("cancelSale.serviceCharge"), value: money(service) }
      : null,
    vat && vat > 0 ? { key: "vat", label: vatRate ? `${t("cancelSale.vat")} (${vatRate})` : t("cancelSale.vat"), value: money(vat) } : null
  ];
  const lines = candidates.filter((line): line is SummaryLine => Boolean(line));

  return (
    <section aria-label={t("cancelSale.billSummary")} className={cn("shrink-0 border-t border-border bg-muted/30 px-4 py-3", className)}>
      <h3 className="text-xs font-medium text-muted-foreground">{t("cancelSale.billSummary")}</h3>
      {lines.length ? (
        <dl className="mt-2 flex flex-col gap-1.5">
          {lines.map((line) => (
            <div key={line.key} className="flex min-w-0 items-baseline justify-between gap-3 text-sm leading-5">
              <dt className="min-w-0 wrap-break-word text-muted-foreground">{line.label}</dt>
              <dd className={cn("shrink-0 tabular-nums", line.tone === "discount" ? "text-destructive" : "text-foreground")}>{line.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <div className="mt-3 flex min-w-0 items-baseline justify-between gap-3 border-t border-dashed border-border pt-3">
        <span className="truncate text-sm font-semibold text-foreground">{t("cancelSale.grandTotal")}</span>
        <span className="shrink-0 text-2xl leading-8 font-bold tabular-nums text-primary-text">{moneyOrDash(grandTotal)}</span>
      </div>
    </section>
  );
}

function SalesDetailSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>
      <Skeleton className="h-20 w-full rounded-lg" />
      <div className="overflow-hidden rounded-md border border-border">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="flex items-center justify-between gap-3 border-b border-border p-3 last:border-b-0">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
