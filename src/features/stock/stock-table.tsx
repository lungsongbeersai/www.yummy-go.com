"use client";

import { PackagePlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
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

interface StockTableProps {
  language: string;
  rows: StockProduct[];
}

export function StockTable({ language, rows }: StockTableProps) {
  const { t } = useTranslation();

  return (
    <div className="hidden h-full min-h-0 overflow-auto md:block">
      <Table className="min-w-215">
        <TableCaption className="sr-only">{t("stock.title")}</TableCaption>
        <TableHeader className="sticky top-0 z-10 bg-background">
          <TableRow>
            <TableHead className="w-[42%]">
              {t("stock.columns.product")} / {t("stock.columns.variant")}
            </TableHead>
            <TableHead>{t("stock.columns.quantity")}</TableHead>
            <TableHead>{t("stock.columns.reorderPoint")}</TableHead>
            <TableHead>{t("stock.columns.status")}</TableHead>
            <TableHead className="text-right">{t("stock.columns.enabled")}</TableHead>
          </TableRow>
        </TableHeader>

        {rows.map((row) => {
          const details = stockDetails(row);
          const orderPoint = productOrderPoint(row);

          return (
            <TableBody key={row.prod_uuid}>
              <TableRow className="bg-muted/25 hover:bg-muted/35">
                <TableCell colSpan={5} className="py-2.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <ProductMedia row={row} />
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <p className="truncate font-bold text-foreground">
                          {productName(row, language)}
                        </p>
                        <Badge variant="outline">
                          {t("stock.variantCount", { count: details.length })}
                        </Badge>
                      </div>
                      <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="font-mono">{row.prod_code || "-"}</span>
                        <span>{categoryName(row, language)}</span>
                        <span>{unitName(row, language)}</span>
                      </div>
                    </div>
                  </div>
                </TableCell>
              </TableRow>

              {details.length ? (
                details.map((detail, index) => {
                  const status = stockLevelStatus(detail, orderPoint);
                  const enabled = stockDetailEnabled(detail);
                  const detailKey =
                    productDetailUuid(detail) ||
                    String(detail.pro_detail_id ?? `${row.prod_uuid}-${index}`);

                  return (
                    <TableRow key={detailKey}>
                      <TableCell className="pl-20">
                        <p className="font-semibold text-foreground">
                          {detailLabel(detail, index, language)}
                        </p>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-base font-black tabular-nums text-foreground">
                          {detailStockQty(detail)}
                        </span>{" "}
                        <span className="text-xs text-muted-foreground">
                          {unitName(row, language)}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono tabular-nums">
                        {orderPoint}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-start gap-1">
                          <StockStatusBadge status={status} />
                          {stockNeedsReorder(detail, orderPoint) ? (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <PackagePlus className="size-3.5" aria-hidden="true" />
                              {t("stock.reorderNeeded")}
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={enabled ? "outline" : "secondary"}>
                          {enabled ? t("stock.enabled") : t("stock.disabled")}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="py-5 text-center text-muted-foreground">
                    {t("stock.noVariants")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          );
        })}
      </Table>
    </div>
  );
}
