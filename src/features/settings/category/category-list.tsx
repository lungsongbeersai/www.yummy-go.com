"use client";

import type { ReactNode } from "react";
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  SettingsListSurface,
  SettingsMobileCard,
  SettingsMobileList,
  SettingsMobileMeta,
  SettingsMobileMetaGrid,
  SettingsRowActions,
  SettingsTableScroll,
} from "@/features/settings/shared/settings-shell";
import { cn } from "@/lib/utils";
import type { Category } from "@/services/category";
import { CategoryIcon } from "./category-icon";
import { CategoryCodeBadge, CategoryIdentity } from "./category-display";
import {
  categoryId,
  categoryName,
  categoryValue,
  groupLabel
} from "./category-utils";

export function CategoryListSurface({
  allSelected,
  backgroundLoading,
  dragEnabled,
  ids,
  pageStart,
  rows,
  selectedRows,
  title,
  toolbar,
  onDelete,
  onEdit,
  onReorder,
  onToggleAll,
  onToggleSelected
}: {
  allSelected: boolean;
  backgroundLoading: boolean;
  dragEnabled: boolean;
  ids: string[];
  pageStart: number;
  rows: Category[];
  selectedRows: Set<string>;
  title: string;
  toolbar: ReactNode;
  onDelete: (row: Category) => void;
  onEdit: (row: Category) => void;
  onReorder: (nextRows: Category[]) => void;
  onToggleAll: (checked: boolean) => void;
  onToggleSelected: (id: string, checked: boolean) => void;
}) {
  const { t } = useTranslation();
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    if (!dragEnabled) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = rows.findIndex((row) => categoryId(row) === String(active.id));
    const newIndex = rows.findIndex((row) => categoryId(row) === String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(rows, oldIndex, newIndex));
  }

  return (
    <SettingsListSurface
      backgroundLoading={backgroundLoading}
      emptyIcon={<CategoryIcon value="" />}
      emptyTitle={title.toLowerCase()}
      hasRows={rows.length > 0}
      listTitle={t("settings.categoryList")}
      mobileList={
        <CategoryMobileList
          pageStart={pageStart}
          rows={rows}
          selectedRows={selectedRows}
          onDelete={onDelete}
          onEdit={onEdit}
          onToggleSelected={onToggleSelected}
        />
      }
      refreshLabel={t("settings.refreshingCategoryList")}
      table={
        <SettingsTableScroll>
          {dragEnabled ? (
            <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={handleDragEnd}>
              <CategoryTable
                allSelected={allSelected}
                dragEnabled
                ids={ids}
                pageStart={pageStart}
                rows={rows}
                selectedRows={selectedRows}
                onDelete={onDelete}
                onEdit={onEdit}
                onToggleAll={onToggleAll}
                onToggleSelected={onToggleSelected}
              />
            </DndContext>
          ) : (
            <CategoryTable
              allSelected={allSelected}
              dragEnabled={false}
              ids={ids}
              pageStart={pageStart}
              rows={rows}
              selectedRows={selectedRows}
              onDelete={onDelete}
              onEdit={onEdit}
              onToggleAll={onToggleAll}
              onToggleSelected={onToggleSelected}
            />
          )}
        </SettingsTableScroll>
      }
      toolbar={toolbar}
    />
  );
}

function CategoryTable({
  allSelected,
  dragEnabled,
  ids,
  pageStart,
  rows,
  selectedRows,
  onDelete,
  onEdit,
  onToggleAll,
  onToggleSelected
}: {
  allSelected: boolean;
  dragEnabled: boolean;
  ids: string[];
  pageStart: number;
  rows: Category[];
  selectedRows: Set<string>;
  onDelete: (row: Category) => void;
  onEdit: (row: Category) => void;
  onToggleAll: (checked: boolean) => void;
  onToggleSelected: (id: string, checked: boolean) => void;
}) {
  const { t } = useTranslation();
  const tableBody = (
    <TableBody>
      {rows.map((row, index) => {
        const id = categoryId(row);
        const selected = selectedRows.has(id);
        const iconValue = categoryValue(row, "cate_icon");
        const name = categoryName(row);
        const cells = (
          <>
            <TableCell className="w-10 px-2">
              <Checkbox aria-label={t("common.selectRow", { name })} checked={selected} onChange={(event) => onToggleSelected(id, event.target.checked)} />
            </TableCell>
            <TableCell className="w-px whitespace-nowrap px-2 text-center text-sm font-black tabular-nums text-muted-foreground">{pageStart + index}</TableCell>
            <TableCell className="max-w-[30rem]">
              <CategoryIdentity row={row} />
            </TableCell>
            <TableCell className="max-w-[18rem] text-muted-foreground">
              <span className="block truncate">{groupLabel(row)}</span>
            </TableCell>
            <TableCell className="max-w-[14rem]">
              <CategoryCodeBadge iconValue={iconValue} />
            </TableCell>
            <TableCell className="text-right">
              <SettingsRowActions row={row} onEdit={onEdit} onDelete={onDelete} />
            </TableCell>
          </>
        );

        if (!dragEnabled) {
          return (
            <TableRow key={id || index} className="h-14" data-state={selected ? "selected" : undefined}>
              {cells}
            </TableRow>
          );
        }

        return (
          <SortableCategoryRow key={id || index} id={id} selected={selected}>
            {cells}
          </SortableCategoryRow>
        );
      })}
    </TableBody>
  );

  return (
    <Table className="min-w-[980px]">
      <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur">
        <TableRow>
          {dragEnabled ? <TableHead className="w-10 px-2" aria-hidden /> : null}
          <TableHead className="w-10 px-2">
            <Checkbox aria-label={t("common.selectAll")} checked={allSelected} onChange={(event) => onToggleAll(event.target.checked)} />
          </TableHead>
          <TableHead className="w-px whitespace-nowrap px-2 text-center">{t("fields.no")}</TableHead>
          <TableHead>{t("nav.category")}</TableHead>
          <TableHead>{t("nav.food_group")}</TableHead>
          <TableHead>{t("fields.icon")}</TableHead>
          <TableHead className="w-16 text-right">{t("common.actions")}</TableHead>
        </TableRow>
      </TableHeader>
      {dragEnabled ? (
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {tableBody}
        </SortableContext>
      ) : (
        tableBody
      )}
    </Table>
  );
}

function SortableCategoryRow({ children, id, selected }: { children: ReactNode; id: string; selected: boolean }) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : 1,
    position: "relative" as const
  };

  return (
    <TableRow ref={setNodeRef} style={style} data-state={selected ? "selected" : undefined} className={cn("h-14", isDragging && "shadow-md")}>
      <TableCell className="w-10 px-2">
        <Button aria-label={t("common.reorder")} size="iconSm" type="button" variant="ghost" {...attributes} {...listeners}>
          <GripVertical aria-hidden />
        </Button>
      </TableCell>
      {children}
    </TableRow>
  );
}

function CategoryMobileList({
  pageStart,
  rows,
  selectedRows,
  onDelete,
  onEdit,
  onToggleSelected
}: {
  pageStart: number;
  rows: Category[];
  selectedRows: Set<string>;
  onDelete: (row: Category) => void;
  onEdit: (row: Category) => void;
  onToggleSelected: (id: string, checked: boolean) => void;
}) {
  const { t } = useTranslation();

  return (
    <SettingsMobileList>
      {rows.map((row, index) => {
        const id = categoryId(row);
        const name = categoryName(row);
        const selected = selectedRows.has(id);
        const iconValue = categoryValue(row, "cate_icon");
        return (
          <SettingsMobileCard
            key={id || index}
            actions={<SettingsRowActions row={row} onEdit={onEdit} onDelete={onDelete} />}
            badges={<Badge className="shrink-0 tabular-nums">{pageStart + index}</Badge>}
            checked={selected}
            leading={
              <span className="grid size-10 place-items-center rounded-md bg-primary/10 text-primary">
                <CategoryIcon value={iconValue} />
              </span>
            }
            selectLabel={t("common.selectRow", { name })}
            selected={selected}
            title={name}
            onCheckedChange={(checked) => onToggleSelected(id, checked)}
          >
            <SettingsMobileMetaGrid>
              <SettingsMobileMeta label={t("fields.nameLa")} value={categoryValue(row, "cate_name_la", "-")} />
              <SettingsMobileMeta label={t("fields.nameEn")} value={categoryValue(row, "cate_name_eng", "-")} />
              <SettingsMobileMeta label={t("nav.food_group")} value={groupLabel(row)} />
              <SettingsMobileMeta label={t("fields.icon")} value={<CategoryCodeBadge iconValue={iconValue} />} />
            </SettingsMobileMetaGrid>
          </SettingsMobileCard>
        );
      })}
    </SettingsMobileList>
  );
}
