"use client";

import Image from "next/image";
import { memo, useEffect, useState } from "react";
import {
  Ban,
  ChefHat,
  ImageIcon,
  Plus,
  SlidersHorizontal,
  Utensils,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ProductSortStatus, type CateProductItem } from "@/services/pos";
import { optionalNumber, optionalString } from "../table-selection/utils";
import {
  getProductActionState,
  getProductBlockedState,
  hasPromo,
  isRemoteUrl,
  productActionLabel,
  productBlockedLabel,
  productMedia,
  productPrice,
  PRODUCT_GRID_CLASS,
  type ProductCardEntry,
  type ProductMedia,
} from "./order-customer-utils";

export const EmployeeProductCard = memo(function EmployeeProductCard({
  activeSort,
  entry,
  loading,
  onAction,
}: {
  activeSort: ProductSortStatus;
  entry: ProductCardEntry;
  loading: boolean;
  onAction: () => void;
}) {
  const { t } = useTranslation();
  const { product } = entry;
  const media = productMedia(product);
  const price = productPrice(product);
  const blockedState = getProductBlockedState(product, activeSort);
  const actionState = getProductActionState(product, activeSort);
  const actionLabel = productActionLabel(actionState, product, activeSort, t);
  const description = productCardDescription(product, activeSort, t);
  const ActionIcon =
    actionState === "blocked"
      ? Ban
      : actionState === "choose" || actionState === "view"
        ? SlidersHorizontal
        : Plus;
  const priceLabel = actionState === "add" && price > 0 ? money(price) : null;
  const optionCount = Math.max(
    optionalNumber(product.count_option_enabled) ?? 0,
    optionalNumber(product.count_option_all) ?? 0,
  );
  const toppingCount = optionalNumber(product.count_topping_enabled) ?? 0;
  const choiceCount = Math.max(optionCount, toppingCount);
  const footerLabel =
    actionState === "choose" && choiceCount > 0
      ? `${t("pos.hasOptions")} (${choiceCount})`
      : actionLabel;

  return (
    <Card className="group flex min-h-65 min-w-0 flex-col overflow-hidden rounded-lg border-border/80 bg-card text-card-foreground shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-md sm:min-h-76">
      <div className="relative aspect-square overflow-hidden bg-muted bg-cover bg-center">
        <ProductMediaView
          alt={product.prod_name}
          fallbackIcon="utensils"
          imageClassName={cn(
            "transition duration-300 group-hover:scale-105",
            blockedState && "grayscale",
          )}
          media={media}
          sizes="(max-width: 768px) 50vw, 220px"
        />
        <ProductBadges activeSort={activeSort} product={product} />
        {blockedState ? (
          <div className="absolute inset-0 grid place-items-center bg-background/75 backdrop-blur-[1px]">
            <Badge className="gap-1 border-destructive/30 bg-destructive text-destructive-foreground shadow-sm">
              <Ban className="size-3" />
              {productBlockedLabel(blockedState, product, t)}
            </Badge>
          </div>
        ) : null}
      </div>

      <CardContent className="flex min-h-0 flex-1 flex-col gap-2 p-2.5 sm:gap-2.5 sm:p-3">
        <div className="min-w-0">
          <CardTitle className="line-clamp-2 min-h-10 text-sm font-black leading-5 text-foreground sm:text-base">
            {product.prod_name}
          </CardTitle>
          <p className="mt-1 line-clamp-1 min-h-4 text-xs font-bold leading-4 text-muted-foreground">
            {description ||
              (actionState === "add"
                ? t("pos.menuNormal")
                : t("pos.priceDetails"))}
          </p>
        </div>

        {priceLabel ? (
          <Button
            type="button"
            className="mt-auto h-10 w-full justify-between rounded-lg bg-primary px-2.5 text-sm font-black text-primary-foreground shadow-sm hover:bg-primary/90 sm:h-11 sm:px-3"
            disabled={loading}
            onClick={onAction}
          >
            <span className="min-w-0 truncate text-left text-sm tabular-nums sm:text-base">
              {priceLabel}
            </span>
            {loading ? (
              <Spinner data-icon="inline-end" />
            ) : (
              <Plus data-icon="inline-end" />
            )}
          </Button>
        ) : (
          <Button
            type="button"
            className={cn(
              "mt-auto h-9 w-full rounded-lg border-primary/45 bg-background px-2 text-xs font-black text-primary shadow-none hover:bg-primary/10 hover:text-primary sm:h-10 sm:px-3 sm:text-sm",
              actionState === "blocked" &&
                "border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive/10 hover:text-destructive",
            )}
            variant="outline"
            disabled={loading || actionState === "blocked"}
            onClick={onAction}
          >
            {loading ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <ActionIcon data-icon="inline-start" />
            )}
            <span className="truncate">{footerLabel}</span>
          </Button>
        )}
      </CardContent>
    </Card>
  );
});

export function ProductMediaView({
  alt,
  fallbackIcon = "image",
  imageClassName,
  media,
  sizes,
}: {
  alt: string;
  fallbackIcon?: "chef" | "image" | "utensils";
  imageClassName?: string;
  media: ProductMedia;
  sizes: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const FallbackIcon =
    fallbackIcon === "chef"
      ? ChefHat
      : fallbackIcon === "utensils"
        ? Utensils
        : ImageIcon;
  const fallbackIconClassName =
    fallbackIcon === "image"
      ? "size-10 text-muted-foreground/55"
      : "size-10 text-muted-foreground";
  const mediaKey = media.type === "image" ? media.src : media.type;

  useEffect(() => {
    setImageFailed(false);
  }, [mediaKey]);

  if (media.type === "image" && !imageFailed) {
    return (
      <Image
        fill
        unoptimized={isRemoteUrl(media.src)}
        alt={alt}
        className={cn("object-cover", imageClassName)}
        sizes={sizes}
        src={media.src}
        onError={() => setImageFailed(true)}
      />
    );
  }

  if (media.type === "color") {
    return (
      <div
        className="grid size-full place-items-center"
        style={{ backgroundColor: media.color }}
      >
        <FallbackIcon className={fallbackIconClassName} />
      </div>
    );
  }

  return (
    <div className="grid size-full place-items-center bg-muted">
      <ImageIcon className="size-10 text-muted-foreground/55" />
    </div>
  );
}

function ProductBadges({
  activeSort,
  product,
}: {
  activeSort: ProductSortStatus;
  product: CateProductItem;
}) {
  const { t } = useTranslation();
  const optionCount = Math.max(
    optionalNumber(product.count_option_enabled) ?? 0,
    optionalNumber(product.count_option_all) ?? 0,
  );
  const toppingCount = optionalNumber(product.count_topping_enabled) ?? 0;
  const productStatusSort =
    optionalNumber(product.status_sort_fk) ?? activeSort;
  const showSet = productStatusSort === ProductSortStatus.SET;
  const showPromotion =
    productStatusSort === ProductSortStatus.PROMOTION || hasPromo(product);
  const showOptions = product.has_options || optionCount > 1;
  const showToppings = toppingCount > 0;
  const showBuyFree = Boolean(product.customer_buy && product.customer_free);

  if (
    !showSet &&
    !showPromotion &&
    !showOptions &&
    !showToppings &&
    !showBuyFree
  )
    return null;

  return (
    <div className="pointer-events-none absolute inset-x-1.5 top-1.5 flex items-start justify-between gap-1.5 sm:inset-x-2 sm:top-2 sm:gap-2">
      <div className="flex min-w-0 flex-wrap gap-1">
        {showToppings ? (
          <Badge className="h-6 rounded-full bg-amber-300 px-1.5 py-0 text-xs font-black leading-none text-amber-950 shadow-sm sm:h-7 sm:px-2">
            +{toppingCount}
          </Badge>
        ) : null}
        {showPromotion ? (
          <Badge className="h-6 rounded-full bg-primary px-1.5 py-0 text-xs font-black leading-none text-primary-foreground shadow-sm sm:h-7 sm:px-2">
            {t("pos.menuPromotion")}
          </Badge>
        ) : null}
        {showSet ? (
          <Badge className="h-6 rounded-full border-primary/20 bg-background/95 px-1.5 py-0 text-xs font-black leading-none text-primary shadow-sm backdrop-blur sm:h-7 sm:px-2">
            {t("pos.menuSet")}
          </Badge>
        ) : null}
        {showBuyFree ? (
          <Badge className="h-6 rounded-full bg-amber-300 px-1.5 py-0 text-xs font-black leading-none text-amber-950 shadow-sm sm:h-7 sm:px-2">
            {t("pos.buyShort")} {product.customer_buy} {t("pos.freeShort")}{" "}
            {product.customer_free}
          </Badge>
        ) : null}
      </div>
      {showOptions ? (
        <Badge className="h-6 shrink-0 rounded-full border-primary/20 bg-background/95 px-1.5 py-0 text-xs font-black leading-none text-primary shadow-sm backdrop-blur sm:h-7 sm:px-2">
          <SlidersHorizontal className="size-3" />
          {t("pos.hasOptions")}
        </Badge>
      ) : null}
    </div>
  );
}

function productCardDescription(
  product: CateProductItem,
  activeSort: ProductSortStatus,
  t: ReturnType<typeof useTranslation>["t"],
) {
  const promoMessage = optionalString(product.promo_msg);
  if (promoMessage) return promoMessage;

  const optionMessage = optionalString(product.options_msg);
  const toppingCount = optionalNumber(product.count_topping_enabled) ?? 0;
  if (optionMessage && toppingCount > 0) {
    return `${optionMessage} · +${toppingCount} ${t("pos.toppings")}`;
  }
  if (optionMessage) return optionMessage;
  if (toppingCount > 0) return `+${toppingCount} ${t("pos.toppings")}`;

  const statusName = optionalString(product.status_name);
  if (statusName) return statusName;
  if (activeSort === ProductSortStatus.PROMOTION) return t("pos.menuPromotion");
  if (activeSort === ProductSortStatus.SET) return t("pos.menuSet");
  return "";
}

export function ProductGridSkeleton() {
  return (
    <div className={PRODUCT_GRID_CLASS}>
      {Array.from({ length: 10 }).map((_, index) => (
        <Card
          key={index}
          className="min-h-65 overflow-hidden rounded-lg border-border bg-card sm:min-h-76"
        >
          <Skeleton className="aspect-square w-full rounded-none bg-muted" />
          <CardContent className="flex flex-col gap-2 p-2.5 sm:gap-2.5 sm:p-3">
            <Skeleton className="h-5 w-5/6 bg-muted" />
            <Skeleton className="h-5 w-2/3 bg-muted" />
            <Skeleton className="h-4 w-3/4 bg-muted" />
            <Skeleton className="mt-auto h-10 w-full rounded-lg bg-muted sm:h-11" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
