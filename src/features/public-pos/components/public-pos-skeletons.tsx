"use client";

import { useTranslation } from "react-i18next";
import { ChefHat, Loader2, Search, Utensils } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PRODUCT_GRID_CLASS } from "@/features/public-pos/constants";

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
    <div className="-mx-2 overflow-hidden px-2">
      <div className="flex gap-2.5">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="w-[142px] flex-none overflow-hidden rounded-lg border border-emerald-100 bg-white dark:border-border dark:bg-background sm:w-[160px]"
          >
            <Skeleton className="aspect-[1.05/1] w-full" />
            <div className="grid gap-1.5 p-2">
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-5 w-full" />
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
        <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
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
          <Utensils className="size-5" />
        </div>
        <p className="text-sm font-black">{t("pos.noProducts")}</p>
      </div>
    </div>
  );
}

function CategoryLoadingGrid() {
  return (
    <div className={PRODUCT_GRID_CLASS}>
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-lg border border-emerald-100 bg-white dark:border-border dark:bg-background"
        >
          <Skeleton className="aspect-[1.05/1] w-full" />
          <div className="grid gap-1.5 p-2">
            <Skeleton className="h-5 w-4/5" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-6 w-full" />
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
      className="w-full"
    >
      <Card className="overflow-hidden border-emerald-100 bg-white/95 shadow-lg shadow-emerald-950/5 dark:border-border dark:bg-background">
        <CardHeader className="flex-col items-stretch justify-start gap-4 border-emerald-100 bg-emerald-50/50 px-4 py-4 dark:border-border dark:bg-muted/25">
          <div className="flex items-center gap-3">
            <div className="grid size-12 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm shadow-emerald-950/10">
              <ChefHat className="size-6" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-normal text-primary">
                YUMMY GO
              </p>
              <h1 className="mt-1 text-xl font-black leading-6">
                {t("pos.publicLoadingTitle")}
              </h1>
              <p className="mt-1 max-w-md text-sm font-medium leading-5 text-muted-foreground">
                {t("pos.publicLoadingDescription")}
              </p>
            </div>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-emerald-100 dark:bg-muted">
            <div className="h-full w-2/3 animate-pulse rounded-full bg-primary" />
          </div>
        </CardHeader>

        <CardContent className="grid gap-4 p-4">
          <div className="flex items-center gap-2 rounded-md border border-emerald-100 bg-background px-3 py-2 dark:border-border">
            <Search className="size-4 text-muted-foreground" />
            <Skeleton className="h-4 flex-1" />
          </div>

          <div className="flex gap-2">
            <Skeleton className="h-8 w-20 rounded-full" />
            <Skeleton className="h-8 w-24 rounded-full" />
            <Skeleton className="h-8 w-16 rounded-full" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="overflow-hidden rounded-lg border border-emerald-100 bg-background dark:border-border"
              >
                <Skeleton className="aspect-[1.15/1] w-full" />
                <div className="grid gap-2 p-3">
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-8 w-full rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
