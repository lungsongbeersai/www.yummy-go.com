"use client";

import { memo, useEffect, useRef } from "react";
import { Plus, Sparkles } from "lucide-react";
import type { CateProductItem } from "@/services/pos";
import {
  PUBLIC_MENU_KIND,
  type PublicMenuKind,
} from "@/stores/public-pos-store";
import type { PublicDisplayProduct } from "../types";
import { hasRemoteProductImage } from "../utils";
import { RailSkeleton } from "./public-pos-skeletons";
import { ProductCard } from "./public-product-card";

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
