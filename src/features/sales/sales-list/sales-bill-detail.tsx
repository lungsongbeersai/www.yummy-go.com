"use client";

import type { ReactNode } from "react";
import { ArrowLeftRight, Banknote, Coins, Printer, RefreshCcw, Store, UserRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/common/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DailySaleItemsBillGroup } from "@/stores/report-store";
import { SalesListItems } from "./sales-list-items";
import {
  billMetaText,
  billPaymentLabel,
  billTimeLabel,
  calculatedRateLabel,
  readRateLabel,
  readValue,
  realMetaText,
  salesListVatSummary,
  statusBadgeClass,
  summaryMetricLabel,
  textValue
} from "./sales-list-utils";

interface SalesBillDetailPanelProps {
  bill: DailySaleItemsBillGroup | null;
  canReprintReceipt: boolean;
  className?: string;
  loading: boolean;
  onReprint: (group: DailySaleItemsBillGroup) => void;
  printingBillId: string;
  variant?: "panel" | "drawer";
}

export function SalesBillDetailPanel({
  bill,
  canReprintReceipt,
  className,
  loading,
  onReprint,
  printingBillId,
  variant = "panel"
}: SalesBillDetailPanelProps) {
  const { t } = useTranslation();
  const drawer = variant === "drawer";
  // py-0/gap-0 กัน py และ gap ฐานของ Card บวกซ้อนกับระยะของ CardHeader/CardContent — ดูคำอธิบายเดียวกันใน sales-list-filters.tsx
  const cardClass = cn(
    "min-h-0 gap-0 overflow-hidden rounded-none border-x-0 border-b-0 border-border bg-card py-0 shadow-none xl:flex xl:min-h-0 xl:flex-col",
    className
  );

  if (!bill) {
    return (
      <Card className={cardClass}>
        <div className="flex min-h-96 flex-1 items-center justify-center p-4">
          <EmptyState title={t("salesList.noSelection")} description={t("salesList.selectBillHint")} />
        </div>
      </Card>
    );
  }

  const actions = (
    <BillDetailActions
      bill={bill}
      canReprintReceipt={canReprintReceipt}
      drawer={drawer}
      loading={loading}
      printingBillId={printingBillId}
      onReprint={onReprint}
    />
  );
  const body = (
    <div className="flex flex-col gap-4 p-3 sm:p-4">
      <BillInfoGrid bill={bill} />
      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2 px-0.5">
          <h3 className="text-sm font-semibold text-foreground">{t("salesList.items")}</h3>
          <span className="text-xs text-muted-foreground tabular-nums">
            {t("pos.itemCount", { count: bill.items.length })}
          </span>
        </div>
        <SalesListItems items={bill.items} />
      </section>
    </div>
  );

  // มือถือมีความสูงจำกัด — หัวแผงและสรุปยอดเลื่อนไปพร้อมเนื้อหา (สรุปยอดที่ปักไว้เดิมกินจอเกือบครึ่ง
  // จนเห็นสินค้าแค่รายการเดียว) เหลือปักไว้ล่างสุดแค่ปุ่มพิมพ์ในระยะนิ้วโป้ง
  if (drawer) {
    return (
      <Card className={cardClass}>
        <CardContent className="flex min-h-0 flex-1 flex-col p-0">
          <div className="min-h-0 flex-1 overflow-auto">
            <div className="border-b border-border px-4 pt-1 pb-3">
              <BillHeading bill={bill} />
            </div>
            {body}
            <SelectedBillSummary bill={bill} />
          </div>
          {/* ยอดสุทธิติดแถบล่างคู่ปุ่มพิมพ์ — เห็นยอดตลอดแม้สรุปยอดเต็มจะเลื่อนไปอยู่ท้ายเนื้อหาแล้ว */}
          <div className="flex shrink-0 items-center gap-3 border-t border-border bg-card px-4 py-3 pb-[calc(0.75rem+var(--pos-system-bottom-safe-area,0px))]">
            <div className="flex min-w-0 flex-col">
              <span className="text-xs text-muted-foreground">{t("salesList.total")}</span>
              <span className="truncate text-lg leading-6 font-bold tabular-nums text-primary-text">{money(bill.lineTotal)}</span>
            </div>
            <div className="ml-auto min-w-0 flex-1 sm:max-w-64">{actions}</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // จอกว้างมาก (2xl) สรุปยอดย้ายไปคอลัมน์ขวา — รายการสินค้าได้ความสูงเต็มแผงแทนที่จะถูกกล่องสรุปกินด้านล่าง
  return (
    <Card className={cardClass}>
      <CardHeader className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3 [.border-b]:pb-3">
        <BillHeading bill={bill} />
        {actions}
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col p-0 2xl:flex-row">
        <div className="min-h-0 flex-1 overflow-auto">{body}</div>
        <SelectedBillSummary bill={bill} className="2xl:w-88 2xl:border-t-0 2xl:border-l" />
      </CardContent>
    </Card>
  );
}

// หัวแผงเดิมเขียนแค่ "รายละเอียดบิล" ไม่บอกว่าเป็นบิลไหน — ยกเลขบิลเป็นหัวข้อ แล้วโต๊ะ/วิธีชำระ/เวลาเป็นบรรทัดรอง
function BillHeading({ bill }: { bill: DailySaleItemsBillGroup }) {
  const { t } = useTranslation();
  const meta = [realMetaText(bill.tableName), billPaymentLabel(bill, t), billTimeLabel(bill).label]
    .filter((value) => value && value !== "-")
    .join(" · ");

  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <p className="text-xs leading-5 text-muted-foreground">{t("salesList.billDetail")}</p>
      <div className="flex min-w-0 items-center gap-2">
        <CardTitle className="truncate text-xl leading-7 font-bold tabular-nums">{bill.invoiceNumber}</CardTitle>
        {bill.status ? (
          <Badge className={cn("shrink-0 px-1.5 py-0 text-2xs leading-4", statusBadgeClass(bill.status))}>{bill.status}</Badge>
        ) : null}
      </div>
      {meta ? <p className="truncate text-sm leading-5 text-muted-foreground tabular-nums">{meta}</p> : null}
    </div>
  );
}

function BillDetailActions({
  bill,
  canReprintReceipt,
  drawer,
  loading,
  onReprint,
  printingBillId
}: {
  bill: DailySaleItemsBillGroup;
  canReprintReceipt: boolean;
  drawer: boolean;
  loading: boolean;
  onReprint: (group: DailySaleItemsBillGroup) => void;
  printingBillId: string;
}) {
  const { t } = useTranslation();
  const reprinting = printingBillId === bill.id;

  return (
    <Button
      type="button"
      variant="outline"
      size={drawer ? "lg" : "default"}
      className={cn("shrink-0", drawer ? "h-11 w-full" : "h-9")}
      disabled={!canReprintReceipt || !textValue(readValue(bill.raw, ["order_uuid"]), "") || Boolean(printingBillId) || loading}
      onClick={() => onReprint(bill)}
    >
      {reprinting ? <RefreshCcw className="animate-spin" data-icon="inline-start" /> : <Printer data-icon="inline-start" />}
      <span className="truncate">{reprinting ? t("salesList.reprintingReceipt") : t("salesList.reprintReceipt")}</span>
    </Button>
  );
}

interface SalesBillDetailDrawerProps {
  bill: DailySaleItemsBillGroup | null;
  canReprintReceipt: boolean;
  loading: boolean;
  onOpenChange: (open: boolean) => void;
  onReprint: (group: DailySaleItemsBillGroup) => void;
  open: boolean;
  printingBillId: string;
}

export function SalesBillDetailDrawer({
  bill,
  canReprintReceipt,
  loading,
  onOpenChange,
  onReprint,
  open,
  printingBillId
}: SalesBillDetailDrawerProps) {
  const { t } = useTranslation();

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="h-[calc(100dvh-0.75rem)] max-h-[92dvh] gap-0 overflow-hidden rounded-t-xl xl:hidden">
        <DrawerHeader className="sr-only">
          <DrawerTitle>{t("salesList.billDetail")}</DrawerTitle>
          <DrawerDescription>{t("salesList.selectBillHint")}</DrawerDescription>
        </DrawerHeader>
        <div className="min-h-0 flex-1 overflow-hidden">
          <SalesBillDetailPanel
            bill={bill}
            canReprintReceipt={canReprintReceipt}
            className="flex h-full flex-col rounded-none border-0 shadow-none"
            loading={loading}
            printingBillId={printingBillId}
            variant="drawer"
            onReprint={onReprint}
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
}

interface BillInfoItem {
  icon: ReactNode;
  label: string;
  value: string;
  wide?: boolean;
}

// ข้อมูลลูกค้า/ช่องทาง/การรับเงิน — เดิมเป็นชิปเรียงต่อกันที่ตัดข้อความลูกค้าจนอ่านไม่ครบ
// เปลี่ยนเป็นกริด label-over-value ในกล่องพื้นอ่อน ค่ายาว (ลูกค้า) ได้กว้าง 2 ช่องและตัดบรรทัดได้
function BillInfoGrid({ bill }: { bill: DailySaleItemsBillGroup }) {
  const { t } = useTranslation();
  const customerName = realMetaText(billMetaText(bill, ["customer_name", "customer"]));
  const customerPhone = realMetaText(billMetaText(bill, ["customer_phone", "phone", "tel"]));
  const memberCode = realMetaText(billMetaText(bill, ["member_code", "customer_code"]));
  const customerDetail = [customerName, memberCode, customerPhone].filter(Boolean).join(" · ");
  const orderChannel = realMetaText(billMetaText(bill, ["order_channel_name", "channel_name"]));
  const candidates: Array<BillInfoItem | null> = [
    customerDetail ? { icon: <UserRound />, label: t("pos.customer"), value: customerDetail, wide: true } : null,
    orderChannel ? { icon: <Store />, label: t("pos.orderChannel"), value: orderChannel } : null,
    bill.receiveCashAmount > 0 ? { icon: <Banknote />, label: t("salesList.cashReceived"), value: money(bill.receiveCashAmount) } : null,
    bill.receiveTransferAmount > 0
      ? { icon: <ArrowLeftRight />, label: t("salesList.transferReceived"), value: money(bill.receiveTransferAmount) }
      : null,
    bill.changeAmount > 0 ? { icon: <Coins />, label: t("salesList.change"), value: money(bill.changeAmount) } : null
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
          <dd className="text-sm leading-5 font-medium wrap-break-word text-foreground tabular-nums">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

type SummaryMetricTone = "amount" | "discount" | "total" | "service" | "vat";

interface SummaryMetric {
  label: string;
  tone: SummaryMetricTone;
  value: number;
}

// สรุปยอดแบบท้ายใบเสร็จ: แถวย่อยเรียบ เส้นประคั่น แล้วยอดสุทธิใหญ่สุดเป็นจุดโฟกัสเดียวของแผง
function SelectedBillSummary({ bill, className }: { bill: DailySaleItemsBillGroup; className?: string }) {
  const { t } = useTranslation();
  const serviceBase = bill.amountTotal + bill.toppingTotal - bill.discountTotal;
  const serviceRate =
    readRateLabel(bill.raw, ["service_charge_rate", "service_rate", "order_service_rate", "charge_name", "rate"], "service_charge") ||
    calculatedRateLabel(bill.serviceChargeAmount, serviceBase);
  const vat = salesListVatSummary(bill.raw);
  const allMetrics: SummaryMetric[] = [
    // "ยอดก่อนหักส่วนลด" ฟังแปลกในบิลที่ไม่มีส่วนลด — ใช้ป้ายยอดรวมย่อยแทน
    { label: bill.discountTotal > 0 ? t("salesList.beforeDiscount") : t("salesList.subtotal"), tone: "amount", value: bill.amountTotal },
    { label: t("salesList.discount"), tone: "discount", value: bill.discountTotal },
    { label: summaryMetricLabel(t("salesList.serviceCharge"), serviceRate), tone: "service", value: bill.serviceChargeAmount },
    { label: summaryMetricLabel(t(vat.labelKey), vat.rate), tone: "vat", value: bill.vatAmount }
  ];
  const lineItems = allMetrics.filter((metric) => metric.tone === "amount" || metric.value > 0);

  return (
    <section
      aria-label={t("salesList.billSummary")}
      className={cn("shrink-0 border-t border-border bg-muted/30 px-4 py-3", className)}
    >
      <h3 className="text-xs font-medium text-muted-foreground">{t("salesList.billSummary")}</h3>
      <dl className="mt-2 flex flex-col gap-1.5">
        {lineItems.map((metric) => (
          <div key={metric.tone} className="flex min-w-0 items-baseline justify-between gap-3 text-sm leading-5">
            <dt className="min-w-0 wrap-break-word text-muted-foreground">{metric.label}</dt>
            <dd className={cn("shrink-0 tabular-nums", metric.tone === "discount" ? "text-destructive" : "text-foreground")}>
              {metric.tone === "discount" ? `-${money(metric.value)}` : money(metric.value)}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 flex min-w-0 items-baseline justify-between gap-3 border-t border-dashed border-border pt-3">
        <span className="truncate text-sm font-semibold text-foreground">{t("salesList.total")}</span>
        <span className="shrink-0 text-2xl leading-8 font-bold tabular-nums text-primary-text">{money(bill.lineTotal)}</span>
      </div>
    </section>
  );
}
