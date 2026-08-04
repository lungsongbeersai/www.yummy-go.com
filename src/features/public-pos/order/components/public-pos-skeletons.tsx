"use client";

import { useTranslation } from "react-i18next";
import { Loader2, Search, Utensils } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { PRODUCT_GRID_CLASS } from "@/features/public-pos/order/constants";

const SKELETON_CARD_CLASS =
  "overflow-hidden rounded-[20px] border border-yg-line bg-yg-panel";

export function ProductsSkeleton() {
  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-2.5">
        <Skeleton className="size-9 rounded-xl" />
        <div className="grid gap-1.5">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-6 w-36" />
        </div>
      </div>
      <CategoryLoadingGrid />
    </div>
  );
}

export function RailSkeleton() {
  return (
    <div className="-mx-(--yg-gutter) overflow-hidden px-(--yg-gutter) sm:mx-0 sm:px-0">
      <div className="flex w-max gap-[clamp(12px,2vw,18px)] sm:grid sm:w-full sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className={`${SKELETON_CARD_CLASS} w-44 flex-none sm:w-auto`}
          >
            <Skeleton className="aspect-4/3 w-full rounded-none" />
            <div className="grid min-h-36 gap-2 p-3.5">
              <Skeleton className="h-5 w-4/5" />
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="mt-auto h-11 w-full rounded-2xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CategoryCompactLoading() {
  return (
    <div className="rounded-2xl border border-yg-line bg-yg-panel p-3">
      <div className="flex items-center gap-2">
        <Loader2
          className="size-4 shrink-0 animate-spin text-yg-accent-strong"
          aria-hidden="true"
        />
        <Skeleton className="h-4 flex-1" />
        <Skeleton className="h-4 w-14" />
      </div>
    </div>
  );
}

export function CategoryDeferredPlaceholder() {
  return (
    <div className="rounded-2xl border border-dashed border-yg-line bg-yg-panel2 p-3">
      <div className="flex items-center gap-2">
        <Skeleton className="size-8 rounded-xl" />
        <div className="grid flex-1 gap-1.5">
          <Skeleton className="h-3.5 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
    </div>
  );
}

export function MenuEmptyState() {
  const { t } = useTranslation();

  return (
    <div className="grid min-h-52 place-items-center rounded-[20px] border border-yg-line bg-yg-panel px-4 text-center backdrop-blur-md">
      <div className="max-w-60">
        <div className="mx-auto mb-3 grid size-12 place-items-center rounded-2xl border border-yg-accent-line bg-yg-accent-soft text-yg-accent-strong">
          <Utensils className="size-5" aria-hidden="true" />
        </div>
        <p className="lao-tone-text font-yg-serif text-base font-semibold text-yg-ink">
          {t("pos.noProducts")}
        </p>
      </div>
    </div>
  );
}

function CategoryLoadingGrid() {
  return (
    <div className={PRODUCT_GRID_CLASS}>
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className={SKELETON_CARD_CLASS}>
          <Skeleton className="aspect-4/3 w-full rounded-none" />
          <div className="grid min-h-36 gap-2 p-3.5">
            <Skeleton className="h-5 w-4/5" />
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="mt-auto h-11 w-full rounded-2xl" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PublicPosLoadingScreen() {
  const { t } = useTranslation();

  return (
    <section
      aria-busy="true"
      aria-live="polite"
      aria-label={t("pos.publicLoadingTitle")}
      className="flex w-full flex-col gap-4"
    >
      {/* โครงเดียวกับ hero จริง ไม่ให้เลย์เอาต์กระโดดตอนข้อมูลมาถึง */}
      <Skeleton className="h-[clamp(310px,42vw,420px)] w-full rounded-[28px]" />

      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <div className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-2xl border border-yg-line bg-yg-panel px-3.5">
            <Search
              className="size-4 shrink-0 text-yg-faint"
              aria-hidden="true"
            />
            <Skeleton className="h-4 flex-1" />
          </div>
          <Skeleton className="size-11 rounded-2xl" />
          <Skeleton className="h-11 w-22 rounded-2xl" />
        </div>
        <div className="flex gap-2 overflow-hidden">
          <Skeleton className="h-11 w-24 rounded-full" />
          <Skeleton className="h-11 w-28 rounded-full" />
          <Skeleton className="h-11 w-20 rounded-full" />
          <Skeleton className="h-11 w-28 rounded-full" />
        </div>
      </div>

      <RailSkeleton />
      <ProductsSkeleton />
    </section>
  );
}
