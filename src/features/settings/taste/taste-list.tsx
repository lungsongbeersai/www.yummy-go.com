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
import { GripVertical, Soup } from "lucide-react";
import { useTranslation } from "react-i18next";
import { isActiveStatus, StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  SettingsMobileCard,
  SettingsMobileList,
  SettingsMobileMeta,
  SettingsMobileMetaGrid,
  SettingsRowActions,
  SettingsTableScroll,
  SettingsEmptyRecords
} from "@/features/settings/shared/settings-shell";
import { cn } from "@/lib/utils";
import type { Taste } from "@/services/taste";
import { tasteId, tasteName, tasteStatus, tasteValue } from "./taste-utils";

export function TasteListSurface({
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
  rows: Taste[];
  selectedRows: Set<string>;
  title: string;
  toolbar: ReactNode;
  onDelete: (row: Taste) => void;
  onEdit: (row: Taste) => void;
  onReorder: (nextRows: Taste[]) => void;
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
    const oldIndex = rows.findIndex((row) => tasteId(row) === String(active.id));
    const newIndex = rows.findIndex((row) => tasteId(row) === String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(rows, oldIndex, newIndex));
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-border bg-card/95 px-3 py-2.5 backdrop-blur sm:px-4 lg:px-5">
        <div className="flex min-w-0 flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-black">{t("settings.tasteList")}</p>
          </div>
          <div className="min-w-0 xl:max-w-[48rem]">{toolbar}</div>
        </div>
        {backgroundLoading ? (
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Spinner aria-hidden />
            {t("settings.refreshingTasteList")}
          </div>
        ) : null}
      </div>
      {rows.length ? (
        <>
          <div className="hidden min-h-0 flex-1 md:flex">
            <SettingsTableScroll>
              {dragEnabled ? (
                <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={handleDragEnd}>
                  <TasteTable
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
                <TasteTable
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
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto md:hidden">
            <TasteMobileList
              pageStart={pageStart}
              rows={rows}
              selectedRows={selectedRows}
              onDelete={onDelete}
              onEdit={onEdit}
              onToggleSelected={onToggleSelected}
            />
          </div>
        </>
      ) : (
        <SettingsEmptyRecords icon={<Soup aria-hidden />} title={title.toLowerCase()} />
      )}
    </div>
  );
}

function TasteTable({
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
  rows: Taste[];
  selectedRows: Set<string>;
  onDelete: (row: Taste) => void;
  onEdit: (row: Taste) => void;
  onToggleAll: (checked: boolean) => void;
  onToggleSelected: (id: string, checked: boolean) => void;
}) {
  const { t } = useTranslation();
  const tableBody = (
    <TableBody>
      {rows.map((row, index) => {
        const id = tasteId(row);
        const selected = selectedRows.has(id);
        const name = tasteName(row);
        const cells = (
          <>
            <TableCell className="w-10 px-2">
              <Checkbox aria-label={t("common.selectRow", { name })} checked={selected} onCheckedChange={(checked) => onToggleSelected(id, checked as boolean)} />
            </TableCell>
            <TableCell className="w-px whitespace-nowrap px-2 text-center text-sm font-black tabular-nums text-muted-foreground">{pageStart + index}</TableCell>
            <TableCell className="max-w-[28rem]">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                  <Soup aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-black">{name}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {tasteValue(row, "taste_name_la", "-")} / {tasteValue(row, "taste_name_eng", "-")}
                  </p>
                </div>
              </div>
            </TableCell>
            <TableCell>
              <StatusBadge active={isActiveStatus(tasteStatus(row))} />
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
          <SortableTasteRow key={id || index} id={id} selected={selected}>
            {cells}
          </SortableTasteRow>
        );
      })}
    </TableBody>
  );

  return (
    <Table className="min-w-[720px]">
      <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur">
        <TableRow>
          {dragEnabled ? <TableHead className="w-10 px-2" aria-hidden /> : null}
          <TableHead className="w-10 px-2">
            <Checkbox aria-label={t("common.selectAll")} checked={allSelected} onCheckedChange={(checked) => onToggleAll(checked as boolean)} />
          </TableHead>
          <TableHead className="w-px whitespace-nowrap px-2 text-center">{t("fields.no")}</TableHead>
          <TableHead>{t("nav.taste")}</TableHead>
          <TableHead>{t("fields.taste_status")}</TableHead>
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

function SortableTasteRow({ children, id, selected }: { children: ReactNode; id: string; selected: boolean }) {
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
        <Button aria-label={t("common.reorder")} size="icon-sm" type="button" variant="ghost" {...attributes} {...listeners}>
          <GripVertical aria-hidden />
        </Button>
      </TableCell>
      {children}
    </TableRow>
  );
}

function TasteMobileList({
  pageStart,
  rows,
  selectedRows,
  onDelete,
  onEdit,
  onToggleSelected
}: {
  pageStart: number;
  rows: Taste[];
  selectedRows: Set<string>;
  onDelete: (row: Taste) => void;
  onEdit: (row: Taste) => void;
  onToggleSelected: (id: string, checked: boolean) => void;
}) {
  const { t } = useTranslation();

  return (
    <SettingsMobileList>
      {rows.map((row, index) => {
        const id = tasteId(row);
        const name = tasteName(row);
        const selected = selectedRows.has(id);
        return (
          <SettingsMobileCard
            key={id || index}
            actions={<SettingsRowActions row={row} onEdit={onEdit} onDelete={onDelete} />}
            badges={<StatusBadge active={isActiveStatus(tasteStatus(row))} />}
            checked={selected}
            leading={
              <span className="grid size-10 place-items-center rounded-md bg-primary/10 text-primary">
                <Soup aria-hidden />
              </span>
            }
            selectLabel={t("common.selectRow", { name })}
            selected={selected}
            subtitle={`${tasteValue(row, "taste_name_la", "-")} / ${tasteValue(row, "taste_name_eng", "-")}`}
            title={name}
            onCheckedChange={(checked) => onToggleSelected(id, checked)}
          >
            <SettingsMobileMetaGrid>
              <SettingsMobileMeta label={t("fields.no")} value={pageStart + index} />
            </SettingsMobileMetaGrid>
          </SettingsMobileCard>
        );
      })}
    </SettingsMobileList>
  );
}
