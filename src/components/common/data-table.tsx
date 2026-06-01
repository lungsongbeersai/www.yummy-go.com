"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  GripVertical,
  Menu,
  Pencil,
  Trash2
} from "lucide-react";
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
import { compactText } from "@/lib/format";
import { DEFAULT_PAGE_LIMIT, PAGE_LIMIT_OPTIONS, isAllPageLimit, pageLimitSize } from "@/lib/pagination";
import { cn } from "@/lib/utils";
import type { PageLimit } from "@/services/shared/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export interface TableColumn<T> {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  className?: string;
  headClassName?: string;
  render?: (row: T) => ReactNode;
}

export interface TableRowAction<T> {
  id?: string;
  label: string | ((row: T) => string);
  icon?: ReactNode | ((row: T) => ReactNode);
  disabled?: boolean | ((row: T) => boolean);
  destructive?: boolean;
  keepOpenOnSelect?: boolean;
  onSelect: (row: T) => void;
}

interface DataTableProps<T extends Record<string, unknown>> {
  rows: T[];
  columns: TableColumn<T>[];
  idKey: keyof T;
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
  actions?: TableRowAction<T>[];
  selectable?: boolean;
  onSelectionChange?: (selected: T[]) => void;
  draggable?: boolean;
  onReorder?: (rows: T[]) => void;
  pagination?: boolean;
  pageSize?: PageLimit;
  pageSizeOptions?: PageLimit[];
}

function cellAlignClass(align?: "left" | "right" | "center") {
  if (align === "right") return "text-right";
  if (align === "center") return "text-center";
  return undefined;
}

export function DataTable<T extends Record<string, unknown>>({
  rows,
  columns,
  idKey,
  onEdit,
  onDelete,
  actions = [],
  selectable = false,
  onSelectionChange,
  draggable = false,
  onReorder,
  pagination = false,
  pageSize: initialPageSize = DEFAULT_PAGE_LIMIT,
  pageSizeOptions = PAGE_LIMIT_OPTIONS
}: DataTableProps<T>) {
  const { t } = useTranslation();
  const showActions = Boolean(onEdit || actions.length || onDelete);
  const totalColumns =
    columns.length + (draggable ? 1 : 0) + (selectable ? 1 : 0) + (showActions ? 1 : 0);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState<PageLimit>(initialPageSize);

  const totalRows = rows.length;
  const activePageSize = pageLimitSize(pageSize, totalRows);
  const totalPages = pagination && !isAllPageLimit(pageSize) ? Math.max(1, Math.ceil(totalRows / activePageSize)) : 1;

  useEffect(() => {
    if (pageIndex > totalPages - 1) setPageIndex(Math.max(0, totalPages - 1));
  }, [pageIndex, totalPages]);

  const visibleRows = useMemo(() => {
    if (!pagination) return rows;
    if (isAllPageLimit(pageSize)) return rows;
    const start = pageIndex * activePageSize;
    return rows.slice(start, start + activePageSize);
  }, [rows, pagination, pageIndex, pageSize, activePageSize]);

  const visibleIds = useMemo(
    () => visibleRows.map((row) => String(row[idKey])),
    [visibleRows, idKey]
  );

  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));

  function notifySelection(next: Set<string>) {
    setSelected(next);
    if (onSelectionChange) {
      const selectedRows = rows.filter((row) => next.has(String(row[idKey])));
      onSelectionChange(selectedRows);
    }
  }

  function toggleRow(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    notifySelection(next);
  }

  function togglePage() {
    const next = new Set(selected);
    if (allVisibleSelected) visibleIds.forEach((id) => next.delete(id));
    else visibleIds.forEach((id) => next.add(id));
    notifySelection(next);
  }

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = rows.findIndex((row) => String(row[idKey]) === active.id);
    const newIndex = rows.findIndex((row) => String(row[idKey]) === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder?.(arrayMove(rows, oldIndex, newIndex));
  }

  const renderActions = (row: T) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button aria-label={t("common.actions")} size="iconSm" type="button" variant="ghost">
          <Menu />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuGroup>
          {onEdit ? (
            <DropdownMenuItem onSelect={() => onEdit(row)}>
              <Pencil />
              {t("actions.edit")}
            </DropdownMenuItem>
          ) : null}
          {actions.map((action, index) => {
            const label = typeof action.label === "function" ? action.label(row) : action.label;
            const disabled = typeof action.disabled === "function" ? action.disabled(row) : action.disabled;
            const icon = typeof action.icon === "function" ? action.icon(row) : action.icon;
            return (
              <DropdownMenuItem
                key={action.id ?? index}
                disabled={disabled}
                variant={action.destructive ? "destructive" : "default"}
                onSelect={(event) => {
                  if (action.keepOpenOnSelect) event.preventDefault();
                  action.onSelect(row);
                }}
              >
                {icon}
                {label}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>
        {onDelete ? (
          <>
            {onEdit || actions.length ? <DropdownMenuSeparator /> : null}
            <DropdownMenuGroup>
              <DropdownMenuItem variant="destructive" onSelect={() => onDelete(row)}>
                <Trash2 />
                {t("actions.delete")}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const renderCells = (row: T) =>
    columns.map((column) => (
      <TableCell key={column.key} className={cn(cellAlignClass(column.align), column.className)}>
        {column.render ? column.render(row) : compactText(row[column.key])}
      </TableCell>
    ));

  const body = (
    <TableBody className="bg-card">
      {visibleRows.length === 0 ? (
        <TableRow>
          <TableCell colSpan={totalColumns} className="h-24 text-center text-muted-foreground">
            {t("common.noData")}
          </TableCell>
        </TableRow>
      ) : (
        visibleRows.map((row) => {
          const id = String(row[idKey]);
          const isSelected = selected.has(id);
          if (draggable) {
            return (
              <SortableRow
                key={id}
                id={id}
                selected={isSelected}
                selectable={selectable}
                onToggle={() => toggleRow(id)}
                reorderLabel={t("common.reorder")}
                selectLabel={t("common.actions")}
              >
                {renderCells(row)}
                {showActions ? (
                  <TableCell className="text-right">{renderActions(row)}</TableCell>
                ) : null}
              </SortableRow>
            );
          }
          return (
            <TableRow key={id} data-state={isSelected ? "selected" : undefined}>
              {selectable ? (
                <TableCell className="w-10">
                  <Checkbox
                    aria-label={t("common.actions")}
                    checked={isSelected}
                    onChange={() => toggleRow(id)}
                  />
                </TableCell>
              ) : null}
              {renderCells(row)}
              {showActions ? (
                <TableCell className="text-right">{renderActions(row)}</TableCell>
              ) : null}
            </TableRow>
          );
        })
      )}
    </TableBody>
  );

  const header = (
    <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur">
      <TableRow>
        {draggable ? <TableHead className="w-8" aria-hidden /> : null}
        {selectable ? (
          <TableHead className="w-10">
            <Checkbox
              aria-label="select all"
              checked={allVisibleSelected}
              onChange={togglePage}
            />
          </TableHead>
        ) : null}
        {columns.map((column) => (
          <TableHead
            key={column.key}
            className={cn(cellAlignClass(column.align), column.headClassName)}
          >
            {column.label}
          </TableHead>
        ))}
        {showActions ? (
          <TableHead className="w-16 text-right">{t("common.actions")}</TableHead>
        ) : null}
      </TableRow>
    </TableHeader>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <Table className="min-w-[820px]">
          {header}
          {draggable ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              modifiers={[restrictToVerticalAxis]}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={visibleIds} strategy={verticalListSortingStrategy}>
                {body}
              </SortableContext>
            </DndContext>
          ) : (
            body
          )}
        </Table>
      </div>

      {pagination || selectable ? (
        <div className="flex flex-wrap items-center justify-between gap-4 px-1 text-[13px] text-muted-foreground">
          <div className="min-w-0">
            {selectable
              ? t("common.selected", { count: selected.size, total: totalRows })
              : null}
          </div>
          {pagination ? (
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span>{t("common.rowsPerPage")}</span>
                <Select
                  value={String(pageSize)}
                  onValueChange={(value) => {
                    setPageSize(value === "All" ? "All" : Number(value));
                    setPageIndex(0);
                  }}
                >
                  <SelectTrigger size="sm" className="h-8 w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {pageSizeOptions.map((option) => (
                        <SelectItem key={String(option)} value={String(option)}>
                          {option === "All" ? t("common.all") : option}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <span>{t("common.page", { current: pageIndex + 1, total: totalPages })}</span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="iconSm"
                  aria-label={t("common.firstPage")}
                  disabled={pageIndex === 0}
                  onClick={() => setPageIndex(0)}
                >
                  <ChevronsLeft />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="iconSm"
                  aria-label={t("common.previousPage")}
                  disabled={pageIndex === 0}
                  onClick={() => setPageIndex((index) => Math.max(0, index - 1))}
                >
                  <ChevronLeft />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="iconSm"
                  aria-label={t("common.nextPage")}
                  disabled={pageIndex >= totalPages - 1}
                  onClick={() => setPageIndex((index) => Math.min(totalPages - 1, index + 1))}
                >
                  <ChevronRight />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="iconSm"
                  aria-label={t("common.lastPage")}
                  disabled={pageIndex >= totalPages - 1}
                  onClick={() => setPageIndex(totalPages - 1)}
                >
                  <ChevronsRight />
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

interface SortableRowProps {
  id: string;
  selected: boolean;
  selectable: boolean;
  onToggle: () => void;
  reorderLabel: string;
  selectLabel: string;
  children: ReactNode;
}

function SortableRow({
  id,
  selected,
  selectable,
  onToggle,
  reorderLabel,
  selectLabel,
  children
}: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    position: "relative" as const,
    opacity: isDragging ? 0.85 : 1
  };
  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      data-state={selected ? "selected" : undefined}
      className={cn(isDragging && "shadow-md")}
    >
      <TableCell className="w-8 px-2">
        <Button
          type="button"
          variant="ghost"
          size="iconSm"
          aria-label={reorderLabel}
          className="text-muted-foreground hover:text-foreground"
          {...attributes}
          {...listeners}
        >
          <GripVertical />
        </Button>
      </TableCell>
      {selectable ? (
        <TableCell className="w-10">
          <Checkbox aria-label={selectLabel} checked={selected} onChange={onToggle} />
        </TableCell>
      ) : null}
      {children}
    </TableRow>
  );
}
