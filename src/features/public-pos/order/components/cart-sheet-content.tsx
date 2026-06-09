"use client";

import { useTranslation } from "react-i18next";
import {
  Loader2,
  ReceiptText,
  Send,
  ShoppingBag,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { PublicCartSheetWorkflow } from "../hooks/use-public-cart-sheet-workflow";
import { formatMoney } from "../utils";
import { CartGroup, CartTotalRow } from "./cart-sheet-items";

export function CartSheetContent({
  workflow,
}: {
  workflow: PublicCartSheetWorkflow;
}) {
  const { t } = useTranslation();
  const {
    allItems,
    confirming,
    confirmableItems,
    groups,
    invoice,
    lang,
    loading,
    onConfirmKitchen,
    onDeleteItem,
    onOpenChange,
    onUpdateQty,
    open,
    saving,
    statusRule,
    tableName,
    total,
    totals,
  } = workflow;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[88dvh] overflow-hidden rounded-t-[1.35rem] border-emerald-100 bg-[#f7fcf9] p-0 sm:inset-x-auto sm:left-1/2 sm:w-full sm:max-w-xl sm:-translate-x-1/2 dark:border-border dark:bg-background"
      >
        <SheetHeader className="border-b border-emerald-100 bg-white/95 p-3 text-left dark:border-border dark:bg-background/95">
          <div className="mb-1 h-1 w-10 self-center rounded-full bg-emerald-100 dark:bg-muted" />
          <div className="flex items-start justify-between gap-3 pr-8">
            <div className="min-w-0">
              <SheetTitle className="truncate text-base font-semibold leading-5">
                {invoice}
              </SheetTitle>
              <SheetDescription className="text-xs">
                {tableName ? `${t("pos.table")} ${tableName}` : t("pos.basket")}
              </SheetDescription>
            </div>
            <Badge className="h-6 rounded-full border border-emerald-100 bg-emerald-50 px-2 text-[11px] font-medium text-primary dark:border-border dark:bg-primary/10">
              {allItems.length} {t("pos.cartItems")}
            </Badge>
          </div>
        </SheetHeader>

        <div className="overflow-y-auto px-3 py-2.5">
          {loading ? (
            <div className="grid gap-2">
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-24 w-full rounded-xl" />
            </div>
          ) : null}

          {!loading && !workflow.cart.length ? (
            <div className="grid min-h-44 place-items-center text-center">
              <div>
                <ShoppingBag className="mx-auto mb-3 size-10 text-muted-foreground" />
                <p className="font-black">{t("pos.noOrder")}</p>
              </div>
            </div>
          ) : null}

          {groups.map((group) =>
            group.items.length ? (
              <CartGroup
                key={group.key}
                title={group.title}
                items={group.items}
                statusRule={statusRule}
                saving={saving}
                lang={lang}
                onUpdateQty={onUpdateQty}
                onDeleteItem={onDeleteItem}
              />
            ) : null,
          )}
        </div>

        <SheetFooter className="border-t border-emerald-100 bg-white p-3 dark:border-border dark:bg-background">
          <div className="grid gap-1.5 rounded-xl border border-emerald-100 bg-emerald-50/45 p-2.5 text-xs dark:border-border dark:bg-muted/30">
            <CartTotalRow
              label={t("pos.cartSubtotal")}
              value={totals.subtotal}
              lang={lang}
            />
            {totals.itemDiscount > 0 ? (
              <CartTotalRow
                label={t("pos.itemDiscount")}
                value={-totals.itemDiscount}
                lang={lang}
                muted
              />
            ) : null}
            {totals.orderDiscount > 0 ? (
              <CartTotalRow
                label={t("pos.discountTotal")}
                value={-totals.orderDiscount}
                lang={lang}
                muted
              />
            ) : null}
            {totals.service > 0 ? (
              <CartTotalRow
                label={t("pos.serviceCharge")}
                value={totals.service}
                lang={lang}
                muted
              />
            ) : null}
            {totals.vat > 0 ? (
              <CartTotalRow
                label={t("pos.vat")}
                value={totals.vat}
                lang={lang}
                muted
              />
            ) : null}
            <div className="mt-1 flex items-center justify-between border-t border-emerald-100 pt-2 dark:border-border">
              <p className="text-sm font-semibold">{t("common.total")}</p>
              <p className="text-base font-semibold text-primary">
                {formatMoney(total, lang)}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="block min-w-0">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 w-full rounded-md text-xs"
                    disabled
                  >
                    <ReceiptText />
                    {t("pos.requestBill")}
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={8}>
                {t("pos.requestBillDevelopmentTooltip")}
              </TooltipContent>
            </Tooltip>
            <Button
              type="button"
              className="h-11 rounded-md text-xs"
              onClick={onConfirmKitchen}
              disabled={!confirmableItems.length || confirming}
            >
              {confirming ? <Loader2 className="animate-spin" /> : <Send />}
              {t("pos.confirmOrderAction")}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
