"use client";

import { useTranslation } from "react-i18next";
import { Loader2, Search, Utensils } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { PRODUCT_GRID_CLASS } from "@/features/public-pos/order/constants";

export function ProductsSkeleton() {
  return (
    <div className="grid gap-2.5">
      <div className="flex items-center gap-2">
        <Skeleton className="size-6 rounded-full" />
        <Skeleton className="h-5 w-32" />
      </div>
      <CategoryLoadingGrid />
    </div>
  );
}

export function RailSkeleton() {
  return (
    <div className="-mx-2 overflow-hidden px-2 sm:mx-0 sm:px-0">
      <div className="flex w-max gap-3 sm:grid sm:w-full sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="w-44 flex-none overflow-hidden rounded-xl border border-emerald-100 bg-white dark:border-border dark:bg-background sm:w-auto"
          >
            <Skeleton className="aspect-[4/3] w-full" />
            <div className="grid min-h-36 gap-1.5 p-2.5">
              <Skeleton className="h-5 w-4/5" />
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="mt-auto h-10 w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CategoryCompactLoading() {
  return (
    <div className="rounded-lg border border-emerald-100 bg-white/85 p-3 shadow-sm shadow-emerald-950/5 dark:border-border dark:bg-background/85">
      <div className="flex items-center gap-2">
        <Loader2
          className="size-4 shrink-0 animate-spin text-primary"
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
    <div className="rounded-lg border border-dashed border-emerald-100 bg-white/65 p-3 dark:border-border dark:bg-background/65">
      <div className="flex items-center gap-2">
        <Skeleton className="size-8 rounded-md" />
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
    <div className="grid min-h-52 place-items-center rounded-lg border border-emerald-100 bg-white/90 px-4 text-center shadow-sm shadow-emerald-950/5 dark:border-border dark:bg-background">
      <div className="max-w-60">
        <div className="mx-auto mb-3 grid size-11 place-items-center rounded-full bg-emerald-50 text-primary dark:bg-primary/10">
          <Utensils className="size-5" aria-hidden="true" />
        </div>
        <p className="text-sm font-black">{t("pos.noProducts")}</p>
      </div>
    </div>
  );
}

function CategoryLoadingGrid() {
  return (
    <div className={PRODUCT_GRID_CLASS}>
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-lg border border-emerald-100 bg-white dark:border-border dark:bg-background"
        >
          <Skeleton className="aspect-[4/3] w-full" />
          <div className="grid min-h-36 gap-1.5 p-2.5">
            <Skeleton className="h-5 w-4/5" />
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="mt-auto h-10 w-full" />
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
      className="flex w-full flex-col gap-3"
    >
      <div className="sticky top-12 z-20 -mx-2.5 bg-[#f3fbf7]/95 px-2.5 py-1.5 backdrop-blur-xl sm:-mx-4 sm:top-14 sm:px-4 dark:bg-app/95">
        <div className="mx-auto flex max-w-5xl flex-col gap-1.5 rounded-lg border border-emerald-100 bg-white/95 p-1.5 shadow-sm shadow-emerald-950/5 dark:border-border dark:bg-background/95">
          <div className="flex gap-1.5">
            <div className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md border border-emerald-100 bg-emerald-50/50 px-2.5 dark:border-border dark:bg-muted/45">
              <Search
                className="size-3.5 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <Skeleton className="h-4 flex-1" />
            </div>
            <Skeleton className="h-9 w-9 rounded-md" />
          </div>
          <div className="flex gap-2 overflow-hidden pb-1">
            <Skeleton className="h-8 w-20 rounded-full" />
            <Skeleton className="h-8 w-24 rounded-full" />
            <Skeleton className="h-8 w-16 rounded-full" />
            <Skeleton className="h-8 w-24 rounded-full" />
          </div>
        </div>
      </div>

      <RailSkeleton />
      <ProductsSkeleton />
    </section>
  );
}
