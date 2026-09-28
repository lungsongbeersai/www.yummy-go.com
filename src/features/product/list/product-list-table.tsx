"use client";

import { useState, type ReactNode } from "react";
import { DndContext, MeasuringStrategy, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronRight, ChevronsUpDown, GripVertical } from "lucide-react";
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
import { ProductEnabledSwitch, ProductStockBadge, ProductStockSelect, stockSummaryLabel } from "./product-list-status";
import type { ProductStatusKey, ProductTableRow } from "./product-list-types";
import type { ProductListWorkflow } from "./use-product-list-workflow";

function LabeledSwitch({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2">
      {children}
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

function ProductNotificationSwitch({ row, workflow }: { row: ProductTableRow; workflow: ProductListWorkflow }) {
  const notificationKey: ProductStatusKey = `notification:${row.prod_uuid}`;
  const checked = binaryFlag(row.prod_notification, "2") === "1";

  return (
    <LabeledSwitch label={checked ? workflow.t("common.active") : workflow.t("common.inactive")}>
      <Switch
        checked={checked}
        disabled={workflow.pendingKeys.has(notificationKey)}
        size="sm"
        aria-label={workflow.t("product.notification.label")}
        onCheckedChange={(nextChecked) => workflow.updateNotification(row, nextChecked)}
      />
    </LabeledSwitch>
  );
}

function ProductStockModeSwitch({ row, workflow }: { row: ProductTableRow; workflow: ProductListWorkflow }) {
  const details = productDetails(row);
  const pendingKey: ProductStatusKey = `stock-all:${row.prod_uuid}`;
  const pendingMode = workflow.pendingBulkStockModes[row.prod_uuid];

  if (!details.length) return <span className="text-muted-foreground">{workflow.t("common.noData")}</span>;

  const summary = detailStockSummary(details);
  const checked = pendingMode ? pendingMode === 1 : summary === "deduct";
  const label = pendingMode
    ? pendingMode === 1
      ? workflow.t("product.stockMode.deduct")
      : workflow.t("product.stockMode.noDeduct")
    : stockSummaryLabel(workflow, summary);

  return (
    <LabeledSwitch label={label}>
      <Switch
        checked={checked}
        disabled={workflow.pendingKeys.has(pendingKey)}
        size="sm"
        aria-label={workflow.t("product.stockBulk.label")}
        onCheckedChange={(nextChecked) => workflow.updateAllDetailStockModes(row, nextChecked ? 1 : 2)}
      />
    </LabeledSwitch>
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
  const hint = handleHint ?? handleLabel;
  // ลากได้ = ปุ่มจับลาก, ลากไม่ได้แต่มีเหตุผลให้บอก = กดแล้วแจ้งเตือน, นอกนั้นปิดไว้เฉยๆ
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
      <GripVertical />
    </Button>
  ) : (
    <Button
      aria-disabled
      aria-label={hint}
      title={hint}
      size="icon-sm"
      type="button"
      variant="ghost"
      disabled={!onUnavailable}
      className="opacity-50"
      onClick={onUnavailable}
    >
      <GripVertical />
    </Button>
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

function ProductDetailRows({ row, workflow }: { row: ProductTableRow; workflow: ProductListWorkflow }) {
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
              // พื้นหลังจางแยกแถวย่อยออกจากแถวสินค้าหลัก — ไม่มีสิ่งนี้ตารางจะอ่านไม่ออกว่าแถวไหนเป็นขนาด/ราคาของสินค้าไหน
              className="bg-muted/30"
              dragEnabled={workflow.canSortProductDetails && details.length > 1}
              handleLabel={workflow.t("common.reorder")}
              id={detailUuid}
            >
              {(dragHandle) => (
                <>
                  <TableCell />
                  <TableCell>
                    <div className="flex items-center gap-1 text-muted-foreground tabular-nums">
                      {index + 1}
                      {dragHandle}
                    </div>
                  </TableCell>
                  <TableCell />
                  <TableCell className="pl-12">{detailLabel(detail, index, workflow.language)}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(detail.pro_detail_bprice)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {isFoodSet ? money(row.prod_set_price) : money(detail.pro_detail_sprice)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{detailStockQty(detail)}</TableCell>
                  <TableCell />
                  <TableCell>
                    {isFoodSet ? (
                      <ProductStockSelect detail={detail} prodUuid={row.prod_uuid} workflow={workflow} />
                    ) : (
                      <ProductStockBadge detail={detail} workflow={workflow} />
                    )}
                  </TableCell>
                  <TableCell />
                  <TableCell>
                    <LabeledSwitch label={enabled ? workflow.t("common.active") : workflow.t("common.inactive")}>
                      <ProductEnabledSwitch detail={detail} workflow={workflow} />
                    </LabeledSwitch>
                  </TableCell>
                  {isPromotion ? (
                    <TableCell className="text-muted-foreground">
                      <p>
                        {workflow.t("product.buyQty")}: {String(detail.pro_detail_cus_qtyBuy ?? 0)} /{" "}
                        {workflow.t("product.freeQty")}: {String(detail.pro_detail_cus_qtyFree ?? 0)}
                      </p>
                      <p>
                        {shortDate(detail.pro_detail_sDate)} - {shortDate(detail.pro_detail_eDate)} ·{" "}
                        {shortTime(detail.pro_detail_sTime)} - {shortTime(detail.pro_detail_eTime)}
                      </p>
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
    <DndContext
      collisionDetection={closestCenter}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      modifiers={[restrictToVerticalAxis]}
      sensors={sensors}
      onDragCancel={() => setDragging(false)}
      onDragEnd={handleDragEnd}
      onDragStart={() => setDragging(true)}
    >
      {/* container ของ Table เป็นตัวสกรอลเอง (ทั้งสองแกน) หัวตาราง sticky จึงค้างอยู่ด้านบนได้ */}
      <Table containerClassName="min-h-0 flex-1 overflow-auto">
        <TableHeader className="sticky top-0 z-20 bg-background">
          <TableRow>
            <TableHead>
              <Checkbox
                aria-label={workflow.t("common.selectAll")}
                checked={workflow.allSelected}
                onCheckedChange={(checked) => workflow.toggleAllSelected(checked === true)}
              />
            </TableHead>
            <TableHead>{workflow.t("common.order")}</TableHead>
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
                {workflow.t("fields.prod_name")}
              </div>
            </TableHead>
            <TableHead className="text-right">{workflow.t("fields.bprice")}</TableHead>
            <TableHead className="text-right">
              {isFoodSet ? workflow.t("product.setPrice") : workflow.t("fields.sprice")}
            </TableHead>
            <TableHead className="text-right">{workflow.t("fields.qtyStock")}</TableHead>
            <TableHead className="text-right">{workflow.t("product.orderPoint")}</TableHead>
            <TableHead>{workflow.t("product.stockBulk.label")}</TableHead>
            <TableHead>{workflow.t("product.notification.label")}</TableHead>
            <TableHead>{workflow.t("product.detailEnabledStatus")}</TableHead>
            {isPromotion ? <TableHead>{workflow.t("product.promotionTime.label")}</TableHead> : null}
            <TableHead>
              <span className="sr-only">{workflow.t("common.actions")}</span>
            </TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          <SortableContext items={workflow.filteredRows.map((row) => row.prod_uuid)} strategy={verticalListSortingStrategy}>
            {workflow.filteredRows.flatMap((row, index) => {
              const details = productDetails(row);
              const hasDetails = details.length > 0;
              const expanded = hasDetails && !workflow.collapsedProducts.has(row.prod_uuid) && !dragging;
              const selected = workflow.selectedRows.has(row.prod_uuid);
              const orderPoint = productOrderPoint(row);
              const name = productName(row, workflow.language);

              const rowsToRender = [
                <SortableRow
                  key={row.prod_uuid}
                  dragEnabled={workflow.canSortProducts}
                  handleHint={workflow.t("product.sortHint")}
                  handleLabel={workflow.t("common.reorder")}
                  id={row.prod_uuid}
                  selected={selected}
                  onUnavailable={workflow.notifySortUnavailable}
                >
                  {(dragHandle) => (
                    <>
                      <TableCell>
                        <Checkbox
                          aria-label={workflow.t("common.selectRow", { name })}
                          checked={selected}
                          onCheckedChange={(checked) => workflow.toggleSelected(row.prod_uuid, checked === true)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-muted-foreground tabular-nums">
                          {index + 1}
                          {dragHandle}
                        </div>
                      </TableCell>
                      <TableCell>{categoryName(row, workflow.language)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            aria-label={`${workflow.t("product.sections.details")} ${name}`}
                            aria-expanded={expanded}
                            disabled={!hasDetails}
                            onClick={() => workflow.toggleProductDetails(row.prod_uuid)}
                          >
                            <ChevronRight className={cn("transition-transform", expanded && "rotate-90")} />
                          </Button>
                          <ProductMedia row={row} />
                          <div>
                            <div className="flex items-center gap-2 font-medium">
                              {name}
                              {hasDetails ? <Badge variant="secondary">{details.length}</Badge> : null}
                            </div>
                            <div className="text-muted-foreground">
                              {row.prod_code || "-"} · {unitName(row, workflow.language)}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell />
                      <TableCell />
                      <TableCell />
                      <TableCell className="text-right tabular-nums">{orderPoint > 0 ? orderPoint : null}</TableCell>
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
  );
}
