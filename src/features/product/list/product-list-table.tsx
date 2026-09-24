"use client";

import { useState, type ReactNode } from "react";
import { DndContext, MeasuringStrategy, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Boxes, ChevronRight, ChevronsUpDown, GripVertical, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useReorderSensors } from "@/hooks/use-reorder-sensors";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  binaryFlag,
  categoryName,
  detailLabel,
  detailStockQty,
  detailStockSummary,
  productDetails,
  productDetailUuid,
  productName,
  productOrderPoint,
  shortDate,
  shortTime,
  unitName
} from "./product-list-utils";
import { ProductListActions } from "./product-list-actions";
import { ProductMedia } from "./product-list-media";
import {
  ProductEnabledSwitch,
  ProductStockBadge,
  ProductStockSelect,
  stockSummaryLabel
} from "./product-list-status";
import type { ProductStatusKey, ProductTableRow } from "./product-list-types";
import type { ProductListWorkflow } from "./use-product-list-workflow";

function ProductNotificationSwitch({
  row,
  workflow
}: {
  row: ProductTableRow;
  workflow: ProductListWorkflow;
}) {
  const notificationKey: ProductStatusKey = `notification:${row.prod_uuid}`;
  const checked = binaryFlag(row.prod_notification, "2") === "1";
  const disabled = workflow.pendingKeys.has(notificationKey);

  return (
    <div className="flex items-center gap-2 whitespace-nowrap">
      <Switch
        checked={checked}
        disabled={disabled}
        size="sm"
        aria-label={workflow.t("product.notification.label")}
        onCheckedChange={(nextChecked) => workflow.updateNotification(row, nextChecked)}
      />
      <span className="text-xs text-muted-foreground">
        {checked ? workflow.t("common.active") : workflow.t("common.inactive")}
      </span>
    </div>
  );
}

function ProductStockModeSwitch({
  row,
  workflow
}: {
  row: ProductTableRow;
  workflow: ProductListWorkflow;
}) {
  const details = productDetails(row);
  const pendingKey: ProductStatusKey = `stock-all:${row.prod_uuid}`;
  const pendingMode = workflow.pendingBulkStockModes[row.prod_uuid];

  if (!details.length) {
    return <span className="text-xs text-muted-foreground">{workflow.t("common.noData")}</span>;
  }

  const summary = detailStockSummary(details);
  const checked = pendingMode ? pendingMode === 1 : summary === "deduct";
  const label = pendingMode
    ? pendingMode === 1
      ? workflow.t("product.stockMode.deduct")
      : workflow.t("product.stockMode.noDeduct")
    : stockSummaryLabel(workflow, summary);

  return (
    <div className="flex items-center gap-2 whitespace-nowrap">
      <Switch
        checked={checked}
        disabled={workflow.pendingKeys.has(pendingKey)}
        size="sm"
        aria-label={workflow.t("product.stockBulk.label")}
        onCheckedChange={(nextChecked) => workflow.updateAllDetailStockModes(row, nextChecked ? 1 : 2)}
      />
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function SortableRow({
  children,
  className,
  dragEnabled,
  handleHint,
  handleLabel,
  id,
  selected,
  onUnavailable
}: {
  children: (dragHandle: ReactNode) => ReactNode;
  className?: string;
  dragEnabled: boolean;
  handleHint?: string;
  handleLabel: string;
  id: string;
  selected?: boolean;
  onUnavailable?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !dragEnabled
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : 1,
    position: "relative" as const
  };
  const dragHandle = dragEnabled ? (
    <Button
      aria-label={handleLabel}
      title={handleLabel}
      size="icon-sm"
      type="button"
      variant="ghost"
      className="cursor-grab touch-none active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      <GripVertical aria-hidden />
    </Button>
  ) : onUnavailable ? (
    <Button
      aria-disabled
      aria-label={handleHint ?? handleLabel}
      title={handleHint ?? handleLabel}
      size="icon-sm"
      type="button"
      variant="ghost"
      className="opacity-50"
      onClick={onUnavailable}
    >
      <GripVertical aria-hidden />
    </Button>
  ) : (
    <span title={handleHint ?? handleLabel}>
      <Button aria-label={handleHint ?? handleLabel} size="icon-sm" type="button" variant="ghost" disabled>
        <GripVertical aria-hidden />
      </Button>
    </span>
  );

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      data-state={selected ? "selected" : undefined}
      className={cn(className, isDragging && "z-10 shadow-md")}
    >
      {children(dragHandle)}
    </TableRow>
  );
}

function ProductDetailRows({
  row,
  workflow
}: {
  row: ProductTableRow;
  workflow: ProductListWorkflow;
}) {
  const sensors = useReorderSensors();
  const details = productDetails(row);
  const isPromotion = String(workflow.statusSortFk) === "3";
  const isFoodSet = String(workflow.statusSortFk) === "2";
  const detailIds = details.map((detail, index) => productDetailUuid(detail) || `${row.prod_uuid}-${index}`);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    void workflow.reorderProductDetail(row, String(active.id), String(over.id));
  }

  if (!details.length) return null;

  return (
    <DndContext
      accessibility={{ container: typeof document === "undefined" ? undefined : document.body }}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      sensors={sensors}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={detailIds} strategy={verticalListSortingStrategy}>
        {details.map((detail, index) => {
          const detailUuid = detailIds[index];
          const enabled = binaryFlag(detail.pro_detail_enabled, "1") === "1";

          return (
            <SortableRow
              key={detailUuid}
              className="bg-muted/10 hover:bg-muted/20 [&>td]:whitespace-nowrap [&>td]:py-2.5"
              dragEnabled={workflow.canSortProductDetails && details.length > 1}
              handleLabel={workflow.t("common.reorder")}
              id={detailUuid}
            >
              {(dragHandle) => (
              <>
        <TableCell className="w-10 px-2" />
        <TableCell>
          <div className="flex items-center justify-center gap-1 whitespace-nowrap">
            <Badge variant="outline" className="h-7 min-w-8 justify-center px-2 font-mono text-xs tabular-nums">
              {index + 1}
            </Badge>
            {dragHandle}
          </div>
        </TableCell>
        <TableCell />
        <TableCell>
          <div className="min-w-0 border-l border-border pl-4">
            <p className="truncate text-sm font-black">{detailLabel(detail, index, workflow.language)}</p>
          </div>
        </TableCell>
        <TableCell className="font-mono text-sm font-semibold tabular-nums">
          {money(detail.pro_detail_bprice)}
        </TableCell>
        <TableCell className="font-mono text-sm font-semibold tabular-nums">
          {isFoodSet ? money(row.prod_set_price) : money(detail.pro_detail_sprice)}
        </TableCell>
        <TableCell className="font-mono text-sm font-semibold tabular-nums">{detailStockQty(detail)}</TableCell>
        <TableCell />
        <TableCell>
          {isFoodSet ? (
            <ProductStockSelect compact detail={detail} prodUuid={row.prod_uuid} workflow={workflow} />
          ) : (
            <ProductStockBadge compact detail={detail} workflow={workflow} />
          )}
        </TableCell>
        <TableCell />
        <TableCell>
          <div className="flex items-center gap-2 whitespace-nowrap">
            <ProductEnabledSwitch detail={detail} workflow={workflow} />
            <span className="text-xs text-muted-foreground">
              {enabled ? workflow.t("common.active") : workflow.t("common.inactive")}
            </span>
          </div>
        </TableCell>
        {isPromotion ? (
          <TableCell>
            <div className="min-w-0 text-xs text-muted-foreground">
              <p className="truncate">
                {workflow.t("product.buyQty")}: {String(detail.pro_detail_cus_qtyBuy ?? 0)} /{" "}
                {workflow.t("product.freeQty")}: {String(detail.pro_detail_cus_qtyFree ?? 0)}
              </p>
              <p className="truncate">
                {shortDate(detail.pro_detail_sDate)} - {shortDate(detail.pro_detail_eDate)}
              </p>
              <p className="truncate">
                {shortTime(detail.pro_detail_sTime)} - {shortTime(detail.pro_detail_eTime)}
              </p>
            </div>
          </TableCell>
        ) : null}
        <TableCell />
              </>
              )}
            </SortableRow>
          );
        })}
      </SortableContext>
    </DndContext>
  );
}

export function ProductListTable({ workflow }: { workflow: ProductListWorkflow }) {
  const isPromotion = String(workflow.statusSortFk) === "3";
  const isFoodSet = String(workflow.statusSortFk) === "2";
  const [dragging, setDragging] = useState(false);
  const sensors = useReorderSensors();

  function handleDragEnd(event: DragEndEvent) {
    setDragging(false);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    void workflow.reorderProduct(String(active.id), String(over.id));
  }

  return (
    <div className="relative hidden min-h-0 flex-1 overflow-auto md:block">
      <DndContext
        collisionDetection={closestCenter}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        modifiers={[restrictToVerticalAxis]}
        sensors={sensors}
        onDragCancel={() => setDragging(false)}
        onDragEnd={handleDragEnd}
        onDragStart={() => setDragging(true)}
      >
      <Table className="w-max min-w-full table-auto">
        <TableHeader className="sticky top-0 z-40 bg-background shadow-sm [&_th]:sticky [&_th]:top-0 [&_th]:z-40 [&_th]:whitespace-nowrap [&_th]:border-b [&_th]:border-border [&_th]:bg-background [&_th]:shadow-sm">
          <TableRow>
            <TableHead className="w-10 px-2">
              <Checkbox
                aria-label={workflow.t("common.selectAll")}
                checked={workflow.allSelected}
                onCheckedChange={(checked) => workflow.toggleAllSelected(checked as boolean)}
              />
            </TableHead>
            <TableHead className="w-28 text-center">{workflow.t("common.order")}</TableHead>
            <TableHead>{workflow.t("nav.category")}</TableHead>
            <TableHead>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label={
                    workflow.allDetailsExpanded ? workflow.t("actions.collapseAll") : workflow.t("actions.expandAll")
                  }
                  aria-expanded={workflow.allDetailsExpanded}
                  disabled={!workflow.detailProductIds.length}
                  onClick={workflow.toggleAllDetails}
                >
                  <ChevronsUpDown />
                </Button>
                <span>{workflow.t("fields.prod_name")}</span>
              </div>
            </TableHead>
            <TableHead>{workflow.t("fields.bprice")}</TableHead>
            <TableHead>{isFoodSet ? workflow.t("product.setPrice") : workflow.t("fields.sprice")}</TableHead>
            <TableHead>{workflow.t("fields.qtyStock")}</TableHead>
            <TableHead>{workflow.t("product.orderPoint")}</TableHead>
            <TableHead>{workflow.t("product.stockBulk.label")}</TableHead>
            <TableHead>{workflow.t("product.notification.label")}</TableHead>
            <TableHead>{workflow.t("product.detailEnabledStatus")}</TableHead>
            {isPromotion ? <TableHead>{workflow.t("product.promotionTime.label")}</TableHead> : null}
            <TableHead className="text-right">{workflow.t("common.actions")}</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody className="bg-card">
          <SortableContext
            items={workflow.filteredRows.map((row) => row.prod_uuid)}
            strategy={verticalListSortingStrategy}
          >
          {workflow.filteredRows.flatMap((row, index) => {
            const details = productDetails(row);
            const hasDetails = details.length > 0;
            const expanded = hasDetails && !workflow.collapsedProducts.has(row.prod_uuid) && !dragging;
            const selected = workflow.selectedRows.has(row.prod_uuid);
            const orderPoint = productOrderPoint(row);

            const rowsToRender = [
              <SortableRow
                key={row.prod_uuid}
                className={cn(
                  // แถบสลับสีอ่อนๆ ต่อแถว ช่วยตาไล่ตามแถวในตารางที่มีคอลัมน์เยอะ (13 คอลัมน์) — เดิมทุกแถวสีเดียวกันหมด
                  // ดูเป็นผืนเดียวรวมกัน data-[state=selected] ยังชนะอยู่เพราะ specificity ของ attribute selector สูงกว่า
                  index % 2 === 1 ? "bg-muted/10" : "bg-card",
                  "data-[state=selected]:bg-primary/5 [&>td]:whitespace-nowrap [&>td]:py-3",
                  expanded && "border-l-4 border-l-primary/50"
                )}
                dragEnabled={workflow.canSortProducts}
                handleHint={workflow.t("product.sortHint")}
                handleLabel={workflow.t("common.reorder")}
                id={row.prod_uuid}
                selected={selected}
                onUnavailable={workflow.notifySortUnavailable}
              >
              {(dragHandle) => (
              <>
                <TableCell className="w-10 px-2">
                  <Checkbox
                    aria-label={workflow.t("common.selectRow", { name: productName(row, workflow.language) })}
                    checked={selected}
                    onCheckedChange={(checked) => workflow.toggleSelected(row.prod_uuid, checked as boolean)}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-center gap-1 whitespace-nowrap">
                    <Badge variant="outline" className="h-7 min-w-8 justify-center px-2 font-mono text-xs tabular-nums">
                      {index + 1}
                    </Badge>
                    {dragHandle}
                  </div>
                </TableCell>
                <TableCell>
                  <p className="max-w-40 truncate font-semibold">{categoryName(row, workflow.language)}</p>
                </TableCell>
                <TableCell>
                  <div className="flex min-w-0 items-center gap-3">
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`${workflow.t("product.sections.details")} ${productName(row, workflow.language)}`}
                      aria-expanded={expanded}
                      disabled={!hasDetails}
                      onClick={() => workflow.toggleProductDetails(row.prod_uuid)}
                    >
                      {hasDetails ? (
                        <ChevronRight
                          className={cn(
                            "transition-transform duration-150 ease-out motion-reduce:transition-none",
                            expanded && "rotate-90"
                          )}
                        />
                      ) : (
                        <Package />
                      )}
                    </Button>
                    <ProductMedia row={row} />
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <p className="max-w-56 truncate font-black">{productName(row, workflow.language)}</p>
                        {hasDetails ? (
                          <Badge variant="outline" className="shrink-0 gap-1 text-xs">
                            <Boxes className="size-3" />
                            {details.length}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-0.5 max-w-56 truncate text-xs text-muted-foreground">
                        {row.prod_code || "-"} / {unitName(row, workflow.language)}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell />
                <TableCell />
                <TableCell className="font-mono text-sm font-bold tabular-nums">
                  {/* {totalStockQty(row)} */}

                </TableCell>
                <TableCell className="font-mono text-sm font-semibold tabular-nums">
                  {orderPoint > 0 ? orderPoint : null}
                </TableCell>
                <TableCell>
                  <ProductStockModeSwitch row={row} workflow={workflow} />
                </TableCell>
                <TableCell>
                  <ProductNotificationSwitch row={row} workflow={workflow} />
                </TableCell>
                <TableCell />
                {isPromotion ? <TableCell /> : null}
                <TableCell className="text-right">
                  <ProductListActions row={row} workflow={workflow} />
                </TableCell>
              </>
              )}
              </SortableRow>
            ];

            if (expanded) {
              rowsToRender.push(<ProductDetailRows key={`${row.prod_uuid}-details`} row={row} workflow={workflow} />);
            }

            return rowsToRender;
          })}
          </SortableContext>
        </TableBody>
      </Table>
      </DndContext>
    </div>
  );
}
