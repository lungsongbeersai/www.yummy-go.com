"use client";

import { AnimatePresence, motion } from "motion/react";
import { Boxes, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  binaryFlag,
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
import { DetailMetric, ProductMedia } from "./product-list-media";
import {
  ProductEnabledSwitch,
  ProductStatusBadges,
  ProductStockBadge,
  ProductStockSelect,
  ProductStockSummaryStatus
} from "./product-list-status";
import type { ProductTableRow } from "./product-list-types";
import type { ProductListWorkflow } from "./use-product-list-workflow";

function ProductMobileCard({
  row,
  workflow
}: {
  row: ProductTableRow;
  workflow: ProductListWorkflow;
}) {
  const details = productDetails(row);
  const expanded = details.length > 0 && !workflow.collapsedProducts.has(row.prod_uuid);
  const isPromotion = String(workflow.statusSortFk) === "3";
  const isFoodSet = String(workflow.statusSortFk) === "2";
  const orderPoint = productOrderPoint(row);
  const selected = workflow.selectedRows.has(row.prod_uuid);

  return (
    <div
      className="overflow-hidden rounded-lg border border-border bg-card p-3 shadow-sm data-[state=selected]:border-primary/60 data-[state=selected]:bg-primary/5"
      data-state={selected ? "selected" : undefined}
    >
      <div className="flex min-w-0 items-start gap-3">
        <Checkbox
          aria-label={workflow.t("common.selectRow", { name: productName(row, workflow.language) })}
          checked={selected}
          className="mt-1"
          onChange={(event) => workflow.toggleSelected(row.prod_uuid, event.target.checked)}
        />
        <ProductMedia row={row} className="size-16" />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-black">{productName(row, workflow.language)}</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {row.prod_code || "-"} / {unitName(row, workflow.language)}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <Badge className="bg-muted text-muted-foreground">{categoryName(row, workflow.language)}</Badge>
                <Badge className="bg-primary/10 text-primary">{workflow.activeStatusLabel}</Badge>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Badge>{row.row_number}</Badge>
              <ProductListActions row={row} workflow={workflow} />
            </div>
          </div>
        </div>
      </div>

      <Separator className="my-3" />

      <div className="grid gap-2 text-xs sm:grid-cols-3">
        <div className="min-w-0 rounded-md bg-muted/15 p-2">
          <p className="text-muted-foreground">{workflow.t("fields.prod_price")}</p>
          <p className="mt-0.5 truncate font-mono font-semibold tabular-nums">{productPriceLabel(row)}</p>
        </div>
        <div className="min-w-0 rounded-md bg-muted/15 p-2">
          <p className="text-muted-foreground">{workflow.t("fields.qtyStock")}</p>
          <div className="mt-0.5">
            <ProductStockSummaryStatus row={row} workflow={workflow} />
          </div>
          {orderPoint > 0 ? (
            <p className="mt-0.5 text-muted-foreground">
              {workflow.t("product.orderPoint")}: {orderPoint}
            </p>
          ) : null}
        </div>
        <div className="min-w-0 rounded-md bg-muted/15 p-2">
          <span className="text-muted-foreground">{workflow.t("product.notification.label")}</span>
          <div className="mt-0.5">
            <ProductStatusBadges row={row} workflow={workflow} />
          </div>
        </div>
      </div>

      <Separator className="my-3" />

      <div className="flex flex-col gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="w-full justify-between"
          disabled={!details.length}
          aria-expanded={expanded}
          onClick={() => workflow.toggleProductDetails(row.prod_uuid)}
        >
          <span className="flex items-center gap-2">
            <Boxes data-icon="inline-start" />
            {workflow.t("product.sections.details")} ({details.length})
          </span>
          <ChevronRight
            data-icon="inline-end"
            className={cn(
              "transition-transform duration-150 ease-out motion-reduce:transition-none",
              expanded && "rotate-90"
            )}
          />
        </Button>

        <AnimatePresence initial={false}>
          {expanded ? (
            <motion.div
              key={`${row.prod_uuid}-mobile-details`}
              initial={workflow.detailMotion.initial}
              animate={workflow.detailMotion.animate}
              exit={{ ...workflow.detailMotion.exit, pointerEvents: "none" }}
              transition={workflow.detailMotion.transition}
              className="origin-top transform-gpu will-change-transform"
            >
              <div className="flex flex-col gap-2">
                {details.map((detail, index) => (
                  <div key={productDetailUuid(detail) || String(index)} className="rounded-md border border-border bg-background p-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">{detailLabel(detail, index, workflow.language)}</p>
                        <p className="text-xs text-muted-foreground">
                          {isFoodSet ? workflow.t("pos.product") : workflow.t("fields.size")}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <ProductEnabledSwitch detail={detail} workflow={workflow} />
                        <Badge className={binaryFlag(detail.pro_detail_enabled, "1") === "1" ? "bg-primary/10 text-primary" : "bg-secondary text-secondary-foreground"}>
                          {binaryFlag(detail.pro_detail_enabled, "1") === "1"
                            ? workflow.t("common.active")
                            : workflow.t("common.inactive")}
                        </Badge>
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      <DetailMetric label={workflow.t("fields.bprice")} value={money(detail.pro_detail_bprice)} />
                      <DetailMetric
                        label={isFoodSet ? workflow.t("product.setPrice") : workflow.t("fields.sprice")}
                        value={isFoodSet ? money(row.prod_set_price) : money(detail.pro_detail_sprice)}
                      />
                      <DetailMetric label={workflow.t("fields.qtyStock")} value={String(detailStockQty(detail))} />
                    </div>
                    <div className="mt-2">
                      {isFoodSet ? (
                        <ProductStockSelect compact detail={detail} prodUuid={row.prod_uuid} workflow={workflow} />
                      ) : (
                        <ProductStockBadge compact detail={detail} workflow={workflow} />
                      )}
                    </div>
                    {isPromotion ? (
                      <div className="mt-2 rounded-md bg-muted/20 p-2 text-xs text-muted-foreground">
                        <p>
                          {workflow.t("product.buyQty")}: {String(detail.pro_detail_cus_qtyBuy ?? 0)} /{" "}
                          {workflow.t("product.freeQty")}: {String(detail.pro_detail_cus_qtyFree ?? 0)}
                        </p>
                        <p>
                          {shortDate(detail.pro_detail_sDate)} - {shortDate(detail.pro_detail_eDate)}
                        </p>
                        <p>
                          {shortTime(detail.pro_detail_sTime)} - {shortTime(detail.pro_detail_eTime)}
                        </p>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}

export function ProductListMobile({ workflow }: { workflow: ProductListWorkflow }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-3 md:hidden">
      <div className="flex flex-col gap-2">
        {workflow.filteredRows.map((row) => (
          <ProductMobileCard key={row.prod_uuid} row={row} workflow={workflow} />
        ))}
      </div>
    </div>
  );
}
