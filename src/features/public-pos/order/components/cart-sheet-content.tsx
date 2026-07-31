"use client";

import { useTranslation } from "react-i18next";
import { CircleCheck, Send, ShoppingBag, X } from "lucide-react";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import type { PublicCartSheetWorkflow } from "../hooks/use-public-cart-sheet-workflow";
import { formatMoney } from "../utils";
import { CartNoteDialog } from "./cart-note-dialog";
import { CartGroup, CartTotalRow } from "./cart-sheet-items";

export function CartSheetContent({
  workflow,
}: {
  workflow: PublicCartSheetWorkflow;
}) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const {
    allItems,
    confirming,
    confirmableItemQty,
    confirmableItems,
    groups,
    invoice,
    lang,
    loading,
    onConfirmKitchen,
    onDeleteItem,
    onNoteChange,
    onNoteOpen,
    onNoteOpenChange,
    onOpenChange,
    onUpdateNote,
    onUpdateQty,
    noteDraft,
    noteTarget,
    open,
    saving,
    statusRule,
    tableName,
    total,
    totalItemQty,
    totals,
  } = workflow;
  const orderMeta = [tableName ? `${t("pos.table")} ${tableName}` : "", invoice]
    .filter(Boolean)
    .join(" · ");

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      direction={isMobile ? "bottom" : "right"}
    >
      <DrawerContent
        aria-busy={loading || saving || confirming}
        className={cn(
          "overflow-hidden border-border bg-background p-0",
          isMobile
            ? "mx-auto max-h-[92dvh] w-full max-w-xl rounded-t-2xl"
            : "h-dvh max-h-none w-full max-w-120 rounded-none border-l sm:max-w-120"
        )}
      >
        <DrawerHeader className="border-b border-border bg-background/95 px-4 py-3 text-left backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <DrawerTitle className="truncate text-base font-semibold leading-5">
                {t("pos.basket")}
              </DrawerTitle>
              <DrawerDescription className="text-xs">
                {orderMeta || t("pos.newOrder")}
              </DrawerDescription>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Badge variant="secondary" className="h-7 rounded-full px-2.5">
                {totalItemQty} {t("pos.cartItems")}
              </Badge>
              <DrawerClose asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-11 rounded-full"
                  aria-label={t("actions.close")}
                  disabled={saving || confirming}
                >
                  <X aria-hidden="true" />
                </Button>
              </DrawerClose>
            </div>
          </div>
        </DrawerHeader>

        <div className="min-h-0 flex-1 overscroll-contain overflow-y-auto bg-muted/20 px-3 py-3">
          {loading ? <CartSheetLoadingSkeleton /> : null}

          {!loading && !allItems.length ? (
            <Empty className="min-h-56 border-none">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ShoppingBag aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle>{t("pos.noOrder")}</EmptyTitle>
                <EmptyDescription>
                  {t("pos.emptyCartDescription")}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : null}

          {!loading
            ? groups.map((group) =>
                group.items.length ? (
                  <CartGroup
                    key={group.key}
                    groupKey={group.key}
                    title={group.title}
                    items={group.items}
                    statusRule={statusRule}
                    saving={saving}
                    lang={lang}
                    onUpdateQty={onUpdateQty}
                    onDeleteItem={onDeleteItem}
                    onOpenNote={onNoteOpen}
                  />
                ) : null
              )
            : null}
        </div>

        {loading || allItems.length ? (
          <DrawerFooter className="border-t border-border bg-background p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            {loading ? (
              <CartSheetFooterSkeleton />
            ) : (
              <>
                <div
                  className="grid gap-1.5 rounded-xl border border-border bg-muted/40 p-3 text-xs"
                  aria-live="polite"
                  aria-atomic="true"
                >
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
                  <Separator className="my-1" />
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold">{t("common.total")}</p>
                    <output className="text-base font-semibold tabular-nums text-primary">
                      {formatMoney(total, lang)}
                    </output>
                  </div>
                </div>
                {confirmableItemQty > 0 ? (
                  <Button
                    type="button"
                    className="h-12 w-full rounded-lg"
                    onClick={onConfirmKitchen}
                    disabled={!confirmableItems.length || saving || confirming}
                  >
                    {confirming ? (
                      <Spinner />
                    ) : (
                      <Send data-icon="inline-start" aria-hidden="true" />
                    )}
                    {t("pos.confirmOrderItems", { count: confirmableItemQty })}
                  </Button>
                ) : (
                  <Alert className="border-primary/20 bg-primary/5 text-primary">
                    <CircleCheck aria-hidden="true" />
                    <AlertTitle>{t("pos.allItemsSubmitted")}</AlertTitle>
                  </Alert>
                )}
              </>
            )}
          </DrawerFooter>
        ) : null}
      </DrawerContent>
      <CartNoteDialog
        note={noteDraft}
        open={Boolean(noteTarget)}
        pending={saving}
        onNoteChange={onNoteChange}
        onOpenChange={onNoteOpenChange}
        onSubmit={onUpdateNote}
      />
    </Drawer>
  );
}

function CartSheetLoadingSkeleton() {
  return (
    <div className="grid gap-3" aria-busy="true">
      {Array.from({ length: 2 }).map((_, groupIndex) => (
        <section key={groupIndex} className="grid gap-2">
          <div className="flex items-center justify-between gap-3 px-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="size-5 rounded-full" />
          </div>
          {Array.from({ length: groupIndex === 0 ? 2 : 1 }).map(
            (__, itemIndex) => (
              <div
                key={itemIndex}
                className="rounded-xl border border-emerald-100 bg-white p-2.5 shadow-sm shadow-emerald-950/5 dark:border-border dark:bg-background"
              >
                <div className="grid grid-cols-[52px_minmax(0,1fr)] gap-2.5">
                  <Skeleton className="size-12 rounded-lg" />
                  <div className="min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="grid min-w-0 flex-1 gap-1.5">
                        <Skeleton className="h-4.5 w-4/5" />
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-5 w-20 rounded-full" />
                      </div>
                      <Skeleton className="h-4.5 w-20" />
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <Skeleton className="h-10 w-10 rounded-md" />
                      <Skeleton className="h-10 w-10 rounded-md" />
                      <Skeleton className="h-10 w-10 rounded-md" />
                    </div>
                  </div>
                </div>
              </div>
            )
          )}
        </section>
      ))}
    </div>
  );
}

function CartSheetFooterSkeleton() {
  return (
    <>
      <div className="grid gap-2 rounded-xl border border-emerald-100 bg-emerald-50/45 p-2.5 dark:border-border dark:bg-muted/30">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-emerald-100 pt-2 dark:border-border">
          <Skeleton className="h-5 w-12" />
          <Skeleton className="h-5 w-28" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Skeleton className="h-11 rounded-md" />
        <Skeleton className="h-11 rounded-md" />
      </div>
    </>
  );
}
