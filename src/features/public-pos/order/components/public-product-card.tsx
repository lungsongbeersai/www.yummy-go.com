"use client";

import { memo, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  ChevronRight,
  Plus,
  SlidersHorizontal,
  Sparkles,
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
  formatMoney,
  getProductActionState,
  getProductBlockedState,
  hasPromo,
  productBlockedLabel,
  publicProductCardPrice,
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
  variant?: "grid" | "rail" | "railGrid" | "list";
}) {
  const { t } = useTranslation();
  const mediaRef = useRef<HTMLDivElement | null>(null);
  const price = publicProductCardPrice(product);
  const statusSortFk = publicMenuKindToStatusSortFk(statusKind);
  const blockedState = getProductBlockedState(product, statusSortFk);
  const actionState = getProductActionState(product, statusSortFk);
  const isBlocked = actionState === "blocked";
  const blockedLabel = productBlockedLabel(blockedState, product, t);
  const optionCount = Math.max(
    0,
    Number(product.count_option_enabled ?? 0) || 0,
  );
  const hasActualChoices =
    product.has_options === true ||
    optionCount > 1 ||
    Number(product.count_topping_enabled ?? 0) > 0;
  const choiceMeta = hasActualChoices
    ? optionCount > 1
      ? t("pos.optionCount", { count: optionCount })
      : product.options_msg || t("pos.hasOptions")
    : "";
  const promoLabel =
    product.promo_msg || (hasPromo(product) ? t("pos.promotion") : "");
  const actionLabel = getActionLabel({
    actionState,
    blockedLabel,
    hasActualChoices,
    detailed: false,
    t,
  });
  const detailedActionLabel = getActionLabel({
    actionState,
    blockedLabel,
    hasActualChoices,
    detailed: true,
    t,
  });
  const priceLabel = getAccessiblePriceLabel(price, lang, isBlocked, t);
  const accessibleLabel = [
    product.prod_name,
    priceLabel,
    promoLabel,
    choiceMeta,
    detailedActionLabel,
  ]
    .filter(Boolean)
    .join(", ");
  const handleClick = useCallback(() => {
    if (isBlocked || loading) return;
    onProductClick(
      product,
      cateUuid,
      statusKind,
      mediaRef.current?.getBoundingClientRect(),
    );
  }, [cateUuid, isBlocked, loading, onProductClick, product, statusKind]);

  if (variant === "list") {
    return (
      <Card
        className={cn(
          "h-full overflow-hidden rounded-xl border-emerald-100 bg-white shadow-sm shadow-emerald-950/5 transition-[border-color,box-shadow,transform] motion-reduce:transition-none dark:border-border dark:bg-background",
          isBlocked
            ? "bg-muted/25 dark:bg-muted/20"
            : "active:scale-[0.99] hover:border-primary/35 hover:shadow-md motion-reduce:transform-none",
        )}
      >
        <Button
          type="button"
          variant="ghost"
          className="flex min-h-28 w-full items-stretch gap-2.5 rounded-none p-2 text-left hover:bg-primary/5 focus-visible:ring-inset aria-disabled:cursor-not-allowed aria-disabled:hover:bg-transparent disabled:opacity-100"
          onClick={handleClick}
          disabled={loading}
          aria-busy={loading || undefined}
          aria-disabled={isBlocked || undefined}
          aria-label={accessibleLabel}
        >
          <div
            ref={mediaRef}
            className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-emerald-100 bg-emerald-50 dark:border-border dark:bg-muted"
          >
            <ProductMedia
              product={product}
              variant="listThumb"
              blockedState={blockedState}
              blockedLabel={blockedLabel}
              priority={imagePriority}
            />
          </div>

          <CardContent className="flex min-w-0 flex-1 gap-2.5 p-0.5">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <p
                className={cn(
                  "lao-tone-text line-clamp-2 text-sm font-black leading-5 text-foreground",
                  isBlocked ? "text-foreground/75 dark:text-foreground/80" : "",
                )}
              >
                {product.prod_name}
              </p>

              <ProductPriceLabel
                price={price}
                lang={lang}
                blocked={isBlocked}
                compact
              />

              <div className="flex min-h-5 min-w-0 flex-wrap items-center gap-1.5">
                {!isBlocked && promoLabel ? (
                  <ProductPromoBadge label={promoLabel} compact />
                ) : null}
                {choiceMeta ? <ProductChoiceMeta label={choiceMeta} /> : null}
              </div>
            </div>

            <div className="flex w-32 shrink-0 items-end justify-end">
              <ProductActionPill
                actionState={actionState}
                hasActualChoices={hasActualChoices}
                label={actionLabel}
                loading={loading}
                compact
              />
            </div>
          </CardContent>
        </Button>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        "h-full overflow-hidden rounded-xl border-emerald-100 bg-white shadow-sm shadow-emerald-950/5 transition-[border-color,box-shadow,transform] motion-reduce:transition-none dark:border-border dark:bg-background",
        variant === "rail"
          ? "w-44 flex-none snap-start"
          : variant === "railGrid"
            ? "w-44 flex-none snap-start sm:w-auto"
            : "min-w-0",
        isBlocked
          ? "bg-muted/25 dark:bg-muted/20"
          : "active:scale-[0.99] hover:border-primary/35 hover:shadow-md motion-reduce:transform-none",
      )}
    >
      <Button
        type="button"
        variant="ghost"
        className="flex h-full w-full flex-col items-stretch justify-start rounded-none p-0 text-left hover:bg-transparent focus-visible:ring-inset aria-disabled:cursor-not-allowed disabled:opacity-100"
        onClick={handleClick}
        disabled={loading}
        aria-busy={loading || undefined}
        aria-disabled={isBlocked || undefined}
        aria-label={accessibleLabel}
      >
        <div ref={mediaRef} className="relative w-full">
          <ProductMedia
            product={product}
            blockedState={blockedState}
            blockedLabel={blockedLabel}
            priority={imagePriority}
          />
          {!isBlocked && promoLabel ? (
            <ProductPromoBadge label={promoLabel} overlay />
          ) : null}
        </div>

        <CardContent className="flex min-h-36 flex-1 flex-col gap-1.5 p-2.5">
          <p
            className={cn(
              "lao-tone-text line-clamp-2 min-h-10 text-sm font-black leading-5 text-foreground",
              isBlocked ? "text-foreground/75 dark:text-foreground/80" : "",
            )}
          >
            {product.prod_name}
          </p>

          <ProductPriceLabel
            price={price}
            lang={lang}
            blocked={isBlocked}
          />

          <div className="flex min-h-5 min-w-0 items-center">
            {choiceMeta ? <ProductChoiceMeta label={choiceMeta} /> : null}
          </div>

          <ProductActionPill
            actionState={actionState}
            hasActualChoices={hasActualChoices}
            label={actionLabel}
            loading={loading}
          />
        </CardContent>
      </Button>
    </Card>
  );
});

function ProductPriceLabel({
  price,
  lang,
  blocked,
  compact = false,
}: {
  price: ReturnType<typeof publicProductCardPrice>;
  lang: string;
  blocked: boolean;
  compact?: boolean;
}) {
  const { t } = useTranslation();

  if (price.kind === "variable") {
    if (blocked) {
      return (
        <span
          className={cn("min-h-7", compact ? "min-h-5" : "")}
          aria-hidden="true"
        />
      );
    }

    return (
      <p
        className={cn(
          "min-h-7 text-xs font-semibold leading-4 text-muted-foreground",
          compact ? "min-h-5" : "",
        )}
      >
        {t("pos.chooseToSeePrice")}
      </p>
    );
  }

  return (
    <p
      className={cn(
        "min-h-7 min-w-0 leading-5 tabular-nums",
        compact ? "min-h-5" : "",
      )}
    >
      {price.kind === "starting" ? (
        <span className="mr-1 text-[11px] font-bold text-muted-foreground">
          {t("pos.startingAt")}
        </span>
      ) : null}
      <span
        className={cn(
          "text-[15px] font-black text-primary",
          blocked ? "text-foreground/65 dark:text-foreground/70" : "",
        )}
      >
        {formatMoney(price.value, lang)}
      </span>
    </p>
  );
}

function ProductChoiceMeta({ label }: { label: string }) {
  return (
    <span className="flex min-w-0 items-center gap-1 text-xs font-semibold text-muted-foreground">
      <SlidersHorizontal className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate">{label}</span>
    </span>
  );
}

function ProductPromoBadge({
  label,
  overlay = false,
  compact = false,
}: {
  label: string;
  overlay?: boolean;
  compact?: boolean;
}) {
  return (
    <Badge
      className={cn(
        "max-w-full gap-1 border-amber-300 bg-amber-50 text-[11px] font-black text-amber-800 dark:border-amber-500/50 dark:bg-amber-950/85 dark:text-amber-100",
        overlay
          ? "absolute left-2 top-2 h-6 max-w-[calc(100%-1rem)] rounded-full px-2 py-0 shadow-sm backdrop-blur-sm"
          : "h-5 rounded-md px-1.5 py-0",
        compact ? "text-[10px]" : "",
      )}
    >
      <Sparkles className="size-3 shrink-0" aria-hidden="true" />
      <span className="truncate">{label}</span>
    </Badge>
  );
}

function ProductActionPill({
  actionState,
  hasActualChoices,
  label,
  loading,
  compact = false,
}: {
  actionState: ProductActionState;
  hasActualChoices: boolean;
  label: string;
  loading: boolean;
  compact?: boolean;
}) {
  const primaryAction =
    actionState === "add" ||
    (actionState === "choose" && hasActualChoices);
  const blocked = actionState === "blocked";
  const Icon = blocked
    ? AlertCircle
    : actionState === "add"
      ? Plus
      : actionState === "choose" && hasActualChoices
        ? SlidersHorizontal
        : ChevronRight;

  return (
    <span
      className={cn(
        "mt-auto flex min-w-0 items-center justify-center gap-1.5 rounded-lg px-3 font-black leading-none",
        compact ? "h-9 max-w-32 text-[11px]" : "h-10 w-full text-xs",
        blocked
          ? "border border-slate-200 bg-slate-100 text-muted-foreground dark:border-border dark:bg-muted"
          : primaryAction
            ? "bg-primary text-primary-foreground shadow-sm shadow-emerald-950/10"
            : "border border-primary/20 bg-primary/5 text-primary dark:bg-primary/10",
      )}
    >
      {loading ? (
        <Spinner />
      ) : (
        <Icon className="size-4 shrink-0" aria-hidden="true" />
      )}
      <span className="truncate">{label}</span>
    </span>
  );
}

function getAccessiblePriceLabel(
  price: ReturnType<typeof publicProductCardPrice>,
  lang: string,
  blocked: boolean,
  t: ReturnType<typeof useTranslation>["t"],
) {
  if (price.kind === "variable") {
    return blocked ? "" : t("pos.chooseToSeePrice");
  }
  const amount = formatMoney(price.value, lang);
  return price.kind === "starting"
    ? `${t("pos.startingAt")} ${amount}`
    : amount;
}

function getActionLabel({
  actionState,
  blockedLabel,
  hasActualChoices,
  detailed,
  t,
}: {
  actionState: ProductActionState;
  blockedLabel: string;
  hasActualChoices: boolean;
  detailed: boolean;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  if (actionState === "blocked") return blockedLabel;
  if (actionState === "choose" && hasActualChoices) {
    return t(detailed ? "pos.chooseOptionsAction" : "pos.chooseOptions");
  }
  if (actionState === "view" || actionState === "choose") {
    return t(detailed ? "pos.viewDetailsAction" : "pos.viewDetails");
  }
  return t("pos.addItem");
}
