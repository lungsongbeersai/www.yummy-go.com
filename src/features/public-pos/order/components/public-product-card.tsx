"use client";

import { memo, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  ChevronRight,
  Plus,
  SlidersHorizontal,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import type { CateProductItem } from "@/services/pos";
import {
  publicMenuKindToStatusSortFk,
  type PublicMenuKind,
} from "@/stores/public-pos-store";
import type { ProductActionState } from "../types";
import {
  formatProductPrice,
  getProductActionState,
  getProductBlockedState,
  hasPromo,
  productBlockedLabel,
  statusSectionLabel,
} from "../utils";
import { ProductMedia } from "./public-product-media";

export const ProductCard = memo(function ProductCard({
  product,
  cateUuid,
  statusKind,
  lang,
  loading,
  onProductClick,
  imagePriority = false,
  variant = "grid",
}: {
  product: CateProductItem;
  cateUuid: string;
  statusKind: PublicMenuKind;
  lang: string;
  loading: boolean;
  onProductClick: (
    product: CateProductItem,
    cateUuid: string,
    statusKind: PublicMenuKind,
    sourceRect?: DOMRect | null,
  ) => void;
  imagePriority?: boolean;
  variant?: "grid" | "rail" | "list";
}) {
  const { t } = useTranslation();
  const mediaRef = useRef<HTMLDivElement | null>(null);
  const price = formatProductPrice(product, lang);
  const statusSortFk = publicMenuKindToStatusSortFk(statusKind);
  const sectionLabel = statusSectionLabel(statusKind, lang);
  const blockedState = getProductBlockedState(product, statusSortFk);
  const actionState = getProductActionState(product, statusSortFk);
  const isBlocked = actionState === "blocked";
  const blockedLabel = productBlockedLabel(blockedState, product, t);
  const chooseBadgeLabel =
    actionState === "choose" ? product.options_msg || t("pos.hasOptions") : "";
  const promoLabel =
    product.promo_msg || (hasPromo(product) ? t("pos.promotion") : "");
  const handleClick = useCallback(
    () =>
      onProductClick(
        product,
        cateUuid,
        statusKind,
        mediaRef.current?.getBoundingClientRect(),
      ),
    [cateUuid, onProductClick, product, statusKind],
  );

  if (variant === "list") {
    return (
      <Card
        className={cn(
          "overflow-hidden rounded-lg border-emerald-100 bg-white shadow-sm shadow-emerald-950/5 transition dark:border-border dark:bg-background",
          isBlocked
            ? "bg-muted/20"
            : "active:scale-[0.99] hover:border-primary/35 hover:shadow-md",
        )}
      >
        <Button
          type="button"
          variant="ghost"
          className="flex min-h-24 w-full items-stretch gap-2 rounded-none p-2 text-left hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-100 min-[380px]:min-h-[6.25rem] min-[380px]:gap-2.5"
          onClick={handleClick}
          disabled={isBlocked || loading}
          aria-label={
            blockedLabel
              ? `${product.prod_name} - ${blockedLabel}`
              : product.prod_name
          }
        >
          <div
            ref={mediaRef}
            className="h-20 w-20 shrink-0 overflow-hidden rounded-md border border-emerald-100 bg-emerald-50 dark:border-border dark:bg-muted min-[380px]:h-[5.25rem] min-[380px]:w-[5.25rem]"
          >
            <ProductMedia
              product={product}
              variant="listThumb"
              blockedState={blockedState}
              blockedLabel={blockedLabel}
              priority={imagePriority}
            />
          </div>
          <CardContent className="flex min-w-0 flex-1 gap-2 p-0.5">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="min-w-0">
                <p
                  className={cn(
                    "line-clamp-2 text-sm font-black leading-5 text-foreground",
                    isBlocked ? "text-muted-foreground" : "",
                  )}
                >
                  {product.prod_name}
                </p>
                <p className="mt-0.5 truncate text-[11px] font-medium text-muted-foreground">
                  {sectionLabel}
                </p>
              </div>

              <div className="flex min-h-5 flex-wrap items-center gap-1">
                {blockedLabel ? (
                  <Badge className="h-5 border-destructive/30 bg-destructive/10 px-1.5 py-0 text-[10px] font-black text-destructive dark:bg-destructive/20">
                    {blockedLabel}
                  </Badge>
                ) : null}
                {!isBlocked && chooseBadgeLabel ? (
                  <Badge className="h-5 border-primary/25 bg-primary/10 px-1.5 py-0 text-[10px] font-black text-primary">
                    {chooseBadgeLabel}
                  </Badge>
                ) : null}
                {!isBlocked && actionState !== "choose" && promoLabel ? (
                  <Badge className="h-5 border-amber-300 bg-amber-50 px-1.5 py-0 text-[10px] font-black text-amber-700 dark:border-amber-500/50 dark:bg-amber-950/40 dark:text-amber-200">
                    {promoLabel}
                  </Badge>
                ) : null}
              </div>
            </div>

            <div className="flex shrink-0 flex-col items-end justify-between gap-2">
              {price ? (
                <p
                  className={cn(
                    "max-w-24 truncate text-right text-sm font-black leading-5 text-primary tabular-nums",
                    isBlocked ? "text-muted-foreground" : "",
                  )}
                >
                  {price}
                </p>
              ) : (
                <span className="h-5" aria-hidden="true" />
              )}
              <ProductActionPill actionState={actionState} loading={loading} />
            </div>
          </CardContent>
        </Button>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        "overflow-hidden border-emerald-100 bg-white shadow-sm shadow-emerald-950/5 transition dark:border-border dark:bg-background",
        variant === "rail" ? "w-35.5 flex-none sm:w-40" : "",
        isBlocked
          ? "opacity-85"
          : "active:scale-[0.99] hover:border-primary/35 hover:shadow-md",
      )}
    >
      <Button
        type="button"
        variant="ghost"
        className="flex h-full w-full flex-col items-stretch justify-start rounded-none p-0 text-left hover:bg-transparent disabled:cursor-not-allowed"
        onClick={handleClick}
        disabled={isBlocked || loading}
        aria-label={
          blockedLabel
            ? `${product.prod_name} - ${blockedLabel}`
          : product.prod_name
        }
      >
        <div ref={mediaRef}>
          <ProductMedia
            product={product}
            blockedState={blockedState}
            blockedLabel={blockedLabel}
            priority={imagePriority}
          />
        </div>
        <CardContent
          className={cn(
            "flex flex-1 flex-col gap-1.5 p-2",
            variant === "rail" ? "min-h-21.5" : "min-h-23",
          )}
        >
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 min-h-8 text-[13px] font-black leading-4">
              {product.prod_name}
            </p>
            {price ? (
              <p className="mt-0.5 text-[13px] font-black leading-4 text-primary">
                {price}
              </p>
            ) : null}
          </div>
          <div className="flex min-h-5 flex-wrap items-center gap-1">
            {!isBlocked && chooseBadgeLabel ? (
              <Badge className="h-5 border-primary/25 bg-primary/10 px-1.5 py-0 text-[10px] text-primary">
                {chooseBadgeLabel}
              </Badge>
            ) : null}
            {!isBlocked && actionState !== "choose" && promoLabel ? (
              <Badge className="h-5 border-amber-300 bg-amber-50 px-1.5 py-0 text-[10px] text-amber-700">
                {promoLabel}
              </Badge>
            ) : null}
          </div>
          <div className="flex items-center justify-between gap-1.5">
            <p className="truncate text-[10px] font-medium text-muted-foreground">
              {sectionLabel}
            </p>
            <ProductActionPill actionState={actionState} loading={loading} />
          </div>
        </CardContent>
      </Button>
    </Card>
  );
});

function ProductActionPill({
  actionState,
  loading,
}: {
  actionState: ProductActionState;
  loading: boolean;
}) {
  const { t } = useTranslation();

  if (actionState === "blocked") {
    return (
      <span className="flex h-7 shrink-0 items-center justify-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2 text-[10px] font-black leading-none text-muted-foreground dark:border-border dark:bg-muted">
        <AlertCircle className="size-3.5" />
      </span>
    );
  }

  if (actionState === "choose") {
    return (
      <span className="flex h-7 shrink-0 items-center justify-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2 text-[10px] font-black leading-none text-primary">
        {loading ? (
          <Spinner />
        ) : (
          <SlidersHorizontal className="size-3.5" />
        )}
        <span>{t("pos.chooseOptions")}</span>
      </span>
    );
  }

  if (actionState === "view") {
    return (
      <span className="flex h-7 shrink-0 items-center justify-center gap-1 rounded-full border border-slate-200 bg-white px-2 text-[10px] font-black leading-none text-slate-600 dark:border-border dark:bg-background dark:text-muted-foreground">
        {loading ? (
          <Spinner />
        ) : (
          <ChevronRight className="size-3.5" />
        )}
        <span>{t("pos.viewDetails")}</span>
      </span>
    );
  }

  return (
    <span className="flex h-7 shrink-0 items-center justify-center gap-1 rounded-full bg-primary px-2 text-[10px] font-black leading-none text-primary-foreground">
      {loading ? (
        <Spinner />
      ) : (
        <Plus className="size-3.5" />
      )}
      <span>{t("pos.addItem")}</span>
    </span>
  );
}
