"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingState } from "@/components/common/loading-state";
import {
  DashboardChartGridFallback,
  DashboardFilterBar,
  DashboardFooter,
  DashboardHeader,
  DashboardHeroStrip,
  // DashboardQueryBar,
  ErrorBanner,
  type DashboardCopy
} from "@/features/dashboard/overview/components/dashboard-widgets";
import {
  asRow,
  branchLabel,
  createDashboardModel,
  createDefaultFilters,
  optionList,
  selectedLabel,
  text,
  type DashboardFilters
} from "@/features/dashboard/overview/dashboard-view-model";
import { useAppStore } from "@/stores/app-store";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { useBranchStore } from "@/stores/branch-store";
import { useDashboardStore } from "@/stores/dashboard-store";

const dashboardCopyKeys = [
  "accounting",
  "activeQuery",
  "amount",
  "apply",
  "available",
  "avgBill",
  "balance",
  "bestProduct",
  "branch",
  "byQty",
  "byRevenue",
  "cancelRate",
  "cancellations",
  "cash",
  "channels",
  "copied",
  "copyQuery",
  "cumulativePercent",
  "cutoff",
  "dailySales",
  "dailySalesSubtitle",
  "days",
  "debt",
  "discount",
  "discountRate",
  "driveRevenue",
  "endDate",
  "export",
  "insights",
  "lang",
  "ledger",
  "mainChannel",
  "mixed",
  "month",
  "noData",
  "occupied",
  "occupancy",
  "orderChannels",
  "orders",
  "paid",
  "pareto",
  "paretoHint",
  "paymentSplit",
  "payments",
  "products",
  "productsSold",
  "qty",
  "reportMonth",
  "reset",
  "revenue",
  "shareOfQty",
  "startDate",
  "tableLoad",
  "tables",
  "tableStatus",
  "thisMonth",
  "title",
  "top",
  "topProducts",
  "topShare",
  "totalBills",
  "trackedTotal",
  "transfer",
  "waiting",
  "warnings",
  "watchProduct",
  "year"
] as const;

function createDashboardCopy(t: (key: string) => unknown): DashboardCopy {
  return Object.fromEntries(
    dashboardCopyKeys.map((key) => [key, String(t(`dashboard.${key}`))])
  ) as DashboardCopy;
}

function filtersFromRequestParams(params: Record<string, unknown>): DashboardFilters {
  return {
    end_date: text(params.end_date, ""),
    start_date: text(params.start_date, "")
  };
}

function filtersKey(filters: DashboardFilters) {
  return [filters.start_date, filters.end_date].join("|");
}

const DashboardRevenueAccountingGrid = dynamic(
  () => import("./components/dashboard-chart-widgets").then((module) => module.DashboardRevenueAccountingGrid),
  {
    loading: () => <DashboardChartGridFallback variant="revenue" />,
    ssr: false
  }
);

const DashboardOperationsGrid = dynamic(
  () => import("./components/dashboard-chart-widgets").then((module) => module.DashboardOperationsGrid),
  {
    loading: () => <DashboardChartGridFallback variant="operations" />,
    ssr: false
  }
);

const DashboardProductsParetoGrid = dynamic(
  () => import("./components/dashboard-chart-widgets").then((module) => module.DashboardProductsParetoGrid),
  {
    loading: () => <DashboardChartGridFallback variant="products" />,
    ssr: false
  }
);

export function DashboardPage() {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const language = useAppStore((state) => state.language);
  const { data, error, loadDashboard, loading } = useDashboardStore(
    useShallow((state) => ({
      data: state.data,
      error: state.error,
      loadDashboard: state.load,
      loading: state.loading
    }))
  );
  const {
    branchError,
    branchLoading,
    branchStoreUuid,
    branches,
    loadBranches,
    selectedBranchUuid,
    setSelectedBranch
  } = useBranchStore(
    useShallow((state) => ({
      branchError: state.error,
      branchLoading: state.loading,
      branchStoreUuid: state.storeUuid,
      branches: state.branches,
      loadBranches: state.loadBranches,
      selectedBranchUuid: state.selectedBranchUuid,
      setSelectedBranch: state.setSelectedBranch
    }))
  );
  const copy = useMemo(() => createDashboardCopy(t), [t]);
  const [filters, setFilters] = useState<DashboardFilters>(() => createDefaultFilters());
  const [appliedFilters, setAppliedFilters] = useState<DashboardFilters>(() => createDefaultFilters());
  const [top, setTop] = useState("10");
  const storeUuid = authStoreUuid(user);

  const model = useMemo(() => createDashboardModel(data, appliedFilters, top), [appliedFilters, data, top]);
  const topOptions = useMemo(() => {
    const options = optionList(model.dashboard, "top");
    return options.length
      ? options
      : ["5", "10", "20", "50"].map((value) => ({ label: value, value }));
  }, [model.dashboard]);
  const activeBranchUuid = branchStoreUuid === storeUuid && selectedBranchUuid
    ? selectedBranchUuid
    : user?.branch_uuid || "";
  const branchOptions = useMemo(() => {
    const options = branches
      .map((branch) => {
        const row = asRow(branch);
        return { value: text(row.branch_uuid), label: branchLabel(row, language) };
      })
      .filter((option) => option.value !== "-");

    if (user?.branch_uuid && !options.some((option) => option.value === user.branch_uuid)) {
      options.unshift({ value: user.branch_uuid, label: user.branch_name || user.branch_uuid });
    }

    return options;
  }, [branches, language, user?.branch_name, user?.branch_uuid]);
  const activeBranchLabel = useMemo(
    () => selectedLabel(branchOptions, activeBranchUuid),
    [activeBranchUuid, branchOptions]
  );
  const periodLabel = useMemo(
    () => {
      const start = text(model.requestParams.start_date, appliedFilters.start_date);
      const end = text(model.requestParams.end_date, appliedFilters.end_date);
      if (!start && !end) return "";
      return start === end ? start : `${start} - ${end}`;
    },
    [appliedFilters.end_date, appliedFilters.start_date, model.requestParams]
  );
  const productSummary = useMemo(() => asRow(model.dashboard.product_summary), [model.dashboard]);
  const responseFilters = useMemo(() => filtersFromRequestParams(model.requestParams), [model.requestParams]);
  const responseFilterKey = filtersKey(responseFilters);

  const load = useCallback(async (targetFilters: DashboardFilters, targetTop: string) => {
    if (!activeBranchUuid) return;
    const params = {
      branch_uuid_fk: activeBranchUuid,
      end_date: targetFilters.end_date,
      lang: language,
      start_date: targetFilters.start_date,
      top: targetTop
    };

    try {
      await loadDashboard(params);
    } catch {
      // Dashboard store owns the visible error message.
    }
  }, [activeBranchUuid, language, loadDashboard]);

  const handleFilterChange = useCallback((patch: Partial<DashboardFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
  }, []);

  const handleApply = useCallback(() => {
    setAppliedFilters({ ...filters });
  }, [filters]);

  const handleReset = useCallback(() => {
    const nextFilters = createDefaultFilters();
    setFilters(nextFilters);
    setAppliedFilters(nextFilters);
  }, []);

  const handleTopChange = useCallback((value: string) => {
    setTop(value);
  }, []);

  useEffect(() => {
    if (!storeUuid) return;
    void loadBranches(storeUuid, user?.branch_uuid).catch(() => undefined);
  }, [loadBranches, storeUuid, user?.branch_uuid]);

  useEffect(() => {
    void load(appliedFilters, top);
  }, [appliedFilters, load, top]);

  useEffect(() => {
    if (!data || !responseFilterKey.replaceAll("|", "")) return;
    setFilters((current) => (filtersKey(current) === responseFilterKey ? current : responseFilters));
  }, [data, responseFilterKey, responseFilters]);

  if (loading && !data) return <LoadingState label={t("common.loading")} variant="dashboard" />;

  return (
    <div className="dashboard-screen flex flex-col gap-4">
      <DashboardHeader activeBranchLabel={activeBranchLabel} copy={copy} filtersMeta={model.filters} section={model.section} />
      <DashboardFilterBar
        activeBranchUuid={activeBranchUuid}
        branchLoading={branchLoading}
        branchOptions={branchOptions}
        copy={copy}
        filters={filters}
        loading={loading}
        onApply={handleApply}
        onBranchChange={setSelectedBranch}
        onFilterChange={handleFilterChange}
        onReset={handleReset}
      />
      {/* <DashboardQueryBar activeBranchUuid={activeBranchUuid} copy={copy} requestParams={model.requestParams} /> */}

      {branchError ? <ErrorBanner message={branchError} /> : null}
      {error ? <ErrorBanner message={error} /> : null}

      {!data && !loading ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">{copy.noData}</CardContent>
        </Card>
      ) : null}

      <DashboardHeroStrip copy={copy} kpis={model.kpis} periodLabel={periodLabel} section={model.section} trendRows={model.trendRows} />
      <DashboardRevenueAccountingGrid
        accountingRows={model.accountingRows}
        copy={copy}
        paymentRows={model.paymentRows}
        paymentTrendRows={model.paymentTrendRows}
        trendRows={model.trendRows}
      />
      <DashboardOperationsGrid
        channelRows={model.channelRows}
        copy={copy}
        insights={model.insights}
        productSummary={productSummary}
        tableSummary={model.tableSummary}
      />
      <DashboardProductsParetoGrid
        copy={copy}
        loading={loading}
        products={model.productRows}
        top={top}
        topOptions={topOptions}
        onTopChange={handleTopChange}
      />
      <DashboardFooter activeBranchUuid={activeBranchUuid} copy={copy} filtersMeta={model.filters} requestParams={model.requestParams} />
    </div>
  );
}
