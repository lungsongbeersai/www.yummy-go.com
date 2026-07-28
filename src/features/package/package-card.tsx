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
  Pencil,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useReorderSensors } from "@/hooks/use-reorder-sensors";
import { cn } from "@/lib/utils";
import type { Language } from "@/lib/language";
import type { PackageDetail, PackageItem } from "@/services/package";

interface PackageCardProps {
  item: PackageItem;
  language: Language;
  reorderDisabled: boolean;
  sorting: boolean;
  onEdit?: (item: PackageItem) => void;
  onReorderDetails: (details: PackageDetail[]) => void;
}

function localizedName(
  item: Pick<PackageItem | PackageDetail, "name" | "nameEn" | "nameLa">,
  language: Language,
): string {
  return language === "en"
    ? item.nameEn || item.name || item.nameLa
    : item.nameLa || item.name || item.nameEn;
}

function localizedPrice(price: number, language: Language): string {
  return `${new Intl.NumberFormat(language === "en" ? "en-US" : "lo-LA", {
    maximumFractionDigits: 0,
  }).format(price)} LAK`;
}

export function PackageCard({
  item,
  language,
  reorderDisabled,
  sorting,
  onEdit,
  onReorderDetails,
}: PackageCardProps) {
  const { t } = useTranslation();
  const sensors = useReorderSensors();
  const detailIds = item.details.map(
    (detail, index) => detail.id || `${item.id}-detail-${index}`,
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || reorderDisabled) return;
    const oldIndex = detailIds.indexOf(String(active.id));
    const newIndex = detailIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    onReorderDetails(arrayMove(item.details, oldIndex, newIndex));
  }

  return (
    <Card role="article" className="overflow-hidden shadow-sm">
      <CardHeader className="flex-col gap-3 sm:flex-row">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="min-w-0 truncate text-lg font-black tracking-tight">
              {localizedName(item, language)}
            </CardTitle>
            <StatusBadge
              active={item.status === 1}
              label={
                item.status === 1
                  ? t("packageManagement.active")
                  : t("packageManagement.inactive")
              }
            />
          </div>
          <p className="mt-1 text-xl font-black tabular-nums text-foreground">
            {localizedPrice(item.price, language)}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-11 w-full shrink-0 sm:h-8 sm:w-auto"
          disabled={!onEdit}
          onClick={() => onEdit?.(item)}
        >
          <Pencil data-icon="inline-start" />
          {t("packageManagement.editPackage")}
        </Button>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-bold">
            {t("packageManagement.details")} ({item.details.length})
          </h3>
          {sorting ? (
            <span
              className="text-xs font-medium text-muted-foreground"
              role="status"
            >
              {t("packageManagement.reorderDetails")}
            </span>
          ) : null}
        </div>

        {item.details.length ? (
          <DndContext
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            sensors={sensors}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={detailIds}
              strategy={verticalListSortingStrategy}
            >
              <div className="flex flex-col gap-2">
                {item.details.map((detail, index) => (
                  <SortableDetail
                    key={detailIds[index]}
                    detail={detail}
                    disabled={reorderDisabled || item.details.length < 2}
                    first={index === 0}
                    id={detailIds[index]}
                    language={language}
                    last={index === item.details.length - 1}
                    onMove={(offset) =>
                      onReorderDetails(
                        arrayMove(item.details, index, index + offset),
                      )
                    }
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <p className="rounded-md bg-muted/30 px-3 py-4 text-sm text-muted-foreground">
            {t("packageManagement.detailsRequired")}
          </p>
        )}
      </CardContent>

      <CardFooter className="grid min-w-0 grid-cols-1 gap-2 text-xs text-muted-foreground sm:grid-cols-2">
        <p className="min-w-0 break-words">
          <span className="font-semibold text-foreground">
            {t("packageManagement.packageNameLa")}:
          </span>{" "}
          {item.nameLa || "—"}
        </p>
        <p className="min-w-0 break-words">
          <span className="font-semibold text-foreground">
            {t("packageManagement.packageNameEn")}:
          </span>{" "}
          {item.nameEn || "—"}
        </p>
      </CardFooter>
    </Card>
  );
}

function SortableDetail({
  detail,
  disabled,
  first,
  id,
  language,
  last,
  onMove,
}: {
  detail: PackageDetail;
  disabled: boolean;
  first: boolean;
  id: string;
  language: Language;
  last: boolean;
  onMove: (offset: -1 | 1) => void;
}) {
  const { t } = useTranslation();
  const {
    attributes,
    isDragging,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id, disabled });
  const name = localizedName(detail, language);

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        "flex min-w-0 items-start gap-2 rounded-md border border-border bg-background p-2",
        isDragging && "relative shadow-md",
      )}
    >
      <Button
        type="button"
        size="iconSm"
        variant="ghost"
        className="size-11 shrink-0 cursor-grab touch-none active:cursor-grabbing"
        aria-label={`${t("packageManagement.dragToReorder")} ${name}`}
        disabled={disabled}
        {...attributes}
        {...listeners}
      >
        <GripVertical aria-hidden="true" />
      </Button>

      <div className="min-w-0 flex-1 py-1">
        <p className="break-words text-sm font-bold">{name}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <StatusBadge
            active={detail.status === 1}
            label={
              detail.status === 1
                ? t("packageManagement.active")
                : t("packageManagement.inactive")
            }
          />
          {detail.nameLa && detail.nameEn ? (
            <span className="min-w-0 break-words text-xs text-muted-foreground">
              {language === "en" ? detail.nameLa : detail.nameEn}
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Button
          type="button"
          size="iconSm"
          variant="ghost"
          className="size-11"
          aria-label={`${t("packageManagement.moveUp")} ${name}`}
          title={`${t("packageManagement.moveUp")} ${name}`}
          disabled={disabled || first}
          onClick={() => onMove(-1)}
        >
          <ArrowUp aria-hidden="true" />
        </Button>
        <Button
          type="button"
          size="iconSm"
          variant="ghost"
          className="size-11"
          aria-label={`${t("packageManagement.moveDown")} ${name}`}
          title={`${t("packageManagement.moveDown")} ${name}`}
          disabled={disabled || last}
          onClick={() => onMove(1)}
        >
          <ArrowDown aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
