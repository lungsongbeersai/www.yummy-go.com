"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import { memo, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ImageIcon,
  Loader2,
  Plus,
  SlidersHorizontal,
  Sparkles,
  Utensils,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  ProductImageStatus,
  type CateProductItem,
  type CateWithProducts,
  type ProdItem,
} from "@/services/pos";
import {
  PUBLIC_MENU_KIND,
  publicMenuKindToStatusSortFk,
  type PublicMenuKind,
} from "@/stores/public-pos-store";
import { PRODUCT_GRID_CLASS } from "@/features/public-pos/order/constants";
import type {
  ProductActionState,
  ProductBlockedState,
  PublicDisplayProduct,
} from "@/features/public-pos/order/types";
import {
  formatProductPrice,
  hasPromo,
  hasRemoteProductImage,
  isHexColor,
  productBlockedLabel,
  productImageUrl,
  getProductActionState,
  getProductBlockedState,
  statusSectionLabel,
} from "@/features/public-pos/order/utils";
import {
  CategoryCompactLoading,
  CategoryDeferredPlaceholder,
  RailSkeleton,
} from "@/features/public-pos/order/components/public-pos-skeletons";

const PublicCategoryIcon = dynamic(
  () =>
    import("@/features/public-pos/order/components/public-category-icon").then(
      (mod) => mod.PublicCategoryIcon,
    ),
  { ssr: false },
);

export const StatusRailSection = memo(function StatusRailSection({
  title,
  products,
  visibleCount,
  loading,
  priorityFirstImage = false,
  lang,
  loadingProductUuid,
  onProductClick,
  onRevealMore,
}: {
  title: string;
  products: PublicDisplayProduct[];
  visibleCount: number;
  loading: boolean;
  priorityFirstImage?: boolean;
  lang: string;
  loadingProductUuid: string;
  onProductClick: (
    product: CateProductItem,
    cateUuid: string,
    statusKind: PublicMenuKind,
    sourceRect?: DOMRect | null,
  ) => void;
  onRevealMore: (statusKind: PublicMenuKind, totalProducts: number) => void;
}) {
  const visibleProducts = products.slice(0, visibleCount);
  const priorityProductUuid = priorityFirstImage
    ? (visibleProducts.find(({ product }) => hasRemoteProductImage(product))
        ?.product.prod_uuid ?? "")
    : "";
  const railRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail || visibleProducts.length >= products.length) return;

    const handleScroll = () => {
      if (rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 220) {
        const statusKind = products[0]?.statusKind;
        if (statusKind) onRevealMore(statusKind, products.length);
      }
    };

    rail.addEventListener("scroll", handleScroll, { passive: true });
    return () => rail.removeEventListener("scroll", handleScroll);
  }, [onRevealMore, products, visibleProducts.length]);

  if (!visibleProducts.length && !loading) return null;

  return (
    <section className="[contain-intrinsic-size:260px] [content-visibility:auto]">
      <div className="mb-2 flex items-center gap-2">
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
          <Sparkles className="size-3.5" />
        </span>
        <h2 className="text-base font-black leading-6">{title}</h2>
      </div>

      {visibleProducts.length ? (
        <div
          ref={railRef}
          className="-mx-2 overflow-x-auto px-2 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <div className="flex w-max gap-2.5">
            {visibleProducts.map(({ product, cateUuid, statusKind }) => (
              <ProductCard
                key={`${statusKind}:${product.prod_uuid}`}
                product={product}
                cateUuid={cateUuid}
                statusKind={statusKind}
                lang={lang}
                loading={loadingProductUuid === product.prod_uuid}
                imagePriority={product.prod_uuid === priorityProductUuid}
                onProductClick={onProductClick}
                variant="rail"
              />
            ))}
            {visibleProducts.length < products.length ? (
              <button
                type="button"
                className="grid h-[230px] w-14 flex-none place-items-center rounded-lg border border-emerald-100 bg-white text-primary shadow-sm shadow-emerald-950/5 dark:border-border dark:bg-background"
                onClick={() =>
                  onRevealMore(
                    products[0]?.statusKind ?? PUBLIC_MENU_KIND.NORMAL,
                    products.length,
                  )
                }
                aria-label={title}
              >
                <Plus className="size-5" />
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <RailSkeleton />
      )}
    </section>
  );
});

export const ProductCategorySection = memo(function ProductCategorySection({
  category,
  products,
  totalProducts,
  loaded,
  loading,
  jumping,
  collapsed,
  lang,
  statusKind,
  priorityFirstImage = false,
  loadingProductUuid,
  onEnsureLoad,
  onProductClick,
  onRevealMore,
  onToggleCollapse,
  refCallback,
}: {
  category: CateWithProducts;
  products: CateProductItem[];
  totalProducts: number;
  loaded: boolean;
  loading: boolean;
  jumping: boolean;
  collapsed: boolean;
  lang: string;
  statusKind: PublicMenuKind;
  priorityFirstImage?: boolean;
  loadingProductUuid: string;
  onEnsureLoad: (cateUuid: string) => void;
  onProductClick: (
    product: CateProductItem,
    cateUuid: string,
    statusKind: PublicMenuKind,
    sourceRect?: DOMRect | null,
  ) => void;
  onRevealMore: (cateUuid: string) => void;
  onToggleCollapse: (cateUuid: string) => void;
  refCallback: (element: HTMLElement | null) => void;
}) {
  const { t } = useTranslation();
  const sectionRef = useRef<HTMLElement | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const loadingVisible = loading || jumping;
  const priorityProductUuid = priorityFirstImage
    ? (products.find((product) => hasRemoteProductImage(product))?.prod_uuid ??
      "")
    : "";

  const setSectionRef = useCallback(
    (element: HTMLElement | null) => {
      sectionRef.current = element;
      refCallback(element);
    },
    [refCallback],
  );

  useEffect(() => {
    const element = loadMoreRef.current;
    if (collapsed || !element || products.length >= totalProducts) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onRevealMore(category.cate_uuid);
        }
      },
      { rootMargin: "180px 0px 220px 0px", threshold: 0 },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [
    category.cate_uuid,
    collapsed,
    onRevealMore,
    products.length,
    totalProducts,
  ]);

  useEffect(() => {
    const element = sectionRef.current;
    if (collapsed || loaded || loading || jumping || !element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onEnsureLoad(category.cate_uuid);
        }
      },
      { rootMargin: "260px 0px 420px 0px", threshold: 0 },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [category.cate_uuid, collapsed, jumping, loaded, loading, onEnsureLoad]);

  return (
    <section
      ref={setSectionRef}
      id={`public-pos-cate-${category.cate_uuid}`}
      data-cate-uuid={category.cate_uuid}
      className="mt-7 scroll-mt-36 first:mt-0 sm:mt-8 [contain-intrinsic-size:720px] [content-visibility:auto]"
    >
      <div className="mb-2 flex min-w-0 items-center gap-2">
        <span className="grid size-8 shrink-0 place-items-center rounded-full border border-primary/10 bg-primary/10 text-primary shadow-sm shadow-emerald-950/5">
          <PublicCategoryIcon icon={category.cate_icon} className="size-5" />
        </span>
        <h2 className="min-w-0 flex-1 truncate text-base font-black leading-6">
          {category.cate_name}
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0 rounded-full text-muted-foreground hover:bg-primary/10 hover:text-primary"
          aria-label={category.cate_name}
          aria-expanded={!collapsed}
          onClick={() => onToggleCollapse(category.cate_uuid)}
        >
          {collapsed ? (
            <ChevronDown className="size-4" />
          ) : (
            <ChevronUp className="size-4" />
          )}
        </Button>
      </div>

      {collapsed ? null : loadingVisible ? (
        <CategoryCompactLoading />
      ) : !loaded ? (
        <CategoryDeferredPlaceholder />
      ) : products.length ? (
        <div className={PRODUCT_GRID_CLASS}>
          {products.map((product) => (
            <ProductCard
              key={product.prod_uuid}
              product={product}
              cateUuid={category.cate_uuid}
              statusKind={statusKind}
              lang={lang}
              loading={loadingProductUuid === product.prod_uuid}
              imagePriority={product.prod_uuid === priorityProductUuid}
              onProductClick={onProductClick}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-emerald-100 bg-white/75 p-4 text-center text-sm font-semibold text-muted-foreground dark:border-border dark:bg-background/75">
          {t("pos.noProductsInCategory")}
        </div>
      )}

      {!collapsed && products.length < totalProducts ? (
        <div ref={loadMoreRef} className="h-8" aria-hidden="true" />
      ) : null}
    </section>
  );
});

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
  variant?: "grid" | "rail";
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

  return (
    <Card
      className={cn(
        "overflow-hidden border-emerald-100 bg-white shadow-sm shadow-emerald-950/5 transition dark:border-border dark:bg-background",
        variant === "rail" ? "w-[142px] flex-none sm:w-[160px]" : "",
        isBlocked
          ? "opacity-85"
          : "active:scale-[0.99] hover:border-primary/35 hover:shadow-md",
      )}
    >
      <button
        type="button"
        className="flex h-full w-full flex-col text-left disabled:cursor-not-allowed"
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
            variant === "rail" ? "min-h-[86px]" : "min-h-[92px]",
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
      </button>
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
          <Loader2 className="size-3.5 animate-spin" />
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
          <Loader2 className="size-3.5 animate-spin" />
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
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <Plus className="size-3.5" />
      )}
      <span>{t("pos.addItem")}</span>
    </span>
  );
}

export function ProductMedia({
  product,
  variant = "card",
  blockedState,
  blockedLabel,
  priority = false,
}: {
  product: CateProductItem | ProdItem;
  variant?: "card" | "sheet" | "sheetThumb";
  blockedState?: ProductBlockedState | null;
  blockedLabel?: string;
  priority?: boolean;
}) {
  const imageUrl = productImageUrl(product);
  const colorCandidate = product.prod_color || product.prod_image;
  const colorSwatch =
    product.prod_status_imge === ProductImageStatus.COLOR &&
    isHexColor(colorCandidate)
      ? colorCandidate
      : "";
  const mediaClass =
    variant === "sheet"
      ? "aspect-[16/9]"
      : variant === "sheetThumb"
        ? "aspect-square"
        : "aspect-[1.05/1]";
  const imageSizes =
    variant === "sheetThumb"
      ? "96px"
      : "(min-width: 1024px) 240px, (min-width: 640px) 30vw, 50vw";

  if (imageUrl) {
    return (
      <div
        className={cn(
          "relative w-full overflow-hidden bg-emerald-50 dark:bg-muted",
          mediaClass,
        )}
      >
        <Image
          src={imageUrl}
          alt={product.prod_name}
          fill
          priority={priority || undefined}
          loading={priority ? undefined : "lazy"}
          quality={60}
          sizes={imageSizes}
          className={cn(
            "object-cover",
            blockedState ? "opacity-65 saturate-[0.55]" : "",
          )}
        />
        <ProductMediaStateOverlay
          blockedState={blockedState}
          label={blockedLabel}
        />
      </div>
    );
  }

  if (colorSwatch) {
    return (
      <div
        className={cn(
          "relative grid w-full place-items-center overflow-hidden border-b border-emerald-100 dark:border-border",
          mediaClass,
        )}
        style={{ backgroundColor: colorSwatch }}
      >
        <Utensils
          className={cn(
            "size-9 text-background/85 drop-shadow",
            blockedState ? "opacity-60 saturate-[0.55]" : "",
          )}
        />
        <ProductMediaStateOverlay
          blockedState={blockedState}
          label={blockedLabel}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative grid w-full place-items-center overflow-hidden bg-emerald-50 text-muted-foreground dark:bg-muted",
        mediaClass,
      )}
    >
      <ImageIcon className={cn("size-9", blockedState ? "opacity-60" : "")} />
      <ProductMediaStateOverlay
        blockedState={blockedState}
        label={blockedLabel}
      />
    </div>
  );
}

function ProductMediaStateOverlay({
  blockedState,
  label,
}: {
  blockedState?: ProductBlockedState | null;
  label?: string;
}) {
  if (!blockedState || !label) return null;

  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute inset-0 bg-white/35 dark:bg-black/35" />
      <Badge
        className={cn(
          "absolute left-2 top-2 h-6 max-w-[calc(100%-1rem)] gap-1 rounded-full px-2 py-0 text-[10px] font-black leading-none shadow-sm backdrop-blur-sm",
          blockedState === "promotion-ended"
            ? "border-amber-300 bg-amber-50/95 text-amber-800 dark:border-amber-500/50 dark:bg-amber-950/85 dark:text-amber-100"
            : "border-destructive/35 bg-destructive/10 text-destructive dark:bg-destructive/20",
        )}
      >
        <AlertCircle className="size-3 shrink-0" />
        <span className="truncate">{label}</span>
      </Badge>
    </div>
  );
}
