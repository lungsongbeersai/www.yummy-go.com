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
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle
} from "@/components/ui/item";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SettingsRowActions } from "@/features/settings/shared/settings-shell";
import { SettingsIconTile } from "@/features/settings/shared/settings-tones";
import { cn } from "@/lib/utils";
import type { Taste } from "@/services/taste";
import { tasteId, tasteStatus, tasteValue } from "./taste-utils";

export const TASTE_ICON = Soup;

type TasteListProps = {
  rows: Taste[];
  selectedRows: Set<string>;
  onDelete: (row: Taste) => void;
  onEdit: (row: Taste) => void;
  onToggleSelected: (id: string, checked: boolean) => void;
};

// Lao name leads, English underneath (the old row also repeated both as "LA / EN").
function tasteNames(row: Taste) {
  const la = tasteValue(row, "taste_name_la", tasteValue(row, "taste_name", "-"));
  const en = tasteValue(row, "taste_name_eng");
  return { en: en && en !== la ? en : "", la };
}

function TasteName({ row }: { row: Taste }) {
  const { en, la } = tasteNames(row);
  return (
    <div className="flex items-center gap-3">
      <SettingsIconTile icon={TASTE_ICON} />
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate font-medium">{la}</span>
        {en ? <span className="truncate text-muted-foreground">{en}</span> : null}
      </div>
    </div>
  );
}

// Drag to reorder only works when the whole list is on one page (the order is stored per row).
export function TasteTable({
  allSelected,
  dragEnabled,
  ids,
  pageStart,
  onReorder,
  onToggleAll,
  ...props
}: TasteListProps & {
  allSelected: boolean;
  dragEnabled: boolean;
  ids: string[];
  pageStart: number;
  onReorder: (nextRows: Taste[]) => void;
  onToggleAll: (checked: boolean) => void;
}) {
  const { rows, selectedRows, onDelete, onEdit, onToggleSelected } = props;
  const { t } = useTranslation();
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = rows.findIndex((row) => tasteId(row) === String(active.id));
    const newIndex = rows.findIndex((row) => tasteId(row) === String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(rows, oldIndex, newIndex));
  }

  const body = (
    <TableBody>
      {rows.map((row, index) => {
        const id = tasteId(row);
        const selected = selectedRows.has(id);
        const cells = (
          <>
            <TableCell>
              <Checkbox
                aria-label={t("common.selectRow", { name: tasteNames(row).la })}
                checked={selected}
                onCheckedChange={(checked) => onToggleSelected(id, checked === true)}
              />
            </TableCell>
            <TableCell className="text-center text-muted-foreground tabular-nums">{pageStart + index}</TableCell>
            <TableCell>
              <TasteName row={row} />
            </TableCell>
            <TableCell>
              <StatusBadge active={isActiveStatus(tasteStatus(row))} />
            </TableCell>
            <TableCell className="text-right">
              <SettingsRowActions row={row} onEdit={onEdit} onDelete={onDelete} />
            </TableCell>
          </>
        );

        return dragEnabled ? (
          <SortableTasteRow key={id || index} id={id} selected={selected}>
            {cells}
          </SortableTasteRow>
        ) : (
          <TableRow key={id || index} data-state={selected ? "selected" : undefined}>
            {cells}
          </TableRow>
        );
      })}
    </TableBody>
  );

  const table = (
    <Table containerClassName="min-h-0 flex-1 overflow-auto">
      <TableHeader className="sticky top-0 z-10 bg-muted">
        <TableRow>
          {dragEnabled ? <TableHead className="w-px" aria-hidden /> : null}
          <TableHead className="w-px">
            <Checkbox aria-label={t("common.selectAll")} checked={allSelected} onCheckedChange={(checked) => onToggleAll(checked === true)} />
          </TableHead>
          {/* w-px: handle, checkbox, number and actions shrink to their content. */}
          <TableHead className="w-px text-center">{t("fields.no")}</TableHead>
          <TableHead className="min-w-56">{t("nav.taste")}</TableHead>
          <TableHead>{t("fields.taste_status")}</TableHead>
          <TableHead className="w-px">
            <span className="sr-only">{t("common.actions")}</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      {dragEnabled ? (
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {body}
        </SortableContext>
      ) : (
        body
      )}
    </Table>
  );

  return dragEnabled ? (
    <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={handleDragEnd}>
      {table}
    </DndContext>
  ) : (
    table
  );
}

function SortableTasteRow({ children, id, selected }: { children: ReactNode; id: string; selected: boolean }) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  return (
    <TableRow
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, position: "relative" }}
      data-state={selected ? "selected" : undefined}
      className={cn(isDragging && "bg-background opacity-90 shadow-md")}
    >
      <TableCell>
        <Button aria-label={t("common.reorder")} size="icon-sm" type="button" variant="ghost" {...attributes} {...listeners}>
          <GripVertical aria-hidden />
        </Button>
      </TableCell>
      {children}
    </TableRow>
  );
}

// Narrow pages: one Item per taste, two columns once there is room.
export function TasteMobileList({ rows, selectedRows, onDelete, onEdit, onToggleSelected }: TasteListProps) {
  const { t } = useTranslation();

  return (
    <ItemGroup className="@xl:grid @xl:grid-cols-2">
      {rows.map((row, index) => {
        const id = tasteId(row);
        const { en, la } = tasteNames(row);
        return (
          <Item key={id || index} variant="outline">
            <Checkbox aria-label={t("common.selectRow", { name: la })} checked={selectedRows.has(id)} onCheckedChange={(checked) => onToggleSelected(id, checked === true)} />
            <ItemMedia>
              <SettingsIconTile icon={TASTE_ICON} />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>
                {la}
                <StatusBadge active={isActiveStatus(tasteStatus(row))} />
              </ItemTitle>
              {en ? <ItemDescription>{en}</ItemDescription> : null}
            </ItemContent>
            <ItemActions>
              <SettingsRowActions row={row} onEdit={onEdit} onDelete={onDelete} />
            </ItemActions>
          </Item>
        );
      })}
    </ItemGroup>
  );
}
