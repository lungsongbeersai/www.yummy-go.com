"use client";

import { Fragment } from "react";
import { PackagePlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ProductMedia } from "@/features/product/list/product-list-media";
import {
  categoryName,
  detailLabel,
  detailStockQty,
  productDetailUuid,
  productName,
  productOrderPoint,
  unitName
} from "@/features/product/list/product-list-utils";
import type { StockProduct } from "@/services/stock";
import { StockStatusBadge } from "./stock-status-badge";
import {
  stockDetailEnabled,
  stockDetails,
  stockLevelStatus,
  stockNeedsReorder
} from "./stock-utils";

interface StockMobileListProps {
  language: string;
  rows: StockProduct[];
}

export function StockMobileList({ language, rows }: StockMobileListProps) {
  const { t } = useTranslation();

  return (
    <div className="h-full overflow-y-auto p-3 md:hidden">
      <ul className="flex flex-col gap-3">
        {rows.map((row) => {
          const details = stockDetails(row);
          const orderPoint = productOrderPoint(row);

          return (
            <li key={row.prod_uuid}>
              <Card className="overflow-hidden shadow-sm">
                <CardHeader className="p-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <ProductMedia className="size-14" row={row} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold text-foreground">
                        {productName(row, language)}
                      </p>
                      <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                        {row.prod_code || "-"}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline">{categoryName(row, language)}</Badge>
                        <Badge variant="outline">
                          {t("stock.variantCount", { count: details.length })}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-0">
                  {details.length ? (
                    details.map((detail, index) => {
                      const status = stockLevelStatus(detail, orderPoint);
                      const enabled = stockDetailEnabled(detail);
                      const detailKey =
                        productDetailUuid(detail) ||
                        String(detail.pro_detail_id ?? `${row.prod_uuid}-${index}`);

                      return (
                        <Fragment key={detailKey}>
                          {index ? <Separator /> : null}
                          <div className="flex flex-col gap-3 p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-foreground">
                                  {detailLabel(detail, index, language)}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {t("stock.columns.reorderPoint")}: {orderPoint}
                                </p>
                              </div>
                              <StockStatusBadge status={status} />
                            </div>

                            <div className="flex items-end justify-between gap-3">
                              <div>
                                <p className="text-xs font-semibold text-muted-foreground">
                                  {t("stock.columns.quantity")}
                                </p>
                                <p className="font-mono text-2xl font-black tabular-nums text-foreground">
                                  {detailStockQty(detail)}{" "}
                                  <span className="font-sans text-xs font-semibold text-muted-foreground">
                                    {unitName(row, language)}
                                  </span>
                                </p>
                              </div>
                              <Badge variant={enabled ? "outline" : "secondary"}>
                                {enabled ? t("stock.enabled") : t("stock.disabled")}
                              </Badge>
                            </div>

                            {stockNeedsReorder(detail, orderPoint) ? (
                              <p className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                                <PackagePlus className="size-3.5" aria-hidden="true" />
                                {t("stock.reorderNeeded")}
                              </p>
                            ) : null}
                          </div>
                        </Fragment>
                      );
                    })
                  ) : (
                    <p className="p-4 text-center text-sm text-muted-foreground">
                      {t("stock.noVariants")}
                    </p>
                  )}
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
