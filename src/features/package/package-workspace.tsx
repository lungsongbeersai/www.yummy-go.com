"use client";

import { PackageOpen, RefreshCw, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AppPagination } from "@/components/common/app-pagination";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { PackageCard } from "@/features/package/package-card";
import {
  PackageDesktopNavigator,
  PackageMobileNavigator,
} from "@/features/package/package-navigator";
import type { PackageStatusFilter } from "@/features/package/package-toolbar";
import type { Language } from "@/lib/language";
import type {
  BillingCycle,
  PackageDetail,
  PackageItem,
  PackagePlan,
  PackagePlanGroup,
} from "@/services/package";
import type { PackageSortingScope } from "@/stores/package-store";

interface PackageWorkspaceProps {
  billingCycles: BillingCycle[];
  catalogReady: boolean;
  language: Language;
  loadError: string | null;
  loading: boolean;
  packages: PackageItem[];
  page: number;
  planGroups: PackagePlanGroup[];
  rangeEnd: number;
  rangeStart: number;
  refreshing: boolean;
  search: string;
  selectedCycleId: string;
  selectedCycleName: string;
  selectedPlan: PackagePlan | null;
  sortingScope: PackageSortingScope;
  status: PackageStatusFilter;
  total: number;
  totalPages: number;
  onAddPackage?: () => void;
  onAddPlan?: () => void;
  onEditPackage?: (item: PackageItem) => void;
  onPageChange: (page: number) => void;
  onReorderCycles: (cycles: BillingCycle[]) => void;
  onReorderDetails: (
    packageId: string,
    details: PackageDetail[],
  ) => void;
  onReorderPlans: (cycleId: string, plans: PackagePlan[]) => void;
  onRetry: () => void;
  onSelectCycle: (cycleId: string) => void;
  onSelectPlan: (planId: string) => void;
}

export function PackageWorkspace({
  billingCycles,
  catalogReady,
  language,
  loadError,
  loading,
  packages,
  page,
  planGroups,
  rangeEnd,
  rangeStart,
  refreshing,
  search,
  selectedCycleId,
  selectedCycleName,
  selectedPlan,
  sortingScope,
  status,
  total,
  totalPages,
  onAddPackage,
  onAddPlan,
  onEditPackage,
  onPageChange,
  onReorderCycles,
  onReorderDetails,
  onReorderPlans,
  onRetry,
  onSelectCycle,
  onSelectPlan,
}: PackageWorkspaceProps) {
  const { t } = useTranslation();
  const blockingLoadError = Boolean(loadError && !catalogReady);
  const initialLoading = !catalogReady && !loadError;
  const navigatorProps = {
    billingCycles,
    planGroups,
    selectedCycleId,
    selectedPlanId: selectedPlan?.id ?? "",
    sortingScope,
    onAddPlan,
    onReorderCycles,
    onReorderPlans,
    onSelectCycle,
    onSelectPlan,
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {blockingLoadError ? null : (
        <div className="shrink-0 border-b border-border bg-card/80 lg:hidden">
          {initialLoading ? (
            <MobileNavigatorSkeleton />
          ) : (
            <PackageMobileNavigator {...navigatorProps} />
          )}
        </div>
      )}

      {loadError ? (
        <div className="shrink-0 px-3 pt-3 sm:px-4 lg:px-5">
          <Alert variant="destructive">
            <TriangleAlert aria-hidden="true" />
            <AlertTitle>{t("packageManagement.loadFailed")}</AlertTitle>
            <AlertDescription>
              <p>{loadError}</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-11 sm:h-8"
                disabled={loading || refreshing}
                onClick={onRetry}
              >
                {loading || refreshing ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <RefreshCw data-icon="inline-start" />
                )}
                {t("actions.tryAgain")}
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      ) : null}

      {refreshing ? (
        <div
          className="flex shrink-0 items-center gap-2 px-4 py-2 text-xs font-medium text-muted-foreground lg:px-5"
          role="status"
        >
          <Spinner aria-hidden="true" />
          {t("packageManagement.refreshing")}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain touch-pan-y">
        {initialLoading ? (
          <WorkspaceSkeleton />
        ) : blockingLoadError ? null : (
          <div className="min-h-full lg:grid lg:grid-cols-[21rem_minmax(0,1fr)]">
            <PackageDesktopNavigator {...navigatorProps} />

            <main className="min-w-0 p-3 sm:p-4 lg:p-5">
              <div className="mb-4 flex min-w-0 flex-wrap items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-muted-foreground">
                    {t("packageManagement.plan")}
                  </p>
                  <h2 className="mt-1 truncate text-xl font-black tracking-tight text-foreground">
                    {selectedCycleName || t("packageManagement.billingCycle")}
                    {selectedPlan ? ` · ${selectedPlan.methodName}` : ""}
                  </h2>
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="h-11 sm:h-8"
                  disabled={!selectedPlan || !onAddPackage}
                  onClick={onAddPackage}
                >
                  <PackageOpen data-icon="inline-start" />
                  {t("packageManagement.addPackage")}
                </Button>
              </div>

              {packages.length ? (
                <div className="grid min-w-0 grid-cols-1 gap-4 2xl:grid-cols-2">
                  {packages.map((item) => (
                    <PackageCard
                      key={item.id}
                      item={item}
                      language={language}
                      reorderDisabled={sortingScope !== null}
                      sorting={sortingScope === `details:${item.id}`}
                      onEdit={onEditPackage}
                      onReorderDetails={(details) =>
                        onReorderDetails(item.id, details)
                      }
                    />
                  ))}
                </div>
              ) : (
                <PackageEmptyState
                  filtered={Boolean(search.trim()) || status !== "all"}
                  scoped={total > 0}
                  canAdd={Boolean(selectedPlan && onAddPackage)}
                  onAddPackage={onAddPackage}
                />
              )}
            </main>
          </div>
        )}
      </div>

      {catalogReady ? (
        <footer className="w-full shrink-0 border-t border-border bg-card px-3 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-4 lg:px-5">
          <AppPagination
            compact
            className="w-full"
            disabled={loading || refreshing}
            page={page}
            rangeLabel={t("packageManagement.range", {
              start: rangeStart,
              end: rangeEnd,
              total,
            })}
            totalPages={totalPages}
            onPageChange={onPageChange}
          />
        </footer>
      ) : null}
    </section>
  );
}

function PackageEmptyState({
  canAdd,
  filtered,
  scoped,
  onAddPackage,
}: {
  canAdd: boolean;
  filtered: boolean;
  scoped: boolean;
  onAddPackage?: () => void;
}) {
  const { t } = useTranslation();
  const title = scoped
    ? t("packageManagement.scopedEmptyTitle")
    : filtered
      ? t("packageManagement.noResultsTitle")
      : t("packageManagement.emptyTitle");
  const description = scoped
    ? t("packageManagement.scopedEmptyDescription")
    : filtered
      ? t("packageManagement.noResultsDescription")
      : t("packageManagement.emptyDescription");

  return (
    <Empty className="min-h-72 border border-border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <PackageOpen aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {canAdd ? (
        <EmptyContent>
          <Button type="button" className="h-11 sm:h-10" onClick={onAddPackage}>
            <PackageOpen data-icon="inline-start" />
            {t("packageManagement.addPackage")}
          </Button>
        </EmptyContent>
      ) : null}
    </Empty>
  );
}

function MobileNavigatorSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 sm:p-4">
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-11 w-full" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-11 w-full" />
      </div>
    </div>
  );
}

function WorkspaceSkeleton() {
  return (
    <div className="min-h-full lg:grid lg:grid-cols-[21rem_minmax(0,1fr)]">
      <div className="hidden border-r border-border bg-card/60 p-4 lg:flex lg:flex-col lg:gap-3">
        <Skeleton className="h-4 w-32" />
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-28 w-full" />
        ))}
      </div>
      <div className="p-3 sm:p-4 lg:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-52" />
          </div>
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => (
            <div
              key={index}
              className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"
            >
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-7 w-32" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
