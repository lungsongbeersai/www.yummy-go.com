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
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemGroup,
  ItemMedia,
  ItemTitle
} from "@/components/ui/item";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SettingsRowActions } from "@/features/settings/shared/settings-shell";
import { cn } from "@/lib/utils";
import type { Category } from "@/services/category";
import { CategoryIconTile, categoryNames } from "./category-display";
import { categoryId, groupLabel } from "./category-utils";

type CategoryListProps = {
  rows: Category[];
  selectedRows: Set<string>;
  onDelete: (row: Category) => void;
  onEdit: (row: Category) => void;
  onToggleSelected: (id: string, checked: boolean) => void;
};

// The old table also had an "icon" column printing the raw icon code (e.g. "mdi-food"); the icon
// itself now sits in the tile beside the name, and the code is still picked in the form.
function CategoryName({ row }: { row: Category }) {
  const { en, la } = categoryNames(row);
  return (
    <div className="flex items-center gap-3">
      <CategoryIconTile row={row} />
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate font-medium">{la}</span>
        {en ? <span className="truncate text-muted-foreground">{en}</span> : null}
      </div>
    </div>
  );
}

// Drag to reorder only works when the whole list is on one page (the order is saved as a whole).
export function CategoryTable({
  allSelected,
  dragEnabled,
  ids,
  pageStart,
  onReorder,
  onToggleAll,
  ...props
}: CategoryListProps & {
  allSelected: boolean;
  dragEnabled: boolean;
  ids: string[];
  pageStart: number;
  onReorder: (nextRows: Category[]) => void;
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
    const oldIndex = rows.findIndex((row) => categoryId(row) === String(active.id));
    const newIndex = rows.findIndex((row) => categoryId(row) === String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(rows, oldIndex, newIndex));
  }

  const body = (
    <TableBody>
      {rows.map((row, index) => {
        const id = categoryId(row);
        const selected = selectedRows.has(id);
        const cells = (
          <>
            <TableCell>
              <Checkbox
                aria-label={t("common.selectRow", { name: categoryNames(row).la })}
                checked={selected}
                onCheckedChange={(checked) => onToggleSelected(id, checked === true)}
              />
            </TableCell>
            <TableCell className="text-center text-muted-foreground tabular-nums">{pageStart + index}</TableCell>
            <TableCell>
              <CategoryName row={row} />
            </TableCell>
            <TableCell className="text-muted-foreground">{groupLabel(row)}</TableCell>
            <TableCell className="text-right">
              <SettingsRowActions row={row} onEdit={onEdit} onDelete={onDelete} />
            </TableCell>
          </>
        );

        return dragEnabled ? (
          <SortableCategoryRow key={id || index} id={id} selected={selected}>
            {cells}
          </SortableCategoryRow>
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
          <TableHead className="min-w-56">{t("nav.category")}</TableHead>
          <TableHead>{t("nav.food_group")}</TableHead>
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

function SortableCategoryRow({ children, id, selected }: { children: ReactNode; id: string; selected: boolean }) {
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

// Narrow pages: one Item per category — icon tile, names, then its food group. Two columns once
// there is room.
export function CategoryMobileList({ rows, selectedRows, onDelete, onEdit, onToggleSelected }: CategoryListProps) {
  const { t } = useTranslation();

  return (
    <ItemGroup className="@xl:grid @xl:grid-cols-2">
      {rows.map((row, index) => {
        const id = categoryId(row);
        const { en, la } = categoryNames(row);
        return (
          <Item key={id || index} variant="outline">
            <Checkbox aria-label={t("common.selectRow", { name: la })} checked={selectedRows.has(id)} onCheckedChange={(checked) => onToggleSelected(id, checked === true)} />
            <ItemMedia>
              <CategoryIconTile row={row} />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>{la}</ItemTitle>
              {en ? <ItemDescription>{en}</ItemDescription> : null}
            </ItemContent>
            <ItemActions>
              <SettingsRowActions row={row} onEdit={onEdit} onDelete={onDelete} />
            </ItemActions>
            <ItemFooter className="justify-start gap-1.5">
              <span className="text-muted-foreground">{t("nav.food_group")}:</span>
              {groupLabel(row)}
            </ItemFooter>
          </Item>
        );
      })}
    </ItemGroup>
  );
}
