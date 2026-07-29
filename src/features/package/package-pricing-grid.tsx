"use client";

import { closestCenter, DndContext, type DragEndEvent } from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, SearchX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useReorderSensors } from "@/hooks/use-reorder-sensors";
import { cn } from "@/lib/utils";
import type { Language } from "@/lib/language";
import type {
  PackageBillingGroup,
  PackageDetail,
  PackageItem,
  PackagePlan,
} from "@/services/package";
import { PackagePriceCard } from "@/features/package/package-price-card";
import type { PackageStatusFilter } from "@/features/package/package-toolbar";
import {
  cycleSavingsPercent,
  packagesForPlan,
} from "@/features/package/package-ui-utils";

interface PackagePricingGridProps {
  arranging: boolean;
  language: Language;
  months: number;
  packageGroups: PackageBillingGroup[];
  plans: PackagePlan[];
  monthlyPriceByMethodId: Map<string, number>;
  reorderDisabled: boolean;
  status: PackageStatusFilter;
  onAddPackage: (planId: string) => void;
  onAddPlan: () => void;
  onEditPackage: (item: PackageItem) => void;
  onReorderDetails: (packageId: string, details: PackageDetail[]) => void;
  onReorderPlans: (plans: PackagePlan[]) => void;
}

export function PackagePricingGrid({
  arranging,
  language,
  months,
  packageGroups,
  plans,
  monthlyPriceByMethodId,
  reorderDisabled,
  status,
  onAddPackage,
  onAddPlan,
  onEditPackage,
  onReorderDetails,
  onReorderPlans,
}: PackagePricingGridProps) {
  const sensors = useReorderSensors();
  const planIds = plans.map((plan) => plan.id);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || reorderDisabled) return;
    const oldIndex = planIds.indexOf(String(active.id));
    const newIndex = planIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    onReorderPlans(arrayMove(plans, oldIndex, newIndex));
  }

  return (
    <DndContext
      collisionDetection={closestCenter}
      sensors={sensors}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={planIds} strategy={rectSortingStrategy}>
        <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-[repeat(auto-fit,minmax(16rem,1fr))]">
          {plans.map((plan) => (
            <PlanColumn
              key={plan.id}
              arranging={arranging}
              language={language}
              months={months}
              monthlyPrice={monthlyPriceByMethodId.get(plan.methodId) ?? 0}
              packages={packagesForPlan(packageGroups, plan.id)}
              plan={plan}
              reorderDisabled={reorderDisabled}
              status={status}
              onAddPackage={onAddPackage}
              onEditPackage={onEditPackage}
              onReorderDetails={onReorderDetails}
            />
          ))}

          <AddPlanColumn onAddPlan={onAddPlan} />
        </div>
      </SortableContext>
    </DndContext>
  );
}

function PlanColumn({
  arranging,
  language,
  months,
  monthlyPrice,
  packages,
  plan,
  reorderDisabled,
  status,
  onAddPackage,
  onEditPackage,
  onReorderDetails,
}: {
  arranging: boolean;
  language: Language;
  months: number;
  monthlyPrice: number;
  packages: PackageItem[];
  plan: PackagePlan;
  reorderDisabled: boolean;
  status: PackageStatusFilter;
  onAddPackage: (planId: string) => void;
  onEditPackage: (item: PackageItem) => void;
  onReorderDetails: (packageId: string, details: PackageDetail[]) => void;
}) {
  const { t } = useTranslation();
  const { attributes, isDragging, listeners, setNodeRef, transform, transition } =
    useSortable({ id: plan.id, disabled: reorderDisabled || !arranging });

  return (
    <section
      ref={setNodeRef}
      className={cn(
        "flex min-w-0 flex-col gap-3",
        isDragging && "z-10 opacity-80",
      )}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <header className="flex min-w-0 items-center gap-2">
        {arranging ? (
          <button
            type="button"
            aria-label={`${t("packageManagement.dragToReorder")} ${plan.methodName}`}
            className={cn(
              "flex size-11 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground touch-none sm:size-6",
              reorderDisabled && "cursor-not-allowed opacity-60",
            )}
            {...attributes}
            {...listeners}
          >
            <GripVertical aria-hidden className="size-4" />
          </button>
        ) : null}
        <h2 className="min-w-0 truncate text-sm font-black text-foreground">
          {plan.methodName}
        </h2>
      </header>

      {packages.length ? (
        packages.map((item) => (
          <PackagePriceCard
            key={item.id}
            arranging={arranging}
            item={item}
            language={language}
            months={months}
            reorderDisabled={reorderDisabled}
            savingsPercent={cycleSavingsPercent(monthlyPrice, item.price, months)}
            onEdit={onEditPackage}
            onReorderDetails={(details) => onReorderDetails(item.id, details)}
          />
        ))
      ) : status === "all" ? (
        <button
          type="button"
          className="flex min-h-40 min-w-0 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-card/40 p-4 text-center transition hover:border-primary hover:bg-primary/5"
          onClick={() => onAddPackage(plan.id)}
        >
          <Plus aria-hidden className="size-5 text-primary" />
          <span className="text-sm font-bold text-foreground">
            {t("packageManagement.createPackageHere")}
          </span>
          <span className="text-xs text-muted-foreground">
            {t("packageManagement.createPackageHint")}
          </span>
        </button>
      ) : (
        // สถานะกรองไม่ตรงกับแพ็กเกจที่มีอยู่จริง (ไม่ใช่ "ยังไม่มีแพ็กเกจ") ห้ามให้กดสร้าง
        // เพราะแผนนี้อาจมีแพ็กเกจอยู่แล้ว การกดสร้างจะได้แพ็กเกจซ้ำใต้แผนเดียวกัน
        <div className="flex min-h-40 min-w-0 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-card/40 p-4 text-center">
          <SearchX aria-hidden className="size-5 text-muted-foreground" />
          <span className="text-sm font-bold text-foreground">
            {t("packageManagement.noResultsTitle")}
          </span>
          <span className="text-xs text-muted-foreground">
            {t("packageManagement.noResultsDescription")}
          </span>
        </div>
      )}
    </section>
  );
}

function AddPlanColumn({ onAddPlan }: { onAddPlan: () => void }) {
  const { t } = useTranslation();

  return (
    <section className="flex min-w-0 flex-col gap-3">
      <header className="h-5" aria-hidden />
      <Button
        type="button"
        variant="outline"
        className="flex min-h-40 w-full flex-col items-center justify-center gap-2 border-dashed"
        onClick={onAddPlan}
      >
        <Plus aria-hidden className="size-5" />
        <span className="text-sm font-bold">
          {t("packageManagement.addPlan")}
        </span>
      </Button>
    </section>
  );
}
