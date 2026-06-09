"use client";

import dynamic from "next/dynamic";
import { memo, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CateProductItem, CateWithProducts } from "@/services/pos";
import type { PublicMenuKind } from "@/stores/public-pos-store";
import { PRODUCT_GRID_CLASS } from "../constants";
import { hasRemoteProductImage } from "../utils";
import {
  CategoryCompactLoading,
  CategoryDeferredPlaceholder,
} from "./public-pos-skeletons";
import { ProductCard } from "./public-product-card";

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
