"use client";

import { PackageOpen, RefreshCw, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { PackageCycleToggle } from "@/features/package/package-cycle-toggle";
import { PackagePricingGrid } from "@/features/package/package-pricing-grid";
import type { Language } from "@/lib/language";
import type {
  BillingCycle,
  PackageBillingGroup,
  PackageDetail,
  PackageItem,
  PackagePlan,
} from "@/services/package";

interface PackageWorkspaceProps {
  arranging: boolean;
  billingCycles: BillingCycle[];
  catalogReady: boolean;
  language: Language;
  loadError: string | null;
  loading: boolean;
  months: number;
  monthlyPriceByMethodId: Map<string, number>;
  packageGroups: PackageBillingGroup[];
  plans: PackagePlan[];
  reorderDisabled: boolean;
  selectedCycleId: string;
  shownCount: number;
  total: number;
  onAddPackage: (planId: string) => void;
  onAddPlan: () => void;
  onEditPackage: (item: PackageItem) => void;
  onReorderCycles: (cycles: BillingCycle[]) => void;
  onReorderDetails: (packageId: string, details: PackageDetail[]) => void;
  onReorderPlans: (plans: PackagePlan[]) => void;
  onRetry: () => void;
  onSelectCycle: (cycleId: string) => void;
}

export function PackageWorkspace({
  arranging,
  billingCycles,
  catalogReady,
  language,
  loadError,
  loading,
  months,
  monthlyPriceByMethodId,
  packageGroups,
  plans,
  reorderDisabled,
  selectedCycleId,
  shownCount,
  total,
  onAddPackage,
  onAddPlan,
  onEditPackage,
  onReorderCycles,
  onReorderDetails,
  onReorderPlans,
  onRetry,
  onSelectCycle,
}: PackageWorkspaceProps) {
  const { t } = useTranslation();
  const initialLoading = loading && !catalogReady;
  // เมื่อยังไม่เคยโหลดสำเร็จเลย loadError ต้องบล็อกทั้งหน้าเพราะไม่มีข้อมูลให้แสดง
  // แต่ถ้า catalogReady แล้ว (เช่น error มาจาก background refresh หลัง save) ห้ามเป่าข้อมูลเดิมทิ้ง —
  // แสดง error เป็น banner เฉยๆ แล้วให้ grid ที่มีอยู่แสดงต่อไปตามปกติ
  const blockingLoadError = Boolean(loadError && !catalogReady);

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border bg-card/80 px-3 py-3 sm:px-4 lg:px-5">
        <PackageCycleToggle
          arranging={arranging}
          cycles={billingCycles}
          reorderDisabled={reorderDisabled}
          selectedCycleId={selectedCycleId}
          onReorder={onReorderCycles}
          onSelect={onSelectCycle}
        />
        {arranging ? (
          <p className="mt-2 text-xs text-muted-foreground">
            {t("packageManagement.arrangeHint")}
          </p>
        ) : null}
      </div>

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
                disabled={loading}
                onClick={onRetry}
              >
                {loading ? (
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

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain touch-pan-y px-3 py-3 sm:px-4 lg:px-5">
        {initialLoading ? (
          <PricingGridSkeleton />
        ) : blockingLoadError ? null : billingCycles.length === 0 ? (
          <Empty className="min-h-72 border border-border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <PackageOpen aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>{t("packageManagement.emptyTitle")}</EmptyTitle>
              <EmptyDescription>
                {t("packageManagement.emptyDescription")}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            <PackagePricingGrid
              arranging={arranging}
              language={language}
              months={months}
              packageGroups={packageGroups}
              plans={plans}
              monthlyPriceByMethodId={monthlyPriceByMethodId}
              reorderDisabled={reorderDisabled}
              onAddPackage={onAddPackage}
              onAddPlan={onAddPlan}
              onEditPackage={onEditPackage}
              onReorderDetails={onReorderDetails}
              onReorderPlans={onReorderPlans}
            />
            {total > shownCount ? (
              <p className="shrink-0 px-1 py-2 text-xs text-muted-foreground">
                {t("packageManagement.truncated", { shown: shownCount, total })}
              </p>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

function PricingGridSkeleton() {
  return (
    <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="flex flex-col gap-3">
          <Skeleton className="h-5 w-2/3" />
          <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
