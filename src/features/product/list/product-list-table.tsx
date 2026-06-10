"use client";

import { AnimatePresence, motion } from "motion/react";
import { Boxes, ChevronRight, ChevronsUpDown, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  productPriceLabel,
  shortDate,
  shortTime,
  unitName
} from "./product-list-utils";
import { ProductListActions } from "./product-list-actions";
import { ProductMedia } from "./product-list-media";
import {
  ProductEnabledSwitch,
  ProductStatusBadges,
  ProductStockBadge,
  ProductStockSelect,
  ProductStockSummaryStatus,
  stockSummaryClass,
  stockSummaryLabel
} from "./product-list-status";
import type { ProductTableRow } from "./product-list-types";
import type { ProductListWorkflow } from "./use-product-list-workflow";

const MotionTableRow = motion.create(TableRow);

function ProductDetailPanel({
  row,
  workflow
}: {
  row: ProductTableRow;
  workflow: ProductListWorkflow;
}) {
  const details = productDetails(row);
  const isPromotion = String(workflow.statusSortFk) === "3";
  const isFoodSet = String(workflow.statusSortFk) === "2";

  if (!details.length) return null;

  return (
    <MotionTableRow
      key={`${row.prod_uuid}-details`}
      initial={workflow.detailMotion.initial}
      animate={workflow.detailMotion.animate}
      exit={{ ...workflow.detailMotion.exit, pointerEvents: "none" }}
      transition={workflow.detailMotion.transition}
      className="origin-top transform-gpu bg-muted/15 will-change-transform hover:bg-muted/15"
    >
      <TableCell colSpan={7} className="px-4 py-3">
        <div className="overflow-hidden rounded-md border border-border bg-background shadow-sm">
          <div className="flex min-w-0 items-center justify-between gap-3 border-b border-border bg-muted/20 px-3 py-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Boxes className="text-primary" />
                <p className="text-sm font-black">{workflow.t("product.sections.details")}</p>
                <Badge>{details.length}</Badge>
              </div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {productName(row, workflow.language)}
              </p>
            </div>
            <Badge className={stockSummaryClass(detailStockSummary(details))}>
              {stockSummaryLabel(workflow, detailStockSummary(details))}
            </Badge>
          </div>
          <div className="overflow-x-auto">
            <Table className={cn(isPromotion ? "min-w-230" : "min-w-180")}>
              <TableHeader className="bg-background">
                <TableRow>
                  <TableHead className="min-w-56">
                    {isFoodSet ? workflow.t("pos.product") : workflow.t("fields.size")}
                  </TableHead>
                  <TableHead className="w-32">{workflow.t("fields.bprice")}</TableHead>
                  <TableHead className="w-32">
                    {isFoodSet ? workflow.t("product.setPrice") : workflow.t("fields.sprice")}
                  </TableHead>
                  <TableHead className="w-28">{workflow.t("fields.qtyStock")}</TableHead>
                  <TableHead className="w-44">{workflow.t("product.stockBulk.label")}</TableHead>
                  <TableHead className="w-36">{workflow.t("product.detailEnabledStatus")}</TableHead>
                  {isPromotion ? (
                    <TableHead className="min-w-56">{workflow.t("product.promotionTime.label")}</TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {details.map((detail, index) => {
                  const detailUuid = productDetailUuid(detail) || `${row.prod_uuid}-${index}`;
                  const enabled = binaryFlag(detail.pro_detail_enabled, "1") === "1";
                  return (
                    <TableRow key={detailUuid} className="hover:bg-muted/20">
                      <TableCell>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black">
                            {detailLabel(detail, index, workflow.language)}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">#{index + 1}</p>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm font-semibold tabular-nums">
                        {money(detail.pro_detail_bprice)}
                      </TableCell>
                      <TableCell className="font-mono text-sm font-semibold tabular-nums">
                        {isFoodSet ? money(row.prod_set_price) : money(detail.pro_detail_sprice)}
                      </TableCell>
                      <TableCell className="font-mono text-sm font-semibold tabular-nums">
                        {detailStockQty(detail)}
                      </TableCell>
                      <TableCell>
                        {isFoodSet ? (
                          <ProductStockSelect compact detail={detail} prodUuid={row.prod_uuid} workflow={workflow} />
                        ) : (
                          <ProductStockBadge compact detail={detail} workflow={workflow} />
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
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
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      </TableCell>
    </MotionTableRow>
  );
}

export function ProductListTable({ workflow }: { workflow: ProductListWorkflow }) {
  return (
    <div className="relative hidden min-h-0 flex-1 overflow-auto md:block">
      <Table className="min-w-255">
        <TableHeader className="sticky top-0 z-40 bg-background shadow-sm [&_th]:sticky [&_th]:top-0 [&_th]:z-40 [&_th]:border-b [&_th]:border-border [&_th]:bg-background [&_th]:shadow-sm">
          <TableRow>
            <TableHead className="w-10 px-2">
              <Checkbox
                aria-label={workflow.t("common.selectAll")}
                checked={workflow.allSelected}
                onChange={(event) => workflow.toggleAllSelected(event.target.checked)}
              />
            </TableHead>
            <TableHead className="min-w-[24rem]">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="iconSm"
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
            <TableHead className="min-w-48">
              {workflow.t("nav.category")} / {workflow.t("product.type")}
            </TableHead>
            <TableHead className="min-w-44">{workflow.t("fields.prod_price")}</TableHead>
            <TableHead className="min-w-56">{workflow.t("fields.qtyStock")}</TableHead>
            <TableHead className="min-w-44">{workflow.t("common.status")}</TableHead>
            <TableHead className="w-16 text-right">{workflow.t("common.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="bg-card">
          {workflow.filteredRows.flatMap((row) => {
            const details = productDetails(row);
            const hasDetails = details.length > 0;
            const expanded = hasDetails && !workflow.collapsedProducts.has(row.prod_uuid);
            const selected = workflow.selectedRows.has(row.prod_uuid);
            const orderPoint = productOrderPoint(row);
            const rowsToRender = [
              <TableRow
                key={row.prod_uuid}
                className={cn(
                  "bg-card data-[state=selected]:bg-primary/5 [&>td]:py-3",
                  expanded && "border-l-4 border-l-primary/50"
                )}
                data-state={selected ? "selected" : undefined}
              >
                <TableCell className="w-10 px-2">
                  <Checkbox
                    aria-label={workflow.t("common.selectRow", { name: productName(row, workflow.language) })}
                    checked={selected}
                    onChange={(event) => workflow.toggleSelected(row.prod_uuid, event.target.checked)}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex min-w-0 items-center gap-3">
                    <Button
                      type="button"
                      size="iconSm"
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
                      <div className="flex min-w-0 items-center gap-2">
                        <p className="truncate font-black">{productName(row, workflow.language)}</p>
                        <Badge className="shrink-0 bg-muted text-muted-foreground">{row.row_number}</Badge>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {row.prod_code || "-"} / {unitName(row, workflow.language)}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{categoryName(row, workflow.language)}</p>
                    <Badge className="mt-1 bg-primary/10 text-primary">{workflow.activeStatusLabel}</Badge>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="min-w-0">
                    <p className="truncate font-mono font-bold">{productPriceLabel(row)}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex min-w-0 flex-col gap-1">
                    <ProductStockSummaryStatus row={row} workflow={workflow} />
                    {orderPoint > 0 ? (
                      <Badge>
                        {workflow.t("product.orderPoint")}: {orderPoint}
                      </Badge>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>
                  <ProductStatusBadges row={row} workflow={workflow} />
                </TableCell>
                <TableCell className="text-right">
                  <ProductListActions row={row} workflow={workflow} />
                </TableCell>
              </TableRow>
            ];

            if (hasDetails) {
              rowsToRender.push(
                <AnimatePresence key={`${row.prod_uuid}-details-presence`} initial={false}>
                  {expanded ? <ProductDetailPanel row={row} workflow={workflow} /> : null}
                </AnimatePresence>
              );
            }
            return rowsToRender;
          })}
        </TableBody>
      </Table>
    </div>
  );
}
