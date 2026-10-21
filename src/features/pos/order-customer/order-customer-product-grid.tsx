"use client";

import { memo, useMemo } from "react";
import { cn } from "@/lib/utils";
import { optionalString } from "@/lib/values";
import { EmployeeProductCard } from "./order-customer-product-card";
import { productMedia } from "./product-media";
import {
  PRODUCT_GRID_CLASS,
  PRODUCT_GRID_PRELOAD_COUNT,
  type ProductCardEntry,
  type ProductSortStatus,
} from "./order-customer-utils";

interface EmployeeProductGridProps {
  activeSort: ProductSortStatus;
  className?: string;
  compact: boolean;
  loadingProductUuid: string;
  nativeMobile: boolean;
  onAction: (entry: ProductCardEntry) => void;
  onPrefetch: (entry: ProductCardEntry) => void;
  products: ProductCardEntry[];
}

// Cart updates and option edits do not change the catalog. Keep the entire
// product list out of those renders, including creating and comparing its cards.
export const EmployeeProductGrid = memo(function EmployeeProductGrid({
  activeSort,
  className,
  compact,
  loadingProductUuid,
  nativeMobile,
  onAction,
  onPrefetch,
  products,
}: EmployeeProductGridProps) {
  // The first client-loaded images need eager/high priority as well as preload.
  const preloadImageIndexes = useMemo(() => {
    const indexes = new Set<number>();
    for (const [index, entry] of products.entries()) {
      if (indexes.size >= PRODUCT_GRID_PRELOAD_COUNT) break;
      if (productMedia(entry.product).type === "image") indexes.add(index);
    }
    return indexes;
  }, [products]);

  return (
    <div
      className={cn(
        PRODUCT_GRID_CLASS,
        className,
        "pb-24 lg:pb-[calc(1rem+var(--pos-system-bottom-safe-area))]",
      )}
    >
      {products.map((entry, index) => (
        <EmployeeProductCard
          key={`${entry.cateUuid}-${entry.product.prodUuid}-${
            optionalString(entry.product.proDetailUuid) ?? activeSort
          }`}
          activeSort={activeSort}
          compact={compact}
          entry={entry}
          imagePreload={preloadImageIndexes.has(index)}
          loading={loadingProductUuid === entry.product.prodUuid}
          nativeMobile={nativeMobile}
          onAction={onAction}
          onPrefetch={onPrefetch}
        />
      ))}
    </div>
  );
});
