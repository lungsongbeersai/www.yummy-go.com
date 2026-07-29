"use client";

import { useEffect, useMemo, useState } from "react";
import { PackageOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PackageToolbar, type PackageStatusFilter } from "@/features/package/package-toolbar";
import { PackageFormDialog } from "@/features/package/package-form-dialog";
import { PackagePlanDialog } from "@/features/package/package-plan-dialog";
import {
  activePackageNavigation,
  orderedPlanColumns,
  packagesForPlan,
} from "@/features/package/package-ui-utils";
import { PackageWorkspace } from "@/features/package/package-workspace";
import type {
  BillingCycle,
  CreatePackagePlanInput,
  PackageDetail,
  PackageItem,
  PackagePlan,
  SavePackageInput,
} from "@/services/package";
import { useAppStore } from "@/stores/app-store";
import {
  usePackageStore,
  type PackageQuery,
} from "@/stores/package-store";
import { errorMessage } from "@/stores/store-utils";
import { useToastStore } from "@/stores/toast-store";

export const PACKAGE_FETCH_LIMIT = 50;

export function PackagePage() {
  const { t } = useTranslation();
  const language = useAppStore((state) => state.language);
  const billingCycles = usePackageStore((state) => state.billingCycles);
  const methods = usePackageStore((state) => state.methods);
  const planGroups = usePackageStore((state) => state.planGroups);
  const packageGroups = usePackageStore((state) => state.packageGroups);
  const total = usePackageStore((state) => state.total);
  const catalogReady = usePackageStore((state) => state.catalogReady);
  const loading = usePackageStore((state) => state.loading);
  const refreshing = usePackageStore((state) => state.refreshing);
  const saving = usePackageStore((state) => state.saving);
  const sortingScope = usePackageStore((state) => state.sortingScope);
  const loadError = usePackageStore((state) => state.loadError);
  const loadCatalog = usePackageStore((state) => state.loadCatalog);
  const createPlan = usePackageStore((state) => state.createPlan);
  const savePackage = usePackageStore((state) => state.save);
  const sortCycles = usePackageStore((state) => state.sortCycles);
  const sortPlans = usePackageStore((state) => state.sortPlans);
  const sortDetails = usePackageStore((state) => state.sortDetails);
  const showToast = useToastStore((state) => state.show);
  const [status, setStatus] = useState<PackageStatusFilter>("all");
  const [selectedCycleId, setSelectedCycleId] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [arranging, setArranging] = useState(false);
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [packageDialogOpen, setPackageDialogOpen] = useState(false);
  const [editingPackage, setEditingPackage] =
    useState<PackageItem | null>(null);
  const queryStatus =
    status === "1" ? 1 : status === "2" ? 2 : ("all" as const);
  const query = useMemo<PackageQuery>(
    () => ({
      language,
      limit: PACKAGE_FETCH_LIMIT,
      orderBy: "asc",
      page: 1,
      search: "",
      status: queryStatus,
    }),
    [language, queryStatus],
  );

  useEffect(() => {
    const background = usePackageStore.getState().catalogReady;

    void loadCatalog(query, { background }).catch(() => {
      // The store owns load errors for UI retries and internal refreshes.
    });
  }, [loadCatalog, query]);

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

  // ไม่ต้องเขียน navigation.cycleId กลับเข้า state — activePackageNavigation() resolve
  // ค่าที่ใช้จริงจาก selection ดิบทุกครั้งอยู่แล้ว (fallback เป็นตัวแรกที่ active ถ้า selection ไม่ valid)
  // ทุกจุดที่ render อ่านจาก navigation.* ส่วน state ดิบเก็บไว้แค่ "ผู้ใช้เลือกอะไร" เท่านั้น
  const activeGroup =
    navigation.planGroups.find(
      (group) => group.billingCycleId === navigation.cycleId,
    ) ?? null;
  const plans = useMemo(() => orderedPlanColumns(activeGroup), [activeGroup]);
  const months = activeGroup?.months ?? 1;
  // ราคาต่อเดือนของแต่ละประเภทร้าน ใช้เป็นฐานคำนวณ badge ส่วนลดของรอบบิลอื่น
  const monthlyPriceByMethodId = useMemo(() => {
    const monthlyGroup = navigation.planGroups.find(
      (group) => group.months === 1,
    );
    const prices = new Map<string, number>();
    for (const plan of monthlyGroup?.plans ?? []) {
      const [first] = packagesForPlan(packageGroups, plan.id);
      if (first) prices.set(plan.methodId, first.price);
    }
    return prices;
  }, [navigation.planGroups, packageGroups]);
  // total มาจาก backend เป็นจำนวนทั้งแคตตาล็อก (ทุกรอบบิล ไม่กรองตาม cycle ที่เลือกอยู่)
  // shownCount ต้องนับข้ามทุก billing cycle ที่โหลดมาแล้วเช่นกัน ไม่ใช่แค่ plans ของ cycle
  // ที่แสดงอยู่ ไม่งั้นเทียบกันคนละ scope แล้ว truncated banner จะค้างจริงทั้งที่โหลดครบแล้ว
  const shownCount = useMemo(
    () =>
      packageGroups
        .flatMap((group) => group.methods)
        .flatMap((method) => method.packages).length,
    [packageGroups],
  );

  function changeStatus(value: PackageStatusFilter) {
    if (value === status) return;
    setStatus(value);
  }

  function selectCycle(cycleId: string) {
    setSelectedCycleId(cycleId);
  }

  function openCreatePackage(planId: string) {
    setSelectedPlanId(planId);
    setEditingPackage(null);
    setPackageDialogOpen(true);
  }

  function openEditPackage(item: PackageItem) {
    setEditingPackage(item);
    setPackageDialogOpen(true);
  }

  function changePackageDialogOpen(open: boolean) {
    setPackageDialogOpen(open);
    if (!open) setEditingPackage(null);
  }

  async function submitPlan(input: CreatePackagePlanInput) {
    try {
      await createPlan(input, query);
      const createdPlan =
        usePackageStore
          .getState()
          .planGroups.find(
            (group) => group.billingCycleId === input.billingCycleId,
          )
          ?.plans.find((plan) => plan.methodId === input.methodId) ?? null;

      setSelectedCycleId(input.billingCycleId);
      if (createdPlan) setSelectedPlanId(createdPlan.id);
      setPlanDialogOpen(false);
      showToast({
        title: t("packageManagement.planCreated"),
        tone: "success",
      });
    } catch (saveError) {
      showToast({
        title: t("packageManagement.planSaveFailed"),
        description: errorMessage(saveError),
        tone: "error",
      });
    }
  }

  async function submitPackage(input: SavePackageInput) {
    try {
      await savePackage(input, query);
      changePackageDialogOpen(false);
      showToast({
        title: t("packageManagement.packageSaved"),
        tone: "success",
      });
    } catch (saveError) {
      showToast({
        title: t("packageManagement.saveFailed"),
        description: errorMessage(saveError),
        tone: "error",
      });
    }
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

  function reorderPlans(reorderedPlans: PackagePlan[]) {
    void sortPlans(navigation.cycleId, reorderedPlans, query)
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
              <PackageOpen
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
            arranging={arranging}
            refreshing={loading || refreshing}
            status={status}
            onRefresh={() => void refresh()}
            onStatusChange={changeStatus}
            onToggleArrange={() => setArranging((value) => !value)}
          />
        </div>
      </header>

      <PackageWorkspace
        arranging={arranging}
        billingCycles={navigation.billingCycles}
        catalogReady={catalogReady}
        language={language}
        loadError={loadError}
        loading={loading}
        months={months}
        monthlyPriceByMethodId={monthlyPriceByMethodId}
        packageGroups={packageGroups}
        plans={plans}
        reorderDisabled={sortingScope !== null}
        selectedCycleId={navigation.cycleId}
        shownCount={shownCount}
        total={total}
        onAddPackage={openCreatePackage}
        onAddPlan={() => setPlanDialogOpen(true)}
        onEditPackage={openEditPackage}
        onReorderCycles={reorderCycles}
        onReorderDetails={reorderDetails}
        onReorderPlans={reorderPlans}
        onRetry={() => void refresh()}
        onSelectCycle={selectCycle}
      />

      <PackagePlanDialog
        billingCycles={navigation.billingCycles}
        methods={methods}
        open={planDialogOpen}
        planGroups={planGroups}
        saving={saving}
        selectedCycleId={navigation.cycleId}
        onOpenChange={setPlanDialogOpen}
        onSubmit={submitPlan}
      />

      <PackageFormDialog
        editing={editingPackage}
        language={language}
        open={packageDialogOpen}
        planGroups={navigation.planGroups}
        saving={saving}
        selectedPlanId={selectedPlanId}
        onOpenChange={changePackageDialogOpen}
        onSubmit={submitPackage}
      />
    </div>
  );
}
