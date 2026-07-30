"use client";

import type { Route } from "next";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Ban, CreditCard, Printer, ReceiptText, RefreshCcw, UserRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Spinner } from "@/components/ui/spinner";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DailySaleItemsBillGroup } from "@/stores/report-store";
import { SalesListItems } from "./sales-list-items";
import {
  billMetaText,
  calculatedRateLabel,
  readRateLabel,
  readValue,
  realMetaText,
  summaryMetricLabel,
  textValue
} from "./sales-list-utils";

interface SalesBillDetailPanelProps {
  bill: DailySaleItemsBillGroup | null;
  cancelSaleHref: Route | null;
  canReprintReceipt: boolean;
  className?: string;
  loading: boolean;
  onReprint: (group: DailySaleItemsBillGroup) => void;
  printingBillId: string;
  variant?: "panel" | "drawer";
}

export function SalesBillDetailPanel({
  bill,
  cancelSaleHref,
  canReprintReceipt,
  className,
  loading,
  onReprint,
  printingBillId,
  variant = "panel"
}: SalesBillDetailPanelProps) {
  const { t } = useTranslation();
  const drawer = variant === "drawer";
  const cardClass = cn("min-h-0 overflow-hidden border-border bg-card shadow-sm xl:flex xl:min-h-0 xl:flex-col", className);
  const cancelUnavailableDescriptionId = `sales-list-cancel-unavailable-${variant}`;

  if (!bill) {
    return (
      <Card className={cardClass}>
        <div className="flex min-h-96 flex-1 items-center justify-center p-4">
          <EmptyState title={t("salesList.noSelection")} description={t("salesList.selectBillHint")} />
        </div>
      </Card>
    );
  }

  const heading = (
    <>
      <CardTitle className="truncate text-base font-semibold">{t("salesList.billDetail")}</CardTitle>
      <BillHeaderFacts bill={bill} compact={drawer} />
    </>
  );
  const actions = (
    <BillDetailActions
      bill={bill}
      cancelSaleHref={cancelSaleHref}
      canReprintReceipt={canReprintReceipt}
      descriptionId={cancelUnavailableDescriptionId}
      drawer={drawer}
      loading={loading}
      printingBillId={printingBillId}
      onReprint={onReprint}
    />
  );

  // มือถือมีความสูงจำกัด หัวแผงจึงเลื่อนหายไปพร้อมเนื้อหาเพื่อคืนพื้นที่ให้รายการสินค้า
  // แล้วปักยอดสรุปกับปุ่มสั่งงานไว้ล่างสุดในระยะนิ้วโป้ง — ทั้งคู่ต้องเข้าถึงได้ตลอดโดยไม่ต้องเลื่อนกลับ
  if (drawer) {
    return (
      <Card className={cardClass}>
        <CardContent className="flex min-h-0 flex-1 flex-col p-0">
          <div className="min-h-0 flex-1 overflow-auto">
            <div className="border-b border-border px-3 py-2.5">{heading}</div>
            <div className="p-2">
              <SalesListItems items={bill.items} />
            </div>
          </div>
          <SelectedBillSummary bill={bill} />
          <div className="shrink-0 border-t border-border bg-card px-3 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            {actions}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cardClass}>
      <CardHeader className="flex-col items-stretch gap-2 border-b border-border px-3 py-2.5 md:flex-row md:items-start md:justify-between md:px-4">
        <div className="min-w-0 flex-1">{heading}</div>
        {actions}
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col p-0">
        <div className="min-h-0 flex-1 overflow-auto p-2 sm:p-3">
          <SalesListItems items={bill.items} />
        </div>
        <SelectedBillSummary bill={bill} />
      </CardContent>
    </Card>
  );
}

function BillDetailActions({
  bill,
  cancelSaleHref,
  canReprintReceipt,
  descriptionId,
  drawer,
  loading,
  onReprint,
  printingBillId
}: {
  bill: DailySaleItemsBillGroup;
  cancelSaleHref: Route | null;
  canReprintReceipt: boolean;
  descriptionId: string;
  drawer: boolean;
  loading: boolean;
  onReprint: (group: DailySaleItemsBillGroup) => void;
  printingBillId: string;
}) {
  const { t } = useTranslation();
  const [openingCancelSale, setOpeningCancelSale] = useState(false);
  const reprinting = printingBillId === bill.id;

  return (
    <div className={cn("flex w-full shrink-0 flex-col gap-1.5", !drawer && "md:w-auto md:items-end")}>
      {/* บังคับสองปุ่มเรียงคู่เสมอ — เรียงแนวตั้งบนจอ 393px กินความสูงที่ต้องเก็บไว้ให้รายการสินค้า */}
      <div className={cn("grid w-full grid-cols-2 gap-2", !drawer && "md:flex md:w-auto")}>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 w-full shrink-0 md:h-9 md:min-h-9 md:w-auto"
          disabled={!canReprintReceipt || !textValue(readValue(bill.raw, ["order_uuid"]), "") || Boolean(printingBillId) || loading}
          onClick={() => onReprint(bill)}
        >
          {reprinting ? <RefreshCcw className="animate-spin" data-icon="inline-start" /> : <Printer data-icon="inline-start" />}
          <span className="truncate">{reprinting ? t("salesList.reprintingReceipt") : t("salesList.reprintReceipt")}</span>
        </Button>
        {cancelSaleHref ? (
          <Button asChild className="min-h-11 w-full shrink-0 md:h-9 md:min-h-9 md:w-auto" size="md" variant="danger">
            <Link
              aria-busy={openingCancelSale}
              aria-disabled={openingCancelSale}
              href={cancelSaleHref}
              onClick={(event) => {
                if (openingCancelSale) {
                  event.preventDefault();
                  return;
                }
                setOpeningCancelSale(true);
              }}
            >
              {openingCancelSale ? <Spinner data-icon="inline-start" /> : <Ban data-icon="inline-start" />}
              <span className="truncate">
                {openingCancelSale ? t("cancelSale.openingCancelPage") : t("cancelSale.cancelBill")}
              </span>
            </Link>
          </Button>
        ) : (
          <Button
            aria-describedby={descriptionId}
            className="min-h-11 w-full shrink-0 md:h-9 md:min-h-9 md:w-auto"
            disabled
            type="button"
            variant="danger"
          >
            <Ban data-icon="inline-start" />
            <span className="truncate">{t("cancelSale.cancelBill")}</span>
          </Button>
        )}
      </div>
      {!cancelSaleHref ? (
        <p id={descriptionId} className="max-w-sm text-xs leading-snug text-muted-foreground md:text-right">
          {t("cancelSale.cancelUnavailable")}
        </p>
      ) : null}
    </div>
  );
}

interface SalesBillDetailDrawerProps {
  bill: DailySaleItemsBillGroup | null;
  cancelSaleHref: Route | null;
  canReprintReceipt: boolean;
  loading: boolean;
  onOpenChange: (open: boolean) => void;
  onReprint: (group: DailySaleItemsBillGroup) => void;
  open: boolean;
  printingBillId: string;
}

export function SalesBillDetailDrawer({
  bill,
  cancelSaleHref,
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
            cancelSaleHref={cancelSaleHref}
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

interface BillReviewMetaItem {
  icon: ReactNode;
  label: string;
  value: string;
}

function BillHeaderFacts({
  bill,
  compact = false
}: {
  bill: DailySaleItemsBillGroup;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const customerName = realMetaText(billMetaText(bill, ["customer_name", "customer"]));
  const customerPhone = realMetaText(billMetaText(bill, ["customer_phone", "phone", "tel"]));
  const memberCode = realMetaText(billMetaText(bill, ["member_code", "customer_code"]));
  const customerDetail = [customerName, memberCode, customerPhone].filter(Boolean).join(" / ");
  const orderChannel = realMetaText(billMetaText(bill, ["order_channel_name", "channel_name"]));
  const paymentFactCandidates: Array<BillReviewMetaItem | null> = [
    bill.receiveCashAmount > 0 ? { icon: <CreditCard />, label: t("salesList.cashReceived"), value: money(bill.receiveCashAmount) } : null,
    bill.receiveTransferAmount > 0 ? { icon: <CreditCard />, label: t("salesList.transferReceived"), value: money(bill.receiveTransferAmount) } : null,
    bill.changeAmount > 0 ? { icon: <ReceiptText />, label: t("salesList.change"), value: money(bill.changeAmount) } : null
  ];
  const paymentFacts = paymentFactCandidates.filter((item): item is BillReviewMetaItem => Boolean(item));
  const candidates: Array<BillReviewMetaItem | null> = [
    customerDetail ? { icon: <UserRound />, label: t("pos.customer"), value: customerDetail } : null,
    orderChannel ? { icon: <ReceiptText />, label: t("pos.orderChannel"), value: orderChannel } : null,
    ...paymentFacts
  ];
  const items = candidates
    .filter((item): item is BillReviewMetaItem => Boolean(item))
    .filter((item) => Boolean(realMetaText(item.value)));

  if (!items.length) return null;

  return (
    <div
      className={cn(
        "mt-2 grid min-w-0 grid-cols-1 gap-1.5 min-[430px]:grid-cols-2 md:flex md:flex-wrap",
        compact && "min-[360px]:grid-cols-2"
      )}
    >
      {items.map((item) => (
        <BillHeaderFact key={`${item.label}-${item.value}`} item={item} compact={compact} />
      ))}
    </div>
  );
}

function BillHeaderFact({
  compact,
  item
}: {
  compact: boolean;
  item: BillReviewMetaItem;
}) {
  return (
    <span
      className={cn(
        "inline-flex w-full min-w-0 items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-1 text-xs leading-5 text-muted-foreground",
        compact ? "" : "md:w-auto md:max-w-56 2xl:max-w-64"
      )}
      title={`${item.label}: ${item.value}`}
    >
      <span className="flex size-3.5 shrink-0 items-center justify-center text-muted-foreground/80 [&_svg]:size-3.5">{item.icon}</span>
      <span className="min-w-0 truncate">
        <span>{item.label}: </span>
        <span className="font-medium text-foreground">{item.value}</span>
      </span>
    </span>
  );
}

type SummaryMetricTone = "amount" | "discount" | "total" | "service" | "topping" | "vat";

interface SummaryMetric {
  label: string;
  tone: SummaryMetricTone;
  value: number;
}

function SelectedBillSummary({ bill }: { bill: DailySaleItemsBillGroup }) {
  const { t } = useTranslation();
  const serviceBase = bill.amountTotal + bill.toppingTotal - bill.discountTotal;
  const vatBase = serviceBase + bill.serviceChargeAmount;
  const serviceRate =
    readRateLabel(bill.raw, ["service_charge_rate", "service_rate", "order_service_rate", "charge_name", "rate"], "service_charge") ||
    calculatedRateLabel(bill.serviceChargeAmount, serviceBase);
  const vatRate =
    readRateLabel(bill.raw, ["vat_rate", "tax_rate", "order_vat_rate", "vat_name", "rate"], "vat") ||
    calculatedRateLabel(bill.vatAmount, vatBase);
  const allMetrics: SummaryMetric[] = [
    { label: t("salesList.amount"), tone: "amount", value: bill.amountTotal },
    { label: t("salesList.toppings"), tone: "topping", value: bill.toppingTotal },
    { label: t("salesList.discount"), tone: "discount", value: bill.discountTotal },
    { label: summaryMetricLabel(t("salesList.serviceCharge"), serviceRate), tone: "service", value: bill.serviceChargeAmount },
    { label: summaryMetricLabel(t("salesList.vat"), vatRate), tone: "vat", value: bill.vatAmount },
    { label: t("salesList.total"), tone: "total", value: bill.lineTotal }
  ];
  const metrics = allMetrics.filter((metric) => metric.tone === "amount" || metric.tone === "total" || metric.value > 0);

  const lineItems = metrics.filter((metric) => metric.tone !== "total");
  const totalMetric = metrics.find((metric) => metric.tone === "total");

  return (
    <div className="shrink-0 border-t border-border bg-card px-3 py-3 sm:px-4">
      <p className="text-xs font-medium text-muted-foreground">{t("salesList.billSummary")}</p>
      {/* แถวย่อยพื้นเรียบทั้งหมด เหลือสีเฉพาะส่วนลด และยกยอดสุทธิเป็นจุดโฟกัสเดียวของแผง */}
      <div className="mt-2 overflow-hidden rounded-md border border-border">
        <div className="flex flex-col divide-y divide-border">
          {lineItems.map((metric) => (
            <div key={metric.label} className="flex min-w-0 items-center justify-between gap-3 px-3 py-2">
              <p className="truncate text-xs leading-5 text-muted-foreground">{metric.label}</p>
              <p
                className={cn(
                  "shrink-0 text-sm leading-5 tabular-nums",
                  metric.tone === "discount" ? "text-destructive" : "text-foreground"
                )}
              >
                {metric.tone === "discount" ? `-${money(metric.value)}` : money(metric.value)}
              </p>
            </div>
          ))}
        </div>
        {totalMetric ? (
          <div className="flex min-w-0 items-center justify-between gap-3 border-t-2 border-primary/20 bg-primary/5 px-3 py-2.5">
            <p className="truncate text-sm font-medium text-foreground">{totalMetric.label}</p>
            <p className="shrink-0 text-lg font-bold leading-7 tabular-nums text-primary">{money(totalMetric.value)}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
