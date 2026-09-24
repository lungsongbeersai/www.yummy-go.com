"use client";

import Image from "next/image";
import { memo, useState } from "react";
import { useResetOnChange } from "@/hooks/use-reset-on-change";
import {
  Ban,
  ChefHat,
  Eye,
  ImageIcon,
  Plus,
  SlidersHorizontal,
  Utensils,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { IMAGE_CROP_ASPECT_CLASS } from "@/config/image-crop";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CateProductItem } from "@/services/pos";
import { optionalNumber, optionalString } from "@/lib/values";
import {
  getProductActionState,
  getProductBlockedState,
  hasPromo,
  shouldUnoptimizeProductImage,
  productActionLabel,
  productBlockedLabel,
  productCardPrice,
  productMedia,
  productOptionCount,
  productToppingCount,
  ProductSortStatus,
  PRODUCT_GRID_CLASS,
  type ProductCardEntry,
  type ProductMedia,
} from "./order-customer-utils";

export const EmployeeProductCard = memo(function EmployeeProductCard({
  activeSort,
  disabled,
  entry,
  imagePreload = false,
  loading,
  onAction,
  onPrefetch,
}: {
  activeSort: ProductSortStatus;
  entry: ProductCardEntry;
  disabled: boolean;
  imagePreload?: boolean;
  loading: boolean;
  onAction: (entry: ProductCardEntry) => void;
  onPrefetch: (entry: ProductCardEntry) => void;
}) {
  const { t } = useTranslation();
  const { product } = entry;
  const media = productMedia(product);
  const price = productCardPrice(product, activeSort);
  const blockedState = getProductBlockedState(product, activeSort);
  const actionState = getProductActionState(product, activeSort);
  const actionLabel = productActionLabel(actionState, product, activeSort, t);
  const cardActionLabel =
    actionState === "choose"
      ? t("pos.chooseOptionsAction")
      : actionState === "view"
      ? t("pos.viewDetailsAction")
      : actionLabel;
  const description = productCardDescription(product, activeSort, t);
  const unavailable = Boolean(blockedState);
  const interactionDisabled = unavailable || disabled || loading;
  const ActionIcon =
    actionState === "blocked"
      ? Ban
      : actionState === "choose"
      ? SlidersHorizontal
      : actionState === "view"
      ? Eye
      : Plus;
  const accessibleActionLabel = loading
    ? `${t("common.loading")}: ${product.prodName}`
    : `${cardActionLabel}: ${product.prodName}`;

  return (
    <Card
      className={cn(
        "group relative flex min-w-0 flex-col gap-0 overflow-hidden rounded-lg border-border/80 bg-card py-0 text-card-foreground shadow-sm [contain-intrinsic-size:320px] [content-visibility:auto]",
        !interactionDisabled &&
          "cursor-pointer transition-[transform,border-color,box-shadow] duration-200 motion-safe:hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-md motion-reduce:transition-none",
        interactionDisabled && "cursor-not-allowed",
      )}
    >
      <div className={cn("relative overflow-hidden bg-muted", IMAGE_CROP_ASPECT_CLASS)}>
        <ProductMediaView
          alt={product.prodName}
          fallbackIcon="utensils"
          imageClassName={cn(
            !interactionDisabled &&
              "transition-transform duration-300 motion-safe:group-hover:scale-105 motion-reduce:transition-none",
            blockedState && "grayscale",
          )}
          media={media}
          preload={imagePreload}
          sizes="(max-width: 767px) 50vw, (max-width: 1279px) 33vw, (max-width: 1535px) 25vw, 300px"
        />
        <ProductBadges activeSort={activeSort} product={product} />
        {blockedState ? (
          <div className="absolute inset-0 grid place-items-center bg-background/75 backdrop-blur-[1px]">
            <Badge className="gap-1 border-destructive/30 bg-destructive text-destructive-foreground shadow-sm">
              <Ban aria-hidden="true" className="size-3" />
              {productBlockedLabel(blockedState, product, t)}
            </Badge>
          </div>
        ) : null}
      </div>

      {/* ชื่อ/รายละเอียด/ราคาจับกลุ่มกันด้านบน ปุ่มอย่างเดียวที่ดันลงล่างสุด (mt-auto) ให้ปุ่มในแถว
          เดียวกันตรงกัน — เดิมเว้นที่ 2 บรรทัดให้ชื่อเสมอ (min-h-10) + gap-2.5 ทุกชั้น + ราคาเป็นตัว mt-auto
          เลยมีช่องว่างโหว่ใต้ชื่อ และการ์ดสูงเกินจำเป็น */}
      <CardContent className="flex min-h-0 flex-1 flex-col gap-2 p-2.5">
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="lao-tone-text line-clamp-2 text-pretty text-sm font-bold leading-5 text-foreground sm:text-base sm:leading-6">
            {product.prodName}
          </p>
          {description ? (
            <p className="line-clamp-1 text-xs font-medium leading-4 text-muted-foreground">
              {description}
            </p>
          ) : null}
          <ProductCardPriceLabel blocked={unavailable} price={price} />
        </div>

        <div
          aria-hidden="true"
          className={cn(
            "mt-auto flex h-10 w-full items-center justify-center gap-2 rounded-lg border px-2 text-xs font-bold sm:px-3 sm:text-sm",
            (actionState === "add" ||
              actionState === "choose" ||
              actionState === "view") &&
              "border-primary bg-primary text-primary-foreground shadow-sm",
            actionState === "blocked" &&
              "border-destructive/20 bg-destructive/10 text-destructive",
          )}
        >
          {loading ? (
            <Spinner aria-hidden="true" aria-label={undefined} />
          ) : (
            <ActionIcon aria-hidden="true" />
          )}
          <span className="min-w-0 truncate">{cardActionLabel}</span>
        </div>
      </CardContent>

      {loading ? (
        <span role="status" className="sr-only">
          {accessibleActionLabel}
        </span>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        aria-busy={loading}
        aria-label={accessibleActionLabel}
        className="absolute inset-0 z-20 h-auto w-auto touch-manipulation rounded-lg bg-transparent p-0 shadow-none transition-transform duration-100 hover:bg-primary/5 active:scale-[0.98] active:bg-primary/15 motion-reduce:transition-none focus-visible:bg-primary/5 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:pointer-events-auto disabled:cursor-not-allowed disabled:opacity-100"
        disabled={interactionDisabled}
        onClick={() => onAction(entry)}
        onFocus={() => onPrefetch(entry)}
        onPointerDown={() => onPrefetch(entry)}
        onPointerEnter={() => onPrefetch(entry)}
      />
    </Card>
  );
});

function ProductCardPriceLabel({
  blocked,
  price,
}: {
  blocked: boolean;
  price: ReturnType<typeof productCardPrice>;
}) {
  const { t } = useTranslation();

  if (price.kind === "variable" && !blocked) {
    return (
      <p className="truncate text-xs font-medium leading-6 text-muted-foreground">
        {t("pos.chooseToSeePrice")}
      </p>
    );
  }
  if (price.kind === "unavailable" || price.kind === "variable") {
    return null;
  }

  return (
    <p
      className={cn(
        "flex min-w-0 items-baseline gap-1.5",
        blocked && "text-muted-foreground",
      )}
    >
      {price.kind === "starting" ? (
        <span className="shrink-0 text-2xs font-semibold leading-4 text-muted-foreground">
          {t("pos.startingAt")}
        </span>
      ) : null}
      <span
        className={cn(
          "min-w-0 truncate text-base font-black leading-6 text-primary-text tabular-nums sm:text-lg",
          blocked && "text-muted-foreground",
        )}
      >
        {money(price.value)}
      </span>
    </p>
  );
}

export function ProductMediaView({
  alt,
  fallbackIcon = "image",
  imageClassName,
  media,
  preload = false,
  sizes,
}: {
  alt: string;
  fallbackIcon?: "chef" | "image" | "utensils";
  imageClassName?: string;
  media: ProductMedia;
  preload?: boolean;
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

  // เปลี่ยนรูป = ให้โอกาสโหลดใหม่ ไม่ค้าง fallback ของรูปเดิม
  useResetOnChange(mediaKey, () => setImageFailed(false));

  if (media.type === "image" && !imageFailed) {
    return (
      <Image
        fill
        unoptimized={shouldUnoptimizeProductImage(media.src)}
        alt={alt}
        className={cn("object-contain", imageClassName)}
        quality={60}
        preload={preload || undefined}
        // เมนูโหลดฝั่ง client หลัง mount — URL รูปไม่มีใน HTML ตอน SSR
        // <link rel=preload> จึงช่วยไม่ได้ ต้องสั่ง eager/high ที่แท็กรูปตรง ๆ
        loading={preload ? "eager" : "lazy"}
        fetchPriority={preload ? "high" : undefined}
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
        <FallbackIcon aria-hidden="true" className={fallbackIconClassName} />
      </div>
    );
  }

  return (
    <div className="grid size-full place-items-center bg-muted">
      <ImageIcon
        aria-hidden="true"
        className="size-10 text-muted-foreground/55"
      />
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
  const productStatusSort =
    optionalNumber(product.statusSortFk) ?? activeSort;
  const showSet = productStatusSort === ProductSortStatus.SET;
  const showPromotion =
    productStatusSort === ProductSortStatus.PROMOTION || hasPromo(product);
  const showBuyFree = Boolean(product.customerBuy && product.customerFree);

  if (!showSet && !showPromotion && !showBuyFree) return null;

  return (
    <div className="pointer-events-none absolute inset-x-1.5 top-1.5 flex items-start gap-1.5 sm:inset-x-2 sm:top-2 sm:gap-2">
      <div className="flex min-w-0 flex-wrap gap-1">
        {showPromotion ? (
          <Badge className="h-6 rounded-full bg-primary px-1.5 py-0 text-xs font-black leading-none text-primary-foreground shadow-sm sm:h-7 sm:px-2">
            {t("pos.menuPromotion")}
          </Badge>
        ) : null}
        {showSet ? (
          <Badge className="h-6 rounded-full border-primary/20 bg-background/95 px-1.5 py-0 text-xs font-black leading-none text-primary-text shadow-sm backdrop-blur sm:h-7 sm:px-2">
            {t("pos.menuSet")}
          </Badge>
        ) : null}
        {showBuyFree ? (
          <Badge className="h-6 rounded-full bg-warning px-1.5 py-0 text-xs font-black leading-none text-warning-foreground shadow-sm sm:h-7 sm:px-2">
            {t("pos.buyShort")} {product.customerBuy} {t("pos.freeShort")}{" "}
            {product.customerFree}
          </Badge>
        ) : null}
      </div>
    </div>
  );
}

function productCardDescription(
  product: CateProductItem,
  activeSort: ProductSortStatus,
  t: ReturnType<typeof useTranslation>["t"]
) {
  const promoMessage = optionalString(product.promoMsg);
  if (promoMessage) return promoMessage;

  const optionCount = productOptionCount(product);
  const optionMessage = optionalString(product.optionsMsg);
  const toppingCount = productToppingCount(product);
  const optionSummary =
    optionCount > 1
      ? t("pos.optionCount", { count: optionCount })
      : product.hasOptions
      ? optionMessage ?? t("pos.hasOptions")
      : null;
  const toppingSummary =
    toppingCount > 0 ? t("pos.toppingCount", { count: toppingCount }) : null;
  const choiceSummary = [optionSummary, toppingSummary]
    .filter(Boolean)
    .join(" · ");
  if (choiceSummary) return choiceSummary;

  // ป้ายประเภท "ทั่วไป" ไม่ช่วยแยกอะไร (เกือบทั้งเมนูเป็นแบบนี้) — โชว์เฉพาะ ชุด/โปรโมชั่น
  const productSort = optionalNumber(product.statusSortFk) ?? activeSort;
  if (productSort === ProductSortStatus.NORMAL) return "";
  const statusName = optionalString(product.statusName);
  if (statusName) return statusName;
  if (activeSort === ProductSortStatus.PROMOTION) return t("pos.menuPromotion");
  if (activeSort === ProductSortStatus.SET) return t("pos.menuSet");
  return "";
}

export function ProductGridSkeleton() {
  const { t } = useTranslation();

  return (
    <div
      role="status"
      aria-label={t("pos.loadingProducts")}
      className={PRODUCT_GRID_CLASS}
    >
      {Array.from({ length: 10 }).map((_, index) => (
        <Card
          key={index}
          aria-hidden="true"
          className="gap-0 overflow-hidden rounded-lg border-border bg-card py-0"
        >
          <Skeleton className={cn("w-full rounded-none bg-muted", IMAGE_CROP_ASPECT_CLASS)} />
          <CardContent className="flex flex-col gap-2 p-2.5">
            <div className="flex flex-col gap-1">
              <Skeleton className="h-5 w-5/6 bg-muted" />
              <Skeleton className="h-4 w-3/4 bg-muted" />
              <Skeleton className="h-6 w-1/2 bg-muted" />
            </div>
            <Skeleton className="h-10 w-full rounded-lg bg-muted" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
