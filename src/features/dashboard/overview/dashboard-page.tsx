"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Lock, RefreshCw } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { menuGrantsPath } from "@/components/layout/shell-menu-helpers";
import { useSidebarPermissionAccess } from "@/hooks/use-sidebar-permission-access";
import { useVisualEffectsTier } from "@/hooks/use-visual-effects-tier";
import { cn } from "@/lib/utils";
import {
  DashboardAlerts,
  DashboardDetailFallback,
  DashboardFilterBar,
  DashboardHeader,
  DashboardHeroRow,
  DashboardPageSkeleton,
} from "@/features/dashboard/overview/components/dashboard-widgets";
import {
  applyPeriodMonth,
  applyPeriodMonthEnd,
  applyPeriodType,
  applyPeriodYear,
  applyPeriodYearEnd,
  asRow,
  branchLabel,
  createDashboardModel,
  createDefaultFilters,
  DASHBOARD_PERIOD_TYPES,
  optionList,
  skylineColumns,
  sparklineValues,
  text,
  yearSelectOptions,
  type DashboardCopy,
  type DashboardFilters,
  type DashboardPeriodType,
  type SelectOption,
} from "@/features/dashboard/overview/dashboard-view-model";
import { useAppStore } from "@/stores/app-store";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { useBranchStore } from "@/stores/branch-store";
import { useDashboardStore } from "@/stores/dashboard-store";
import { usePermissionsSidebarStore } from "@/stores/permissions-sidebar-store";
import { useResetOnDeps } from "@/hooks/use-reset-on-change";

const dashboardCopyKeys = [
  "accounting",
  "apply",
  "available",
  "avgBill",
  "balance",
  "bestProduct",
  "billCount",
  "billUnit",
  "branch",
  "byQty",
  "byRevenue",
  "cancelRate",
  "cancellations",
  "cash",
  "channels",
  "collectionRate",
  "cumulativePercent",
  "daily",
  "dailyAverage",
  "dailySales",
  "dailySalesSubtitle",
  "dailyTable",
  "days",
  "debt",
  "discount",
  "discountRate",
  "driveRevenue",
  "endDate",
  "highestRevenueProduct",
  "insights",
  "ledger",
  "mainChannel",
  "mixedPayment",
  "monthFrom",
  "monthTo",
  "monthly",
  "monthlyTotals",
  "noData",
  "now",
  "occupancy",
  "occupied",
  "orderChannels",
  "orderShare",
  "orders",
  "paidTotal",
  "paymentSplitWarning",
  "peakDay",
  "periodType",
  "products",
  "productsSold",
  "qty",
  "refresh",
  "retry",
  "revenue",
  "revenueShare",
  "shareOfQty",
  "singleDayHint",
  "startDate",
  "tableLoad",
  "tableStatus",
  "thisMonth",
  "title",
  "today",
  "top",
  "topProducts",
  "totalBills",
  "trackedTotal",
  "transfer",
  "unallocatedMixedPayment",
  "unappliedChanges",
  "waiting",
  "warnings",
  "watchProduct",
  "weeklyTotals",
  "year",
  "yearFrom",
  "yearTo",
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

// What the user has picked, as opposed to filtersKey (dates only) which matches responses.
function scopeKey(filters: Pick<DashboardFilters, "end_date" | "periodType" | "start_date">) {
  return [filters.periodType, filters.start_date, filters.end_date].join("|");
}

function rangeLabel(start: string, end: string) {
  if (!start && !end) return "";
  return start === end ? start : `${start} – ${end}`;
}

const DashboardSalesRow = dynamic(
  () => import("./components/dashboard-detail-widgets").then((module) => module.DashboardSalesRow),
  { loading: () => <DashboardDetailFallback variant="sales" />, ssr: false },
);

const DashboardProductsRow = dynamic(
  () => import("./components/dashboard-detail-widgets").then((module) => module.DashboardProductsRow),
  { loading: () => <DashboardDetailFallback variant="products" />, ssr: false },
);

// Dashboard ("/") ก็เป็นแค่ MenuItem ตัวหนึ่งที่แอดมินให้สิทธิ์ได้เหมือนเมนูอื่น (ผ่านจัดการเมนู/
// จัดการสิทธิ์เข้าถึง) ไม่ใช่หน้าที่เข้าได้เสมอ — ถ้า role ปัจจุบันไม่ถูกให้สิทธิ์ ต้องไม่ยิง
// loadDashboard/loadBranches เลย (ข้อมูลยอดขายจริงรั่วออกไปทาง network response ได้แม้จะเบลอ
// ด้วย CSS ก็ตาม) จึงกันไว้ตั้งแต่ระดับ mount component ไม่ใช่แค่ conditional ใน effect
export function DashboardPage() {
  const { t } = useTranslation();
  const sidebarError = usePermissionsSidebarStore((state) => state.error);
  const { keyMatches, loading: permissionLoading, menuItems } = useSidebarPermissionAccess();

  if (permissionLoading) {
    return <DashboardPageSkeleton label={t("common.loading")} />;
  }

  const permissionError = keyMatches ? sidebarError : null;
  const hasAccess = !permissionError && menuGrantsPath(menuItems, "/");

  if (!hasAccess) return <DashboardAccessRestricted />;

  return <DashboardPageContent />;
}

// เลี่ยง scroll เพิ่ม: /  (dashboardScreen) ไม่ได้ตัด overflow ไว้ให้แบบหน้าอื่น (ปกติ Dashboard
// จริงยาวเกินจอได้ตามดีไซน์) ส่วนนี้เนื้อหามีแค่การ์ดข้อความสั้น ๆ จึงต้องกำหนดความสูงให้พอดี
// กับพื้นที่ที่เหลือใต้ header เอง (คำนวณจาก --app-shell-header-height เดียวกับที่ AppShell ใช้)
// ไม่ใช้ skeleton เต็มหน้าแบบ DashboardPageSkeleton เพราะสูงเกินพื้นที่ที่มีจริง
// vh ก่อนแล้วค่อยเป็น dvh เมื่อรองรับ: WebView 101 ของ Swan 1 ไม่รู้จัก dvh เลย
function DashboardAccessRestricted() {
  const { t } = useTranslation();

  return (
    <div className="mx-auto flex h-[calc(100vh-var(--app-shell-header-height)-2rem)] w-full max-w-3xl items-center justify-center overflow-hidden supports-[height:100dvh]:h-[calc(100dvh-var(--app-shell-header-height)-2rem)] lg:h-[calc(100vh-var(--app-shell-header-height)-3rem)] lg:supports-[height:100dvh]:h-[calc(100dvh-var(--app-shell-header-height)-3rem)]">
      <Card className="w-full max-w-sm border-border/80 text-center shadow-lg">
        <CardContent className="flex flex-col items-center gap-3 p-8">
          <div className="flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <Lock aria-hidden="true" className="size-7" />
          </div>
          <p className="text-base font-bold text-foreground">
            {t("dashboard.accessRestrictedTitle")}
          </p>
          <p className="text-sm text-muted-foreground">
            {t("dashboard.accessRestrictedDescription")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function DashboardPageContent() {
  const { t } = useTranslation();
  const tier = useVisualEffectsTier();
  const user = useAuthStore((state) => state.user);
  const language = useAppStore((state) => state.language);
  const { data, error, loadDashboard, loadedParams, loading } = useDashboardStore(
    useShallow((state) => ({
      data: state.data,
      error: state.error,
      loadDashboard: state.load,
      loadedParams: state.loadedParams,
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
  // Tracks whether the filters are still exactly the untouched "today" default
  // this page creates on mount/reset, vs. a range the user picked by hand (a
  // specific past day, a month, a custom range). Only the untouched default is
  // safe for the business-day-rollover effect below to replace on its own —
  // otherwise it would silently discard a range someone is deliberately
  // reviewing the moment the calendar day turns over underneath them.
  const isAutoTodayRef = useRef(true);

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
  const activeBranchLabel =
    branchOptions.find((option) => option.value === activeBranchUuid)?.label ?? "";
  const periodLabel = useMemo(
    () =>
      rangeLabel(
        text(model.requestParams.start_date, appliedFilters.start_date),
        text(model.requestParams.end_date, appliedFilters.end_date),
      ),
    [appliedFilters.end_date, appliedFilters.start_date, model.requestParams],
  );
  const productSummary = useMemo(
    () => asRow(model.dashboard.product_summary),
    [model.dashboard],
  );
  const responseFilters = useMemo(
    () => filtersFromRequestParams(model.requestParams),
    [model.requestParams],
  );
  const responseFilterKey = filtersKey(responseFilters);
  const skyline = useMemo(
    () => skylineColumns(model.trendRows, model.paymentTrendRows, model.peakRevenueDay?.date ?? null),
    [model.paymentTrendRows, model.peakRevenueDay, model.trendRows],
  );
  const dailyRows = model.trendRows.length ? model.trendRows : model.paymentTrendRows;
  const ordersSparkline = useMemo(() => sparklineValues(dailyRows, "orders"), [dailyRows]);
  const avgBillSparkline = useMemo(() => sparklineValues(dailyRows, "avgBill"), [dailyRows]);

  // Compare what was asked for with the request whose numbers are on screen. Another branch or
  // period dims the page — while it loads, and also after it failed, when the old numbers are
  // all there is. The header then names the branch the numbers belong to, so a cashier never
  // reads one branch's money under another's name. A Top-N-only change dims just the product
  // list; a same-scope refresh dims nothing.
  const scopeMismatch =
    loadedParams !== null &&
    [loadedParams.branch_uuid_fk, loadedParams.start_date, loadedParams.end_date].join("|") !==
      [activeBranchUuid, appliedFilters.start_date, appliedFilters.end_date].join("|");
  const topChanging = loading && loadedParams !== null && !scopeMismatch && String(loadedParams.top ?? "") !== top;
  const shownBranchUuid = loadedParams?.branch_uuid_fk ?? activeBranchUuid;
  const shownBranchLabel =
    branchOptions.find((option) => option.value === shownBranchUuid)?.label ?? activeBranchLabel;
  // The data's own range decides whether there is a daily trend to draw.
  const shownStart = text(model.requestParams.start_date, loadedParams?.start_date ?? appliedFilters.start_date);
  const shownEnd = text(model.requestParams.end_date, loadedParams?.end_date ?? appliedFilters.end_date);
  const isSingleDay = shownStart === shownEnd;
  // The staged fields differ from both what was applied and what the backend answered with
  // (the response may normalise dates), so Apply has something to do.
  const isDirty =
    scopeKey(filters) !== scopeKey(appliedFilters) &&
    scopeKey(filters) !== scopeKey({ ...appliedFilters, ...responseFilters });
  const today = createDefaultFilters().start_date;
  const periodSummary =
    appliedFilters.periodType === "daily" &&
    appliedFilters.start_date === today &&
    appliedFilters.end_date === today
      ? copy.today
      : rangeLabel(appliedFilters.start_date, appliedFilters.end_date);

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
    isAutoTodayRef.current = false;
    setFilters((current) => ({ ...current, ...patch }));
  }, []);

  const handlePeriodTypeChange = useCallback((value: string) => {
    isAutoTodayRef.current = false;
    setFilters((current) => applyPeriodType(current, value as DashboardPeriodType));
  }, []);

  const handlePeriodYearChange = useCallback((value: string) => {
    isAutoTodayRef.current = false;
    setFilters((current) => applyPeriodYear(current, Number(value)));
  }, []);

  const handlePeriodYearEndChange = useCallback((value: string) => {
    isAutoTodayRef.current = false;
    setFilters((current) => applyPeriodYearEnd(current, Number(value)));
  }, []);

  const handlePeriodMonthChange = useCallback((value: string) => {
    isAutoTodayRef.current = false;
    setFilters((current) => applyPeriodMonth(current, Number(value)));
  }, []);

  const handlePeriodMonthEndChange = useCallback((value: string) => {
    isAutoTodayRef.current = false;
    setFilters((current) => applyPeriodMonthEnd(current, Number(value)));
  }, []);

  const handleApply = useCallback(() => {
    setAppliedFilters({ ...filters });
  }, [filters]);

  // "Today" is the untouched default, so the business-day rollover may advance it again.
  const handleToday = useCallback(() => {
    isAutoTodayRef.current = true;
    const nextFilters = createDefaultFilters();
    setFilters(nextFilters);
    setAppliedFilters(nextFilters);
  }, []);

  // The flag must drop before the state changes, or the rollover effect below would put the
  // view back to today on the next focus or 5-minute tick.
  const handleThisMonth = useCallback(() => {
    isAutoTodayRef.current = false;
    const nextFilters = applyPeriodType(createDefaultFilters(), "monthly");
    setFilters(nextFilters);
    setAppliedFilters(nextFilters);
  }, []);

  const handleReload = useCallback(() => {
    void load(appliedFilters, top);
  }, [appliedFilters, load, top]);

  // One retry for whatever failed: the branch list error and the dashboard error can share a
  // message (e.g. "Network Error") and be shown as a single alert.
  const handleRetry = useCallback(() => {
    if (branchError && storeUuid) void loadBranches(storeUuid, user?.branch_uuid).catch(() => undefined);
    void load(appliedFilters, top);
  }, [appliedFilters, branchError, load, loadBranches, storeUuid, top, user?.branch_uuid]);

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

  // A business day rolling over while this page stays open (a kiosk monitor
  // left running, or a browser tab nobody closes) must not leave "today"
  // frozen at whatever date it was on mount/reset — the fetch effect above
  // only re-runs when appliedFilters changes, and nothing else was advancing
  // it. Recompute on wake (tab regains focus/visibility) and on a slow
  // interval as a backstop for a display that never loses either. Only ever
  // replaces the untouched default (isAutoTodayRef) — a range picked by hand
  // (a specific past day, a month, a custom range) is never overridden.
  useEffect(() => {
    const checkBusinessDay = () => {
      if (!isAutoTodayRef.current) return;
      const nextFilters = createDefaultFilters();
      if (
        appliedFilters.start_date === nextFilters.start_date &&
        appliedFilters.end_date === nextFilters.end_date
      ) {
        return;
      }
      setFilters(nextFilters);
      setAppliedFilters(nextFilters);
    };
    checkBusinessDay();
    const intervalId = window.setInterval(checkBusinessDay, 5 * 60 * 1000);
    window.addEventListener("focus", checkBusinessDay);
    document.addEventListener("visibilitychange", checkBusinessDay);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", checkBusinessDay);
      document.removeEventListener("visibilitychange", checkBusinessDay);
    };
  }, [appliedFilters]);

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
    return <DashboardPageSkeleton label={t("common.loading")} />;

  const errors = [branchError, error].filter(
    (message, index, all): message is string => Boolean(message) && all.indexOf(message) === index,
  );

  // Reading order = priority: filters → the plate and the four numbers that explain it → how
  // sales moved and how they were paid → what sold and where → tables and things to watch.
  return (
    <div data-fx={tier} className="flex flex-col gap-4 tabular-nums xl:gap-5">
      <DashboardHeader
        branchLabel={shownBranchLabel}
        copy={copy}
        filtersMeta={model.filters}
        loading={loading}
        onRefresh={handleReload}
        scopeLoadingLabel={
          loading && scopeMismatch
            ? [activeBranchLabel, rangeLabel(appliedFilters.start_date, appliedFilters.end_date)].filter(Boolean).join(" · ")
            : null
        }
        section={model.section}
      />
      <DashboardFilterBar
        activeBranchUuid={activeBranchUuid}
        branchLabel={activeBranchLabel}
        branchLoading={branchLoading}
        branchOptions={branchOptions}
        copy={copy}
        filters={filters}
        isDirty={isDirty}
        loading={loading}
        monthOptions={monthOptions}
        onApply={handleApply}
        onBranchChange={setSelectedBranch}
        onFilterChange={handleFilterChange}
        onPeriodMonthChange={handlePeriodMonthChange}
        onPeriodMonthEndChange={handlePeriodMonthEndChange}
        onPeriodTypeChange={handlePeriodTypeChange}
        onPeriodYearChange={handlePeriodYearChange}
        onPeriodYearEndChange={handlePeriodYearEndChange}
        onThisMonth={handleThisMonth}
        onToday={handleToday}
        periodSummary={periodSummary}
        periodTypeOptions={periodTypeOptions}
        yearOptions={yearOptions}
      />
      <DashboardAlerts copy={copy} errors={errors} onRetry={handleRetry} warnings={model.warnings} />

      {!data && !loading ? (
        <Card className="shadow-dash-card">
          <CardContent>
            <Empty>
              <EmptyHeader>
                <EmptyTitle>{copy.noData}</EmptyTitle>
              </EmptyHeader>
              <EmptyContent>
                <Button type="button" variant="outline" className="pointer-coarse:h-10" onClick={handleRetry}>
                  <RefreshCw data-icon="inline-start" />
                  {copy.retry}
                </Button>
              </EmptyContent>
            </Empty>
          </CardContent>
        </Card>
      ) : (
        <div
          aria-busy={loading}
          className={cn(
            "flex flex-col gap-4 transition-opacity xl:gap-5",
            scopeMismatch && "opacity-60",
            scopeMismatch && loading && "pointer-events-none",
          )}
        >
          <DashboardHeroRow
            avgBillSparkline={avgBillSparkline}
            copy={copy}
            kpis={model.kpis}
            ordersSparkline={ordersSparkline}
            periodLabel={periodLabel}
            section={model.section}
            skyline={skyline}
            tier={tier}
          />
          <DashboardSalesRow
            accountingRows={model.accountingRows}
            channelRows={model.channelRows}
            copy={copy}
            isSingleDay={isSingleDay}
            mainOrderChannel={model.mainOrderChannel}
            onThisMonth={handleThisMonth}
            paymentSummary={model.paymentSummary}
            paymentSummaryCards={model.paymentSummaryCards}
            paymentTrendRows={model.paymentTrendRows}
            tier={tier}
            trendRows={model.trendRows}
          />
          <DashboardProductsRow
            copy={copy}
            highestRevenueProduct={model.highestRevenueProduct}
            insights={model.insights}
            loading={loading}
            onTopChange={handleTopChange}
            productSummary={productSummary}
            products={model.productRows}
            productsDimmed={topChanging}
            tableSummary={model.tableSummary}
            tier={tier}
            top={top}
            topOptions={topOptions}
          />
        </div>
      )}
    </div>
  );
}
