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
  DashboardPaymentSummaryStrip,
  // DashboardQueryBar,
  ErrorBanner,
  type DashboardCopy,
} from "@/features/dashboard/overview/components/dashboard-widgets";
import {
  applyPeriodMonth,
  applyPeriodType,
  applyPeriodYear,
  asRow,
  branchLabel,
  createDashboardModel,
  createDefaultFilters,
  DASHBOARD_PERIOD_TYPES,
  optionList,
  text,
  yearSelectOptions,
  type DashboardFilters,
  type DashboardPeriodType,
  type SelectOption,
} from "@/features/dashboard/overview/dashboard-view-model";
import { useAppStore } from "@/stores/app-store";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { useBranchStore } from "@/stores/branch-store";
import { useDashboardStore } from "@/stores/dashboard-store";
import { useResetOnDeps } from "@/hooks/use-reset-on-change";

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
  "collectionRate",
  "copied",
  "copyQuery",
  "cumulativePercent",
  "cutoff",
  "daily",
  "dailySales",
  "dailySalesSubtitle",
  "days",
  "debt",
  "discount",
  "discountRate",
  "driveRevenue",
  "endDate",
  "export",
  "highestRevenueProduct",
  "insights",
  "lang",
  "ledger",
  "mainChannel",
  "mixed",
  "mixedPayment",
  "month",
  "monthly",
  "noData",
  "occupied",
  "occupancy",
  "orderChannels",
  "orderShare",
  "orders",
  "paid",
  "paidTotal",
  "pareto",
  "paretoHint",
  "paymentSplitWarning",
  "paymentSplit",
  "payments",
  "peakDay",
  "periodType",
  "products",
  "productsSold",
  "qty",
  "reportMonth",
  "reset",
  "revenue",
  "revenueShare",
  "shareOfQty",
  "startDate",
  "serviceCharge",
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
  "unallocatedMixedPayment",
  "unpaidRate",
  "vat",
  "waiting",
  "warnings",
  "watchProduct",
  "year",
  "yearly",
] as const;

function createDashboardCopy(t: (key: string) => unknown): DashboardCopy {
  return Object.fromEntries(
    dashboardCopyKeys.map((key) => [key, String(t(`dashboard.${key}`))]),
  ) as DashboardCopy;
}

function filtersFromRequestParams(
  params: Record<string, unknown>,
): Pick<DashboardFilters, "end_date" | "start_date"> {
  return {
    end_date: text(params.end_date, ""),
    start_date: text(params.start_date, ""),
  };
}

function filtersKey(filters: Pick<DashboardFilters, "end_date" | "start_date">) {
  return [filters.start_date, filters.end_date].join("|");
}

const DashboardRevenueAccountingGrid = dynamic(
  () =>
    import("./components/dashboard-chart-widgets").then(
      (module) => module.DashboardRevenueAccountingGrid,
    ),
  {
    loading: () => <DashboardChartGridFallback variant="revenue" />,
    ssr: false,
  },
);

const DashboardOperationsGrid = dynamic(
  () =>
    import("./components/dashboard-chart-widgets").then(
      (module) => module.DashboardOperationsGrid,
    ),
  {
    loading: () => <DashboardChartGridFallback variant="operations" />,
    ssr: false,
  },
);

const DashboardProductsParetoGrid = dynamic(
  () =>
    import("./components/dashboard-chart-widgets").then(
      (module) => module.DashboardProductsParetoGrid,
    ),
  {
    loading: () => <DashboardChartGridFallback variant="products" />,
    ssr: false,
  },
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
      loading: state.loading,
    })),
  );
  const {
    branchError,
    branchLoading,
    branchStoreUuid,
    branches,
    loadBranches,
    selectedBranchUuid,
    setSelectedBranch,
  } = useBranchStore(
    useShallow((state) => ({
      branchError: state.error,
      branchLoading: state.loading,
      branchStoreUuid: state.storeUuid,
      branches: state.branches,
      loadBranches: state.loadBranches,
      selectedBranchUuid: state.selectedBranchUuid,
      setSelectedBranch: state.setSelectedBranch,
    })),
  );
  const copy = useMemo(() => createDashboardCopy(t), [t]);
  const [filters, setFilters] = useState<DashboardFilters>(() =>
    createDefaultFilters(),
  );
  const [appliedFilters, setAppliedFilters] = useState<DashboardFilters>(() =>
    createDefaultFilters(),
  );
  const [top, setTop] = useState("10");
  const storeUuid = authStoreUuid(user);

  const model = useMemo(
    () => createDashboardModel(data, appliedFilters, top),
    [appliedFilters, data, top],
  );
  const topOptions = useMemo(() => {
    const options = optionList(model.dashboard, "top");
    return options.length
      ? options
      : ["5", "10", "20", "50"].map((value) => ({ label: value, value }));
  }, [model.dashboard]);
  const periodTypeOptions = useMemo<SelectOption[]>(
    () => DASHBOARD_PERIOD_TYPES.map((value) => ({ label: copy[value], value })),
    [copy],
  );
  const monthOptions = useMemo<SelectOption[]>(() => {
    const months = t("dashboard.months", { returnObjects: true });
    const monthNames = Array.isArray(months) ? (months as string[]) : [];
    return Array.from({ length: 12 }, (_, index) => ({
      label: monthNames[index] ?? String(index + 1),
      value: String(index + 1),
    }));
  }, [t]);
  const yearOptions = useMemo<SelectOption[]>(
    () => yearSelectOptions(new Date().getFullYear()),
    [],
  );
  // แยกฟิลด์ของ user ออกมาเป็นค่า string ก่อนเข้า useMemo เพราะ React Compiler
  // จะ infer dependency เป็น `user` ทั้งก้อน (กว้างกว่าที่ระบุไว้เอง) แล้วยกเลิกการ memo ทิ้ง
  const userBranchUuid = user?.branch_uuid ?? "";
  const userBranchName = user?.branch_name ?? "";
  const activeBranchUuid =
    branchStoreUuid === storeUuid && selectedBranchUuid
      ? selectedBranchUuid
      : userBranchUuid;
  const branchOptions = useMemo(() => {
    const options = branches
      .map((branch) => {
        const row = asRow(branch);
        return {
          value: text(row.branch_uuid),
          label: branchLabel(row, language),
        };
      })
      .filter((option) => option.value !== "-");

    if (
      userBranchUuid &&
      !options.some((option) => option.value === userBranchUuid)
    ) {
      options.unshift({
        value: userBranchUuid,
        label: userBranchName || userBranchUuid,
      });
    }

    return options;
  }, [branches, language, userBranchName, userBranchUuid]);
  const periodLabel = useMemo(() => {
    const start = text(
      model.requestParams.start_date,
      appliedFilters.start_date,
    );
    const end = text(model.requestParams.end_date, appliedFilters.end_date);
    if (!start && !end) return "";
    return start === end ? start : `${start} - ${end}`;
  }, [appliedFilters.end_date, appliedFilters.start_date, model.requestParams]);
  const productSummary = useMemo(
    () => asRow(model.dashboard.product_summary),
    [model.dashboard],
  );
  const responseFilters = useMemo(
    () => filtersFromRequestParams(model.requestParams),
    [model.requestParams],
  );
  const responseFilterKey = filtersKey(responseFilters);

  const load = useCallback(
    async (targetFilters: DashboardFilters, targetTop: string) => {
      if (!activeBranchUuid) return;
      const params = {
        branch_uuid_fk: activeBranchUuid,
        end_date: targetFilters.end_date,
        lang: language,
        start_date: targetFilters.start_date,
        top: targetTop,
      };

      try {
        await loadDashboard(params);
      } catch {
        // Dashboard store owns the visible error message.
      }
    },
    [activeBranchUuid, language, loadDashboard],
  );

  const handleFilterChange = useCallback((patch: Partial<DashboardFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
  }, []);

  const handlePeriodTypeChange = useCallback((value: string) => {
    setFilters((current) => applyPeriodType(current, value as DashboardPeriodType));
  }, []);

  const handlePeriodYearChange = useCallback((value: string) => {
    setFilters((current) => applyPeriodYear(current, Number(value)));
  }, []);

  const handlePeriodMonthChange = useCallback((value: string) => {
    setFilters((current) => applyPeriodMonth(current, Number(value)));
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

  // ซิงก์ช่องกรองในฟอร์มกลับมาตรงกับช่วงวันที่ที่ backend ใช้จริง (request_params)
  // ทำระหว่าง render แทน effect เพื่อไม่ให้ผู้ใช้เห็นวันที่เดิมแวบหนึ่งก่อนถูกแก้
  // ยังคง dependency ชุดเดิม [data, responseFilterKey, responseFilters] เพื่อให้จังหวะ
  // การซิงก์เหมือน effect เดิมทุกกรณี (เช่น refetch จากการเปลี่ยน top/ภาษา)
  useResetOnDeps([data, responseFilterKey, responseFilters], () => {
    if (!data || !responseFilterKey.replaceAll("|", "")) return;
    setFilters((current) =>
      filtersKey(current) === responseFilterKey
        ? current
        : { ...current, ...responseFilters },
    );
  });

  if (loading && !data)
    return <LoadingState label={t("common.loading")} variant="dashboard" />;

  return (
    <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-4 tabular-nums max-xl:max-w-full">
      <DashboardHeader
        copy={copy}
        filtersMeta={model.filters}
        section={model.section}
      />
      <div className="lg:sticky lg:z-[35] lg:top-[calc(var(--app-shell-header-height)+0.75rem)]">
        <DashboardFilterBar
          activeBranchUuid={activeBranchUuid}
          branchLoading={branchLoading}
          branchOptions={branchOptions}
          copy={copy}
          filters={filters}
          loading={loading}
          monthOptions={monthOptions}
          onApply={handleApply}
          onBranchChange={setSelectedBranch}
          onFilterChange={handleFilterChange}
          onPeriodMonthChange={handlePeriodMonthChange}
          onPeriodTypeChange={handlePeriodTypeChange}
          onPeriodYearChange={handlePeriodYearChange}
          onReset={handleReset}
          periodTypeOptions={periodTypeOptions}
          yearOptions={yearOptions}
        />
      </div>
      <DashboardPaymentSummaryStrip
        cards={model.paymentSummaryCards}
        copy={copy}
        paymentSummary={model.paymentSummary}
        warnings={model.warnings}
      />
      {/* <DashboardQueryBar activeBranchUuid={activeBranchUuid} copy={copy} requestParams={model.requestParams} /> */}

      {branchError ? <ErrorBanner message={branchError} /> : null}
      {error ? <ErrorBanner message={error} /> : null}

      {!data && !loading ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            {copy.noData}
          </CardContent>
        </Card>
      ) : null}

      <DashboardHeroStrip
        copy={copy}
        kpis={model.kpis}
        periodLabel={periodLabel}
        section={model.section}
        trendRows={model.trendRows}
      />
      <DashboardRevenueAccountingGrid
        accountingRows={model.accountingRows}
        copy={copy}
        paymentRows={model.paymentRows}
        paymentTrendRows={model.paymentTrendRows}
        peakRevenueDay={model.peakRevenueDay}
        trendRows={model.trendRows}
      />
      <DashboardOperationsGrid
        channelRows={model.channelRows}
        copy={copy}
        highestRevenueProduct={model.highestRevenueProduct}
        insights={model.insights}
        mainOrderChannel={model.mainOrderChannel}
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
      <DashboardFooter
        activeBranchUuid={activeBranchUuid}
        copy={copy}
        filtersMeta={model.filters}
        requestParams={model.requestParams}
      />
    </div>
  );
}
