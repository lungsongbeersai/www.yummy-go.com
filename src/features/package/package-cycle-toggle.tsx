"use client";

import { closestCenter, DndContext, type DragEndEvent } from "@dnd-kit/core";
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useReorderSensors } from "@/hooks/use-reorder-sensors";
import { cn } from "@/lib/utils";
import type { BillingCycle } from "@/services/package";

interface PackageCycleToggleProps {
  arranging: boolean;
  cycles: BillingCycle[];
  reorderDisabled: boolean;
  selectedCycleId: string;
  onReorder: (cycles: BillingCycle[]) => void;
  onSelect: (cycleId: string) => void;
}

export function PackageCycleToggle({
  arranging,
  cycles,
  reorderDisabled,
  selectedCycleId,
  onReorder,
  onSelect,
}: PackageCycleToggleProps) {
  const { t } = useTranslation();
  const sensors = useReorderSensors();
  const cycleIds = cycles.map((cycle) => cycle.id);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || reorderDisabled) return;
    const oldIndex = cycleIds.indexOf(String(active.id));
    const newIndex = cycleIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(cycles, oldIndex, newIndex));
  }

  if (!arranging) {
    return (
      <ToggleGroup
        aria-label={t("packageManagement.billingCycle")}
        className="w-full sm:w-auto"
        type="single"
        value={selectedCycleId}
        variant="outline"
        onValueChange={(value) => {
          if (value) onSelect(value);
        }}
      >
        {cycles.map((cycle) => (
          <ToggleGroupItem
            key={cycle.id}
            className="h-11 flex-1 px-4 text-sm font-bold sm:h-8 sm:flex-none"
            value={cycle.id}
          >
            {cycle.name}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    );
  }

  return (
    <DndContext
      collisionDetection={closestCenter}
      modifiers={[restrictToHorizontalAxis]}
      sensors={sensors}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={cycleIds} strategy={horizontalListSortingStrategy}>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {cycles.map((cycle) => (
            <SortableCycleChip
              key={cycle.id}
              cycle={cycle}
              disabled={reorderDisabled}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableCycleChip({
  cycle,
  disabled,
}: {
  cycle: BillingCycle;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const { attributes, isDragging, listeners, setNodeRef, transform, transition } =
    useSortable({ id: cycle.id, disabled });

  return (
    <Button
      ref={setNodeRef}
      type="button"
      variant="outline"
      aria-label={`${t("packageManagement.dragToReorder")} ${cycle.name}`}
      className={cn(
        "h-11 min-w-0 cursor-grab touch-none bg-card px-3 text-sm font-bold sm:h-8",
        isDragging && "z-10 opacity-80 shadow-md",
        disabled && "cursor-not-allowed opacity-60",
      )}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
    >
      <GripVertical aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      <span className="truncate">{cycle.name}</span>
    </Button>
  );
}
