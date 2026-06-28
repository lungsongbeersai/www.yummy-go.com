"use client";

import { AnimatePresence, motion } from "motion/react";
import { Boxes, ChevronRight, ChevronsUpDown, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
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

const MotionTableRow = motion.create(TableRow);

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

function ProductDetailRows({
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

  return details.map((detail, index) => {
    const detailUuid = productDetailUuid(detail) || `${row.prod_uuid}-${index}`;
    const enabled = binaryFlag(detail.pro_detail_enabled, "1") === "1";

    return (
      <MotionTableRow
        key={detailUuid}
        initial={workflow.detailMotion.initial}
        animate={workflow.detailMotion.animate}
        exit={{ ...workflow.detailMotion.exit, pointerEvents: "none" }}
        transition={workflow.detailMotion.transition}
        className="origin-top bg-muted/10 hover:bg-muted/20 [&>td]:whitespace-nowrap [&>td]:py-2.5"
      >
        <TableCell className="w-10 px-2" />
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
      </MotionTableRow>
    );
  });
}

export function ProductListTable({ workflow }: { workflow: ProductListWorkflow }) {
  const isPromotion = String(workflow.statusSortFk) === "3";
  const isFoodSet = String(workflow.statusSortFk) === "2";

  return (
    <div className="relative hidden min-h-0 flex-1 overflow-auto md:block">
      <Table className="w-max min-w-full table-auto">
        <TableHeader className="sticky top-0 z-40 bg-background shadow-sm [&_th]:sticky [&_th]:top-0 [&_th]:z-40 [&_th]:whitespace-nowrap [&_th]:border-b [&_th]:border-border [&_th]:bg-background [&_th]:shadow-sm">
          <TableRow>
            <TableHead className="w-10 px-2">
              <Checkbox
                aria-label={workflow.t("common.selectAll")}
                checked={workflow.allSelected}
                onChange={(event) => workflow.toggleAllSelected(event.target.checked)}
              />
            </TableHead>
            <TableHead>{workflow.t("nav.category")}</TableHead>
            <TableHead>
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
                  "bg-card data-[state=selected]:bg-primary/5 [&>td]:whitespace-nowrap [&>td]:py-3",
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
                  <p className="max-w-40 truncate font-semibold">{categoryName(row, workflow.language)}</p>
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
              </TableRow>
            ];

            if (hasDetails) {
              rowsToRender.push(
                <AnimatePresence key={`${row.prod_uuid}-details-presence`} initial={false}>
                  {expanded ? <ProductDetailRows row={row} workflow={workflow} /> : null}
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