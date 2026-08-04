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

const CARD_SURFACE_CLASS =
  "h-full gap-0 overflow-hidden rounded-[20px] border-yg-line bg-yg-panel py-0 shadow-[0_18px_40px_-26px_rgb(0_0_0/0.45)] backdrop-blur-md transition-[border-color,box-shadow,transform] dark:shadow-[0_18px_40px_-26px_rgb(0_0_0/0.8)] motion-reduce:transition-none";

const CARD_INTERACTIVE_CLASS =
  "hover:-translate-y-1 hover:border-yg-accent-line hover:shadow-[0_26px_54px_-26px_rgb(0_0_0/0.55)] active:translate-y-0 dark:hover:shadow-[0_26px_54px_-26px_rgb(0_0_0/0.9)] motion-reduce:transform-none";

export const ProductCard = memo(function ProductCard({
  product,
  cateUuid,
  statusKind,
  lang,
  loading,
  onProductClick,
  imagePreload = false,
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
  imagePreload?: boolean;
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
    Number(product.countOptionEnabled ?? 0) || 0,
  );
  const hasActualChoices =
    product.hasOptions === true ||
    optionCount > 1 ||
    Number(product.countToppingEnabled ?? 0) > 0;
  const choiceMeta = hasActualChoices
    ? optionCount > 1
      ? t("pos.optionCount", { count: optionCount })
      : product.optionsMsg || t("pos.hasOptions")
    : "";
  const promoLabel =
    product.promoMsg || (hasPromo(product) ? t("pos.promotion") : "");
  const actionLabel = getActionLabel({
    actionState,
    blockedLabel,
    detailed: false,
    t,
  });
  const detailedActionLabel = getActionLabel({
    actionState,
    blockedLabel,
    detailed: true,
    t,
  });
  const priceLabel = getAccessiblePriceLabel(price, lang, isBlocked, t);
  const accessibleLabel = [
    product.prodName,
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
          CARD_SURFACE_CLASS,
          isBlocked ? "" : CARD_INTERACTIVE_CLASS,
        )}
      >
        <Button
          type="button"
          variant="ghost"
          className="flex min-h-28 w-full items-stretch gap-3 rounded-none p-2.5 text-left hover:bg-yg-panel-hover focus-visible:ring-inset aria-disabled:cursor-not-allowed aria-disabled:hover:bg-transparent disabled:opacity-100"
          onClick={handleClick}
          disabled={loading}
          aria-busy={loading || undefined}
          aria-disabled={isBlocked || undefined}
          aria-label={accessibleLabel}
        >
          <div
            ref={mediaRef}
            className="relative size-24 shrink-0 overflow-hidden rounded-2xl border border-yg-line"
          >
            <ProductMedia
              product={product}
              variant="listThumb"
              blockedState={blockedState}
              blockedLabel={blockedLabel}
              preload={imagePreload}
            />
          </div>

          <CardContent className="flex min-w-0 flex-1 gap-3 p-0">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <p className="lao-tone-text line-clamp-2 font-yg-serif text-[15px] font-semibold leading-snug text-yg-ink">
                {product.prodName}
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

            {isBlocked ? null : (
              <div className="flex shrink-0 items-end justify-end">
                <ProductActionPill
                  actionState={actionState}
                  hasActualChoices={hasActualChoices}
                  label={actionLabel}
                  loading={loading}
                  compact
                />
              </div>
            )}
          </CardContent>
        </Button>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        CARD_SURFACE_CLASS,
        variant === "rail"
          ? "w-44 flex-none snap-start"
          : variant === "railGrid"
            ? "w-44 flex-none snap-start sm:w-auto"
            : "min-w-0",
        isBlocked ? "" : CARD_INTERACTIVE_CLASS,
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
            preload={imagePreload}
          />
          {!isBlocked && promoLabel ? (
            <ProductPromoBadge label={promoLabel} overlay />
          ) : null}
        </div>

        <CardContent className="flex min-h-36 flex-1 flex-col gap-2 p-3.5 max-[419px]:gap-1 max-[419px]:py-3">
          <p className="lao-tone-text line-clamp-2 min-h-10 font-yg-serif text-[15px] font-semibold leading-snug text-yg-ink">
            {product.prodName}
          </p>

          {/* การ์ดสองคอลัมน์บนมือถือเหลือพื้นที่ราคาไม่พอเมื่อปุ่ม 44px อยู่แถวเดียวกัน
              ให้ราคาเต็มแถว แล้วใช้ metadata กับปุ่มร่วมแถวล่างเพื่อคงความสูงเดิม */}
          <div className="mt-auto flex items-end justify-between gap-2 max-[419px]:grid max-[419px]:grid-cols-[minmax(0,1fr)_auto] max-[419px]:gap-x-2 max-[419px]:gap-y-1">
            <div className="min-w-0 flex-1 max-[419px]:contents">
              <ProductPriceLabel
                price={price}
                lang={lang}
                blocked={isBlocked}
              />
              {choiceMeta ? <ProductChoiceMeta label={choiceMeta} /> : null}
            </div>

            {isBlocked ? null : (
              <div className="shrink-0 max-[419px]:col-start-2 max-[419px]:row-start-2">
                <ProductActionPill
                  actionState={actionState}
                  hasActualChoices={hasActualChoices}
                  label={actionLabel}
                  loading={loading}
                />
              </div>
            )}
          </div>
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
          className={cn(
            "block min-h-7",
            compact ? "min-h-5" : "max-[419px]:col-span-2",
          )}
          aria-hidden="true"
        />
      );
    }

    return (
      <p
        className={cn(
          "min-h-7 text-xs font-semibold leading-4 text-yg-muted",
          compact ? "min-h-5" : "max-[419px]:col-span-2",
        )}
      >
        {t("pos.chooseToSeePrice")}
      </p>
    );
  }

  return (
    <p
      className={cn(
        "flex min-h-7 min-w-0 items-baseline gap-1",
        compact
          ? "min-h-5"
          : "max-[419px]:col-span-2 max-[419px]:flex-col max-[419px]:items-start max-[419px]:gap-0.5",
      )}
    >
      {price.kind === "starting" ? (
        <span className="shrink-0 text-[10px] font-bold text-yg-faint">
          {t("pos.startingAt")}
        </span>
      ) : null}
      <span
        className={cn(
          "max-w-full font-yg-number text-[22px] font-semibold leading-none tabular-nums",
          compact
            ? "truncate"
            : "whitespace-nowrap max-[419px]:text-[clamp(18px,5.2vw,22px)]",
          blocked ? "text-yg-muted" : "text-yg-accent-strong",
        )}
      >
        {formatMoney(price.value, lang)}
      </span>
    </p>
  );
}

function ProductChoiceMeta({ label }: { label: string }) {
  return (
    <span className="mt-0.5 flex min-w-0 items-center gap-1 text-[11px] font-semibold text-yg-faint">
      <SlidersHorizontal className="size-3 shrink-0" aria-hidden="true" />
      <span className="lao-tone-text truncate">{label}</span>
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
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 border border-yg-accent-line bg-yg-accent-soft font-extrabold tracking-wide text-yg-accent-strong",
        overlay
          ? "absolute left-2.5 top-2.5 h-6 max-w-[calc(100%-1.25rem)] rounded-lg px-2 text-[10px] backdrop-blur-md"
          : "h-5 rounded-md px-1.5 text-[10px]",
        compact ? "text-[9px]" : "",
      )}
    >
      <Sparkles className="size-2.5 shrink-0" aria-hidden="true" />
      <span className="lao-tone-text truncate">{label}</span>
    </span>
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
  const isAdd = actionState === "add";
  const isChoose = actionState === "choose" && hasActualChoices;
  const blocked = actionState === "blocked";
  const Icon = blocked
    ? AlertCircle
    : isAdd
      ? Plus
      : isChoose
        ? SlidersHorizontal
        : ChevronRight;
  // ปุ่ม "เพิ่ม" เป็นไอคอนล้วนทรงจัตุรัสตามดีไซน์ ที่เหลือมีข้อความกำกับ
  const iconOnly = isAdd && !loading;

  return (
    <span
      className={cn(
        "flex h-11 min-w-0 shrink-0 items-center justify-center gap-1.5 rounded-2xl border text-xs font-extrabold leading-none transition-[filter,transform] motion-reduce:transition-none",
        iconOnly ? "w-11 px-0" : "px-3.5",
        compact ? "max-w-32" : "",
        blocked
          ? "border-yg-line bg-yg-panel2 text-yg-muted"
          : isChoose
            ? "border-yg-accent-line bg-yg-accent-soft text-yg-accent-strong"
            : "border-yg-accent bg-yg-accent text-yg-on-accent shadow-[0_8px_20px_-10px_var(--yg-accent)]",
      )}
    >
      {loading ? (
        <Spinner />
      ) : (
        <Icon className="size-4 shrink-0" aria-hidden="true" />
      )}
      {iconOnly ? null : (
        <span className="lao-tone-text truncate">{label}</span>
      )}
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
  detailed,
  t,
}: {
  actionState: ProductActionState;
  blockedLabel: string;
  detailed: boolean;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  if (actionState === "blocked") return blockedLabel;
  if (actionState === "choose") {
    return t(detailed ? "pos.chooseOptionsAction" : "pos.chooseOptions");
  }
  if (actionState === "view") {
    return t(detailed ? "pos.viewDetailsAction" : "pos.viewDetails");
  }
  return t("pos.addItem");
}
