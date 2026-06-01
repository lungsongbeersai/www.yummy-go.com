"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Loader2, Minus, Plus } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { CartOrder, ProdItem } from "@/services/pos";
import {
  publicMenuKindToStatusSortFk,
  type PublicMenuKind,
} from "@/stores/public-pos-store";
import { MAX_OPEN_QTY } from "@/features/public-pos/constants";
import type { PublicAddToCartPayload } from "@/features/public-pos/types";
import { ProductMedia } from "@/features/public-pos/components/public-menu-sections";
import {
  defaultOrderQty,
  firstAvailableDetail,
  formatMoney,
  formatShortDate,
  getModalBasePrice,
  getProductModalMode,
  getPromoLabel,
  isDetailAvailable,
  isToppingAvailable,
  maxAvailableQty,
  numeric,
  productModeLabel,
  productPriceFromDetail,
  promotionQuantity,
  toppingDisplayName,
} from "@/features/public-pos/utils";

export function ProductOrderSheet({
  open,
  onOpenChange,
  product,
  statusKind,
  cart,
  lang,
  loading,
  saving,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: ProdItem | null;
  statusKind: PublicMenuKind;
  cart: CartOrder[];
  lang: string;
  loading: boolean;
  saving: boolean;
  onAdd: (payload: PublicAddToCartPayload, sourceRect?: DOMRect | null) => void;
}) {
  const { t } = useTranslation();
  const mediaRef = useRef<HTMLDivElement | null>(null);
  const details = useMemo(() => product?.details ?? [], [product]);
  const toppings = useMemo(() => product?.toppings ?? [], [product]);
  const statusSortFk = publicMenuKindToStatusSortFk(statusKind);
  const mode = useMemo(
    () => getProductModalMode(statusSortFk, product),
    [product, statusSortFk],
  );
  const [detailUuid, setDetailUuid] = useState("");
  const [selectedToppingUuids, setSelectedToppingUuids] = useState<string[]>(
    [],
  );
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open || !product) return;
    const nextDetail = firstAvailableDetail(product) ?? details[0];
    setDetailUuid(nextDetail?.pro_detail_uuid ?? "");
    setQty(defaultOrderQty(nextDetail));
    setSelectedToppingUuids([]);
    setNote("");
  }, [details, open, product]);

  const selectedDetail =
    details.find((detail) => detail.pro_detail_uuid === detailUuid) ??
    firstAvailableDetail(product);
  const selectedToppings = toppings.filter(
    (topping) =>
      selectedToppingUuids.includes(topping.prod_topping_uuid) &&
      isToppingAvailable(topping),
  );
  const basePrice = getModalBasePrice(product, selectedDetail, mode);
  const toppingTotal = selectedToppings.reduce(
    (sum, topping) => sum + numeric(topping.topping_price),
    0,
  );
  const lineTotal = (basePrice + toppingTotal) * qty;
  const maxQty = Math.min(
    MAX_OPEN_QTY,
    maxAvailableQty(product, selectedDetail ?? undefined, cart),
  );
  const quantityMeta = promotionQuantity(selectedDetail);
  const qtyStep = quantityMeta.qtyStep;
  const minQty = qtyStep;
  const maxSelectableQty = maxQty >= minQty ? maxQty : minQty;
  const canSubmit = Boolean(
    product &&
      selectedDetail &&
      isDetailAvailable(selectedDetail) &&
      qty >= minQty &&
      qty <= maxQty &&
      !saving,
  );
  const modeLabel = product ? productModeLabel(mode, product, lang) : "";
  const hasSelectableDetails = mode !== "set" && details.length > 0;
  const priceLabel =
    mode === "set"
      ? formatMoney(basePrice, lang)
      : selectedDetail
        ? formatMoney(basePrice, lang)
        : "";

  const handleQty = (nextQty: number) => {
    setQty(Math.max(minQty, Math.min(maxSelectableQty, nextQty)));
  };

  const toggleTopping = (toppingUuid: string) => {
    const topping = toppings.find(
      (item) => item.prod_topping_uuid === toppingUuid,
    );
    if (!isToppingAvailable(topping)) return;

    setSelectedToppingUuids((current) =>
      current.includes(toppingUuid)
        ? current.filter((uuid) => uuid !== toppingUuid)
        : [...current, toppingUuid],
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex max-h-[88dvh] flex-col overflow-hidden rounded-t-2xl border-emerald-100 bg-[#fbfffd] p-0 sm:inset-x-auto sm:left-1/2 sm:w-full sm:max-w-xl sm:-translate-x-1/2 dark:border-border dark:bg-background"
      >
        <SheetHeader className="shrink-0 border-b border-emerald-100 bg-white/95 p-3 text-left dark:border-border dark:bg-background/95">
          <div className="flex items-start justify-between gap-3 pr-8">
            <div className="min-w-0">
              <SheetTitle className="line-clamp-2 text-base font-black leading-5">
                {product?.prod_name ?? t("pos.product")}
              </SheetTitle>
              <SheetDescription className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                {modeLabel ? (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-black text-primary dark:bg-primary/10">
                    {modeLabel}
                  </span>
                ) : null}
                {product?.unite_name ? (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 font-bold text-slate-600 dark:bg-muted dark:text-muted-foreground">
                    {product.unite_name}
                  </span>
                ) : null}
              </SheetDescription>
            </div>
            {priceLabel ? (
              <div className="shrink-0 rounded-full bg-primary px-2.5 py-1 text-xs font-black text-primary-foreground">
                {priceLabel}
              </div>
            ) : null}
          </div>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          {loading && !product ? (
            <div className="grid gap-3">
              <Skeleton className="aspect-[16/9] w-full rounded-lg" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : null}

          {product ? (
            <div className="grid gap-3 pb-1">
              <section className="rounded-xl border border-emerald-100 bg-white p-2.5 shadow-sm shadow-emerald-950/5 dark:border-border dark:bg-background">
                <div className="flex gap-2.5">
                  <div
                    ref={mediaRef}
                    className="w-24 shrink-0 overflow-hidden rounded-lg border border-emerald-100 bg-emerald-50 dark:border-border dark:bg-muted"
                  >
                    <ProductMedia product={product} variant="sheetThumb" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap gap-1.5">
                      {product.type_group ? (
                        <Badge className="h-5 border-primary/20 bg-primary/10 px-1.5 py-0 text-[10px] font-black text-primary">
                          {product.type_group}
                        </Badge>
                      ) : null}
                      {mode === "promotion" && selectedDetail ? (
                        <Badge className="h-5 border-amber-300 bg-amber-50 px-1.5 py-0 text-[10px] font-black text-amber-700">
                          {getPromoLabel(selectedDetail, t)}
                        </Badge>
                      ) : null}
                    </div>
                    {product.prod_code ? (
                      <p className="mt-1 truncate text-[11px] font-bold text-muted-foreground">
                        {product.prod_code}
                      </p>
                    ) : null}
                    <p className="mt-1 text-lg font-black leading-6 text-primary">
                      {formatMoney(lineTotal, lang)}
                    </p>
                    <p className="text-[11px] font-bold text-muted-foreground">
                      {formatMoney(basePrice, lang)}
                      {toppingTotal > 0
                        ? ` + ${formatMoney(toppingTotal, lang)}`
                        : ""}
                    </p>
                  </div>
                </div>
              </section>

              {hasSelectableDetails ? (
                <section className="grid gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-black text-slate-700 dark:text-muted-foreground">
                      {mode === "promotion"
                        ? t("pos.promoDeal")
                        : t("pos.chooseSize")}
                    </p>
                    <span className="text-[11px] font-bold text-muted-foreground">
                      {details.length}
                    </span>
                  </div>
                  <div className="grid gap-2">
                    {details.map((detail) => {
                      const enabled = isDetailAvailable(detail);
                      return (
                        <button
                          key={detail.pro_detail_uuid}
                          type="button"
                          className={cn(
                            "flex min-h-12 items-center justify-between gap-3 rounded-xl border bg-white px-3 py-2 text-left text-sm shadow-sm shadow-emerald-950/5 transition dark:bg-background",
                            detailUuid === detail.pro_detail_uuid
                              ? "border-primary bg-emerald-50 text-primary ring-1 ring-primary/15 dark:bg-primary/10"
                              : "border-emerald-100 dark:border-border",
                            !enabled ? "opacity-50" : "",
                          )}
                          onClick={() => {
                            setDetailUuid(detail.pro_detail_uuid);
                            setQty(defaultOrderQty(detail));
                          }}
                          disabled={!enabled}
                        >
                          <span className="min-w-0">
                            <span className="flex min-w-0 items-center gap-1.5">
                              {detailUuid === detail.pro_detail_uuid ? (
                                <CheckCircle2 className="size-4 shrink-0" />
                              ) : null}
                              <span className="truncate font-black">
                                {detail.size_name || t("pos.size")}
                              </span>
                            </span>
                            {mode === "promotion" ? (
                              <span className="mt-0.5 flex flex-wrap gap-1">
                                <Badge className="h-5 border-amber-300 bg-amber-50 px-1.5 py-0 text-[10px] font-black text-amber-700">
                                  {getPromoLabel(detail, t)}
                                </Badge>
                                {detail.pro_detail_eDate ? (
                                  <span className="text-[11px] font-bold text-muted-foreground">
                                    {t("pos.validUntil")}{" "}
                                    {formatShortDate(
                                      detail.pro_detail_eDate,
                                      lang,
                                    )}
                                  </span>
                                ) : null}
                              </span>
                            ) : null}
                          </span>
                          <span className="shrink-0 text-right font-black">
                            {formatMoney(productPriceFromDetail(detail), lang)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ) : null}

              {mode === "set" && details.length ? (
                <section className="grid gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-black text-slate-700 dark:text-muted-foreground">
                      {t("pos.includedInSet")}
                    </p>
                    <span className="text-[11px] font-bold text-muted-foreground">
                      {details.length}
                    </span>
                  </div>
                  <div className="rounded-xl border border-emerald-100 bg-white p-2 shadow-sm shadow-emerald-950/5 dark:border-border dark:bg-background">
                    {details.map((detail, index) => {
                      const enabled = isDetailAvailable(detail);
                      return (
                        <div
                          key={detail.pro_detail_uuid}
                          className={cn(
                            "flex min-h-10 items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm",
                            index > 0
                              ? "border-t border-emerald-50 dark:border-border"
                              : "",
                            !enabled ? "opacity-50" : "",
                          )}
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-emerald-50 text-[11px] font-black text-primary dark:bg-primary/10">
                              {index + 1}
                            </span>
                            <span className="truncate font-black">
                              {detail.size_name || t("pos.product")}
                            </span>
                          </div>
                          <Badge className="h-5 border-emerald-100 bg-emerald-50 px-1.5 py-0 text-[10px] font-black text-primary">
                            x{defaultOrderQty(detail)}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ) : null}

              {toppings.length ? (
                <section className="grid gap-2">
                  <p className="text-xs font-black text-slate-700 dark:text-muted-foreground">
                    {t("pos.toppings")}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {toppings.map((topping) => {
                      const selected = selectedToppingUuids.includes(
                        topping.prod_topping_uuid,
                      );
                      const enabled = isToppingAvailable(topping);
                      return (
                        <button
                          key={topping.prod_topping_uuid}
                          type="button"
                          className={cn(
                            "min-h-11 rounded-xl border px-2.5 py-1.5 text-left text-sm shadow-sm shadow-emerald-950/5 transition",
                            selected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-emerald-100 bg-white dark:border-border dark:bg-background",
                            !enabled ? "opacity-50" : "",
                          )}
                          onClick={() =>
                            toggleTopping(topping.prod_topping_uuid)
                          }
                          disabled={!enabled}
                        >
                          <span className="line-clamp-1 font-black">
                            {toppingDisplayName(topping, lang)}
                          </span>
                          <span className="text-xs font-bold opacity-80">
                            {formatMoney(numeric(topping.topping_price), lang)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ) : null}

              <section className="grid gap-2">
                <p className="text-xs font-black text-slate-700 dark:text-muted-foreground">
                  {t("pos.note")}
                </p>
                <Textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder={t("pos.notePlaceholder")}
                  className="min-h-16 resize-none border-emerald-100 text-sm dark:border-border"
                />
              </section>
            </div>
          ) : null}
        </div>

        <SheetFooter className="shrink-0 border-t border-emerald-100 bg-white p-3 dark:border-border dark:bg-background">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-11 w-11 rounded-md"
                  onClick={() => handleQty(qty - qtyStep)}
                  disabled={qty <= minQty || saving}
                >
                  <Minus className="size-4" />
                </Button>
                <span className="grid h-10 min-w-10 place-items-center rounded-md border border-emerald-100 px-2 text-sm font-black dark:border-border">
                  {qty}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-11 w-11 rounded-md"
                  onClick={() => handleQty(qty + qtyStep)}
                  disabled={qty + qtyStep > maxQty || saving}
                >
                  <Plus className="size-4" />
                </Button>
              </div>
              {quantityMeta.hasPromotion ? (
                <p className="text-[11px] font-bold text-amber-700 dark:text-amber-200">
                  {t("pos.orderStep", { count: qtyStep })}
                </p>
              ) : null}
            </div>
            <div className="text-right">
              <p className="text-xs font-bold text-muted-foreground">
                {t("common.total")}
              </p>
              <p className="font-black text-primary">
                {formatMoney(lineTotal, lang)}
              </p>
            </div>
          </div>
          <Button
            type="button"
            className="h-11 rounded-md"
            disabled={!canSubmit}
            onClick={() => {
              if (!selectedDetail) return;
              onAdd(
                {
                  detail: selectedDetail,
                  qty,
                  toppings: selectedToppings,
                  note: note.trim(),
                },
                mediaRef.current?.getBoundingClientRect(),
              );
            }}
          >
            {saving ? <Loader2 className="animate-spin" /> : <Plus />}
            {t("actions.add")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
