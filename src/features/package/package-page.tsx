"use client";

import { useEffect, useMemo, useState } from "react";
import { PackageCog } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PackageToolbar, type PackageStatusFilter } from "@/features/package/package-toolbar";
import {
  activePackageNavigation,
  firstPlanId,
  packageRange,
  packagesForPlan,
  planById,
} from "@/features/package/package-ui-utils";
import { PackageWorkspace } from "@/features/package/package-workspace";
import { useUrlPagination } from "@/hooks/use-url-pagination";
import type { UrlPaginationState } from "@/lib/url-pagination";
import type {
  BillingCycle,
  PackageDetail,
  PackagePlan,
} from "@/services/package";
import { useAppStore } from "@/stores/app-store";
import {
  usePackageStore,
  type PackageQuery,
} from "@/stores/package-store";
import { errorMessage } from "@/stores/store-utils";
import { useToastStore } from "@/stores/toast-store";

const PACKAGE_PAGE_LIMIT_OPTIONS = [10, 20, 50];

export function PackagePage({
  initialPagination,
}: {
  initialPagination: UrlPaginationState;
}) {
  const { t } = useTranslation();
  const language = useAppStore((state) => state.language);
  const billingCycles = usePackageStore((state) => state.billingCycles);
  const planGroups = usePackageStore((state) => state.planGroups);
  const packageGroups = usePackageStore((state) => state.packageGroups);
  const responsePage = usePackageStore((state) => state.page);
  const responseLimit = usePackageStore((state) => state.limit);
  const total = usePackageStore((state) => state.total);
  const totalPages = usePackageStore((state) => state.totalPages);
  const catalogReady = usePackageStore((state) => state.catalogReady);
  const loading = usePackageStore((state) => state.loading);
  const refreshing = usePackageStore((state) => state.refreshing);
  const sortingScope = usePackageStore((state) => state.sortingScope);
  const loadError = usePackageStore((state) => state.loadError);
  const loadCatalog = usePackageStore((state) => state.loadCatalog);
  const sortCycles = usePackageStore((state) => state.sortCycles);
  const sortPlans = usePackageStore((state) => state.sortPlans);
  const sortDetails = usePackageStore((state) => state.sortDetails);
  const showToast = useToastStore((state) => state.show);
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<PackageStatusFilter>("all");
  const [selectedCycleId, setSelectedCycleId] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const {
    goToPage,
    limit: requestedLimit,
    page: requestedPage,
    resetPage,
  } = useUrlPagination({
    defaultLimit: 10,
    initialPagination,
    limitOptions: PACKAGE_PAGE_LIMIT_OPTIONS,
  });
  const pageLimit = typeof requestedLimit === "number" ? requestedLimit : 10;
  const queryStatus =
    status === "1" ? 1 : status === "2" ? 2 : ("all" as const);
  const query = useMemo<PackageQuery>(
    () => ({
      language,
      limit: pageLimit,
      orderBy: "asc",
      page: requestedPage,
      search,
      status: queryStatus,
    }),
    [language, pageLimit, queryStatus, requestedPage, search],
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setSearch(searchDraft.trim()), 300);
    return () => window.clearTimeout(timeoutId);
  }, [searchDraft]);

  useEffect(() => {
    let active = true;
    const background = usePackageStore.getState().catalogReady;

    void loadCatalog(query, { background })
      .then(() => {
        if (!active) return;
        const loadedTotalPages = Math.max(
          1,
          usePackageStore.getState().totalPages,
        );
        if (requestedPage > loadedTotalPages) goToPage(loadedTotalPages);
      })
      .catch(() => {
        // The store owns load errors for UI retries and internal refreshes.
      });

    return () => {
      active = false;
    };
  }, [goToPage, loadCatalog, query, requestedPage]);

  const navigation = useMemo(
    () =>
      activePackageNavigation(
        billingCycles,
        planGroups,
        selectedCycleId,
        selectedPlanId,
      ),
    [billingCycles, planGroups, selectedCycleId, selectedPlanId],
  );
  const selectedPlan = useMemo(
    () => planById(navigation.planGroups, navigation.planId),
    [navigation.planGroups, navigation.planId],
  );
  const selectedCycleName =
    navigation.billingCycles.find(
      (cycle) => cycle.id === navigation.cycleId,
    )?.name ??
    navigation.planGroups.find(
      (group) => group.billingCycleId === navigation.cycleId,
    )?.billingCycleName ??
    "";

  useEffect(() => {
    if (selectedCycleId !== navigation.cycleId) {
      setSelectedCycleId(navigation.cycleId);
    }
    if (selectedPlanId !== navigation.planId) {
      setSelectedPlanId(navigation.planId);
    }
  }, [
    navigation.cycleId,
    navigation.planId,
    selectedCycleId,
    selectedPlanId,
  ]);

  const visiblePackages = useMemo(
    () =>
      selectedPlan
        ? packagesForPlan(packageGroups, selectedPlan.id)
        : [],
    [packageGroups, selectedPlan],
  );
  const currentPageRowCount = useMemo(
    () =>
      packageGroups
        .flatMap((group) => group.methods)
        .flatMap((method) => method.packages).length,
    [packageGroups],
  );
  const range = packageRange(
    responsePage,
    responseLimit,
    total,
    currentPageRowCount,
  );

  function changeSearch(value: string) {
    if (value === searchDraft) return;
    setSearchDraft(value);
    resetPage();
  }

  function changeStatus(value: PackageStatusFilter) {
    if (value === status) return;
    setStatus(value);
    resetPage();
  }

  function selectCycle(cycleId: string) {
    setSelectedCycleId(cycleId);
    const group =
      navigation.planGroups.find(
        (item) => item.billingCycleId === cycleId,
      ) ?? null;
    setSelectedPlanId(group ? firstPlanId([group]) : "");
  }

  function selectPlan(planId: string) {
    const plan = planById(navigation.planGroups, planId);
    if (!plan) return;
    setSelectedCycleId(plan.billingCycleId);
    setSelectedPlanId(plan.id);
  }

  async function refresh() {
    try {
      await loadCatalog(query, { background: catalogReady });
    } catch (refreshError) {
      showToast({
        title: t("packageManagement.refreshFailed"),
        description: errorMessage(refreshError),
        tone: "error",
      });
    }
  }

  function reorderCycles(cycles: BillingCycle[]) {
    void sortCycles(cycles, query)
      .then(() => showReorderSuccess())
      .catch((reorderError) => showReorderError(reorderError));
  }

  function reorderPlans(cycleId: string, plans: PackagePlan[]) {
    void sortPlans(cycleId, plans, query)
      .then(() => showReorderSuccess())
      .catch((reorderError) => showReorderError(reorderError));
  }

  function reorderDetails(packageId: string, details: PackageDetail[]) {
    void sortDetails(packageId, details, query)
      .then(() => showReorderSuccess())
      .catch((reorderError) => showReorderError(reorderError));
  }

  function showReorderSuccess() {
    showToast({
      title: t("packageManagement.reorderSaved"),
      tone: "success",
    });
  }

  function showReorderError(reorderError: unknown) {
    showToast({
      title: t("packageManagement.reorderFailed"),
      description: errorMessage(reorderError),
      tone: "error",
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <header className="shrink-0 border-b border-border bg-card">
        <div className="flex min-w-0 flex-col gap-3 px-3 py-3 sm:px-4 lg:flex-row lg:items-center lg:justify-between lg:px-5">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <PackageCog
                className="shrink-0 text-primary"
                aria-hidden="true"
              />
              <h1 className="truncate text-lg font-black tracking-tight text-foreground">
                {t("packageManagement.title")}
              </h1>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
              {t("packageManagement.description")}
            </p>
          </div>

          <PackageToolbar
            canAddPackage={Boolean(selectedPlan)}
            refreshing={loading || refreshing}
            search={searchDraft}
            status={status}
            onRefresh={() => void refresh()}
            onSearchChange={changeSearch}
            onStatusChange={changeStatus}
          />
        </div>
      </header>

      <PackageWorkspace
        billingCycles={navigation.billingCycles}
        catalogReady={catalogReady}
        language={language}
        loadError={loadError}
        loading={loading}
        packages={visiblePackages}
        page={responsePage}
        planGroups={navigation.planGroups}
        rangeEnd={range.end}
        rangeStart={range.start}
        refreshing={refreshing}
        search={search}
        selectedCycleId={navigation.cycleId}
        selectedCycleName={selectedCycleName}
        selectedPlan={selectedPlan}
        sortingScope={sortingScope}
        status={status}
        total={total}
        totalPages={Math.max(1, totalPages)}
        onPageChange={goToPage}
        onReorderCycles={reorderCycles}
        onReorderDetails={reorderDetails}
        onReorderPlans={reorderPlans}
        onRetry={() => void refresh()}
        onSelectCycle={selectCycle}
        onSelectPlan={selectPlan}
      />
    </div>
  );
}
