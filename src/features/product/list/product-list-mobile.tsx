"use client";

import { useState, type ReactNode } from "react";
import { DndContext, MeasuringStrategy, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, GripVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemGroup,
  ItemTitle
} from "@/components/ui/item";
import { useReorderSensors } from "@/hooks/use-reorder-sensors";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  categoryName,
  detailLabel,
  detailStockQty,
  productDetails,
  productDetailUuid,
  productName,
  productOrderPoint,
  productPriceLabel,
  shortDate,
  shortTime,
  unitName
} from "./product-list-utils";
import { ProductListActions } from "./product-list-actions";
import { ProductMedia } from "./product-list-media";
import {
  ProductEnabledSwitch,
  ProductNotificationStatus,
  ProductStockBadge,
  ProductStockSelect,
  ProductStockSummaryStatus
} from "./product-list-status";
import type { ProductTableRow } from "./product-list-types";
import type { ProductListWorkflow } from "./use-product-list-workflow";

function SortableMobileItem({
  children,
  dragEnabled,
  handleHint,
  handleLabel,
  id,
  onUnavailable
}: {
  children: (dragHandle: ReactNode) => ReactNode;
  dragEnabled: boolean;
  handleHint?: string;
  handleLabel: string;
  id: string;
  onUnavailable?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !dragEnabled
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : 1
  };
  const hint = handleHint ?? handleLabel;
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
    <div ref={setNodeRef} role="listitem" style={style} className={cn(isDragging && "relative z-10")}>
      {children(dragHandle)}
    </div>
  );
}

function ProductDetailItems({ row, workflow }: { row: ProductTableRow; workflow: ProductListWorkflow }) {
  const sensors = useReorderSensors();
  const details = productDetails(row);
  const detailIds = details.map((detail, index) => productDetailUuid(detail) || String(index));
  const isPromotion = String(workflow.statusSortFk) === "3";
  const isFoodSet = String(workflow.statusSortFk) === "2";

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    void workflow.reorderProductDetail(row, String(active.id), String(over.id));
  }

  return (
    <DndContext collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} sensors={sensors} onDragEnd={handleDragEnd}>
      <SortableContext items={detailIds} strategy={verticalListSortingStrategy}>
        <ItemGroup>
          {details.map((detail, index) => (
            <SortableMobileItem
              key={detailIds[index]}
              dragEnabled={workflow.canSortProductDetails && details.length > 1}
              handleLabel={workflow.t("common.reorder")}
              id={detailIds[index]}
            >
              {(dragHandle) => (
                <Item variant="muted" size="sm">
                  <ItemContent>
                    <ItemTitle>{detailLabel(detail, index, workflow.language)}</ItemTitle>
                    <ItemDescription>
                      {workflow.t("fields.bprice")} {money(detail.pro_detail_bprice)} ·{" "}
                      {isFoodSet ? workflow.t("product.setPrice") : workflow.t("fields.sprice")}{" "}
                      {isFoodSet ? money(row.prod_set_price) : money(detail.pro_detail_sprice)} ·{" "}
                      {workflow.t("fields.qtyStock")} {detailStockQty(detail)}
                    </ItemDescription>
                    {isPromotion ? (
                      <ItemDescription>
                        {workflow.t("product.buyQty")} {String(detail.pro_detail_cus_qtyBuy ?? 0)} /{" "}
                        {workflow.t("product.freeQty")} {String(detail.pro_detail_cus_qtyFree ?? 0)} ·{" "}
                        {shortDate(detail.pro_detail_sDate)} - {shortDate(detail.pro_detail_eDate)} ·{" "}
                        {shortTime(detail.pro_detail_sTime)} - {shortTime(detail.pro_detail_eTime)}
                      </ItemDescription>
                    ) : null}
                  </ItemContent>
                  <ItemActions>
                    {dragHandle}
                    <ProductEnabledSwitch detail={detail} workflow={workflow} />
                  </ItemActions>
                  <ItemFooter>
                    {isFoodSet ? (
                      <ProductStockSelect compact detail={detail} prodUuid={row.prod_uuid} workflow={workflow} />
                    ) : (
                      <ProductStockBadge detail={detail} workflow={workflow} />
                    )}
                  </ItemFooter>
                </Item>
              )}
            </SortableMobileItem>
          ))}
        </ItemGroup>
      </SortableContext>
    </DndContext>
  );
}

function ProductMobileItem({
  dragHandle,
  dragging,
  row,
  workflow
}: {
  dragHandle: ReactNode;
  dragging: boolean;
  row: ProductTableRow;
  workflow: ProductListWorkflow;
}) {
  const details = productDetails(row);
  const expanded = details.length > 0 && !workflow.collapsedProducts.has(row.prod_uuid) && !dragging;
  const orderPoint = productOrderPoint(row);
  const selected = workflow.selectedRows.has(row.prod_uuid);
  const name = productName(row, workflow.language);

  return (
    <Item variant="outline">
      <Checkbox
        aria-label={workflow.t("common.selectRow", { name })}
        checked={selected}
        onCheckedChange={(checked) => workflow.toggleSelected(row.prod_uuid, checked === true)}
      />
      <ProductMedia row={row} />
      <ItemContent>
        <ItemTitle>{name}</ItemTitle>
        <ItemDescription>
          {row.prod_code || "-"} · {unitName(row, workflow.language)} · {categoryName(row, workflow.language)}
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        {dragHandle}
        <ProductListActions row={row} workflow={workflow} />
      </ItemActions>

      <ItemFooter>
        <span className="tabular-nums">{productPriceLabel(row)}</span>
        <ProductStockSummaryStatus row={row} workflow={workflow} />
      </ItemFooter>
      <ItemFooter>
        <ProductNotificationStatus row={row} workflow={workflow} />
        {orderPoint > 0 ? (
          <Badge variant="outline">
            {workflow.t("product.orderPoint")} {orderPoint}
          </Badge>
        ) : null}
      </ItemFooter>

      {details.length ? (
        <ItemFooter>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-expanded={expanded}
            onClick={() => workflow.toggleProductDetails(row.prod_uuid)}
          >
            {workflow.t("product.sections.details")}
            <Badge variant="secondary">{details.length}</Badge>
            <ChevronDown data-icon="inline-end" className={cn("transition-transform", expanded && "rotate-180")} />
          </Button>
        </ItemFooter>
      ) : null}

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            key={`${row.prod_uuid}-mobile-details`}
            initial={workflow.detailMotion.initial}
            animate={workflow.detailMotion.animate}
            exit={{ ...workflow.detailMotion.exit, pointerEvents: "none" }}
            transition={workflow.detailMotion.transition}
            className="basis-full origin-top"
          >
            <ProductDetailItems row={row} workflow={workflow} />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </Item>
  );
}

export function ProductListMobile({ workflow }: { workflow: ProductListWorkflow }) {
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
      <SortableContext items={workflow.filteredRows.map((row) => row.prod_uuid)} strategy={verticalListSortingStrategy}>
        <ItemGroup>
          {workflow.filteredRows.map((row) => (
            <SortableMobileItem
              key={row.prod_uuid}
              dragEnabled={workflow.canSortProducts}
              handleHint={workflow.t("product.sortHint")}
              handleLabel={workflow.t("common.reorder")}
              id={row.prod_uuid}
              onUnavailable={workflow.notifySortUnavailable}
            >
              {(dragHandle) => <ProductMobileItem dragHandle={dragHandle} dragging={dragging} row={row} workflow={workflow} />}
            </SortableMobileItem>
          ))}
        </ItemGroup>
      </SortableContext>
    </DndContext>
  );
}
