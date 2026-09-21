"use client";

import { useState, type ReactNode } from "react";
import { useResetOnChange } from "@/hooks/use-reset-on-change";
import { AlertCircle, Check, Minus, Plus, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Alert, AlertTitle } from "@/components/ui/alert";
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
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ProdDetail, ProdItem, ProdTaste, ProdTopping } from "@/services/pos";
import {
  availableProductDetails,
  clampOrderQuantity,
  getOrderSelectionIssue,
  getPromoLabel,
  groupedSetDetails,
  isToppingAvailable,
  isTasteAvailable,
  orderQuantityRules,
  orderSelectionIssueLabel,
  productMedia,
  productModeLabel,
  productPriceFromDetail,
  setChoiceGroupDisplayName,
  setChoiceGroupMaxSelect,
  setChoiceGroupUuid,
  toppingDisplayName,
  toppingPrice,
  toppingQtyCap,
  toppingSelectionLimit,
  toppingUuid,
  tasteDisplayName,
  tasteSelectionLimit,
  tasteUuid,
  type OrderQuantityRules,
  type ProductMedia,
  type ProductModalMode,
  type SelectedTopping,
} from "./order-customer-utils";
import { ProductMediaView } from "./order-customer-product-card";

export function ProductOptionsOverlay({
  children,
  closeDisabled = false,
  closeLabel,
  description,
  isMobile,
  open,
  title,
  onOpenChange,
}: {
  children: ReactNode;
  closeDisabled?: boolean;
  closeLabel: string;
  description: string;
  isMobile: boolean;
  open: boolean;
  title: string;
  onOpenChange: (open: boolean) => void;
}) {
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        {/* ลบ env(safe-area-inset-top) ออกจากความสูงทั้งก้อน ให้ขอบบนสุดของ sheet
            หยุดอยู่ที่เส้น safe-area พอดี ไม่ล้ำขึ้นไปทาสีทับ status bar — เหตุผลเดียวกับ
            cart sheet ใน order-customer-view.tsx */}
        <SheetContent
          showCloseButton={false}
          side="bottom"
          className="pos-soft-light-zone pos-dark-zone flex h-[calc(100dvh-8px-env(safe-area-inset-top,0px))] max-h-none flex-col gap-0 overflow-hidden rounded-t-2xl border-border bg-background p-0 text-foreground data-[side=bottom]:h-[calc(100dvh-8px-env(safe-area-inset-top,0px))] motion-reduce:transition-none motion-reduce:data-[state=closed]:animate-none motion-reduce:data-[state=open]:animate-none"
        >
          <SheetHeader className="shrink-0 flex-row items-start justify-between gap-3 border-b border-border px-4 py-3 text-left">
            <div className="min-w-0">
              <SheetTitle className="lao-tone-text line-clamp-2 break-words text-base leading-6 font-bold sm:text-lg">
                {title}
              </SheetTitle>
              <SheetDescription className="sr-only">
                {description}
              </SheetDescription>
            </div>
            <SheetClose asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={closeLabel}
                className="size-11 shrink-0 rounded-full hover:bg-muted"
                disabled={closeDisabled}
              >
                <X aria-hidden="true" />
              </Button>
            </SheetClose>
          </SheetHeader>
          {children}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* max-h เดิม (100dvh-2rem) ไม่เคยเผื่อ safe-area บน/ล่างเลย — ตอนรันบน Capacitor
          จอกว้าง/แนวนอน (isMobile=false ที่ path นี้ถึงจะเจอ Dialog แทน Sheet) กล่อง modal ที่
          จัดกึ่งกลางด้วย top-1/2 อาจสูงล้นไปทับ status bar ด้านบน หรือ gesture bar ด้านล่างได้
          ลบ safe-area ทั้งสองด้านออกจาก max-height เพิ่ม — env() เป็น 0 อยู่แล้วบนจอที่ไม่มี inset */}
      <DialogContent
        showCloseButton={false}
        className="pos-soft-light-zone pos-dark-zone flex max-h-[calc(100dvh-2rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] flex-col gap-0 overflow-hidden border-border bg-background p-0 text-foreground motion-reduce:transition-none motion-reduce:data-[state=closed]:animate-none motion-reduce:data-[state=open]:animate-none sm:max-w-180"
      >
        <DialogHeader className="shrink-0 flex-row items-start justify-between gap-3 border-b border-border px-5 py-3 text-left">
          <div className="min-w-0">
            <DialogTitle className="lao-tone-text line-clamp-2 break-words text-lg leading-6 font-bold">
              {title}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {description}
            </DialogDescription>
          </div>
          <DialogClose asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={closeLabel}
              className="size-11 shrink-0 rounded-full hover:bg-muted"
              disabled={closeDisabled}
            >
              <X aria-hidden="true" />
            </Button>
          </DialogClose>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

export function ProductOptionsForm({
  modalUnitPrice,
  mode,
  note,
  product,
  qty,
  saving,
  selectedDetail,
  selectedSetChoiceUuids,
  selectedTastes,
  selectedToppings,
  toppingQtyByUuid,
  onChangeToppingQty,
  onDetailChange,
  onNoteChange,
  onQtyChange,
  onSubmit,
  onToggleSetChoice,
  onToggleTaste,
  onToggleTopping,
}: {
  modalUnitPrice: number;
  mode: ProductModalMode;
  note: string;
  product: ProdItem;
  qty: number;
  saving: boolean;
  selectedDetail: ProdDetail;
  selectedSetChoiceUuids: Record<string, string[]>;
  selectedTastes: ProdTaste[];
  selectedToppings: SelectedTopping[];
  toppingQtyByUuid: Record<string, number>;
  onChangeToppingQty: (uuid: string, qty: number) => void;
  onDetailChange: (detail: ProdDetail) => void;
  onNoteChange: (note: string) => void;
  onQtyChange: (qty: number) => void;
  onSubmit: () => void;
  onToggleSetChoice: (groupUuid: string, detailUuid: string, maxSelect: number) => void;
  onToggleTaste: (uuid: string) => void;
  onToggleTopping: (uuid: string) => void;
}) {
  const { t } = useTranslation();
  const media = productMedia(product);
  const setMode = mode === "set";
  const details = setMode ? [] : availableProductDetails(product);
  const { ungrouped: setUngroupedDetails, groups: setChoiceGroupEntries } = setMode
    ? groupedSetDetails(product)
    : { ungrouped: [], groups: [] };
  const toppings = (product.toppings ?? []).filter(isToppingAvailable);
  const tastes = (product.tastes ?? []).filter(isTasteAvailable);
  const tasteLimit = tasteSelectionLimit(product);
  const selectedTasteUuids = new Set(selectedTastes.map(tasteUuid));
  const toppingLimit = toppingSelectionLimit(
    toppings.length,
    product.prodToppingMaxSelect,
  );
  const toppingLimitReached = selectedToppings.length >= toppingLimit;
  const total = modalUnitPrice * qty;
  const modeLabel = productModeLabel(mode, product, t);
  const quantityRules = orderQuantityRules(selectedDetail, mode, product);
  const selectionIssue = getOrderSelectionIssue({
    detail: selectedDetail,
    mode,
    product,
    quantity: qty,
    tastes: selectedTastes,
    toppings: selectedToppings,
  });
  const submitIssue = selectionIssue
    ? orderSelectionIssueLabel(selectionIssue, t, quantityRules)
    : null;
  const canSubmit = !selectionIssue;

  return (
    <form
      aria-busy={saving}
      aria-describedby={submitIssue ? "product-options-error" : undefined}
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        if (!saving && canSubmit) onSubmit();
      }}
    >
      <div className="min-h-0 flex-1 overscroll-contain overflow-y-auto px-3 py-3 sm:px-5 sm:py-4">
        <fieldset disabled={saving} className="contents">
          <div className="flex flex-col gap-3 sm:gap-4">
            <ProductDetailSummary
              detailLabel={setMode ? null : selectedDetail.sizeName}
              media={media}
              modeLabel={modeLabel}
              unitPrice={modalUnitPrice}
            />

            <FieldGroup className="gap-4">
              {setMode && setUngroupedDetails.length ? (
                <FieldSet className="gap-2">
                  <SectionLegend
                    label={t("pos.product")}
                    meta={t("pos.optionCount", { count: setUngroupedDetails.length })}
                  />
                  <div className="flex flex-col gap-2">
                    {setUngroupedDetails.map((detail) => {
                      const price = productPriceFromDetail(detail);
                      return (
                        <SetProductRow
                          key={detail.proDetailUuid}
                          label={detail.sizeName || t("pos.product")}
                          price={
                            price > 0
                              ? money(price)
                              : t("pos.includedInSet")
                          }
                        />
                      );
                    })}
                  </div>
                </FieldSet>
              ) : null}

              {setMode
                ? setChoiceGroupEntries.map(({ group, members }) => {
                    const groupUuid = setChoiceGroupUuid(group);
                    const maxSelect = setChoiceGroupMaxSelect(group);
                    const selected = selectedSetChoiceUuids[groupUuid] ?? [];
                    return (
                      <FieldSet key={groupUuid} className="gap-2">
                        <SectionLegend
                          label={setChoiceGroupDisplayName(group) || t("pos.product")}
                          meta={t("pos.selectedOf", {
                            selected: selected.length,
                            total: maxSelect,
                          })}
                          metaEmphasis={selected.length >= maxSelect}
                        />
                        <div className="flex flex-col gap-2">
                          {members.map((detail) => {
                            const price = productPriceFromDetail(detail);
                            const isSelected = selected.includes(detail.proDetailUuid);
                            const canSelectMore = isSelected || selected.length < maxSelect;
                            return (
                              <SetChoiceOptionRow
                                key={detail.proDetailUuid}
                                blocked={!canSelectMore}
                                detailUuid={detail.proDetailUuid}
                                label={detail.sizeName || t("pos.product")}
                                price={price > 0 ? money(price) : t("pos.includedInSet")}
                                selected={isSelected}
                                onToggle={() =>
                                  onToggleSetChoice(groupUuid, detail.proDetailUuid, maxSelect)
                                }
                              />
                            );
                          })}
                        </div>
                      </FieldSet>
                    );
                  })
                : null}

              {!setMode && details.length > 1 ? (
                <FieldSet className="gap-2">
                  <SectionLegend
                    label={t("pos.chooseSize")}
                    meta={t("pos.sizeCount", { count: details.length })}
                  />
                  <RadioGroup
                    value={selectedDetail.proDetailUuid}
                    onValueChange={(uuid) => {
                      const detail = details.find(
                        (option) => option.proDetailUuid === uuid,
                      );
                      if (detail) onDetailChange(detail);
                    }}
                  >
                    {details.map((detail) => {
                      const id = `staff-product-size-${detail.proDetailUuid}`;
                      return (
                        <FieldLabel
                          key={detail.proDetailUuid}
                          htmlFor={id}
                          className="min-h-12 w-full cursor-pointer items-center rounded-xl border border-border/70 bg-card px-3.5 py-2.5 text-foreground transition-colors hover:border-primary/40 hover:bg-accent/40 has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary/5 has-data-[state=checked]:ring-1 has-data-[state=checked]:ring-primary/20"
                        >
                          <RadioGroupItem
                            id={id}
                            value={detail.proDetailUuid}
                            className="size-5"
                          />
                          <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                            {detail.sizeName || t("pos.size")}
                          </span>
                          <span className="shrink-0 text-sm font-bold tabular-nums text-primary">
                            {money(productPriceFromDetail(detail))}
                          </span>
                        </FieldLabel>
                      );
                    })}
                  </RadioGroup>
                </FieldSet>
              ) : null}

              {mode === "promotion" ? (
                <div className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/10 px-3.5 py-2.5 text-primary">
                  <span className="text-sm font-semibold">
                    {t("pos.promoDeal")}
                  </span>
                  <Badge className="shrink-0 bg-primary text-primary-foreground">
                    {getPromoLabel(selectedDetail, t)}
                  </Badge>
                </div>
              ) : null}

              {tastes.length && tasteLimit > 0 ? (
                <FieldSet className="gap-2">
                  <SectionLegend
                    label={t("pos.tastes")}
                    meta={t("pos.selectedOf", {
                      selected: selectedTastes.length,
                      total: tasteLimit,
                    })}
                    metaEmphasis={selectedTastes.length >= tasteLimit}
                  />
                  {/* รสชาติเป็นแท็ก (ไม่มีราคา/จำนวน) — แสดงเป็น chip แบบ wrap แทนแถวเต็มกว้าง
                      ที่ปล่อยด้านขวาโล่ง ให้ดูกระชับ สวย และแยกจากขนาด/ท็อปปิ้งที่มีราคาชัดเจน */}
                  <div className="flex flex-wrap gap-2">
                    {tastes.map((taste) => {
                      const uuid = tasteUuid(taste);
                      const selected = selectedTasteUuids.has(uuid);
                      const blocked = !selected && selectedTastes.length >= tasteLimit;
                      const id = `staff-product-taste-${uuid}`;
                      return (
                        <FieldLabel
                          key={uuid}
                          htmlFor={id}
                          className={cn(
                            "min-h-11 w-fit max-w-full items-center gap-2 rounded-lg border border-border/70 bg-card px-3.5 text-sm font-semibold text-foreground transition-colors hover:border-primary/40 hover:bg-accent/40 has-data-checked:border-primary has-data-checked:bg-primary/10 has-data-checked:text-primary",
                            blocked ? "cursor-not-allowed opacity-60" : "cursor-pointer",
                          )}
                        >
                          <Checkbox
                            id={id}
                            checked={selected}
                            aria-disabled={blocked}
                            className="size-4.5"
                            onCheckedChange={() => onToggleTaste(uuid)}
                          />
                          <span className="min-w-0 truncate">{tasteDisplayName(taste)}</span>
                        </FieldLabel>
                      );
                    })}
                  </div>
                </FieldSet>
              ) : null}

              {toppings.length ? (
                <FieldSet className="gap-2">
                  <SectionLegend
                    label={t("pos.toppings")}
                    meta={t("pos.selectedOf", {
                      selected: selectedToppings.length,
                      total: toppingLimit,
                    })}
                    metaEmphasis={toppingLimitReached}
                  />
                  <div className="flex flex-col gap-2">
                    {toppings.map((topping) => {
                      const uuid = toppingUuid(topping);
                      const qty = toppingQtyByUuid[uuid] ?? 0;
                      const canSelectMore = qty >= 1 || !toppingLimitReached;
                      return (
                        <ToppingOptionRow
                          key={uuid}
                          canSelectMore={canSelectMore}
                          qty={qty}
                          topping={topping}
                          onChangeQty={(nextQty) =>
                            onChangeToppingQty(uuid, nextQty)
                          }
                          onToggle={() => onToggleTopping(uuid)}
                        />
                      );
                    })}
                  </div>
                </FieldSet>
              ) : null}

              <Field>
                <FieldLabel
                  htmlFor="staff-product-quantity"
                  className="text-sm font-semibold text-foreground"
                >
                  {t("pos.qty")}
                </FieldLabel>
                <QuantityControl
                  qty={qty}
                  rules={quantityRules}
                  onQtyChange={onQtyChange}
                />
                {quantityRules.step > 1 ? (
                  <FieldDescription>
                    {t("pos.orderStep", { count: quantityRules.step })}
                  </FieldDescription>
                ) : null}
              </Field>

              <Field>
                <FieldLabel
                  htmlFor="staff-product-note"
                  className="text-sm font-semibold text-foreground"
                >
                  {t("pos.note")}
                </FieldLabel>
                <Textarea
                  id="staff-product-note"
                  autoComplete="off"
                  className="min-h-18 resize-none bg-background"
                  name="orderNote"
                  value={note}
                  placeholder={t("pos.notePlaceholder")}
                  onChange={(event) => onNoteChange(event.target.value)}
                />
              </Field>
            </FieldGroup>

            {submitIssue ? (
              <Alert
                id="product-options-error"
                variant="destructive"
                className="bg-destructive/5"
              >
                <AlertCircle aria-hidden="true" />
                <AlertTitle className="line-clamp-none">{submitIssue}</AlertTitle>
              </Alert>
            ) : null}
          </div>
        </fieldset>
      </div>

      <ProductOptionsFooter
        canSubmit={canSubmit}
        saving={saving}
        total={total}
      />
    </form>
  );
}

function ProductDetailSummary({
  detailLabel,
  media,
  modeLabel,
  unitPrice,
}: {
  detailLabel?: string | null;
  media: ProductMedia;
  modeLabel: string;
  unitPrice: number;
}) {
  const { t } = useTranslation();

  return (
    <section className="rounded-2xl border border-border bg-muted/30 p-3.5">
      <div className="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-3.5 sm:grid-cols-[72px_minmax(0,1fr)]">
        <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-muted bg-cover bg-center shadow-sm ring-1 ring-border/60">
          <ProductMediaView
            alt=""
            fallbackIcon="chef"
            media={media}
            sizes="96px"
          />
        </div>
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1.5">
            <Badge className="w-fit max-w-full truncate border border-primary/20 bg-primary/10 text-primary shadow-none">
              {modeLabel}
            </Badge>
            {detailLabel ? (
              <p className="truncate text-sm font-medium text-muted-foreground">
                {detailLabel}
              </p>
            ) : null}
          </div>
          <div className="min-w-0 shrink-0 text-right">
            <p className="text-xs font-medium leading-4 text-muted-foreground">
              {t("pos.unitPrice")}
            </p>
            <p className="truncate text-xl font-bold leading-7 text-primary tabular-nums sm:text-2xl">
              {money(unitPrice)}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function SectionLegend({
  label,
  meta,
  metaEmphasis = false,
}: {
  label: string;
  meta: string;
  metaEmphasis?: boolean;
}) {
  return (
    <FieldLegend
      variant="label"
      className="mb-0 flex min-w-0 items-center justify-between gap-3 text-xs font-bold uppercase tracking-wide text-muted-foreground"
    >
      <span>{label}</span>
      <span
        className={cn(
          "shrink-0 text-xs font-semibold normal-case tracking-normal",
          metaEmphasis ? "text-primary" : "text-muted-foreground/80",
        )}
      >
        {meta}
      </span>
    </FieldLegend>
  );
}

function SetProductRow({ label, price }: { label: string; price: string }) {
  return (
    <div className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 px-3.5 py-2.5 text-foreground">
      <span className="flex min-w-0 items-center gap-2">
        <Check aria-hidden="true" className="size-4 shrink-0 text-primary" />
        <span className="truncate text-sm font-semibold">{label}</span>
      </span>
      <span className="shrink-0 text-sm font-bold text-primary tabular-nums">
        {price}
      </span>
    </div>
  );
}

function SetChoiceOptionRow({
  blocked,
  detailUuid,
  label,
  price,
  selected,
  onToggle,
}: {
  blocked: boolean;
  detailUuid: string;
  label: string;
  price: string;
  selected: boolean;
  onToggle: () => void;
}) {
  const id = `staff-set-choice-${detailUuid}`;
  return (
    <FieldLabel
      htmlFor={id}
      className={cn(
        "min-h-12 w-full items-center gap-3 rounded-xl border border-border/70 bg-card px-3.5 py-2.5 text-foreground transition-colors has-data-checked:border-primary has-data-checked:bg-primary/5 has-data-checked:ring-1 has-data-checked:ring-primary/20",
        blocked && !selected ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:border-primary/40 hover:bg-accent/40",
      )}
    >
      {/* ไม่ใช้ disabled ของ Radix จริง — ต้องคลิกทะลุถึง onToggle ได้เสมอ เพื่อขึ้น toast
          เตือนเพดานเมื่อกดตัวที่ครบโควตาแล้ว (เหมือน ToppingOptionRow ด้านล่าง) */}
      <Checkbox
        id={id}
        checked={selected}
        aria-disabled={blocked && !selected}
        className="size-4.5"
        onCheckedChange={onToggle}
      />
      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{label}</span>
      <span className="shrink-0 text-sm font-bold tabular-nums text-primary">{price}</span>
    </FieldLabel>
  );
}

function ToppingOptionRow({
  canSelectMore,
  qty,
  topping,
  onChangeQty,
  onToggle,
}: {
  canSelectMore: boolean;
  qty: number;
  topping: ProdTopping;
  onChangeQty: (qty: number) => void;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const selected = qty >= 1;
  const blocked = !selected && !canSelectMore;
  const uuid = toppingUuid(topping);
  const id = `staff-product-topping-${uuid}`;
  const label = toppingDisplayName(topping);
  const unitPrice = toppingPrice(topping);

  return (
    <Field
      orientation="horizontal"
      className={cn(
        "min-h-14 flex-wrap rounded-xl border border-border/70 bg-card px-3.5 py-2.5 transition-colors",
        selected && "border-primary bg-primary/5 ring-1 ring-primary/20",
        blocked && "opacity-50",
      )}
    >
      <FieldLabel
        className={cn(
          "min-h-11 min-w-18 flex-1 items-center gap-3 text-sm font-semibold has-data-checked:bg-transparent dark:has-data-checked:bg-transparent",
          blocked ? "cursor-not-allowed" : "cursor-pointer",
        )}
      >
        {/* ไม่ใช้ disabled ของ Radix จริง — ต้องให้คลิกทะลุมาถึง onToggle ได้เสมอ เพื่อขึ้น toast
            เตือนเพดานเมื่อกดตัวที่ครบโควตาแล้ว ไม่ใช่แค่เงียบๆ ไม่มีอะไรเกิดขึ้นเหมือนปุ่ม disabled จริง */}
        <Checkbox
          id={id}
          aria-disabled={blocked}
          checked={selected}
          className={cn("size-5", blocked && "cursor-not-allowed")}
          onCheckedChange={onToggle}
        />
        <span className="truncate">{label}</span>
      </FieldLabel>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <div className="text-right">
          <p className={cn("text-sm font-bold tabular-nums", unitPrice > 0 ? "text-primary" : "text-muted-foreground")}>
            +{money(unitPrice * Math.max(1, qty))}
          </p>
          <p className="text-2xs font-medium text-muted-foreground tabular-nums">
            {selected && qty > 1 ? `${qty} × ${money(unitPrice)} · ` : ""}
            {t("pos.perItem")}
          </p>
        </div>
        {selected ? (
          <span className="flex items-center rounded-full border border-primary/30 bg-background shadow-sm">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={t("pos.decreaseTopping", { name: label })}
              className="size-11 rounded-full text-primary hover:bg-primary/10"
              onClick={() => onChangeQty(qty - 1)}
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
              className="size-11 rounded-full text-primary hover:bg-primary/10"
              disabled={qty >= toppingQtyCap()}
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

function QuantityControl({
  qty,
  rules,
  onQtyChange,
}: {
  qty: number;
  rules: OrderQuantityRules;
  onQtyChange: (qty: number) => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(String(qty));

  // จำนวนถูกแก้จากที่อื่น (ปุ่ม +/-) = ให้ช่องกรอกตามค่าใหม่
  useResetOnChange(qty, () => setDraft(String(qty)));

  function draftNumber() {
    const parsed = Number(draft);
    return draft && Number.isFinite(parsed) ? parsed : qty;
  }

  // พิมพ์เกินสต็อกแล้ว blur/Enter ต้องไม่ตัดค่ากลับให้เงียบๆ — ปล่อยค่าที่พิมพ์จริงขึ้นไปให้
  // getOrderSelectionIssue ตรวจ แล้วขึ้น Alert "สต็อกไม่พอ" ให้ผู้ใช้เห็นว่าทำไมส่งออเดอร์ไม่ได้
  // (ปุ่ม +/- ยังจำกัดด้วย rules ผ่าน changeBy/actionableQty ตามเดิม จุดนี้แก้แค่ทางพิมพ์เอง)
  function commit(value = draftNumber()) {
    const normalized = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : qty;
    setDraft(String(normalized));
    if (normalized !== qty) onQtyChange(normalized);
  }

  function changeBy(direction: -1 | 1) {
    const current = clampOrderQuantity(draftNumber(), rules);
    commit(current + direction * rules.step);
  }

  const actionableQty = clampOrderQuantity(draftNumber(), rules);
  const parsedVisibleQty = Number(draft);
  const visibleQty =
    draft && Number.isFinite(parsedVisibleQty) ? parsedVisibleQty : undefined;

  return (
    <div className="grid max-w-60 grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={t("pos.decreaseQuantity")}
        className="size-11 bg-background hover:bg-muted"
        disabled={actionableQty <= rules.min}
        onClick={() => changeBy(-1)}
      >
        <Minus aria-hidden="true" />
      </Button>
      <Input
        id="staff-product-quantity"
        role="spinbutton"
        aria-valuemin={rules.min}
        aria-valuemax={rules.max}
        aria-valuenow={visibleQty}
        autoComplete="off"
        className="h-11 w-full bg-background text-center text-lg font-black tabular-nums"
        inputMode="numeric"
        name="quantity"
        value={draft}
        onBlur={() => commit()}
        onChange={(event) => {
          setDraft(event.target.value.replace(/\D/g, ""));
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            changeBy(event.key === "ArrowDown" ? -1 : 1);
            return;
          }
          if (event.key !== "Enter") return;
          event.preventDefault();
          commit();
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={t("pos.increaseQuantity")}
        className="size-11 bg-background hover:bg-muted"
        disabled={actionableQty >= rules.max}
        onClick={() => changeBy(1)}
      >
        <Plus aria-hidden="true" />
      </Button>
    </div>
  );
}

function ProductOptionsFooter({
  canSubmit,
  saving,
  total,
}: {
  canSubmit: boolean;
  saving: boolean;
  total: number;
}) {
  const { t } = useTranslation();
  const content = (
    <>
      <div className="min-w-0">
        <p className="text-xs font-medium leading-4 text-muted-foreground">
          {t("common.total")}
        </p>
        <p className="truncate text-2xl font-bold leading-8 text-primary tabular-nums">
          {money(total)}
        </p>
      </div>
      <Button
        type="submit"
        className="h-12 min-w-40 rounded-xl bg-primary text-base font-bold text-primary-foreground shadow-sm hover:bg-primary/90"
        disabled={saving || !canSubmit}
      >
        {saving ? (
          <Spinner aria-label={t("common.loading")} data-icon="inline-start" />
        ) : (
          <Plus aria-hidden="true" data-icon="inline-start" />
        )}
        {t("pos.sendOrder")}
      </Button>
    </>
  );

  return (
    <>
      <SheetFooter className="shrink-0 border-t border-border bg-background px-4 pt-3 pb-[calc(0.75rem+var(--pos-system-bottom-safe-area))] md:hidden">
        <div className="flex items-center justify-between gap-3">{content}</div>
      </SheetFooter>
      <DialogFooter className="hidden shrink-0 border-t border-border bg-background px-5 py-4 md:flex md:items-center md:justify-between">
        {content}
      </DialogFooter>
    </>
  );
}
