"use client";

import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";

type LoadingVariant =
  | "dashboard"
  | "grid"
  | "page"
  | "posGrid"
  | "productList"
  | "reportTable"
  | "settingsTable"
  | "splitPanel"
  | "table";

interface LoadingStateProps {
  label?: string;
  variant?: LoadingVariant;
}

function LoadingHeader() {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <Skeleton className="h-10 w-28" />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <LoadingHeader />
      <Skeleton className="h-16 rounded-lg" />
      <div className="grid gap-3 xl:grid-cols-[1.15fr_2fr]">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-9 w-44 max-w-full" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="size-10 rounded-md" />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-center gap-3">
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="size-9 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Skeleton className="h-96 rounded-lg xl:col-span-2" />
        <Skeleton className="h-96 rounded-lg" />
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Skeleton className="h-72 rounded-lg" />
        <Skeleton className="h-72 rounded-lg" />
        <Skeleton className="h-72 rounded-lg" />
      </div>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="rounded-lg border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border p-3 sm:flex-row sm:p-4">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-28" />
        </div>
        <div className="flex flex-col gap-3 p-3 sm:p-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="grid grid-cols-[1.2fr_1fr_0.8fr_5rem] gap-3">
              <Skeleton className="h-5" />
              <Skeleton className="h-5" />
              <Skeleton className="h-5" />
              <Skeleton className="h-5" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        {Array.from({ length: 12 }).map((_, index) => (
          <div key={index} className="rounded-lg border border-border bg-card p-4">
            <div className="flex flex-col gap-3">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PosGridSkeleton() {
  return (
    <div className="flex min-w-0 flex-col gap-4 pb-4">
      {Array.from({ length: 2 }).map((_, zoneIndex) => (
        <section key={zoneIndex} className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-6 w-9 rounded-full" />
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(140px,100%),1fr))] gap-2 sm:grid-cols-[repeat(auto-fill,minmax(min(210px,100%),1fr))] sm:gap-3 xl:grid-cols-[repeat(auto-fill,minmax(min(240px,100%),1fr))]">
            {Array.from({ length: zoneIndex === 0 ? 3 : 6 }).map((_, cardIndex) => (
              <div key={cardIndex} className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                <div className="relative flex min-h-32 flex-col items-center justify-center px-2 py-4 sm:min-h-42 sm:px-4 sm:py-6 xl:min-h-44.5">
                  <Skeleton className="absolute right-3 top-3 size-3 rounded-full sm:right-4 sm:top-4 sm:size-4" />
                  <Skeleton className="h-3 w-12" />
                  <Skeleton className="mt-2 h-8 w-20" />
                  <Skeleton className="mt-3 h-4 w-14" />
                </div>
                <div className="flex h-8.5 items-center gap-2 border-t border-border bg-muted/50 px-3 sm:h-10 sm:px-4">
                  <Skeleton className="size-4 rounded-full" />
                  <Skeleton className="h-4 w-6" />
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function SettingsTableSkeleton() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="hidden min-h-0 flex-1 md:block">
        <div className="settings-table-scroll min-h-0 flex-1 overflow-auto">
          <div className="min-w-[720px]">
            <div className="grid grid-cols-[3rem_1.3fr_1fr_1fr_5rem] gap-3 border-b border-border px-4 py-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-4" />
              ))}
            </div>
            {Array.from({ length: 8 }).map((_, rowIndex) => (
              <div key={rowIndex} className="grid grid-cols-[3rem_1.3fr_1fr_1fr_5rem] gap-3 border-b border-border/70 px-4 py-3">
                <Skeleton className="size-5" />
                <Skeleton className="h-5" />
                <Skeleton className="h-5" />
                <Skeleton className="h-5" />
                <Skeleton className="h-8 w-8 justify-self-end" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3 md:hidden">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="rounded-lg border border-border bg-card p-3 shadow-sm">
            <div className="flex items-start gap-3">
              <Skeleton className="mt-1 size-5" />
              <div className="grid min-w-0 flex-1 gap-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
              <Skeleton className="size-8" />
            </div>
            <div className="mt-3 grid gap-2 border-t border-border pt-3 sm:grid-cols-2">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProductListSkeleton() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="hidden min-h-0 flex-1 md:block">
        <div className="grid min-w-[860px] grid-cols-[3rem_4rem_1.5fr_1fr_1fr_7rem] gap-3 border-b border-border px-4 py-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-4" />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="grid min-w-[860px] grid-cols-[3rem_4rem_1.5fr_1fr_1fr_7rem] items-center gap-3 border-b border-border/70 px-4 py-3">
            <Skeleton className="size-5" />
            <Skeleton className="size-10 rounded-md" />
            <div className="grid gap-2">
              <Skeleton className="h-5 w-4/5" />
              <Skeleton className="h-4 w-1/2" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-8 w-20 justify-self-end" />
          </div>
        ))}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3 md:hidden">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="rounded-lg border border-border bg-card p-3 shadow-sm">
            <div className="flex items-start gap-3">
              <Skeleton className="mt-1 size-5" />
              <Skeleton className="size-14 rounded-md" />
              <div className="grid min-w-0 flex-1 gap-2">
                <Skeleton className="h-5 w-4/5" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-6 w-24 rounded-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReportTableSkeleton() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2.5 sm:px-4">
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-24" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-9" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        <div className="min-w-[760px] overflow-hidden rounded-md border border-border">
          <div className="grid grid-cols-[4rem_1.2fr_1fr_1fr_1fr] gap-3 border-b border-border bg-muted/30 px-3 py-2.5">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-4" />
            ))}
          </div>
          {Array.from({ length: 10 }).map((_, rowIndex) => (
            <div key={rowIndex} className="grid grid-cols-[4rem_1.2fr_1fr_1fr_1fr] gap-3 border-b border-border/70 px-3 py-3 last:border-b-0">
              {Array.from({ length: 5 }).map((__, cellIndex) => (
                <Skeleton key={cellIndex} className="h-5" />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="shrink-0 border-t border-border px-4 py-3">
        <Skeleton className="h-9 w-full max-w-sm" />
      </div>
    </div>
  );
}

function SplitPanelSkeleton() {
  return (
    <div className="grid h-full min-h-0 min-w-0 gap-2 sm:gap-3 xl:grid-cols-[minmax(20rem,27rem)_minmax(0,1fr)]">
      <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="mt-2 h-4 w-24" />
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="border-b border-border px-4 py-3 last:border-b-0">
              <div className="flex items-start gap-3">
                <Skeleton className="size-11 rounded-md" />
                <div className="grid min-w-0 flex-1 gap-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-4 w-28" />
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-border px-4 py-3">
          <Skeleton className="h-9 w-full" />
        </div>
      </div>
      <div className="hidden min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card xl:flex">
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="grid flex-1 gap-2">
            <Skeleton className="h-6 w-40" />
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-7 w-32" />
              <Skeleton className="h-7 w-36" />
              <Skeleton className="h-7 w-28" />
            </div>
          </div>
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-3">
          <div className="overflow-hidden rounded-md border border-border">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="grid grid-cols-[52px_minmax(0,1fr)] gap-3 border-b border-border px-3 py-3 last:border-b-0">
                <Skeleton className="size-12 rounded-md" />
                <div className="grid gap-2">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="border-t border-border px-4 py-3">
          <Skeleton className="h-40 w-full rounded-md" />
        </div>
      </div>
    </div>
  );
}

export function LoadingState({ label, variant = "page" }: LoadingStateProps) {
  const { t } = useTranslation();
  const text = label ?? t("common.loading");

  if (variant === "dashboard") return <section aria-busy="true" aria-label={text}><DashboardSkeleton /></section>;
  if (variant === "table") return <section aria-busy="true" aria-label={text}><TableSkeleton /></section>;
  if (variant === "grid") return <section aria-busy="true" aria-label={text}><GridSkeleton /></section>;
  if (variant === "posGrid") return <section aria-busy="true" aria-label={text}><PosGridSkeleton /></section>;
  if (variant === "settingsTable") return <section aria-busy="true" aria-label={text} className="h-full min-h-0"><SettingsTableSkeleton /></section>;
  if (variant === "productList") return <section aria-busy="true" aria-label={text} className="h-full min-h-0"><ProductListSkeleton /></section>;
  if (variant === "reportTable") return <section aria-busy="true" aria-label={text} className="h-full min-h-0"><ReportTableSkeleton /></section>;
  if (variant === "splitPanel") return <section aria-busy="true" aria-label={text} className="h-full min-h-0"><SplitPanelSkeleton /></section>;

  return (
    <section aria-busy="true" aria-label={text} className="flex flex-col gap-5">
      <LoadingHeader />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-64 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    </section>
  );
}
