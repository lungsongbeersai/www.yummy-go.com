"use client";

import {
  BadgePercent,
  BookOpen,
  Check,
  CreditCard,
  Monitor,
  MoreHorizontal,
  QrCode,
  ShoppingCart,
  Shuffle,
  SplitSquareHorizontal,
  Wine,
} from "lucide-react";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";
import { cartSummary } from "./utils";

export function CartSummaryDock({
  actionsDisabled = false,
  billDiscountValueLabel,
  canApplyBillDiscount,
  canConfirm,
  canPay,
  canPaySplitSelection,
  compact = false,
  confirming,
  discountPending,
  neutral = false,
  newOrderCount,
  onBillDiscount,
  onConfirm,
  onCreateTableQr,
  onCreateBranchMenuQr,
  onCreateEmployeeOrder,
  onCreateDeposit,
  onCustomerDisplay,
  onPayBill,
  onPaySplitSelection,
  onTableActions,
  splitSelectedCount = 0,
  splitSelectedTotal = 0,
  summary,
  taxLabel,
}: {
  actionsDisabled?: boolean;
  billDiscountValueLabel?: string | null;
  canApplyBillDiscount: boolean;
  canConfirm: boolean;
  canPay: boolean;
  canPaySplitSelection?: boolean;
  compact?: boolean;
  confirming: boolean;
  discountPending: boolean;
  neutral?: boolean;
  newOrderCount: number;
  onBillDiscount: () => void;
  onConfirm: () => void;
  onCreateTableQr?: () => void;
  onCreateBranchMenuQr?: () => void;
  onCreateEmployeeOrder?: () => void;
  onCreateDeposit?: () => void;
  onCustomerDisplay: () => void;
  onPayBill: () => void;
  onPaySplitSelection?: () => void;
  onTableActions?: () => void;
  splitSelectedCount?: number;
  splitSelectedTotal?: number;
  summary: ReturnType<typeof cartSummary>;
  taxLabel: string;
}) {
  const { t } = useTranslation();
  const primaryIsSplit = splitSelectedCount > 0 && Boolean(onPaySplitSelection);
  const vatTotal = Number(
    summary.tax ?? summary.vatTotal ?? summary.orderVat ?? 0
  );
  const summaryTitle = primaryIsSplit
    ? t("pos.paySelected")
    : t("pos.grandTotal");
  const summaryDetailRows = [
    { key: "vat", label: taxLabel, value: money(vatTotal) },
  ];
  const primaryIsConfirm = !primaryIsSplit && newOrderCount > 0;
  const showConfirmCue = primaryIsConfirm && canConfirm && !confirming;
  const primaryDisabled =
    actionsDisabled ||
    (primaryIsConfirm
      ? !canConfirm
      : primaryIsSplit
      ? !canPaySplitSelection
      : !canPay);
  const primaryLabel = primaryIsConfirm
    ? t("pos.confirmOrderAction")
    : primaryIsSplit
    ? t("pos.splitPayment")
    : t("pos.payBill");
  const PrimaryIcon = primaryIsConfirm
    ? Check
    : primaryIsSplit
    ? SplitSquareHorizontal
    : CreditCard;
  const handlePrimaryAction = primaryIsConfirm
    ? onConfirm
    : primaryIsSplit && onPaySplitSelection
    ? onPaySplitSelection
    : onPayBill;
  const primaryBadgeCount = primaryIsSplit
    ? splitSelectedCount
    : showConfirmCue
    ? newOrderCount
    : 0;
  const splitSelectedTotalLabel = primaryIsSplit
    ? money(splitSelectedTotal)
    : null;
  const disabledButtonClass =
    "disabled:cursor-not-allowed disabled:opacity-65 disabled:hover:bg-primary-foreground/95 dark:disabled:hover:bg-card";
  // ปุ่มรอง (…/สร้างออเดอร์พนักงาน) ขาวเกือบทึบตั้งใจให้ตัดกับพื้นรูปสีเขียว — โหมดมืดไม่มีรูปนั้น
  // (dark:bg-none) dock วางบนพื้นมืดเรียบ ๆ ปุ่มขาวเลยกลายเป็นก้อนสว่างแสบตา ใช้ผิว card แทน
  const secondaryButtonClass =
    "bg-primary-foreground/95 text-primary shadow-sm hover:bg-primary-foreground/90 dark:border dark:border-border dark:bg-card dark:text-foreground dark:hover:bg-accent";
  const moreButtonClass = neutral
    ? "border-primary-foreground/70 bg-primary/25 text-primary-foreground shadow-sm hover:bg-primary/40 hover:text-primary-foreground dark:border-border dark:bg-card dark:text-foreground dark:hover:bg-accent"
    : primaryIsConfirm
    ? secondaryButtonClass
    : "border-primary-foreground/70 bg-primary/25 text-primary-foreground hover:bg-primary/40 dark:border-primary-foreground/60 dark:bg-card dark:text-foreground dark:hover:bg-accent";
  const primaryButtonClass = neutral
    ? primaryDisabled
      ? "border-primary-foreground/25 bg-primary-foreground/15 text-primary-foreground/70 shadow-none disabled:hover:bg-primary-foreground/15 dark:border-border dark:bg-muted dark:text-muted-foreground dark:disabled:hover:bg-muted"
      : "border-primary-foreground/70 bg-primary-foreground/95 text-primary shadow-md hover:bg-primary-foreground/90 hover:text-primary dark:border-border dark:bg-card dark:text-foreground dark:hover:bg-accent dark:hover:text-foreground"
    : primaryIsConfirm
    ? primaryDisabled
      ? "bg-white text-primary hover:bg-white/90 disabled:hover:bg-white dark:border dark:border-border dark:bg-card dark:text-muted-foreground dark:disabled:hover:bg-card"
      : "bg-primary text-primary-foreground hover:bg-primary/90 disabled:hover:bg-primary"
    : primaryDisabled
    ? "border-border bg-muted text-muted-foreground disabled:hover:bg-muted"
    : "border-primary bg-primary-foreground text-primary hover:bg-primary-foreground/90";

  return (
    <div
      className={cn(
        "pos-soft-light-zone pos-dark-zone relative flex flex-col",
        neutral
          ? "text-primary-foreground dark:text-foreground"
          : "text-primary-foreground",
        compact ? "gap-1.5" : "gap-2"
      )}
    >
      <div
        className={cn(
          // ยอดรวมวางตรงบนพื้นเขียวลายใบไม้เหมือน reference โดยใช้ข้อความขาวและเส้นแบ่งโปร่ง
          // ปุ่มหลักด้านล่างกลับขั้วเป็นพื้นขาว/ตัวอักษรเขียว เพื่อเป็น action ที่เด่นที่สุด
          "min-w-0",
          neutral
            ? "text-primary-foreground dark:text-foreground"
            : "text-white",
          compact ? "px-2.5 py-2" : "px-3 py-3"
        )}
      >
        <div
          className={cn(
            "flex flex-col font-bold",
            neutral
              ? "text-primary-foreground/80 dark:text-muted-foreground"
              : "text-white/75",
            compact
              ? cn(
                  "gap-1 text-xs font-medium leading-5",
                  neutral
                    ? "text-primary-foreground/85 dark:text-muted-foreground"
                    : "text-white/85"
                )
              : "gap-1.5 text-sm leading-5"
          )}
        >
          {summaryDetailRows.map((item) => (
            <div
              key={item.key}
              className="flex min-w-0 items-center justify-between gap-3"
            >
              <span className="min-w-0 truncate">{item.label}</span>
              <span
                className={cn(
                  "shrink-0 text-right tabular-nums",
                  neutral
                    ? "text-primary-foreground dark:text-foreground"
                    : compact
                    ? "text-white"
                    : "text-white/90"
                )}
              >
                {item.value}
              </span>
            </div>
          ))}
        </div>
        <div
          className={cn(
            "flex min-w-0 items-start justify-between gap-3 border-t",
            compact ? "mt-1.5 pt-1.5" : "mt-2 pt-2",
            neutral
              ? "border-primary-foreground/20 dark:border-border"
              : "border-white/20"
          )}
        >
          <span
            className={cn(
              "shrink-0 leading-5",
              neutral
                ? compact
                  ? "text-sm font-semibold text-primary-foreground/85 dark:text-muted-foreground"
                  : "text-xs font-bold text-primary-foreground/80 dark:text-muted-foreground"
                : compact
                ? "text-sm font-semibold text-white/85"
                : "text-xs font-bold text-white/75"
            )}
          >
            {summaryTitle}
          </span>
          {/* ยอดรวมคือตัวเลขสำคัญที่สุดบนจอ — วางเป็นบรรทัดสุดท้ายหลังส่วนลด/บริการ/VAT */}
          <span
            className={cn(
              "min-w-0 text-right font-black tabular-nums",
              compact ? "text-xl leading-7" : "text-2xl leading-8"
            )}
          >
            {money(summary.grandTotal)}
          </span>
        </div>
      </div>

      {onCreateEmployeeOrder ? (
        <Button
          type="button"
          variant="ghost"
          className={cn(
            "h-12 w-full min-w-0 justify-center rounded-lg px-3",
            secondaryButtonClass,
            disabledButtonClass,
            compact ? "h-11" : "h-13"
          )}
          disabled={actionsDisabled}
          onClick={onCreateEmployeeOrder}
        >
          <ShoppingCart data-icon="inline-start" />
          <span className="truncate text-sm font-black sm:text-base">
            {t("pos.createEmployeeOrder")}
          </span>
        </Button>
      ) : null}

      <div
        className={cn(
          "grid items-stretch gap-2",
          compact
            ? "grid-cols-[40px_minmax(0,1fr)]"
            : "grid-cols-[48px_minmax(0,1fr)]"
        )}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              aria-label={t("nav.manage")}
              className={cn(
                "min-w-0 rounded-lg border px-2",
                moreButtonClass,
                disabledButtonClass,
                compact ? "h-11" : "h-13"
              )}
              disabled={actionsDisabled}
            >
              <MoreHorizontal data-icon="inline-start" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            side="top"
            sideOffset={10}
            className="w-72"
          >
            <DropdownMenuLabel className="text-xs font-black uppercase text-muted-foreground">
              {t("common.actions")}
            </DropdownMenuLabel>
            <DropdownMenuGroup>
              <DropdownMenuItem
                disabled={
                  actionsDisabled || !canApplyBillDiscount || discountPending
                }
                onSelect={onBillDiscount}
              >
                {discountPending ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <BadgePercent data-icon="inline-start" />
                )}
                <span className="min-w-0 flex-1 truncate">
                  {t("pos.billDiscount")}
                </span>
                {billDiscountValueLabel ? (
                  <Badge className="ml-auto shrink-0 rounded-md bg-warning px-1.5 py-0.5 text-2xs font-black leading-4 text-warning-foreground">
                    {billDiscountValueLabel}
                  </Badge>
                ) : null}
              </DropdownMenuItem>
              {onTableActions ? (
                <DropdownMenuItem
                  disabled={actionsDisabled}
                  onSelect={onTableActions}
                >
                  <Shuffle data-icon="inline-start" />
                  <span>{t("pos.tableActions")}</span>
                </DropdownMenuItem>
              ) : null}
              {onCreateTableQr ? (
                <DropdownMenuItem
                  disabled={actionsDisabled}
                  onSelect={onCreateTableQr}
                >
                  <QrCode data-icon="inline-start" />
                  <span>{t("pos.createTableQr")}</span>
                </DropdownMenuItem>
              ) : null}
              {onCreateBranchMenuQr ? (
                // ระดับสาขา ไม่ผูกกับโต๊ะที่เลือกอยู่ — ไม่ใช้ actionsDisabled
                // (ซึ่งอิงจาก hasSelectedTable) กันปุ่มนี้พลอยโดนปิดไปด้วย
                <DropdownMenuItem onSelect={onCreateBranchMenuQr}>
                  <BookOpen data-icon="inline-start" />
                  <span>{t("pos.createBranchMenuQr")}</span>
                </DropdownMenuItem>
              ) : null}
              {onTableActions || onCreateTableQr || onCreateBranchMenuQr ? (
                <DropdownMenuSeparator />
              ) : null}
              {onCreateDeposit ? (
                <DropdownMenuItem onSelect={onCreateDeposit}>
                  <Wine data-icon="inline-start" />
                  <span>{t("deposit.createTitle")}</span>
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem
                disabled={actionsDisabled}
                onSelect={onCustomerDisplay}
              >
                <Monitor data-icon="inline-start" />
                <span>{t("pos.customerDisplayScreen")}</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          type="button"
          aria-label={
            splitSelectedTotalLabel
              ? `${primaryLabel} ${splitSelectedTotalLabel}`
              : primaryLabel
          }
          className={cn(
            "relative min-w-0 overflow-hidden rounded-lg px-3 shadow-sm",
            compact ? "h-11" : "h-13",
            primaryButtonClass,
            "disabled:cursor-not-allowed disabled:opacity-65",
            primaryBadgeCount > 0 && "pr-8",
            showConfirmCue &&
              (primaryDisabled
                ? "pr-8 ring-2 ring-primary/35 ring-offset-2 ring-offset-white/40 shadow-lg hover:scale-[1.02] hover:brightness-105"
                : "pr-8 ring-2 ring-primary-foreground/55 ring-offset-2 ring-offset-primary/40 shadow-lg hover:scale-[1.02] hover:brightness-110 dark:ring-primary-text/60 dark:ring-offset-background")
          )}
          disabled={primaryDisabled}
          onClick={handlePrimaryAction}
        >
          {showConfirmCue ? (
            <span
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute inset-y-[-45%] left-0 z-0 w-1/3 bg-linear-to-r from-transparent to-transparent",
                primaryDisabled ? "via-primary/20" : "via-primary-foreground/35"
              )}
              style={{
                animation: "confirm-button-shine 1.9s ease-in-out infinite",
              }}
            />
          ) : null}
          {primaryBadgeCount > 0 ? (
            <Badge
              className={cn(
                "absolute right-1.5 top-1.5 z-10 min-w-6 justify-center rounded-full px-1.5 py-0.5 text-2xs font-black shadow-sm",
                primaryDisabled
                  ? "border-primary/30 bg-primary text-primary-foreground"
                  : neutral
                  ? "border-primary-foreground/25 bg-primary text-primary-foreground"
                  : primaryIsConfirm
                  ? "border-primary-foreground/30 bg-primary-foreground text-primary"
                  : "border-primary bg-primary text-primary-foreground"
              )}
            >
              {primaryBadgeCount}
            </Badge>
          ) : null}
          {confirming ? (
            <Spinner className="relative z-10" data-icon="inline-start" />
          ) : (
            <PrimaryIcon className="relative z-10" data-icon="inline-start" />
          )}
          <span className="relative z-10 max-w-full truncate text-sm font-black sm:text-base">
            {primaryLabel}
          </span>
          {splitSelectedTotalLabel ? (
            <span className="sr-only">{splitSelectedTotalLabel}</span>
          ) : null}
        </Button>
      </div>
    </div>
  );
}
