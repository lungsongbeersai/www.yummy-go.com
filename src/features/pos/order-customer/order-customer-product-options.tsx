"use client";

import { useState, type ReactNode } from "react";
import { useResetOnChange } from "@/hooks/use-reset-on-change";
import { AlertCircle, Check, Minus, Plus, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup, ButtonGroupText } from "@/components/ui/button-group";
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
import { optionalNumber } from "@/lib/values";
import type {
  ProdDetail,
  ProdItem,
  ProdSetDetailOptionGroup,
  ProdTaste,
  ProdTopping,
} from "@/services/pos";
import {
  availableProductDetails,
  clampOrderQuantity,
  defaultOrderQty,
  getOrderSelectionIssue,
  getPromoLabel,
  isToppingAvailable,
  isTasteAvailable,
  orderedSetDetailSections,
  orderQuantityRules,
  orderSelectionIssueLabel,
  productMedia,
  productModeLabel,
  productPriceFromDetail,
  setChildOptionSelectionLimit,
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
  media,
  open,
  subtitle,
  title,
  onOpenChange,
}: {
  children: ReactNode;
  closeDisabled?: boolean;
  closeLabel: string;
  description: string;
  isMobile: boolean;
  /** รูปสินค้าเล็กข้างชื่อ — แทนกล่องสรุปใหญ่ในเนื้อหาเดิมที่กินพื้นที่ครึ่งจอ */
  media?: ReactNode;
  open: boolean;
  /** บรรทัดรองใต้ชื่อ (ขนาดที่เลือก · ราคาต่อหน่วย) */
  subtitle?: ReactNode;
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
          <SheetHeader className="shrink-0 flex-row items-center justify-between gap-3 border-b border-border px-4 py-3 text-left">
            <div className="flex min-w-0 items-center gap-3">
              <OverlayMedia media={media} />
              <div className="flex min-w-0 flex-col gap-0.5">
                <SheetTitle className="lao-tone-text line-clamp-2 break-words text-base leading-6 font-bold">
                  {title}
                </SheetTitle>
                <OverlaySubtitle subtitle={subtitle} />
                <SheetDescription className="sr-only">
                  {description}
                </SheetDescription>
              </div>
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
        <DialogHeader className="shrink-0 flex-row items-center justify-between gap-3 border-b border-border px-5 py-3 text-left">
          <div className="flex min-w-0 items-center gap-3">
            <OverlayMedia media={media} />
            <div className="flex min-w-0 flex-col gap-0.5">
              <DialogTitle className="lao-tone-text line-clamp-2 break-words text-lg leading-6 font-bold">
                {title}
              </DialogTitle>
              <OverlaySubtitle subtitle={subtitle} />
              <DialogDescription className="sr-only">
                {description}
              </DialogDescription>
            </div>
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

function OverlayMedia({ media }: { media?: ReactNode }) {
  if (!media) return null;
  return (
    <div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-muted ring-1 ring-border sm:size-14">
      {media}
    </div>
  );
}

function OverlaySubtitle({ subtitle }: { subtitle?: ReactNode }) {
  if (!subtitle) return null;
  return (
    <div className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
      {subtitle}
    </div>
  );
}

export function ProductOptionsMedia({ product }: { product: ProdItem }) {
  return (
    <ProductMediaView
      alt=""
      fallbackIcon="chef"
      media={productMedia(product)}
      sizes="56px"
    />
  );
}

// "ชุด/โปรโมชั่น · ขนาด · ราคาต่อหน่วย" ใต้ชื่อสินค้า — สินค้าทั่วไปไม่โชว์ป้ายประเภท
export function ProductOptionsSubtitle({
  detail,
  mode,
  product,
  unitPrice,
}: {
  detail: ProdDetail;
  mode: ProductModalMode;
  product: ProdItem;
  unitPrice: number;
}) {
  const { t } = useTranslation();
  const modeLabel = mode === "normal" ? "" : productModeLabel(mode, product, t);
  const sizeLabel = mode === "set" ? "" : detail.sizeName;
  // หน่วยนับจาก API (unite_name → uniteName ใน mapApiProdItem) — ต่อท้ายราคาต่อหน่วย
  // ให้รู้ว่าราคาและจำนวนที่สั่งนับเป็นอะไร (ຈານ/ແກ້ວ/ໜ່ວຍ) เหมือนหน้าสั่งของลูกค้า
  const unitName = product.uniteName?.trim() ?? "";

  return (
    <>
      {modeLabel ? (
        <Badge className="max-w-32 shrink truncate border-primary/20 bg-primary/10 text-primary-text shadow-none">
          {modeLabel}
        </Badge>
      ) : null}
      {sizeLabel ? <span className="min-w-0 truncate">{sizeLabel}</span> : null}
      {sizeLabel ? <span aria-hidden="true">·</span> : null}
      <span className="shrink-0 tabular-nums">
        <span className="font-semibold text-foreground">{money(unitPrice)}</span>
        {unitName ? <span> / {unitName}</span> : null}
      </span>
    </>
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
  selectedSetChildOptionGroupUuids,
  selectedSetChoiceUuids,
  selectedSetChoiceTasteUuids,
  selectedTastes,
  selectedToppings,
  toppingQtyByUuid,
  onChangeToppingQty,
  onDetailChange,
  onNoteChange,
  onQtyChange,
  onSubmit,
  onToggleSetChildOption,
  onToggleSetChoice,
  onToggleSetChoiceTaste,
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
  selectedSetChildOptionGroupUuids: Record<string, string[]>;
  selectedSetChoiceUuids: Record<string, string[]>;
  selectedSetChoiceTasteUuids: Record<string, string[]>;
  selectedTastes: ProdTaste[];
  selectedToppings: SelectedTopping[];
  toppingQtyByUuid: Record<string, number>;
  onChangeToppingQty: (uuid: string, qty: number) => void;
  onDetailChange: (detail: ProdDetail) => void;
  onNoteChange: (note: string) => void;
  onQtyChange: (qty: number) => void;
  onSubmit: () => void;
  onToggleSetChildOption: (
    detailUuid: string,
    optionGroupUuid: string,
    maxSelect: number,
  ) => void;
  onToggleSetChoice: (groupUuid: string, detailUuid: string, maxSelect: number) => void;
  onToggleSetChoiceTaste: (
    detailUuid: string,
    optionGroupUuid: string,
    tasteUuid: string,
    maxSelect: number,
  ) => void;
  onToggleTaste: (uuid: string) => void;
  onToggleTopping: (uuid: string) => void;
}) {
  const { t } = useTranslation();
  const setMode = mode === "set";
  const details = setMode ? [] : availableProductDetails(product);
  const setDetailSections = setMode ? orderedSetDetailSections(product) : [];
  const toppings = (product.toppings ?? []).filter(isToppingAvailable);
  const tastes = (product.tastes ?? []).filter(isTasteAvailable);
  const tasteLimit = tasteSelectionLimit(product);
  const hasNestedSetTastes = setMode && product.details.some(
    (detail) =>
      (detail.setOptionGroups ?? []).some(
        (group) =>
          (optionalNumber(group.maxSelect) ?? 0) > 0 &&
          (group.tastes ?? []).some(isTasteAvailable),
      ) || (
        (optionalNumber(detail.setTasteMaxSelect) ?? 0) > 0 &&
        (detail.setTastes ?? []).some(isTasteAvailable)
      ),
  );
  const selectedTasteUuids = new Set(selectedTastes.map(tasteUuid));
  const toppingLimit = toppingSelectionLimit(
    toppings.length,
    product.prodToppingMaxSelect,
  );
  const toppingLimitReached = selectedToppings.length >= toppingLimit;
  const total = modalUnitPrice * qty;
  const quantityRules = orderQuantityRules(selectedDetail, mode, product);
  const selectionIssue = getOrderSelectionIssue({
    detail: selectedDetail,
    mode,
    product,
    quantity: qty,
    selectedSetChildOptionGroupUuids,
    selectedSetChoiceTasteUuids,
    selectedSetChoiceUuids,
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
      <div className="min-h-0 flex-1 overscroll-contain overflow-y-auto px-4 py-4 sm:px-5">
        <fieldset disabled={saving} className="contents">
          <FieldGroup className="gap-5">
              {setMode
                ? setDetailSections.map((section, sectionIndex) => {
                    if (section.kind === "fixed") {
                      return (
                        <FieldSet key={`fixed-${sectionIndex}`} className="gap-2">
                          <SectionLegend
                            label={t("pos.product")}
                            meta={t("pos.optionCount", { count: section.details.length })}
                          />
                          <div className="flex flex-col gap-2">
                            {section.details.map((detail) => (
                              <SetProductRow
                                key={detail.proDetailUuid}
                                detailUuid={detail.proDetailUuid}
                                label={detail.sizeName || t("pos.product")}
                                optionGroups={
                                  detail.setOptionGroups?.length
                                    ? detail.setOptionGroups
                                    : (optionalNumber(detail.setTasteMaxSelect) ?? 0) > 0
                                      ? [{
                                          setDetailOptionGroupUuid: `legacy:${detail.proDetailUuid}`,
                                          groupName: t("pos.tastes"),
                                          maxSelect: detail.setTasteMaxSelect,
                                          tastes: detail.setTastes ?? [],
                                        }]
                                      : []
                                }
                                quantity={defaultOrderQty(detail)}
                                childOptionMaxSelect={setChildOptionSelectionLimit(detail)}
                                selectedOptionGroupUuids={
                                  selectedSetChildOptionGroupUuids[detail.proDetailUuid] ?? []
                                }
                                selectedTasteUuids={selectedSetChoiceTasteUuids}
                                onToggleOptionGroup={(optionGroupUuid, maxSelect) =>
                                  onToggleSetChildOption(
                                    detail.proDetailUuid,
                                    optionGroupUuid,
                                    maxSelect,
                                  )
                                }
                                onToggleTaste={(optionGroupUuid, tasteUuid, maxSelect) =>
                                  onToggleSetChoiceTaste(
                                    detail.proDetailUuid,
                                    optionGroupUuid,
                                    tasteUuid,
                                    maxSelect,
                                  )
                                }
                              />
                            ))}
                          </div>
                        </FieldSet>
                      );
                    }

                    const { group, members } = section;
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
                            const isSelected = selected.includes(detail.proDetailUuid);
                            const canSelectMore = isSelected || selected.length < maxSelect;
                            return (
                              <SetChoiceOptionRow
                                key={detail.proDetailUuid}
                                blocked={!canSelectMore}
                                detailUuid={detail.proDetailUuid}
                                label={detail.sizeName || t("pos.product")}
                                quantity={defaultOrderQty(detail)}
                                selected={isSelected}
                                childOptionMaxSelect={setChildOptionSelectionLimit(detail)}
                                selectedOptionGroupUuids={
                                  selectedSetChildOptionGroupUuids[detail.proDetailUuid] ?? []
                                }
                                selectedTasteUuids={selectedSetChoiceTasteUuids}
                                optionGroups={
                                  detail.setOptionGroups?.length
                                    ? detail.setOptionGroups
                                    : (optionalNumber(detail.setTasteMaxSelect) ?? 0) > 0
                                      ? [{
                                          setDetailOptionGroupUuid: `legacy:${detail.proDetailUuid}`,
                                          groupName: t("pos.tastes"),
                                          maxSelect: detail.setTasteMaxSelect,
                                          tastes: detail.setTastes ?? [],
                                        }]
                                      : []
                                }
                                onToggle={() =>
                                  onToggleSetChoice(groupUuid, detail.proDetailUuid, maxSelect)
                                }
                                onToggleOptionGroup={(optionGroupUuid, childMaxSelect) =>
                                  onToggleSetChildOption(
                                    detail.proDetailUuid,
                                    optionGroupUuid,
                                    childMaxSelect,
                                  )
                                }
                                onToggleTaste={(optionGroupUuid, tasteUuid, maxSelect) =>
                                  onToggleSetChoiceTaste(
                                    detail.proDetailUuid,
                                    optionGroupUuid,
                                    tasteUuid,
                                    maxSelect,
                                  )
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
                <FieldSet className="gap-3">
                  <SectionLegend
                    label={t("pos.chooseSize")}
                    meta={t("pos.sizeCount", { count: details.length })}
                  />
                  {/* การ์ดตัวเลือกแบบกริด แทนแถวเต็มกว้างที่ด้านขวาโล่ง — ชื่อกับราคาอยู่ใกล้กัน กดง่ายบนแท็บเล็ต */}
                  <RadioGroup
                    className="grid grid-cols-2 gap-2 sm:grid-cols-3"
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
                      const checked = detail.proDetailUuid === selectedDetail.proDetailUuid;
                      return (
                        <FieldLabel
                          key={detail.proDetailUuid}
                          htmlFor={id}
                          className={optionCardClass(checked)}
                        >
                          <span className="flex w-full items-start justify-between gap-2">
                            <span className="line-clamp-2 min-w-0 text-sm font-semibold">
                              {detail.sizeName || t("pos.size")}
                            </span>
                            <RadioGroupItem id={id} value={detail.proDetailUuid} className="mt-0.5" />
                          </span>
                          <span
                            className={cn(
                              "text-sm font-semibold tabular-nums",
                              checked ? "text-primary-text" : "text-muted-foreground",
                            )}
                          >
                            {money(productPriceFromDetail(detail))}
                          </span>
                        </FieldLabel>
                      );
                    })}
                  </RadioGroup>
                </FieldSet>
              ) : null}

              {mode === "promotion" ? (
                <div className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/10 px-3.5 py-2.5 text-primary-text">
                  <span className="text-sm font-semibold">
                    {t("pos.promoDeal")}
                  </span>
                  <Badge className="shrink-0 bg-primary text-primary-foreground">
                    {getPromoLabel(selectedDetail, t)}
                  </Badge>
                </div>
              ) : null}

              {(!setMode || !hasNestedSetTastes) && tastes.length && tasteLimit > 0 ? (
                <FieldSet className="gap-3">
                  <SectionLegend
                    label={t("pos.tastes")}
                    meta={t("pos.selectedOf", {
                      selected: selectedTastes.length,
                      total: tasteLimit,
                    })}
                    metaEmphasis={selectedTastes.length >= tasteLimit}
                  />
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
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
                            optionCardClass(selected),
                            "min-h-12 flex-row items-center",
                            blocked && "cursor-not-allowed opacity-50 hover:bg-card",
                          )}
                        >
                          {/* ไม่ใช้ disabled จริง — ต้องคลิกถึง onToggle ได้เพื่อขึ้น toast เตือนเพดาน */}
                          <Checkbox
                            id={id}
                            checked={selected}
                            aria-disabled={blocked}
                            onCheckedChange={() => onToggleTaste(uuid)}
                          />
                          <span className="min-w-0 truncate text-sm font-semibold">
                            {tasteDisplayName(taste)}
                          </span>
                        </FieldLabel>
                      );
                    })}
                  </div>
                </FieldSet>
              ) : null}

              {toppings.length ? (
                <FieldSet className="gap-3">
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
                      const toppingQty = toppingQtyByUuid[uuid] ?? 0;
                      const canSelectMore = toppingQty >= 1 || !toppingLimitReached;
                      return (
                        <ToppingOptionRow
                          key={uuid}
                          canSelectMore={canSelectMore}
                          qty={toppingQty}
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

              <FieldSet className="gap-3">
                <SectionLegend label={t("pos.note")} />
                <Textarea
                  id="staff-product-note"
                  aria-label={t("pos.note")}
                  autoComplete="off"
                  className="min-h-18 resize-none bg-card"
                  name="orderNote"
                  value={note}
                  placeholder={t("pos.notePlaceholder")}
                  onChange={(event) => onNoteChange(event.target.value)}
                />
              </FieldSet>

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
          </FieldGroup>
        </fieldset>
      </div>

      <ProductOptionsFooter
        canSubmit={canSubmit}
        qty={qty}
        quantityRules={quantityRules}
        saving={saving}
        total={total}
        onQtyChange={onQtyChange}
      />
    </form>
  );
}

// การ์ดตัวเลือก (ขนาด/รสชาติ) — หน้าตาเดียวกันทุก section ให้ทั้ง modal ไปในทางเดียวกัน
function optionCardClass(checked: boolean) {
  return cn(
    "w-full min-w-0 cursor-pointer flex-col items-start gap-1 rounded-lg border border-border bg-card p-3 text-foreground transition-colors hover:bg-accent/50",
    checked && "border-primary bg-primary/5 ring-1 ring-primary hover:bg-primary/5",
  );
}

function SectionLegend({
  label,
  meta,
  metaEmphasis = false,
}: {
  label: string;
  meta?: string;
  metaEmphasis?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3">
      <FieldLegend className="mb-0 text-sm font-semibold text-foreground">
        {label}
      </FieldLegend>
      {meta ? (
        <Badge
          variant="secondary"
          className={cn(
            "shrink-0 tabular-nums",
            metaEmphasis && "bg-primary/10 text-primary-text",
          )}
        >
          {meta}
        </Badge>
      ) : null}
    </div>
  );
}

function SetProductRow({
  childOptionMaxSelect,
  detailUuid,
  label,
  optionGroups,
  quantity,
  selectedOptionGroupUuids,
  selectedTasteUuids,
  onToggleOptionGroup,
  onToggleTaste,
}: {
  childOptionMaxSelect: number;
  detailUuid: string;
  label: string;
  optionGroups: ProdSetDetailOptionGroup[];
  quantity: number;
  selectedOptionGroupUuids: string[];
  selectedTasteUuids: Record<string, string[]>;
  onToggleOptionGroup: (optionGroupUuid: string, maxSelect: number) => void;
  onToggleTaste: (optionGroupUuid: string, tasteUuid: string, maxSelect: number) => void;
}) {
  return (
    <div className="w-full rounded-xl border border-primary/20 bg-primary/5 text-foreground">
      <div className="flex min-h-12 items-center justify-between gap-3 px-3.5 py-2.5">
        <span className="flex min-w-0 items-center gap-2">
          <Check aria-hidden="true" className="size-4 shrink-0 text-primary-text" />
          <span className="truncate text-sm font-semibold">{label}</span>
        </span>
        <span className="shrink-0 text-sm font-bold text-primary-text tabular-nums">
          ×{quantity}
        </span>
      </div>
      <SetDetailOptionGroups
        childOptionMaxSelect={childOptionMaxSelect}
        detailUuid={detailUuid}
        optionGroups={optionGroups}
        selectedOptionGroupUuids={selectedOptionGroupUuids}
        selectedTasteUuids={selectedTasteUuids}
        onToggleOptionGroup={onToggleOptionGroup}
        onToggleTaste={onToggleTaste}
      />
    </div>
  );
}

function SetChoiceOptionRow({
  blocked,
  childOptionMaxSelect,
  detailUuid,
  label,
  quantity,
  selected,
  selectedOptionGroupUuids,
  selectedTasteUuids,
  optionGroups,
  onToggle,
  onToggleOptionGroup,
  onToggleTaste,
}: {
  blocked: boolean;
  childOptionMaxSelect: number;
  detailUuid: string;
  label: string;
  quantity: number;
  selected: boolean;
  selectedOptionGroupUuids: string[];
  selectedTasteUuids: Record<string, string[]>;
  optionGroups: ProdSetDetailOptionGroup[];
  onToggle: () => void;
  onToggleOptionGroup: (optionGroupUuid: string, maxSelect: number) => void;
  onToggleTaste: (optionGroupUuid: string, tasteUuid: string, maxSelect: number) => void;
}) {
  const id = `staff-set-choice-${detailUuid}`;
  return (
    <div
      className={cn(
        "w-full rounded-xl border border-border/70 bg-card text-foreground transition-colors",
        selected && "border-primary bg-primary/5 ring-1 ring-primary/20",
        blocked && !selected ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:border-primary/40 hover:bg-accent/40",
      )}
    >
      <FieldLabel
        htmlFor={id}
        className={cn(
          "min-h-12 w-full items-center gap-3 px-3.5 py-2.5",
          blocked && !selected ? "cursor-not-allowed" : "cursor-pointer",
        )}
      >
        {/* ไม่ใช้ disabled ของ Radix จริง — ต้องคลิกทะลุถึง onToggle ได้เสมอ เพื่อขึ้น toast */}
        <Checkbox
          id={id}
          checked={selected}
          aria-disabled={blocked && !selected}
          className="size-4.5"
          onCheckedChange={onToggle}
        />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{label}</span>
        <span className="shrink-0 text-sm font-bold tabular-nums text-primary-text">×{quantity}</span>
      </FieldLabel>

      {selected ? (
        <SetDetailOptionGroups
          childOptionMaxSelect={childOptionMaxSelect}
          detailUuid={detailUuid}
          optionGroups={optionGroups}
          selectedOptionGroupUuids={selectedOptionGroupUuids}
          selectedTasteUuids={selectedTasteUuids}
          onToggleOptionGroup={onToggleOptionGroup}
          onToggleTaste={onToggleTaste}
        />
      ) : null}
    </div>
  );
}

function SetDetailOptionGroups({
  childOptionMaxSelect,
  detailUuid,
  optionGroups,
  selectedOptionGroupUuids,
  selectedTasteUuids,
  onToggleOptionGroup,
  onToggleTaste,
}: {
  childOptionMaxSelect: number;
  detailUuid: string;
  optionGroups: ProdSetDetailOptionGroup[];
  selectedOptionGroupUuids: string[];
  selectedTasteUuids: Record<string, string[]>;
  onToggleOptionGroup: (optionGroupUuid: string, maxSelect: number) => void;
  onToggleTaste: (optionGroupUuid: string, tasteUuid: string, maxSelect: number) => void;
}) {
  const { t } = useTranslation();
  if (!optionGroups.length) return null;
  return (
    <div className="flex flex-col gap-3 border-t border-border/70 px-3.5 py-3">
      {childOptionMaxSelect > 0 ? (
        <div className="flex items-center justify-between gap-3 text-xs font-semibold text-muted-foreground">
          <span>{t("product.setChildOption")}</span>
          <span>
            {t("pos.selectedOf", {
              selected: selectedOptionGroupUuids.length,
              total: childOptionMaxSelect,
            })}
          </span>
        </div>
      ) : null}
      {optionGroups.map((group) => {
            const tastes = (group.tastes ?? []).filter(isTasteAvailable);
            const tasteLimit = Math.min(
              optionalNumber(group.maxSelect) ?? 0,
              tastes.length,
            );
            const selectionKey = `${detailUuid}:${group.setDetailOptionGroupUuid}`;
            const selectedGroupTasteUuids = selectedTasteUuids[selectionKey] ?? [];
            const optionGroupSelected = childOptionMaxSelect <= 0 ||
              selectedOptionGroupUuids.includes(group.setDetailOptionGroupUuid);
            const optionGroupBlocked =
              childOptionMaxSelect > 0 &&
              !optionGroupSelected &&
              selectedOptionGroupUuids.length >= childOptionMaxSelect;
            return (
              <div
                key={group.setDetailOptionGroupUuid}
                className={cn(
                  childOptionMaxSelect > 0 &&
                    "rounded-lg border border-border/70 bg-background p-2.5",
                  optionGroupSelected && childOptionMaxSelect > 0 &&
                    "border-primary bg-primary/5",
                  optionGroupBlocked && "opacity-60",
                )}
              >
                {childOptionMaxSelect > 0 ? (
                  <FieldLabel
                    htmlFor={`staff-set-child-${detailUuid}-${group.setDetailOptionGroupUuid}`}
                    className={cn(
                      "min-h-10 w-full items-center gap-2 text-sm font-semibold",
                      optionGroupBlocked ? "cursor-not-allowed" : "cursor-pointer",
                    )}
                  >
                    <Checkbox
                      id={`staff-set-child-${detailUuid}-${group.setDetailOptionGroupUuid}`}
                      checked={optionGroupSelected}
                      aria-disabled={optionGroupBlocked}
                      onCheckedChange={() =>
                        onToggleOptionGroup(
                          group.setDetailOptionGroupUuid,
                          childOptionMaxSelect,
                        )
                      }
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {group.groupName || group.groupNameLa || t("product.setChildOption")}
                    </span>
                  </FieldLabel>
                ) : (
                  <div className="mb-2 flex items-center justify-between gap-3 text-xs font-semibold text-muted-foreground">
                    <span>{group.groupName || group.groupNameLa || t("pos.tastes")}</span>
                    <span>
                      {t("pos.selectedOf", {
                        selected: selectedGroupTasteUuids.length,
                        total: tasteLimit,
                      })}
                    </span>
                  </div>
                )}
                {optionGroupSelected && tastes.length && tasteLimit > 0 ? (
                  <div className={cn("flex flex-wrap gap-2", childOptionMaxSelect > 0 && "mt-2")}>
                  {tastes.map((taste) => {
              const uuid = tasteUuid(taste);
              const tasteSelected = selectedGroupTasteUuids.includes(uuid);
              const tasteBlocked =
                !tasteSelected && selectedGroupTasteUuids.length >= tasteLimit;
              const tasteId = `staff-set-choice-${detailUuid}-${group.setDetailOptionGroupUuid}-taste-${uuid}`;
              return (
                <FieldLabel
                  key={uuid}
                  htmlFor={tasteId}
                  className={cn(
                    "min-h-10 w-fit max-w-full items-center gap-2 rounded-lg border border-border/70 bg-background px-3 text-sm font-semibold transition-colors has-data-checked:border-primary has-data-checked:bg-primary/10 has-data-checked:text-primary-text",
                    tasteBlocked
                      ? "cursor-not-allowed opacity-60"
                      : "cursor-pointer",
                  )}
                >
                  <Checkbox
                    id={tasteId}
                    checked={tasteSelected}
                    aria-disabled={tasteBlocked}
                    onCheckedChange={() =>
                      onToggleTaste(group.setDetailOptionGroupUuid, uuid, tasteLimit)
                    }
                  />
                  <span className="truncate">{tasteDisplayName(taste)}</span>
                </FieldLabel>
              );
                  })}
                  </div>
                ) : null}
              </div>
            );
      })}
    </div>
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
        "min-h-12 items-center gap-3 rounded-lg border border-border bg-card px-3 py-1.5 transition-colors hover:bg-accent/50",
        selected && "border-primary bg-primary/5 ring-1 ring-primary hover:bg-primary/5",
        blocked && "opacity-50 hover:bg-card",
      )}
    >
      <FieldLabel
        htmlFor={id}
        className={cn(
          "min-h-9 min-w-0 flex-1 items-center gap-3 text-sm font-semibold has-data-checked:bg-transparent dark:has-data-checked:bg-transparent",
          blocked ? "cursor-not-allowed" : "cursor-pointer",
        )}
      >
        {/* ไม่ใช้ disabled ของ Radix จริง — ต้องให้คลิกทะลุมาถึง onToggle ได้เสมอ เพื่อขึ้น toast
            เตือนเพดานเมื่อกดตัวที่ครบโควตาแล้ว ไม่ใช่แค่เงียบๆ ไม่มีอะไรเกิดขึ้นเหมือนปุ่ม disabled จริง */}
        <Checkbox
          id={id}
          aria-disabled={blocked}
          checked={selected}
          className={cn(blocked && "cursor-not-allowed")}
          onCheckedChange={onToggle}
        />
        <span className="min-w-0 truncate">{label}</span>
      </FieldLabel>
      <div className="flex shrink-0 flex-col items-end">
        <span
          className={cn(
            "text-sm font-semibold tabular-nums",
            selected && unitPrice > 0 ? "text-primary-text" : "text-muted-foreground",
          )}
        >
          +{money(unitPrice * Math.max(1, qty))}
        </span>
        {selected && qty > 1 ? (
          <span className="text-2xs text-muted-foreground tabular-nums">
            {qty} × {money(unitPrice)}
          </span>
        ) : null}
      </div>
      {selected ? (
        <ButtonGroup aria-label={label} className="shrink-0">
          <Button
            type="button"
            size="icon"
            variant="outline"
            aria-label={t("pos.decreaseTopping", { name: label })}
            className="size-9 bg-background"
            onClick={() => onChangeQty(qty - 1)}
          >
            <Minus aria-hidden="true" />
          </Button>
          <ButtonGroupText className="min-w-9 justify-center bg-background px-2 text-sm font-semibold tabular-nums">
            {qty}
          </ButtonGroupText>
          <Button
            type="button"
            size="icon"
            variant="outline"
            aria-label={t("pos.increaseTopping", { name: label })}
            className="size-9 bg-background"
            disabled={qty >= toppingQtyCap()}
            onClick={() => onChangeQty(qty + 1)}
          >
            <Plus aria-hidden="true" />
          </Button>
        </ButtonGroup>
      ) : null}
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
    <ButtonGroup aria-label={t("pos.qty")} className="shrink-0">
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={t("pos.decreaseQuantity")}
        className="size-11 bg-background sm:size-12"
        disabled={actionableQty <= rules.min}
        onClick={() => changeBy(-1)}
      >
        <Minus aria-hidden="true" />
      </Button>
      <Input
        id="staff-product-quantity"
        role="spinbutton"
        aria-label={t("pos.qty")}
        aria-valuemin={rules.min}
        aria-valuemax={rules.max}
        aria-valuenow={visibleQty}
        autoComplete="off"
        className="h-11 w-11 flex-none bg-background px-1 text-center text-base font-semibold tabular-nums sm:h-12 sm:w-14"
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
        className="size-11 bg-background sm:size-12"
        disabled={actionableQty >= rules.max}
        onClick={() => changeBy(1)}
      >
        <Plus aria-hidden="true" />
      </Button>
    </ButtonGroup>
  );
}

// จำนวน + ปุ่มเพิ่มลงออเดอร์ (พร้อมยอดรวม) อยู่แถวล่างเดียวกัน — แคชเชียร์ไม่ต้องเลื่อนลงไปหา
// ช่องจำนวนท้ายฟอร์มอีก และเห็นยอดที่กำลังจะเพิ่มบนปุ่มที่จะกดเลย
function ProductOptionsFooter({
  canSubmit,
  qty,
  quantityRules,
  saving,
  total,
  onQtyChange,
}: {
  canSubmit: boolean;
  qty: number;
  quantityRules: OrderQuantityRules;
  saving: boolean;
  total: number;
  onQtyChange: (qty: number) => void;
}) {
  const { t } = useTranslation();
  const content = (
    <div className="flex w-full flex-col gap-2">
      <div className="flex w-full items-center gap-2 sm:gap-3">
        <QuantityControl qty={qty} rules={quantityRules} onQtyChange={onQtyChange} />
        <Button
          type="submit"
          className="h-11 min-w-0 flex-1 justify-between gap-2 rounded-lg px-3 text-sm font-bold sm:h-12 sm:gap-3 sm:px-4 sm:text-base"
          disabled={saving || !canSubmit}
        >
          <span className="flex min-w-0 items-center gap-2">
            {saving ? (
              <Spinner aria-label={t("common.loading")} data-icon="inline-start" />
            ) : (
              // จอแคบ: ตัดไอคอนออกให้ข้อความ + ยอดรวมไม่โดนตัด (ข้างปุ่มมีตัวปรับจำนวนกินที่อยู่)
              <Plus aria-hidden="true" data-icon="inline-start" className="hidden sm:block" />
            )}
            <span className="truncate">{t("pos.sendOrder")}</span>
          </span>
          <span className="shrink-0 tabular-nums">{money(total)}</span>
        </Button>
      </div>
      {quantityRules.step > 1 ? (
        <p className="text-xs text-muted-foreground">
          {t("pos.orderStep", { count: quantityRules.step })}
        </p>
      ) : null}
    </div>
  );

  return (
    <>
      <SheetFooter className="shrink-0 border-t border-border bg-background px-4 pt-3 pb-[calc(0.75rem+var(--pos-system-bottom-safe-area))] md:hidden">
        {content}
      </SheetFooter>
      <DialogFooter className="hidden shrink-0 border-t border-border bg-background px-5 py-4 md:flex">
        {content}
      </DialogFooter>
    </>
  );
}
