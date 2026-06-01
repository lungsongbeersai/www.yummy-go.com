"use client";

import { BadgePercent, Check, CreditCard, Monitor, MoreHorizontal, QrCode, ShoppingCart, Shuffle, SplitSquareHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";
import { cartSummary, positiveNumber } from "./utils";

export function CartSummaryDock({
  billDiscountValueLabel,
  canApplyBillDiscount,
  canConfirm,
  canPay,
  canPaySplitSelection,
  compact = false,
  confirming,
  discountPending,
  newOrderCount,
  onBillDiscount,
  onConfirm,
  onCreateTableQr,
  onCreateEmployeeOrder,
  onCustomerDisplay,
  onPayBill,
  onPaySplitSelection,
  onTableActions,
  serviceLabel,
  splitSelectedCount = 0,
  splitSelectedTotal = 0,
  summary,
  taxLabel
}: {
  billDiscountValueLabel?: string | null;
  canApplyBillDiscount: boolean;
  canConfirm: boolean;
  canPay: boolean;
  canPaySplitSelection?: boolean;
  compact?: boolean;
  confirming: boolean;
  discountPending: boolean;
  newOrderCount: number;
  onBillDiscount: () => void;
  onConfirm: () => void;
  onCreateTableQr: () => void;
  onCreateEmployeeOrder?: () => void;
  onCustomerDisplay: () => void;
  onPayBill: () => void;
  onPaySplitSelection?: () => void;
  onTableActions: () => void;
  serviceLabel: string;
  splitSelectedCount?: number;
  splitSelectedTotal?: number;
  summary: ReturnType<typeof cartSummary>;
  taxLabel: string;
}) {
  const { t } = useTranslation();
  const discountTotal = positiveNumber(summary.orderDiscount);
  const serviceTotal = positiveNumber(summary.serviceTotal);
  const vatTotal = positiveNumber(summary.tax, summary.vatTotal, summary.orderVat);
  const discountMetaValue = discountTotal !== null ? `-${money(discountTotal)}` : billDiscountValueLabel ?? null;
  const discountRateLabel = billDiscountValueLabel?.trim().endsWith("%") ? billDiscountValueLabel.trim() : null;
  const discountLabel = discountRateLabel ? `${t("pos.billDiscount")} (${discountRateLabel})` : t("pos.billDiscount");
  const summaryDetailRows = [
    discountMetaValue !== null ? { key: "discount", label: discountLabel, value: discountMetaValue } : null,
    serviceTotal !== null ? { key: "service", label: serviceLabel, value: money(serviceTotal) } : null,
    vatTotal !== null ? { key: "vat", label: taxLabel, value: money(vatTotal) } : null
  ].filter((item): item is { key: string; label: string; value: string } => Boolean(item));
  const primaryIsSplit = splitSelectedCount > 0 && Boolean(onPaySplitSelection);
  const primaryIsConfirm = !primaryIsSplit && newOrderCount > 0;
  const showConfirmCue = primaryIsConfirm && canConfirm && !confirming;
  const primaryDisabled = primaryIsConfirm ? !canConfirm : primaryIsSplit ? !canPaySplitSelection : !canPay;
  const primaryLabel = primaryIsConfirm ? t("pos.confirmOrderAction") : primaryIsSplit ? t("pos.splitPayment") : t("pos.payBill");
  const PrimaryIcon = primaryIsConfirm ? Check : primaryIsSplit ? SplitSquareHorizontal : CreditCard;
  const handlePrimaryAction = primaryIsConfirm ? onConfirm : primaryIsSplit && onPaySplitSelection ? onPaySplitSelection : onPayBill;
  const primaryBadgeCount = primaryIsSplit ? splitSelectedCount : showConfirmCue ? newOrderCount : 0;
  const splitSelectedTotalLabel = primaryIsSplit ? money(splitSelectedTotal) : null;

  return (
    <div className="pos-soft-light-zone relative flex flex-col gap-2 text-primary-foreground">
      <div className={cn("min-w-0 px-3 text-white", compact ? "py-2.5" : "py-3")}>
        <div className="flex min-w-0 items-start justify-between gap-3">
          <span className="shrink-0 text-xs font-bold leading-5 text-white/75">{t("pos.grandTotal")}</span>
          <span className={cn("min-w-0 text-right font-black tabular-nums", compact ? "text-2xl leading-7" : "text-[28px] leading-8")}>
            {money(summary.grandTotal)}
          </span>
        </div>
        {summaryDetailRows.length > 0 ? (
          <div className="mt-2 flex flex-col gap-1.5 border-t border-white/20 pt-2 text-sm font-bold leading-5 text-white/75">
            {summaryDetailRows.map((item) => (
              <div key={item.key} className="flex min-w-0 items-center justify-between gap-3">
                <span className="min-w-0 truncate">{item.label}</span>
                <span className="shrink-0 text-right text-white/90 tabular-nums">{item.value}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {onCreateEmployeeOrder ? (
        <Button
          type="button"
          variant="ghost"
          className={cn(
            "h-12 w-full min-w-0 justify-center rounded-lg bg-primary-foreground/95 px-3 text-primary shadow-sm hover:bg-primary-foreground/90",
            !compact && "h-[52px]"
          )}
          onClick={onCreateEmployeeOrder}
        >
          <ShoppingCart data-icon="inline-start" />
          <span className="truncate text-sm font-black sm:text-base">{t("pos.createEmployeeOrder")}</span>
        </Button>
      ) : null}

      <div className={cn("grid items-stretch gap-2", compact ? "grid-cols-[44px_minmax(0,1fr)]" : "grid-cols-[48px_minmax(0,1fr)]")}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              aria-label={t("nav.manage")}
              className={cn("min-w-0 rounded-lg bg-primary-foreground/95 px-2 text-primary shadow-sm hover:bg-primary-foreground/90", compact ? "h-12" : "h-[52px]")}
            >
              <MoreHorizontal data-icon="inline-start" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" sideOffset={10} className="w-72">
            <DropdownMenuLabel className="text-xs font-black uppercase text-muted-foreground">
              {t("common.actions")}
            </DropdownMenuLabel>
            <DropdownMenuGroup>
              <DropdownMenuItem disabled={!canApplyBillDiscount || discountPending} onSelect={onBillDiscount}>
                {discountPending ? <Spinner data-icon="inline-start" /> : <BadgePercent data-icon="inline-start" />}
                <span className="min-w-0 flex-1 truncate">{t("pos.billDiscount")}</span>
                {billDiscountValueLabel ? (
                  <Badge className="ml-auto shrink-0 rounded-md bg-amber-300 px-1.5 py-0.5 text-[11px] font-black leading-4 text-amber-950">
                    {billDiscountValueLabel}
                  </Badge>
                ) : null}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onTableActions}>
                <Shuffle data-icon="inline-start" />
                <span>{t("pos.tableActions")}</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onCreateTableQr}>
                <QrCode data-icon="inline-start" />
                <span>{t("pos.createTableQr")}</span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onCustomerDisplay}>
                <Monitor data-icon="inline-start" />
                <span>{t("pos.customerDisplayScreen")}</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          type="button"
          aria-label={splitSelectedTotalLabel ? `${primaryLabel} ${splitSelectedTotalLabel}` : primaryLabel}
          className={cn(
            "relative min-w-0 overflow-hidden rounded-lg bg-primary px-3 text-primary-foreground shadow-sm hover:bg-primary/90",
            compact ? "h-12" : "h-[52px]",
            primaryBadgeCount > 0 && "pr-8",
            showConfirmCue && "pr-8 ring-2 ring-primary-foreground/55 ring-offset-2 ring-offset-primary/40 shadow-lg hover:scale-[1.02] hover:brightness-110"
          )}
          disabled={primaryDisabled}
          onClick={handlePrimaryAction}
        >
          {showConfirmCue ? (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-[-45%] left-0 z-0 w-1/3 bg-gradient-to-r from-transparent via-primary-foreground/35 to-transparent"
              style={{ animation: "confirm-button-shine 1.9s ease-in-out infinite" }}
            />
          ) : null}
          {primaryBadgeCount > 0 ? (
            <Badge className="absolute right-1.5 top-1.5 z-10 min-w-6 justify-center rounded-full border-primary-foreground/30 bg-primary-foreground px-1.5 py-0.5 text-[10px] font-black text-primary shadow-sm">
              {primaryBadgeCount}
            </Badge>
          ) : null}
          {confirming ? <Spinner className="relative z-10" data-icon="inline-start" /> : <PrimaryIcon className="relative z-10" data-icon="inline-start" />}
          <span className="relative z-10 max-w-full truncate text-sm font-black sm:text-base">{primaryLabel}</span>
          {splitSelectedTotalLabel ? <span className="sr-only">{splitSelectedTotalLabel}</span> : null}
        </Button>
      </div>
    </div>
  );
}
