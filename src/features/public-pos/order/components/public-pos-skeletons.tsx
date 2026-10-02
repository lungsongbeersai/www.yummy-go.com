"use client";

import { useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Utensils } from "lucide-react";
import type { PublicProductLayoutMode } from "../types";
import { readPublicProductLayoutMode, subscribePublicProductLayoutMode } from "../utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DEFAULT_PUBLIC_POS_HERO_VISIBLE,
  PRODUCT_GRID_CLASS,
} from "@/features/public-pos/order/constants";
import {
  readPublicPosHeroVisible,
  subscribePublicPosHeroVisible,
} from "@/features/public-pos/order/public-pos-hero-visibility";

// Same shape as the product cards: a soft filled card, no border.
const SKELETON_CARD_CLASS = "overflow-hidden rounded-lg border border-yg-divider bg-yg-card p-2";

export function ProductsSkeleton({ layoutMode = "grid" }: { layoutMode?: PublicProductLayoutMode }) {
  return (
    <div className="grid gap-2.5">
      <div className="flex items-center gap-2.5">
        <Skeleton className="size-7 rounded-lg" />
        <div className="grid gap-1.5">
          <Skeleton className="h-6 w-36" />
        </div>
      </div>
      <CategoryLoadingGrid layoutMode={layoutMode} />
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
            <Skeleton className="aspect-4/3 w-full rounded-lg" />
            <div className="grid gap-2 px-1 pt-2 pb-1">
              <Skeleton className="h-5 w-4/5" />
              <Skeleton className="h-5 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CategoryCompactLoading() {
  return (
    <div className="rounded-xl border border-yg-line bg-yg-panel p-3">
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
    <div className="rounded-xl border border-dashed border-yg-line bg-yg-panel2 p-3">
      <div className="flex items-center gap-2">
        <Skeleton className="size-8 rounded-lg" />
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
    <div className="grid min-h-52 place-items-center rounded-2xl border border-yg-line bg-yg-panel px-4 text-center backdrop-blur-md">
      <div className="max-w-60">
        <div className="mx-auto mb-3 grid size-12 place-items-center rounded-xl border border-yg-accent-line bg-yg-accent-soft text-yg-accent-strong">
          <Utensils className="size-5" aria-hidden="true" />
        </div>
        <p className="lao-tone-text font-yg-serif text-base font-semibold text-yg-ink">
          {t("pos.noProducts")}
        </p>
      </div>
    </div>
  );
}

function CategoryLoadingGrid({ layoutMode }: { layoutMode: PublicProductLayoutMode }) {
  if (layoutMode === "list") return (
    <div className="divide-y divide-yg-line/60">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="flex min-h-28 gap-2.5 py-2">
          <Skeleton className="size-24 shrink-0 rounded-lg" />
          <div className="grid flex-1 content-center gap-2">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-5 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
  return (
    <div className={PRODUCT_GRID_CLASS}>
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className={SKELETON_CARD_CLASS}>
          <Skeleton className="aspect-4/3 w-full rounded-lg" />
          <div className="grid gap-2 px-1 pt-2 pb-1">
            <Skeleton className="h-5 w-4/5" />
            <Skeleton className="h-5 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PublicPosLoadingScreen() {
  const { t } = useTranslation();
  // ต้องเช็คค่าเดียวกับหน้าจริง (ปิดเป็นค่าเริ่มต้น) ไม่งั้น skeleton จะมีบล็อก hero
  // ค้างอยู่เสมอ พอโหลดเสร็จแล้วหน้าจริงไม่มี hero เนื้อหาทั้งหมดจะกระโดดขึ้นแรง
  const heroVisible = useSyncExternalStore(
    subscribePublicPosHeroVisible,
    readPublicPosHeroVisible,
    (): boolean => DEFAULT_PUBLIC_POS_HERO_VISIBLE,
  );

  const layoutMode = useSyncExternalStore(subscribePublicProductLayoutMode, readPublicProductLayoutMode, (): PublicProductLayoutMode => "list");

  return (
    <section
      aria-busy="true"
      aria-live="polite"
      aria-label={t("pos.publicLoadingTitle")}
      className="flex w-full flex-col gap-3"
    >
      {/* โครงเดียวกับ hero จริง ไม่ให้เลย์เอาต์กระโดดตอนข้อมูลมาถึง */}
      {heroVisible ? (
        <Skeleton className="h-[clamp(310px,42vw,420px)] w-full rounded-3xl" />
      ) : null}

      <div className="-mx-(--yg-gutter) flex h-10 gap-3 overflow-hidden border-b border-yg-divider px-(--yg-gutter)">
        <Skeleton className="my-auto h-5 w-20 shrink-0" />
        <Skeleton className="my-auto h-5 w-24 shrink-0" />
        <Skeleton className="my-auto h-5 w-20 shrink-0" />
      </div>
      <ProductsSkeleton layoutMode={layoutMode} />
    </section>
  );
}
