"use client";

import { closestCenter, DndContext, type DragEndEvent } from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowDown,
  ArrowUp,
  GripVertical,
  Plus,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useReorderSensors } from "@/hooks/use-reorder-sensors";
import { cn } from "@/lib/utils";
import type {
  BillingCycle,
  PackagePlan,
  PackagePlanGroup,
} from "@/services/package";
import type { PackageSortingScope } from "@/stores/package-store";

interface PackageNavigatorProps {
  billingCycles: BillingCycle[];
  planGroups: PackagePlanGroup[];
  selectedCycleId: string;
  selectedPlanId: string;
  sortingScope: PackageSortingScope;
  onAddPlan?: () => void;
  onReorderCycles: (cycles: BillingCycle[]) => void;
  onReorderPlans: (cycleId: string, plans: PackagePlan[]) => void;
  onSelectCycle: (cycleId: string) => void;
  onSelectPlan: (planId: string) => void;
}

function groupForCycle(
  groups: PackagePlanGroup[],
  cycleId: string,
): PackagePlanGroup | null {
  return groups.find((group) => group.billingCycleId === cycleId) ?? null;
}

function movedItem<T extends { id: string }>(
  items: T[],
  id: string,
  offset: -1 | 1,
): T[] {
  const index = items.findIndex((item) => item.id === id);
  const nextIndex = index + offset;
  if (index < 0 || nextIndex < 0 || nextIndex >= items.length) return items;
  return arrayMove(items, index, nextIndex);
}

export function PackageMobileNavigator({
  billingCycles,
  planGroups,
  selectedCycleId,
  selectedPlanId,
  sortingScope,
  onAddPlan,
  onReorderCycles,
  onReorderPlans,
  onSelectCycle,
  onSelectPlan,
}: PackageNavigatorProps) {
  const { t } = useTranslation();
  const group = groupForCycle(planGroups, selectedCycleId);
  const plans = group?.plans ?? [];
  const cycleIndex = billingCycles.findIndex(
    (cycle) => cycle.id === selectedCycleId,
  );
  const planIndex = plans.findIndex((plan) => plan.id === selectedPlanId);
  const reorderDisabled = sortingScope !== null;

  return (
    <div className="flex flex-col gap-3 p-3 sm:p-4 lg:hidden">
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-muted-foreground">
          {t("packageManagement.billingCycle")}
        </span>
        <div className="flex min-w-0 items-center gap-1.5">
          <Select value={selectedCycleId} onValueChange={onSelectCycle}>
            <SelectTrigger
              aria-label={t("packageManagement.billingCycle")}
              className="h-11 min-w-0 flex-1"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {billingCycles.map((cycle) => (
                  <SelectItem key={cycle.id} value={cycle.id}>
                    {String(cycle.months).padStart(2, "0")} · {cycle.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <MoveButton
            direction="up"
            disabled={reorderDisabled || cycleIndex <= 0}
            label={`${t("packageManagement.moveUp")} ${billingCycles[cycleIndex]?.name ?? ""}`}
            onClick={() =>
              onReorderCycles(
                movedItem(billingCycles, selectedCycleId, -1),
              )
            }
          />
          <MoveButton
            direction="down"
            disabled={
              reorderDisabled ||
              cycleIndex < 0 ||
              cycleIndex >= billingCycles.length - 1
            }
            label={`${t("packageManagement.moveDown")} ${billingCycles[cycleIndex]?.name ?? ""}`}
            onClick={() =>
              onReorderCycles(movedItem(billingCycles, selectedCycleId, 1))
            }
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-muted-foreground">
          {t("packageManagement.plan")}
        </span>
        <div className="flex min-w-0 items-center gap-1.5">
          <Select
            value={selectedPlanId}
            disabled={!plans.length}
            onValueChange={onSelectPlan}
          >
            <SelectTrigger
              aria-label={t("packageManagement.plan")}
              className="h-11 min-w-0 flex-1"
            >
              <SelectValue placeholder={t("packageManagement.plan")} />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {plans.map((plan) => (
                  <SelectItem key={plan.id} value={plan.id}>
                    {plan.methodName}
                    {plan.status === 1
                      ? ""
                      : ` · ${t("packageManagement.inactive")}`}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <MoveButton
            direction="up"
            disabled={reorderDisabled || planIndex <= 0}
            label={`${t("packageManagement.moveUp")} ${plans[planIndex]?.methodName ?? ""}`}
            onClick={() =>
              group
                ? onReorderPlans(
                    group.billingCycleId,
                    movedItem(plans, selectedPlanId, -1),
                  )
                : undefined
            }
          />
          <MoveButton
            direction="down"
            disabled={
              reorderDisabled ||
              planIndex < 0 ||
              planIndex >= plans.length - 1
            }
            label={`${t("packageManagement.moveDown")} ${plans[planIndex]?.methodName ?? ""}`}
            onClick={() =>
              group
                ? onReorderPlans(
                    group.billingCycleId,
                    movedItem(plans, selectedPlanId, 1),
                  )
                : undefined
            }
          />
          <Button
            type="button"
            size="iconSm"
            variant="outline"
            className="size-11"
            aria-label={t("packageManagement.addPlan")}
            title={t("packageManagement.addPlan")}
            disabled={!selectedCycleId || !onAddPlan}
            onClick={onAddPlan}
          >
            <Plus aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function PackageDesktopNavigator({
  billingCycles,
  planGroups,
  selectedCycleId,
  selectedPlanId,
  sortingScope,
  onAddPlan,
  onReorderCycles,
  onReorderPlans,
  onSelectCycle,
  onSelectPlan,
}: PackageNavigatorProps) {
  const { t } = useTranslation();
  const sensors = useReorderSensors();
  const reorderDisabled = sortingScope !== null;

  function handleCycleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || reorderDisabled) return;
    const oldIndex = billingCycles.findIndex(
      (cycle) => cycle.id === String(active.id),
    );
    const newIndex = billingCycles.findIndex(
      (cycle) => cycle.id === String(over.id),
    );
    if (oldIndex < 0 || newIndex < 0) return;
    onReorderCycles(arrayMove(billingCycles, oldIndex, newIndex));
  }

  return (
    <aside className="hidden min-w-0 border-r border-border bg-card/60 lg:block">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs font-black text-muted-foreground">
            {t("packageManagement.billingCycle")}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("packageManagement.reorderBillingCycles")}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!selectedCycleId || !onAddPlan}
          onClick={onAddPlan}
        >
          <Plus data-icon="inline-start" />
          {t("packageManagement.addPlan")}
        </Button>
      </div>

      <DndContext
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        sensors={sensors}
        onDragEnd={handleCycleDragEnd}
      >
        <SortableContext
          items={billingCycles.map((cycle) => cycle.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col gap-3 px-3 pb-4">
            {billingCycles.map((cycle, cycleIndex) => {
              const plans =
                groupForCycle(planGroups, cycle.id)?.plans ?? [];

              return (
                <SortableCycle
                  key={cycle.id}
                  cycle={cycle}
                  disabled={reorderDisabled}
                  first={cycleIndex === 0}
                  last={cycleIndex === billingCycles.length - 1}
                  plans={plans}
                  selected={cycle.id === selectedCycleId}
                  selectedPlanId={selectedPlanId}
                  sensors={sensors}
                  onMove={(offset) =>
                    onReorderCycles(movedItem(billingCycles, cycle.id, offset))
                  }
                  onReorderPlans={(nextPlans) =>
                    onReorderPlans(cycle.id, nextPlans)
                  }
                  onSelectCycle={() => onSelectCycle(cycle.id)}
                  onSelectPlan={onSelectPlan}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>
    </aside>
  );
}

function SortableCycle({
  cycle,
  disabled,
  first,
  last,
  plans,
  selected,
  selectedPlanId,
  sensors,
  onMove,
  onReorderPlans,
  onSelectCycle,
  onSelectPlan,
}: {
  cycle: BillingCycle;
  disabled: boolean;
  first: boolean;
  last: boolean;
  plans: PackagePlan[];
  selected: boolean;
  selectedPlanId: string;
  sensors: ReturnType<typeof useReorderSensors>;
  onMove: (offset: -1 | 1) => void;
  onReorderPlans: (plans: PackagePlan[]) => void;
  onSelectCycle: () => void;
  onSelectPlan: (planId: string) => void;
}) {
  const { t } = useTranslation();
  const {
    attributes,
    isDragging,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: cycle.id, disabled });

  function handlePlanDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || disabled) return;
    const oldIndex = plans.findIndex(
      (plan) => plan.id === String(active.id),
    );
    const newIndex = plans.findIndex(
      (plan) => plan.id === String(over.id),
    );
    if (oldIndex < 0 || newIndex < 0) return;
    onReorderPlans(arrayMove(plans, oldIndex, newIndex));
  }

  return (
    <section
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        "rounded-lg border border-border bg-card transition-colors",
        selected && "border-primary/50 bg-primary/5",
        isDragging && "relative shadow-md",
      )}
    >
      <div className="flex items-center gap-1.5 p-2">
        <Button
          type="button"
          size="iconSm"
          variant="ghost"
          className="size-11 cursor-grab touch-none active:cursor-grabbing"
          aria-label={`${t("packageManagement.dragToReorder")} ${cycle.name}`}
          disabled={disabled}
          {...attributes}
          {...listeners}
        >
          <GripVertical aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="h-auto min-w-0 flex-1 justify-start px-2 py-1.5 text-left"
          aria-pressed={selected}
          onClick={onSelectCycle}
        >
          <span className="w-8 shrink-0 text-xl font-black tabular-nums text-primary">
            {String(cycle.months).padStart(2, "0")}
          </span>
          <span className="min-w-0 truncate font-bold">{cycle.name}</span>
        </Button>
        <MoveButton
          direction="up"
          disabled={disabled || first}
          label={`${t("packageManagement.moveUp")} ${cycle.name}`}
          onClick={() => onMove(-1)}
        />
        <MoveButton
          direction="down"
          disabled={disabled || last}
          label={`${t("packageManagement.moveDown")} ${cycle.name}`}
          onClick={() => onMove(1)}
        />
      </div>

      <DndContext
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        sensors={sensors}
        onDragEnd={handlePlanDragEnd}
      >
        <SortableContext
          items={plans.map((plan) => plan.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col gap-1 border-t border-border p-2">
            {plans.map((plan, index) => (
              <SortablePlan
                key={plan.id}
                disabled={disabled}
                first={index === 0}
                last={index === plans.length - 1}
                plan={plan}
                selected={plan.id === selectedPlanId}
                onMove={(offset) =>
                  onReorderPlans(movedItem(plans, plan.id, offset))
                }
                onSelect={() => onSelectPlan(plan.id)}
              />
            ))}
            {!plans.length ? (
              <p className="px-2 py-3 text-xs text-muted-foreground">
                {t("packageManagement.scopedEmptyDescription")}
              </p>
            ) : null}
          </div>
        </SortableContext>
      </DndContext>
    </section>
  );
}

function SortablePlan({
  disabled,
  first,
  last,
  plan,
  selected,
  onMove,
  onSelect,
}: {
  disabled: boolean;
  first: boolean;
  last: boolean;
  plan: PackagePlan;
  selected: boolean;
  onMove: (offset: -1 | 1) => void;
  onSelect: () => void;
}) {
  const { t } = useTranslation();
  const {
    attributes,
    isDragging,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: plan.id, disabled });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        "flex min-w-0 items-center gap-1 rounded-md",
        selected && "bg-primary/10",
        isDragging && "relative shadow-md",
      )}
    >
      <Button
        type="button"
        size="iconSm"
        variant="ghost"
        className="size-11 cursor-grab touch-none active:cursor-grabbing"
        aria-label={`${t("packageManagement.dragToReorder")} ${plan.methodName}`}
        disabled={disabled}
        {...attributes}
        {...listeners}
      >
        <GripVertical aria-hidden="true" />
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-11 min-w-0 flex-1 justify-start px-2"
        aria-current={selected ? "true" : undefined}
        onClick={onSelect}
      >
        <span className="truncate">{plan.methodName}</span>
        <StatusBadge
          active={plan.status === 1}
          className="ml-auto shrink-0"
          label={
            plan.status === 1
              ? t("packageManagement.active")
              : t("packageManagement.inactive")
          }
        />
      </Button>
      <MoveButton
        direction="up"
        disabled={disabled || first}
        label={`${t("packageManagement.moveUp")} ${plan.methodName}`}
        onClick={() => onMove(-1)}
      />
      <MoveButton
        direction="down"
        disabled={disabled || last}
        label={`${t("packageManagement.moveDown")} ${plan.methodName}`}
        onClick={() => onMove(1)}
      />
    </div>
  );
}

function MoveButton({
  direction,
  disabled,
  label,
  onClick,
}: {
  direction: "up" | "down";
  disabled: boolean;
  label: string;
  onClick: () => void;
}) {
  const Icon = direction === "up" ? ArrowUp : ArrowDown;

  return (
    <Button
      type="button"
      size="iconSm"
      variant="ghost"
      className="size-11 shrink-0"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon aria-hidden="true" />
    </Button>
  );
}
