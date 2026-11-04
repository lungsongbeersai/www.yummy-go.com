"use client";

import { memo, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Sparkles, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CateProductItem } from "@/services/pos";
import {
  PUBLIC_MENU_KIND,
  type PublicMenuKind,
} from "@/stores/public-pos-store";
import { LCP_PRIORITY_IMAGE_COUNT } from "../constants";
import type { PublicDisplayProduct } from "../types";
import { hasRemoteProductImage } from "../utils";
import { RailSkeleton } from "./public-pos-skeletons";
import { ProductCard, SetProductCard } from "./public-product-card";
import { PublicSectionHeading } from "./public-section-heading";
import { HorizontalScrollArrows } from "./horizontal-scroll-arrows";

const EMPTY_PRIORITY_SET: ReadonlySet<string> = new Set();

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
  cardKind = "product",
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
  // ชุด (SET) มีการ์ดของตัวเอง (SetProductCard) — เนื้อหาน้อยกว่าสินค้าทั่วไป
  // (ไม่มี choice meta, ราคาคงที่เสมอ) จึงไม่ reserve พื้นที่แบบเดียวกับ ProductCard
  cardKind?: "product" | "set";
}) {
  const { t } = useTranslation();
  const visibleProducts = products.slice(0, visibleCount);
  const promotionSection = products.some(({ statusKind }) => statusKind === PUBLIC_MENU_KIND.PROMOTION);
  // การ์ดในแถวเดียวกันเรนเดอร์ขนาดเท่ากันหมด จึง "เสมอกัน" สำหรับ LCP — มาร์ค eager
  // ทุกใบในโควตานี้แทนที่จะเลือกแค่ใบแรก เพราะใบที่ชนะจริงไม่ใช่ใบแรกในลิสต์เสมอไป
  const priorityProductUuids = useMemo(() => {
    if (!priorityFirstImage) return EMPTY_PRIORITY_SET;

    const uuids = new Set<string>();
    for (const { product } of visibleProducts) {
      if (!hasRemoteProductImage(product)) continue;
      uuids.add(product.prodUuid);
      if (uuids.size >= LCP_PRIORITY_IMAGE_COUNT) break;
    }
    return uuids;
  }, [priorityFirstImage, visibleProducts]);
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
    // เหตุผลเดียวกับ ProductCategorySection — content-visibility:auto ชนกับรูปสินค้าที่
    // โหลด async ทำให้บาง section ค้าง placeholder ว่างไว้ไม่ยอม paint เนื้อหาจริงตามจริง
    <section className={cn(
      "border-b border-yg-divider pb-1",
      promotionSection && "-mx-(--yg-gutter) bg-yg-bg px-(--yg-gutter) pt-1",
    )}>
      <PublicSectionHeading
        title={title}
        className="mb-2"
        icon={cardKind === "set"
          ? <UtensilsCrossed className="size-5" aria-hidden="true" />
          : <Sparkles className="size-5" aria-hidden="true" />}
        action={visibleProducts.length ? (
          <HorizontalScrollArrows scrollRef={railRef} variant="controls" />
        ) : undefined}
      />

      {visibleProducts.length ? (
        <div>
          <div
            ref={railRef}
            role="region"
            aria-label={title}
            tabIndex={0}
            className="yg-rail -mx-(--yg-gutter) snap-x snap-proximity scroll-px-(--yg-gutter) overflow-x-auto overflow-y-hidden overscroll-x-contain px-(--yg-gutter) pb-2 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-yg-accent"
          >
            <div className="flex w-max gap-3">
              {visibleProducts.map(({ product, cateUuid, statusKind }) =>
                cardKind === "set" ? (
                  <SetProductCard
                    key={`${statusKind}:${product.prodUuid}`}
                    product={product}
                    cateUuid={cateUuid}
                    lang={lang}
                    loading={loadingProductUuid === product.prodUuid}
                    imagePreload={priorityProductUuids.has(product.prodUuid)}
                    onProductClick={onProductClick}
                    variant="rail"
                  />
                ) : (
                  <ProductCard
                    key={`${statusKind}:${product.prodUuid}`}
                    product={product}
                    cateUuid={cateUuid}
                    statusKind={statusKind}
                    lang={lang}
                    loading={loadingProductUuid === product.prodUuid}
                    imagePreload={priorityProductUuids.has(product.prodUuid)}
                    onProductClick={onProductClick}
                    variant="rail"
                  />
                ),
              )}
              {visibleProducts.length < products.length ? (
                <Button
                  type="button"
                  variant="outline"
                  className="flex h-auto min-h-11 w-14 flex-none snap-start items-center justify-center rounded-xl border-yg-line bg-yg-panel text-yg-accent-strong hover:border-yg-accent-line hover:bg-yg-panel-hover hover:text-yg-accent-strong"
                  onClick={() =>
                    onRevealMore(
                      products[0]?.statusKind ?? PUBLIC_MENU_KIND.NORMAL,
                      products.length,
                    )
                  }
                  aria-label={`${t("app.more")} ${title}`}
                >
                  <Plus aria-hidden="true" />
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <RailSkeleton />
      )}
    </section>
  );
});
