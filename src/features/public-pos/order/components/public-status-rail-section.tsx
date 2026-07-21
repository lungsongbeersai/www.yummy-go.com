"use client";

import { memo, useEffect, useRef } from "react";
import { Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CateProductItem } from "@/services/pos";
import {
  PUBLIC_MENU_KIND,
  type PublicMenuKind,
} from "@/stores/public-pos-store";
import type { PublicDisplayProduct } from "../types";
import { hasRemoteProductImage } from "../utils";
import { RailSkeleton } from "./public-pos-skeletons";
import { ProductCard } from "./public-product-card";
import { HorizontalScrollArrows } from "./horizontal-scroll-arrows";

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
  const useDesktopGrid = products.length <= 5;
  const priorityProductUuid = priorityFirstImage
    ? (visibleProducts.find(({ product }) => hasRemoteProductImage(product))
        ?.product.prod_uuid ?? "")
    : "";
  const railRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail || visibleProducts.length >= products.length) return;

    let frameId = 0;
    const handleScroll = () => {
      if (frameId) return;

      frameId = window.requestAnimationFrame(() => {
        frameId = 0;
        if (rail.scrollLeft + rail.clientWidth < rail.scrollWidth - 220)
          return;

        const statusKind = products[0]?.statusKind;
        if (statusKind) onRevealMore(statusKind, products.length);
      });
    };

    rail.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      rail.removeEventListener("scroll", handleScroll);
      if (frameId) window.cancelAnimationFrame(frameId);
    };
  }, [onRevealMore, products, visibleProducts.length]);

  if (!visibleProducts.length && !loading) return null;

  return (
    <section className="[contain-intrinsic-size:320px] [content-visibility:auto]">
      <div className="mb-2 flex items-center gap-2">
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
          <Sparkles className="size-3.5" aria-hidden="true" />
        </span>
        <h2 className="text-base font-black leading-6">{title}</h2>
      </div>

      {visibleProducts.length ? (
        <div className="relative">
          <div
            ref={railRef}
            className={cn(
              "-mx-2 overflow-x-auto overscroll-x-contain px-2 pb-1 scrollbar-none [&::-webkit-scrollbar]:hidden",
              useDesktopGrid
                ? "sm:mx-0 sm:overflow-visible sm:px-0"
                : "",
            )}
          >
            <div
              className={cn(
                "flex w-max snap-x snap-mandatory gap-3",
                useDesktopGrid
                  ? "sm:grid sm:w-full sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
                  : "",
              )}
            >
              {visibleProducts.map(({ product, cateUuid, statusKind }) => (
                <ProductCard
                  key={`${statusKind}:${product.prod_uuid}`}
                  product={product}
                  cateUuid={cateUuid}
                  statusKind={statusKind}
                  lang={lang}
                  loading={loadingProductUuid === product.prod_uuid}
                  imagePreload={product.prod_uuid === priorityProductUuid}
                  onProductClick={onProductClick}
                  variant={useDesktopGrid ? "railGrid" : "rail"}
                />
              ))}
              {visibleProducts.length < products.length ? (
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    "grid h-auto w-14 flex-none snap-start place-items-center self-stretch rounded-xl border border-emerald-100 bg-white text-primary shadow-sm shadow-emerald-950/5 hover:border-primary/30 hover:bg-primary/5 dark:border-border dark:bg-background",
                    useDesktopGrid ? "sm:min-h-64 sm:w-full" : "",
                  )}
                  onClick={() =>
                    onRevealMore(
                      products[0]?.statusKind ?? PUBLIC_MENU_KIND.NORMAL,
                      products.length,
                    )
                  }
                  aria-label={title}
                >
                  <Plus aria-hidden="true" />
                </Button>
              ) : null}
            </div>
          </div>
          <HorizontalScrollArrows scrollRef={railRef} />
        </div>
      ) : (
        <RailSkeleton />
      )}
    </section>
  );
});
