"use client";

import { useRef } from "react";
import { AlertCircle, Check, Minus, Plus, ShoppingBag, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
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
import {
  defaultOrderQty,
  formatMoney,
  formatShortDate,
  getPromoLabel,
  isDetailAvailable,
  isToppingAvailable,
  numeric,
  productPriceFromDetail,
  toppingDisplayName,
} from "../utils";
import { ProductMedia } from "./public-product-media";

const PANEL_CLASS =
  "flex flex-col gap-0 overflow-hidden border-yg-line bg-linear-to-b from-yg-bg2 to-yg-bg p-0 font-yg-sans text-yg-ink shadow-[0_40px_100px_-30px_rgb(0_0_0/0.55)] dark:shadow-[0_40px_100px_-30px_rgb(0_0_0/0.85)] motion-reduce:transition-none motion-reduce:data-[state=closed]:animate-none motion-reduce:data-[state=open]:animate-none";

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

  const closeButton = (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={t("actions.close")}
      className="absolute right-3.5 top-3.5 z-2 size-11 rounded-xl border border-yg-line bg-yg-bg/60 text-yg-ink backdrop-blur-md hover:bg-yg-bg/85 hover:text-yg-ink"
      disabled={saving}
    >
      <X aria-hidden="true" />
    </Button>
  );

  // Sheet กับ Dialog ของ shadcn สร้างบน Radix Dialog ตัวเดียวกัน แต่ส่ง Title
  // ที่ตรงกับ wrapper ลงไปเพื่อให้สไตล์และ aria-labelledby ผูกถูกตัว
  const body = (titleTag: typeof DialogTitle) => (
    <>
      <ProductOrderMediaHeader workflow={workflow} />
      <ProductOrderForm workflow={workflow} titleTag={titleTag} />
    </>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          aria-busy={loading || saving}
          className={cn(
            PANEL_CLASS,
            "h-[calc(100dvh-0.5rem)] max-h-none rounded-t-[26px]",
          )}
          onEscapeKeyDown={(event) => {
            if (saving) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (saving) event.preventDefault();
          }}
        >
          <SheetDescription className="sr-only">{description}</SheetDescription>
          <SheetClose asChild>{closeButton}</SheetClose>
          {body(SheetTitle)}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        aria-busy={loading || saving}
        className={cn(
          PANEL_CLASS,
          "max-h-[min(880px,92vh)] rounded-[26px] sm:max-w-125",
        )}
        onEscapeKeyDown={(event) => {
          if (saving) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (saving) event.preventDefault();
        }}
      >
        <DialogDescription className="sr-only">{description}</DialogDescription>
        <DialogClose asChild>{closeButton}</DialogClose>
        {body(DialogTitle)}
      </DialogContent>
    </Dialog>
  );
}

/** แบนเนอร์รูปหัวโมดัลตามดีไซน์ — แทนภาพย่อขนาดเล็กของเดิม */
function ProductOrderMediaHeader({
  workflow,
}: {
  workflow: ProductOrderSheetWorkflow;
}) {
  const { loading, mediaRef, product } = workflow;

  return (
    <div
      ref={mediaRef}
      className="relative h-[clamp(168px,32vw,208px)] shrink-0 overflow-hidden"
    >
      {loading && !product ? (
        <Skeleton className="size-full rounded-none" />
      ) : product ? (
        <ProductMedia product={product} variant="sheet" />
      ) : null}

      {/* ไล่เงาขอบล่างให้แบนเนอร์กลืนเข้าเนื้อหา */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-linear-to-b from-transparent from-55% to-yg-bg/60"
      />
    </div>
  );
}

function ProductOrderForm({
  workflow,
  titleTag: TitleTag,
}: {
  workflow: ProductOrderSheetWorkflow;
  titleTag: typeof DialogTitle;
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
    modeLabel,
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
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain scroll-pb-28 px-5 pb-3 pt-4">
        {loading && !product ? <ProductOrderSheetSkeleton /> : null}

        {product ? (
          <FieldGroup className="gap-4">
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-yg-accent">
                {modeLabel || t("pos.product")}
              </span>
              <TitleTag className="lao-tone-text break-words font-yg-sans text-[clamp(21px,5vw,26px)] font-semibold leading-snug text-yg-ink">
                {product.prodName}
              </TitleTag>
              {product.uniteName ? (
                <span className="text-[13px] font-medium text-yg-muted">
                  {product.uniteName}
                </span>
              ) : null}
            </div>

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
              <div className="rounded-2xl border border-yg-accent-line bg-yg-accent-soft px-4 py-3">
                <p className="text-xs font-extrabold text-yg-accent-strong">
                  {t("pos.promoDeal")}
                </p>
                <p className="mt-0.5 text-[13px] font-medium text-yg-muted">
                  {getPromoLabel(selectedDetail, t)}
                </p>
              </div>
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
                className="text-xs font-extrabold tracking-wide text-yg-faint"
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
                className="min-h-18 resize-none rounded-2xl border-yg-line bg-yg-panel text-sm text-yg-ink placeholder:text-yg-faint focus-visible:border-yg-accent-line focus-visible:ring-yg-accent/40"
              />
            </Field>

            <ProductQuantityRow workflow={workflow} />

            {selectionIssue ? (
              <Alert
                id="public-product-order-error"
                variant="destructive"
                className="border-destructive/40 bg-destructive/10"
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
          <Alert
            variant="destructive"
            className="border-destructive/40 bg-destructive/10"
          >
            <AlertCircle aria-hidden="true" />
            <AlertTitle>{t("pos.productLoadFailed")}</AlertTitle>
          </Alert>
        ) : null}
      </div>

      <ProductOrderFooter workflow={workflow} />
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
    <FieldSet className="gap-2.5" disabled={saving}>
      <SectionLegend
        label={mode === "promotion" ? t("pos.promoDeal") : t("pos.chooseSize")}
        meta={t("pos.sizeCount", { count: details.length })}
      />
      <RadioGroup
        name="productSize"
        value={detailUuid}
        onValueChange={onDetailSelect}
        className="gap-2"
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
                  "min-h-14 w-full cursor-pointer items-center rounded-[15px] border border-yg-line bg-yg-panel px-4 py-2 shadow-none transition-[border-color,background-color] hover:border-yg-accent-line has-data-[state=checked]:border-yg-accent has-data-[state=checked]:bg-yg-accent-soft motion-reduce:transition-none",
                  !enabled && "cursor-not-allowed opacity-60",
                )}
              >
                <RadioGroupItem
                  id={id}
                  value={detail.proDetailUuid}
                  disabled={!enabled}
                  className="size-5 border-yg-faint text-yg-accent data-[state=checked]:border-yg-accent"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="lao-tone-text truncate text-sm font-bold text-yg-ink">
                      {detail.sizeName || t("pos.size")}
                    </span>
                    {!enabled ? (
                      <span className="shrink-0 rounded-md border border-yg-line bg-yg-panel2 px-1.5 py-0.5 text-[10px] font-bold text-yg-muted">
                        {t("pos.outOfStock")}
                      </span>
                    ) : null}
                  </span>
                  {mode === "promotion" ? (
                    <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-yg-faint">
                      <span>{getPromoLabel(detail, t)}</span>
                      {detail.proDetailEDate ? (
                        <span>
                          {t("pos.validUntil")}{" "}
                          {formatShortDate(detail.proDetailEDate, lang)}
                        </span>
                      ) : null}
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 text-right font-yg-number text-[19px] font-semibold text-yg-accent-strong tabular-nums">
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
    <FieldSet className="gap-2.5">
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
                "flex min-h-12 items-center justify-between gap-3 rounded-[15px] border border-yg-line bg-yg-panel px-4 py-2",
                !enabled && "opacity-60",
              )}
            >
              <span className="flex min-w-0 items-center gap-2">
                <Check
                  className="size-4 shrink-0 text-yg-accent-strong"
                  aria-hidden="true"
                />
                <span className="lao-tone-text truncate text-sm font-bold text-yg-ink">
                  {detail.sizeName || t("pos.product")}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {!enabled ? (
                  <span className="rounded-md border border-yg-line bg-yg-panel2 px-1.5 py-0.5 text-[10px] font-bold text-yg-muted">
                    {t("pos.outOfStock")}
                  </span>
                ) : null}
                <span className="font-yg-mono text-xs font-semibold text-yg-faint">
                  ×{defaultOrderQty(detail)}
                </span>
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
    <FieldSet className="gap-2.5">
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
        "min-h-16 flex-wrap rounded-[15px] border border-yg-line bg-yg-panel px-4 py-2.5 shadow-none transition-[border-color,background-color] motion-reduce:transition-none",
        selected && "border-yg-accent bg-yg-accent-soft",
        !enabled && "opacity-60",
      )}
    >
      <FieldLabel
        htmlFor={id}
        className={cn(
          "min-h-11 min-w-40 flex-1 cursor-pointer items-center gap-3 text-sm font-bold text-yg-ink",
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
          className="size-5 border-yg-faint data-[state=checked]:border-yg-accent data-[state=checked]:bg-yg-accent data-[state=checked]:text-yg-on-accent"
        />
        <span className="lao-tone-text line-clamp-2 min-w-0 break-words">
          {label}
        </span>
        {!enabled ? (
          <span className="shrink-0 rounded-md border border-yg-line bg-yg-panel2 px-1.5 py-0.5 text-[10px] font-bold text-yg-muted">
            {t("pos.outOfStock")}
          </span>
        ) : null}
      </FieldLabel>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <div className="text-right">
          <p className="font-yg-number text-[17px] font-semibold text-yg-accent-strong tabular-nums">
            +{formatMoney(unitPrice * Math.max(1, qty), lang)}
          </p>
          {selected && qty > 1 ? (
            <p className="text-[11px] font-semibold text-yg-faint tabular-nums">
              {qty} × {formatMoney(unitPrice, lang)} · {t("pos.perItem")}
            </p>
          ) : null}
        </div>

        {selected ? (
          <span className="flex items-center gap-1 rounded-xl border border-yg-line bg-yg-bg2 p-1">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={t("pos.decreaseTopping", { name: label })}
              className="size-9 rounded-lg bg-yg-panel2 text-yg-ink hover:bg-yg-panel-hover"
              disabled={saving}
              onClick={() => {
                onChangeQty(qty - 1);
                // Keep keyboard focus stable when the stepper unmounts at zero.
                if (qty === 1) checkboxRef.current?.focus();
              }}
            >
              <Minus aria-hidden="true" />
            </Button>
            <span className="min-w-7 text-center font-yg-mono text-sm font-semibold text-yg-ink tabular-nums">
              {qty}
            </span>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={t("pos.increaseTopping", { name: label })}
              className="size-9 rounded-lg bg-yg-accent-soft text-yg-accent-strong hover:bg-yg-accent-line"
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

/** แถวจำนวนตามดีไซน์ — อยู่ในเนื้อหา ไม่ใช่ท้ายโมดัล */
function ProductQuantityRow({
  workflow,
}: {
  workflow: ProductOrderSheetWorkflow;
}) {
  const { t } = useTranslation();
  const {
    handleQty,
    maxQty,
    minQty,
    qty,
    qtyStep,
    quantityMeta,
    saving,
    selectedDetail,
  } = workflow;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] font-extrabold text-yg-ink">
          {t("pos.qty")}
        </span>
        <div className="flex items-center gap-1 rounded-[15px] border border-yg-line bg-yg-panel p-1">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label={t("pos.decreaseQuantity")}
            className="size-11 rounded-xl bg-yg-panel2 text-yg-ink hover:bg-yg-panel-hover"
            onClick={() => handleQty(qty - qtyStep)}
            disabled={!selectedDetail || qty <= minQty || saving}
          >
            <Minus aria-hidden="true" />
          </Button>
          <output className="min-w-10 text-center font-yg-mono text-[17px] font-semibold text-yg-ink tabular-nums">
            {qty}
          </output>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label={t("pos.increaseQuantity")}
            className="size-11 rounded-xl bg-yg-accent-soft text-yg-accent-strong hover:bg-yg-accent-line"
            onClick={() => handleQty(qty + qtyStep)}
            disabled={!selectedDetail || qty + qtyStep > maxQty || saving}
          >
            <Plus aria-hidden="true" />
          </Button>
        </div>
      </div>
      {quantityMeta.hasPromotion ? (
        <p className="text-right text-[11px] font-semibold text-yg-accent-strong">
          {t("pos.orderStep", { count: qtyStep })}
        </p>
      ) : null}
    </div>
  );
}

/** ท้ายโมดัลตามดีไซน์ — ปุ่มเดียวเต็มความกว้าง มียอดรวมอยู่ในปุ่ม */
function ProductOrderFooter({
  workflow,
}: {
  workflow: ProductOrderSheetWorkflow;
}) {
  const { t } = useTranslation();
  const { canSubmit, lang, lineTotal, loading, product, saving } = workflow;

  return (
    <div className="shrink-0 border-t border-yg-line bg-yg-bg/45 px-5 pt-3.5 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur-md">
      {loading && !product ? (
        <Skeleton className="h-13.5 w-full rounded-2xl" />
      ) : (
        <Button
          type="submit"
          className="h-13.5 w-full rounded-2xl bg-yg-accent text-[15px] font-extrabold text-yg-on-accent shadow-[0_12px_30px_-12px_var(--yg-accent)] hover:bg-yg-accent hover:brightness-105 disabled:opacity-55 disabled:shadow-none"
          disabled={!canSubmit}
        >
          {saving ? (
            <Spinner aria-label={t("common.loading")} data-icon="inline-start" />
          ) : (
            <ShoppingBag aria-hidden="true" data-icon="inline-start" />
          )}
          <span className="truncate" aria-live="polite" aria-atomic="true">
            {t("pos.sendOrder")} · {formatMoney(lineTotal, lang)}
          </span>
        </Button>
      )}
    </div>
  );
}

function SectionLegend({ label, meta }: { label: string; meta: string }) {
  return (
    <FieldLegend
      variant="label"
      className="mb-0 flex min-w-0 items-center justify-between gap-3 text-xs font-extrabold tracking-wide text-yg-faint"
    >
      <span>{label}</span>
      <span className="shrink-0 font-yg-sans text-[11px] font-semibold tabular-nums">
        {meta}
      </span>
    </FieldLegend>
  );
}

function ProductOrderSheetSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden="true">
      <section className="flex flex-col gap-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-7 w-48" />
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
        </div>
        <Skeleton className="h-14 w-full rounded-[15px]" />
        <Skeleton className="h-14 w-full rounded-[15px]" />
        <Skeleton className="h-14 w-full rounded-[15px]" />
      </section>

      <section className="flex flex-col gap-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-18 w-full rounded-2xl" />
      </section>
    </div>
  );
}
