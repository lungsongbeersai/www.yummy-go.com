"use client";

import dynamic from "next/dynamic";
import { memo, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CateProductItem, CateWithProducts } from "@/services/pos";
import type { PublicMenuKind } from "@/stores/public-pos-store";
import { PRODUCT_GRID_CLASS } from "../constants";
import type { PublicProductLayoutMode } from "../types";
import { hasRemoteProductImage } from "../utils";
import {
  CategoryCompactLoading,
  CategoryDeferredPlaceholder,
} from "./public-pos-skeletons";
import { ProductCard } from "./public-product-card";
import { PublicSectionHeading } from "./public-section-heading";

const PublicCategoryIcon = dynamic(
  () =>
    import("@/features/public-pos/order/components/public-category-icon").then(
      (mod) => mod.PublicCategoryIcon,
    ),
  { ssr: false },
);

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
  layoutMode,
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
  layoutMode: PublicProductLayoutMode;
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
    ? (products.find((product) => hasRemoteProductImage(product))?.prodUuid ??
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
          onRevealMore(category.cateUuid);
        }
      },
      { rootMargin: "180px 0px 220px 0px", threshold: 0 },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [
    category.cateUuid,
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
          onEnsureLoad(category.cateUuid);
        }
      },
      { rootMargin: "260px 0px 420px 0px", threshold: 0 },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [category.cateUuid, collapsed, jumping, loaded, loading, onEnsureLoad]);

  return (
    <section
      ref={setSectionRef}
      id={`public-pos-cate-${category.cateUuid}`}
      data-cate-uuid={category.cateUuid}
      className="mt-7 scroll-mt-36 first:mt-0 sm:mt-8 [contain-intrinsic-size:720px] [content-visibility:auto]"
    >
      <PublicSectionHeading
        eyebrow={t("pos.menuEyebrowMenu")}
        title={category.cateName}
        icon={<PublicCategoryIcon icon={category.cateIcon} className="size-5" />}
        meta={t("pos.itemCount", { count: totalProducts })}
        action={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11 shrink-0 rounded-xl text-yg-muted hover:bg-yg-panel-hover hover:text-yg-ink"
            aria-label={category.cateName}
            aria-expanded={!collapsed}
            onClick={() => onToggleCollapse(category.cateUuid)}
          >
            {collapsed ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronUp className="size-4" />
            )}
          </Button>
        }
      />

      {collapsed ? null : loadingVisible ? (
        <CategoryCompactLoading />
      ) : !loaded ? (
        <CategoryDeferredPlaceholder />
      ) : products.length ? (
        <div
          className={
            layoutMode === "list" ? "grid grid-cols-1 gap-2.5" : PRODUCT_GRID_CLASS
          }
        >
          {products.map((product) => (
            <ProductCard
              key={product.prodUuid}
              product={product}
              cateUuid={category.cateUuid}
              statusKind={statusKind}
              lang={lang}
              loading={loadingProductUuid === product.prodUuid}
              imagePreload={product.prodUuid === priorityProductUuid}
              variant={layoutMode}
              onProductClick={onProductClick}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-yg-line bg-yg-panel2 p-4 text-center text-sm font-semibold text-yg-muted">
          {t("pos.noProductsInCategory")}
        </div>
      )}

      {!collapsed && products.length < totalProducts ? (
        <div ref={loadMoreRef} className="h-8" aria-hidden="true" />
      ) : null}
    </section>
  );
});
