"use client";

import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemGroup,
  ItemTitle
} from "@/components/ui/item";
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

export function StockMobileList({ language, rows }: { language: string; rows: StockProduct[] }) {
  const { t } = useTranslation();

  return (
    <ItemGroup>
      {rows.map((row) => {
        const details = stockDetails(row);
        const orderPoint = productOrderPoint(row);
        const unit = unitName(row, language);

        return (
          <Item key={row.prod_uuid} variant="outline">
            <ProductMedia row={row} />
            <ItemContent>
              <ItemTitle>{productName(row, language)}</ItemTitle>
              <ItemDescription>
                {row.prod_code || "-"} · {categoryName(row, language)}
              </ItemDescription>
            </ItemContent>

            <ItemFooter>
              {details.length ? (
                <ItemGroup>
                  {details.map((detail, index) => {
                    const enabled = stockDetailEnabled(detail);
                    const detailKey =
                      productDetailUuid(detail) || String(detail.pro_detail_id ?? `${row.prod_uuid}-${index}`);

                    return (
                      <Item key={detailKey} variant="muted" size="sm">
                        <ItemContent>
                          <ItemTitle>
                            {detailLabel(detail, index, language)}
                            {/* โชว์ป้ายเฉพาะตอนปิดขาย — ปกติเปิดขายอยู่แล้ว ใส่ทุกแถวมีแต่รก */}
                            {enabled ? null : <Badge variant="secondary">{t("stock.disabled")}</Badge>}
                          </ItemTitle>
                          <ItemDescription>
                            {t("stock.columns.reorderPoint")} {orderPoint}
                            {stockNeedsReorder(detail, orderPoint) ? ` · ${t("stock.reorderNeeded")}` : ""}
                          </ItemDescription>
                        </ItemContent>
                        <ItemActions>
                          <span className="tabular-nums">
                            <span className="font-medium">{detailStockQty(detail)}</span>{" "}
                            <span className="text-muted-foreground">{unit}</span>
                          </span>
                          <StockStatusBadge status={stockLevelStatus(detail, orderPoint)} />
                        </ItemActions>
                      </Item>
                    );
                  })}
                </ItemGroup>
              ) : (
                <ItemDescription>{t("stock.noVariants")}</ItemDescription>
              )}
            </ItemFooter>
          </Item>
        );
      })}
    </ItemGroup>
  );
}
