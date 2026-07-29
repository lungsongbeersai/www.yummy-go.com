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
import { Check, GripVertical, Pencil } from "lucide-react";
import { useTranslation } from "react-i18next";
import { StatusBadge } from "@/components/common/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useReorderSensors } from "@/hooks/use-reorder-sensors";
import { cn } from "@/lib/utils";
import type { Language } from "@/lib/language";
import type { PackageDetail, PackageItem } from "@/services/package";
import { monthlyEquivalentPrice } from "@/features/package/package-ui-utils";

interface PackagePriceCardProps {
  arranging: boolean;
  item: PackageItem;
  language: Language;
  months: number;
  reorderDisabled: boolean;
  savingsPercent: number | null;
  onEdit?: (item: PackageItem) => void;
  onReorderDetails: (details: PackageDetail[]) => void;
}

function localizedName(
  entry: Pick<PackageItem | PackageDetail, "name" | "nameEn" | "nameLa">,
  language: Language,
): string {
  return language === "en"
    ? entry.nameEn || entry.name || entry.nameLa
    : entry.nameLa || entry.name || entry.nameEn;
}

function formatKip(price: number, language: Language): string {
  return new Intl.NumberFormat(language === "en" ? "en-US" : "lo-LA", {
    maximumFractionDigits: 0,
  }).format(price);
}

export function PackagePriceCard({
  arranging,
  item,
  language,
  months,
  reorderDisabled,
  savingsPercent,
  onEdit,
  onReorderDetails,
}: PackagePriceCardProps) {
  const { t } = useTranslation();
  const sensors = useReorderSensors();
  const detailIds = item.details.map(
    (detail, index) => detail.id || `${item.id}-detail-${index}`,
  );
  const perMonth = monthlyEquivalentPrice(item.price, months);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || reorderDisabled) return;
    const oldIndex = detailIds.indexOf(String(active.id));
    const newIndex = detailIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    onReorderDetails(arrayMove(item.details, oldIndex, newIndex));
  }

  return (
    <div className="flex min-w-0 flex-col gap-4 rounded-lg border border-border bg-card p-4">
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <p className="min-w-0 truncate text-sm font-bold text-muted-foreground">
            {localizedName(item, language)}
          </p>
          <StatusBadge active={item.status === 1} />
        </div>

        <p className="text-3xl font-black tabular-nums tracking-tight text-foreground">
          {formatKip(item.price, language)}
          <span className="ml-1 text-base font-bold text-muted-foreground">
            ₭
          </span>
          <span className="ml-1 text-sm font-bold text-muted-foreground">
            {months > 1
              ? t("packageManagement.perCycle", { months })
              : t("packageManagement.perMonth")}
          </span>
        </p>

        {months > 1 ? (
          <p className="text-xs text-muted-foreground tabular-nums">
            {t("packageManagement.monthlyEquivalent", {
              price: `${formatKip(perMonth, language)} ₭`,
            })}
          </p>
        ) : null}

        {savingsPercent !== null ? (
          <Badge className="w-fit border-primary/25 bg-primary/10 text-primary">
            {t("packageManagement.savingsBadge", { percent: savingsPercent })}
          </Badge>
        ) : null}
      </div>

      <DndContext
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        sensors={sensors}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={detailIds} strategy={verticalListSortingStrategy}>
          <ul className="flex min-w-0 flex-col gap-2">
            {item.details.map((detail, index) => (
              <DetailRow
                key={detailIds[index]}
                arranging={arranging}
                detail={detail}
                disabled={reorderDisabled}
                language={language}
                sortableId={detailIds[index]}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-11 w-full sm:h-8"
        disabled={!onEdit}
        onClick={() => onEdit?.(item)}
      >
        <Pencil data-icon="inline-start" />
        {t("packageManagement.editPackage")}
      </Button>
    </div>
  );
}

function DetailRow({
  arranging,
  detail,
  disabled,
  language,
  sortableId,
}: {
  arranging: boolean;
  detail: PackageDetail;
  disabled: boolean;
  language: Language;
  sortableId: string;
}) {
  const { t } = useTranslation();
  const { attributes, isDragging, listeners, setNodeRef, transform, transition } =
    useSortable({ id: sortableId, disabled: disabled || !arranging });
  const name = localizedName(detail, language);

  return (
    <li
      ref={setNodeRef}
      className={cn(
        "flex min-w-0 items-center gap-2 text-sm",
        detail.status !== 1 && "opacity-50",
        isDragging && "z-10 opacity-80",
      )}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      {arranging ? (
        <button
          type="button"
          aria-label={`${t("packageManagement.dragToReorder")} ${name}`}
          className={cn(
            "flex size-11 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground touch-none sm:size-6",
            disabled && "cursor-not-allowed opacity-60",
          )}
          {...attributes}
          {...listeners}
        >
          <GripVertical aria-hidden className="size-4" />
        </button>
      ) : (
        <Check aria-hidden className="size-4 shrink-0 text-primary" />
      )}
      <span className="min-w-0 truncate">{name}</span>
    </li>
  );
}
