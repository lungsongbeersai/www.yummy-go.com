"use client";

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
import { stockDetailEnabled, stockDetails, stockLevelStatus, stockNeedsReorder } from "./stock-utils";

export function StockTable({ language, rows }: { language: string; rows: StockProduct[] }) {
  const { t } = useTranslation();

  return (
    // container ของ Table เป็นตัวสกรอลเอง หัวตาราง sticky จึงค้างอยู่ด้านบนได้
    <Table containerClassName="min-h-0 flex-1 overflow-auto">
      <TableCaption className="sr-only">{t("stock.title")}</TableCaption>
      <TableHeader className="sticky top-0 z-10 bg-background">
        <TableRow>
          <TableHead>
            {t("stock.columns.product")} / {t("stock.columns.variant")}
          </TableHead>
          <TableHead className="text-right">{t("stock.columns.quantity")}</TableHead>
          <TableHead className="text-right">{t("stock.columns.reorderPoint")}</TableHead>
          <TableHead>{t("stock.columns.status")}</TableHead>
          <TableHead>{t("stock.columns.enabled")}</TableHead>
        </TableRow>
      </TableHeader>

      {rows.map((row) => {
        const details = stockDetails(row);
        const orderPoint = productOrderPoint(row);
        const unit = unitName(row, language);

        return (
          <TableBody key={row.prod_uuid}>
            {/* แถวหัวกลุ่มพื้นจาง แยกสินค้าแต่ละตัวออกจากแถวขนาดของมัน */}
            <TableRow className="bg-muted/50">
              <TableCell colSpan={5}>
                <div className="flex items-center gap-3">
                  <ProductMedia row={row} />
                  <div>
                    <div className="flex items-center gap-2 font-medium">
                      {productName(row, language)}
                      <Badge variant="secondary">{t("stock.variantCount", { count: details.length })}</Badge>
                    </div>
                    <div className="text-muted-foreground">
                      {row.prod_code || "-"} · {categoryName(row, language)} · {unit}
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
                  productDetailUuid(detail) || String(detail.pro_detail_id ?? `${row.prod_uuid}-${index}`);

                return (
                  <TableRow key={detailKey}>
                    {/* เยื้องให้ตรงกับชื่อสินค้าด้านบน (รูป 40px + gap 12px) */}
                    <TableCell className="pl-15">{detailLabel(detail, index, language)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span className="font-medium">{detailStockQty(detail)}</span>{" "}
                      <span className="text-muted-foreground">{unit}</span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{orderPoint}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <StockStatusBadge status={status} />
                        {stockNeedsReorder(detail, orderPoint) ? (
                          <span className="text-muted-foreground">{t("stock.reorderNeeded")}</span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={enabled ? "outline" : "secondary"}>
                        {enabled ? t("stock.enabled") : t("stock.disabled")}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  {t("stock.noVariants")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        );
      })}
    </Table>
  );
}
