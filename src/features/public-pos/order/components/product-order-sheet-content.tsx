"use client";

import { useRef, type ReactNode } from "react";
import { AlertCircle, Check, Minus, Plus, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import type { ProdDetail, ProdTopping } from "@/services/pos";
import { MAX_OPEN_QTY } from "../constants";
import type { ProductOrderSheetWorkflow } from "../hooks/use-product-order-sheet-workflow";
import { numeric } from "@/features/public-pos/order/numeric";
import { defaultOrderQty, formatMoney, formatShortDate, getPromoLabel, isDetailAvailable, isToppingAvailable, productPriceFromDetail, toppingDisplayName } from "@/features/public-pos/order/product-domain";
import { ProductMedia } from "./public-menu-sections";

export function ProductOrderSheetContent({
  workflow,
}: {
  workflow: ProductOrderSheetWorkflow;
}) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const { loading, modeLabel, onOpenChange, open, product, saving } = workflow;
  const description =
    [modeLabel, product?.uniteName].filter(Boolean).join(" · ") ||
    t("pos.product");
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && saving) return;
    onOpenChange(nextOpen);
  };
  const form = <ProductOrderForm workflow={workflow} isMobile={isMobile} />;

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          aria-busy={loading || saving}
          className="flex h-[calc(100dvh-0.5rem)] max-h-none flex-col gap-0 overflow-hidden rounded-t-2xl border-border bg-background p-0 text-foreground motion-reduce:transition-none motion-reduce:data-[state=closed]:animate-none motion-reduce:data-[state=open]:animate-none"
          onEscapeKeyDown={(event) => {
            if (saving) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (saving) event.preventDefault();
          }}
        >
          <SheetHeader className="shrink-0 border-b border-border p-0 text-left">
            <ProductOrderHeader
              workflow={workflow}
              title={
                <SheetTitle className="lao-tone-text line-clamp-2 break-words text-base font-black leading-6">
                  {product?.prodName ?? t("pos.product")}
                </SheetTitle>
              }
              description={
                <SheetDescription className="sr-only">
                  {description}
                </SheetDescription>
              }
              closeControl={
                <SheetClose asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t("actions.close")}
                    className="size-11 shrink-0 rounded-full touch-manipulation"
                    disabled={saving}
                  >
                    <X aria-hidden="true" />
                  </Button>
                </SheetClose>
              }
            />
          </SheetHeader>
          {form}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        aria-busy={loading || saving}
        className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden rounded-2xl border-border bg-background p-0 text-foreground motion-reduce:transition-none motion-reduce:data-[state=closed]:animate-none motion-reduce:data-[state=open]:animate-none sm:max-w-180"
        onEscapeKeyDown={(event) => {
          if (saving) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (saving) event.preventDefault();
        }}
      >
        <DialogHeader className="shrink-0 border-b border-border p-0 text-left">
          <ProductOrderHeader
            workflow={workflow}
            title={
              <DialogTitle className="lao-tone-text line-clamp-2 break-words text-lg font-black leading-6">
                {product?.prodName ?? t("pos.product")}
              </DialogTitle>
            }
            description={
              <DialogDescription className="sr-only">
                {description}
              </DialogDescription>
            }
            closeControl={
              <DialogClose asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t("actions.close")}
                  className="size-11 shrink-0 rounded-full"
                  disabled={saving}
                >
                  <X aria-hidden="true" />
                </Button>
              </DialogClose>
            }
          />
        </DialogHeader>
        {form}
      </DialogContent>
    </Dialog>
  );
}

function ProductOrderHeader({
  workflow,
  title,
  description,
  closeControl,
}: {
  workflow: ProductOrderSheetWorkflow;
  title: ReactNode;
  description: ReactNode;
  closeControl: ReactNode;
}) {
  const { t } = useTranslation();
  const { basePrice, lang, loading, mediaRef, modeLabel, product } = workflow;

  return (
    <div className="flex min-w-0 items-start gap-3 px-3 py-3 sm:px-5">
      <div
        ref={mediaRef}
        className="size-16 shrink-0 overflow-hidden rounded-xl border border-border bg-muted sm:size-18"
      >
        {loading && !product ? (
          <Skeleton className="size-full" />
        ) : product ? (
          <ProductMedia product={product} variant="sheetThumb" />
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        {loading && !product ? (
          <Skeleton className="h-5 w-36" />
        ) : (
          title
        )}
        {description}

        <div className="mt-1 flex min-h-5 flex-wrap items-center gap-1.5">
          {loading && !product ? (
            <>
              <Skeleton className="h-5 w-16 rounded-md" />
              <Skeleton className="h-5 w-12 rounded-md" />
            </>
          ) : (
            <>
              {modeLabel ? <Badge variant="secondary">{modeLabel}</Badge> : null}
              {product?.uniteName ? (
                <Badge variant="outline">{product.uniteName}</Badge>
              ) : null}
            </>
          )}
        </div>

        <div className="mt-1.5 flex min-w-0 items-baseline gap-2">
          <span className="shrink-0 text-xs font-semibold text-muted-foreground">
            {t("pos.unitPrice")}
          </span>
          {loading && !product ? (
            <Skeleton className="h-5 w-24" />
          ) : (
            <span className="truncate text-lg font-black text-primary tabular-nums">
              {formatMoney(basePrice, lang)}
            </span>
          )}
        </div>
      </div>

      {closeControl}
    </div>
  );
}

function ProductOrderForm({
  workflow,
  isMobile,
}: {
  workflow: ProductOrderSheetWorkflow;
  isMobile: boolean;
}) {
  const { t } = useTranslation();
  const {
    canSubmit,
    detailUuid,
    details,
    handleDetailSelect,
    handleSubmit,
    handleToppingQty,
    handleToppingToggle,
    hasSelectableDetails,
    lang,
    loading,
    mode,
    note,
    onNoteChange,
    product,
    saving,
    selectedDetail,
    selectedToppings,
    selectionIssue,
    toppingQtyByUuid,
    toppings,
  } = workflow;
  const issueLabel = selectionIssue ? t(`pos.${selectionIssue}`) : "";

  return (
    <form
      aria-busy={saving}
      aria-describedby={selectionIssue ? "public-product-order-error" : undefined}
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSubmit) handleSubmit();
      }}
    >
      <div className="min-h-0 flex-1 overscroll-y-contain overflow-y-auto bg-muted/20 px-3 py-3 scroll-pb-28 sm:px-5 sm:py-4">
        {loading && !product ? <ProductOrderSheetSkeleton /> : null}

        {product ? (
          <FieldGroup className="gap-4">
            {hasSelectableDetails ? (
              <ProductSizeFieldset
                details={details}
                detailUuid={detailUuid}
                lang={lang}
                mode={mode}
                saving={saving}
                onDetailSelect={handleDetailSelect}
              />
            ) : null}

            {mode === "set" && details.length ? (
              <SetProductFieldset details={details} />
            ) : null}

            {mode === "promotion" && selectedDetail ? (
              <Alert className="border-primary/20 bg-primary/5 text-primary">
                <AlertTitle>{t("pos.promoDeal")}</AlertTitle>
                <AlertDescription className="text-primary">
                  {getPromoLabel(selectedDetail, t)}
                </AlertDescription>
              </Alert>
            ) : null}

            {toppings.length ? (
              <ProductToppingFieldset
                lang={lang}
                saving={saving}
                selectedCount={selectedToppings.length}
                toppingQtyByUuid={toppingQtyByUuid}
                toppings={toppings}
                onChangeQty={handleToppingQty}
                onToggle={handleToppingToggle}
              />
            ) : null}

            <Field>
              <FieldLabel
                htmlFor="public-product-order-note"
                className="text-sm font-black text-foreground"
              >
                {t("pos.note")}
              </FieldLabel>
              <Textarea
                id="public-product-order-note"
                name="orderNote"
                autoComplete="off"
                value={note}
                disabled={saving}
                onChange={(event) => onNoteChange(event.target.value)}
                placeholder={t("pos.notePlaceholder")}
                className="min-h-18 resize-none bg-background text-sm"
              />
            </Field>

            {selectionIssue ? (
              <Alert
                id="public-product-order-error"
                variant="destructive"
                className="bg-destructive/5"
              >
                <AlertCircle aria-hidden="true" />
                <AlertTitle className="line-clamp-none">{issueLabel}</AlertTitle>
                {selectionIssue === "noAvailableOptions" ? (
                  <AlertDescription>
                    {t("pos.checkProductAvailability")}
                  </AlertDescription>
                ) : null}
              </Alert>
            ) : null}
          </FieldGroup>
        ) : null}

        {!loading && !product ? (
          <Alert variant="destructive">
            <AlertCircle aria-hidden="true" />
            <AlertTitle>{t("pos.productLoadFailed")}</AlertTitle>
          </Alert>
        ) : null}
      </div>

      <ProductOrderFooter workflow={workflow} isMobile={isMobile} />
    </form>
  );
}

function ProductSizeFieldset({
  details,
  detailUuid,
  lang,
  mode,
  saving,
  onDetailSelect,
}: {
  details: ProdDetail[];
  detailUuid: string;
  lang: string;
  mode: ProductOrderSheetWorkflow["mode"];
  saving: boolean;
  onDetailSelect: (uuid: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <FieldSet className="gap-2" disabled={saving}>
      <SectionLegend
        label={mode === "promotion" ? t("pos.promoDeal") : t("pos.chooseSize")}
        meta={t("pos.sizeCount", { count: details.length })}
      />
      <RadioGroup
        name="productSize"
        value={detailUuid}
        onValueChange={onDetailSelect}
      >
        {details.map((detail) => {
          const enabled = isDetailAvailable(detail);
          const id = `public-product-size-${detail.proDetailUuid}`;
          return (
            <Field
              key={detail.proDetailUuid}
              orientation="horizontal"
              data-disabled={!enabled || undefined}
            >
              <FieldLabel
                htmlFor={id}
                className={cn(
                  "min-h-14 w-full cursor-pointer items-center rounded-xl border border-border bg-background px-3 py-2 shadow-xs transition-[border-color,background-color,box-shadow] hover:border-primary/40 hover:bg-primary/5 has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary/10 has-data-[state=checked]:text-primary motion-reduce:transition-none",
                  !enabled && "cursor-not-allowed opacity-60",
                )}
              >
                <RadioGroupItem
                  id={id}
                  value={detail.proDetailUuid}
                  disabled={!enabled}
                  className="size-5"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-black">
                      {detail.sizeName || t("pos.size")}
                    </span>
                    {!enabled ? (
                      <Badge variant="secondary" className="shrink-0">
                        {t("pos.outOfStock")}
                      </Badge>
                    ) : null}
                  </span>
                  {mode === "promotion" ? (
                    <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <span>{getPromoLabel(detail, t)}</span>
                      {detail.proDetailEDate ? (
                        <span>
                          {t("pos.validUntil")} {formatShortDate(detail.proDetailEDate, lang)}
                        </span>
                      ) : null}
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 text-right text-sm font-black tabular-nums">
                  {formatMoney(productPriceFromDetail(detail), lang)}
                </span>
              </FieldLabel>
            </Field>
          );
        })}
      </RadioGroup>
    </FieldSet>
  );
}

function SetProductFieldset({ details }: { details: ProdDetail[] }) {
  const { t } = useTranslation();

  return (
    <FieldSet className="gap-2">
      <SectionLegend
        label={t("pos.includedInSet")}
        meta={t("pos.optionCount", { count: details.length })}
      />
      <div className="flex flex-col gap-2">
        {details.map((detail) => {
          const enabled = isDetailAvailable(detail);
          return (
            <div
              key={detail.proDetailUuid}
              className={cn(
                "flex min-h-12 items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 py-2",
                !enabled && "opacity-60",
              )}
            >
              <span className="flex min-w-0 items-center gap-2">
                <Check className="shrink-0 text-primary" aria-hidden="true" />
                <span className="truncate text-sm font-black">
                  {detail.sizeName || t("pos.product")}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {!enabled ? (
                  <Badge variant="secondary">{t("pos.outOfStock")}</Badge>
                ) : null}
                <Badge variant="outline">x{defaultOrderQty(detail)}</Badge>
              </span>
            </div>
          );
        })}
      </div>
    </FieldSet>
  );
}

function ProductToppingFieldset({
  lang,
  saving,
  selectedCount,
  toppingQtyByUuid,
  toppings,
  onChangeQty,
  onToggle,
}: {
  lang: string;
  saving: boolean;
  selectedCount: number;
  toppingQtyByUuid: Record<string, number>;
  toppings: ProdTopping[];
  onChangeQty: (uuid: string, qty: number) => void;
  onToggle: (uuid: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <FieldSet className="gap-2">
      <SectionLegend
        label={t("pos.toppings")}
        meta={t("pos.selectedOf", {
          selected: selectedCount,
          total: toppings.length,
        })}
      />
      <div className="flex flex-col gap-2">
        {toppings.map((topping) => {
          const uuid = topping.prodToppingUuid;
          const qty = toppingQtyByUuid[uuid] ?? 0;
          return (
            <ProductToppingRow
              key={uuid}
              lang={lang}
              qty={qty}
              saving={saving}
              topping={topping}
              onChangeQty={(nextQty) => onChangeQty(uuid, nextQty)}
              onToggle={() => onToggle(uuid)}
            />
          );
        })}
      </div>
    </FieldSet>
  );
}

function ProductToppingRow({
  lang,
  qty,
  saving,
  topping,
  onChangeQty,
  onToggle,
}: {
  lang: string;
  qty: number;
  saving: boolean;
  topping: ProdTopping;
  onChangeQty: (qty: number) => void;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const selected = qty >= 1;
  const enabled = isToppingAvailable(topping);
  const label = toppingDisplayName(topping, lang) || t("pos.toppings");
  const unitPrice = numeric(topping.toppingPrice);
  const id = `public-product-topping-${topping.prodToppingUuid}`;
  const checkboxRef = useRef<HTMLInputElement>(null);

  return (
    <Field
      orientation="horizontal"
      data-disabled={!enabled || undefined}
      className={cn(
        "min-h-16 flex-wrap rounded-xl border border-border bg-background px-3 py-2.5 shadow-xs transition-[border-color,background-color,box-shadow] motion-reduce:transition-none",
        selected && "border-primary bg-primary/10 text-primary shadow-sm",
        !enabled && "opacity-60",
      )}
    >
      <FieldLabel
        htmlFor={id}
        className={cn(
          "min-h-11 min-w-40 flex-1 cursor-pointer items-center gap-3 text-sm font-black",
          !enabled && "cursor-not-allowed",
        )}
      >
        <Checkbox
          ref={checkboxRef}
          id={id}
          name={`topping-${topping.prodToppingUuid}`}
          checked={selected}
          disabled={!enabled || saving}
          onChange={onToggle}
          className="size-5"
        />
        <span className="line-clamp-2 min-w-0 break-words">{label}</span>
        {!enabled ? (
          <Badge variant="secondary" className="shrink-0">
            {t("pos.outOfStock")}
          </Badge>
        ) : null}
      </FieldLabel>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <div className="text-right">
          <p className="text-sm font-black tabular-nums">
            +{formatMoney(unitPrice * Math.max(1, qty), lang)}
          </p>
          {selected && qty > 1 ? (
            <p className="text-xs font-semibold text-muted-foreground tabular-nums">
              {qty} × {formatMoney(unitPrice, lang)} · {t("pos.perItem")}
            </p>
          ) : null}
        </div>

        {selected ? (
          <span className="flex items-center rounded-full border border-primary/25 bg-background shadow-sm">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={t("pos.decreaseTopping", { name: label })}
              className="size-11 rounded-full text-primary touch-manipulation"
              disabled={saving}
              onClick={() => {
                onChangeQty(qty - 1);
                // Keep keyboard focus stable when the stepper unmounts at zero.
                if (qty === 1) checkboxRef.current?.focus();
              }}
            >
              <Minus aria-hidden="true" />
            </Button>
            <span className="min-w-7 text-center text-sm font-black text-foreground tabular-nums">
              {qty}
            </span>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={t("pos.increaseTopping", { name: label })}
              className="size-11 rounded-full text-primary touch-manipulation"
              disabled={saving || qty >= MAX_OPEN_QTY}
              onClick={() => onChangeQty(qty + 1)}
            >
              <Plus aria-hidden="true" />
            </Button>
          </span>
        ) : null}
      </div>
    </Field>
  );
}

function ProductOrderFooter({
  workflow,
  isMobile,
}: {
  workflow: ProductOrderSheetWorkflow;
  isMobile: boolean;
}) {
  const { t } = useTranslation();
  const {
    canSubmit,
    handleQty,
    lang,
    lineTotal,
    loading,
    maxQty,
    minQty,
    product,
    qty,
    qtyStep,
    quantityMeta,
    saving,
    selectedDetail,
  } = workflow;

  if (loading && !product) {
    const skeleton = <ProductOrderFooterSkeleton />;
    return isMobile ? (
      <SheetFooter className="shrink-0 border-t border-border bg-background px-3 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        {skeleton}
      </SheetFooter>
    ) : (
      <DialogFooter className="shrink-0 border-t border-border bg-background px-5 py-4">
        {skeleton}
      </DialogFooter>
    );
  }

  const quantityControl = (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-muted-foreground">
        {t("pos.qty")}
      </span>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={t("pos.decreaseQuantity")}
          className="size-11 touch-manipulation bg-background"
          onClick={() => handleQty(qty - qtyStep)}
          disabled={!selectedDetail || qty <= minQty || saving}
        >
          <Minus aria-hidden="true" />
        </Button>
        <output className="grid h-11 min-w-11 place-items-center rounded-md border border-border bg-background px-2 text-base font-black tabular-nums">
          {qty}
        </output>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={t("pos.increaseQuantity")}
          className="size-11 touch-manipulation bg-background"
          onClick={() => handleQty(qty + qtyStep)}
          disabled={!selectedDetail || qty + qtyStep > maxQty || saving}
        >
          <Plus aria-hidden="true" />
        </Button>
      </div>
      {quantityMeta.hasPromotion ? (
        <p className="text-xs font-semibold text-amber-700 dark:text-amber-200">
          {t("pos.orderStep", { count: qtyStep })}
        </p>
      ) : null}
    </div>
  );
  const totalOutput = (
    <div className="min-w-0 text-right" aria-live="polite" aria-atomic="true">
      <p className="text-xs font-semibold text-muted-foreground">
        {t("common.total")}
      </p>
      <output className="block truncate text-xl font-black text-primary tabular-nums">
        {formatMoney(lineTotal, lang)}
      </output>
    </div>
  );
  const submitButton = (
    <Button
      type="submit"
      className={cn("h-12 rounded-lg text-sm font-black", !isMobile && "min-w-40")}
      disabled={!canSubmit}
    >
      {saving ? (
        <Spinner aria-label={t("common.loading")} data-icon="inline-start" />
      ) : (
        <Plus aria-hidden="true" data-icon="inline-start" />
      )}
      {t("pos.sendOrder")}
    </Button>
  );

  if (isMobile) {
    return (
      <SheetFooter className="shrink-0 border-t border-border bg-background px-3 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="flex items-end justify-between gap-3">
          {quantityControl}
          {totalOutput}
        </div>
        {submitButton}
      </SheetFooter>
    );
  }

  return (
    <DialogFooter className="shrink-0 flex-row items-center justify-between gap-4 border-t border-border bg-background px-5 py-4">
      {quantityControl}
      <div className="ml-auto">{totalOutput}</div>
      {submitButton}
    </DialogFooter>
  );
}

function SectionLegend({ label, meta }: { label: string; meta: string }) {
  return (
    <FieldLegend
      variant="label"
      className="mb-0 flex min-w-0 items-center justify-between gap-3 text-sm font-black text-foreground"
    >
      <span>{label}</span>
      <span className="shrink-0 text-xs font-semibold text-muted-foreground">
        {meta}
      </span>
    </FieldLegend>
  );
}

function ProductOrderSheetSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden="true">
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
        </div>
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-14 w-full rounded-xl" />
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </section>

      <section className="flex flex-col gap-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-18 w-full rounded-md" />
      </section>
    </div>
  );
}

function ProductOrderFooterSkeleton() {
  return (
    <div className="grid w-full gap-2 sm:grid-cols-[auto_minmax(0,1fr)_10rem] sm:items-center sm:gap-4">
      <div className="flex items-end gap-2">
        <Skeleton className="size-11 rounded-md" />
        <Skeleton className="size-11 rounded-md" />
        <Skeleton className="size-11 rounded-md" />
      </div>
      <div className="grid justify-items-end gap-1">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-6 w-28" />
      </div>
      <Skeleton className="h-12 w-full rounded-lg" />
    </div>
  );
}
