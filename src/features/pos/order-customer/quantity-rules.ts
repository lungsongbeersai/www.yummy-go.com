import { type ProdDetail, type ProdItem } from "@/services/pos";
import { optionalNumber } from "@/lib/values";
import { clampQty, MAX_ORDER_QTY, type ProductModalMode } from "./menu-structure";
import { enabledProductDetails } from "./product-availability";

export function defaultOrderQty(detail?: ProdDetail | null) {
  const qty =
    optionalNumber(detail?.pro_detail_cus_qtyBuy, detail?.default_qty) ?? 1;
  return clampQty(qty);
}

export interface OrderQuantityRules {
  canOrder: boolean;
  min: number;
  max: number;
  step: number;
}

function promotionOrderStep(detail?: ProdDetail | null) {
  const buy = optionalNumber(detail?.pro_detail_cus_qtyBuy) ?? 0;
  const free = optionalNumber(detail?.pro_detail_cus_qtyFree) ?? 0;
  return buy > 0 && free > 0 ? clampQty(buy) : 1;
}

function detailOrderStockLimit(
  detail: ProdDetail | null | undefined,
  unitsPerOrder = 1,
) {
  if (!detail || optionalNumber(detail.cut_stock) === 2) return MAX_ORDER_QTY;

  const stock = optionalNumber(detail.qty_stock, detail.pro_detail_qty_stock);
  if (stock === null) return MAX_ORDER_QTY;
  return Math.max(0, Math.floor(stock / Math.max(1, unitsPerOrder)));
}

function setOrderStockLimit(product?: ProdItem | null) {
  const details = enabledProductDetails(product);
  if (!details.length) return 0;
  return Math.min(
    ...details.map((detail) =>
      detailOrderStockLimit(detail, defaultOrderQty(detail)),
    ),
  );
}

export function orderQuantityRules(
  detail: ProdDetail | null | undefined,
  mode: ProductModalMode,
  product?: ProdItem | null,
): OrderQuantityRules {
  const step = mode === "promotion" ? promotionOrderStep(detail) : 1;
  const stockLimit =
    mode === "set"
      ? setOrderStockLimit(product)
      : detailOrderStockLimit(detail);
  const alignedMax =
    Math.floor(Math.min(MAX_ORDER_QTY, stockLimit) / step) * step;
  const canOrder = alignedMax >= step;
  return {
    canOrder,
    min: step,
    max: canOrder ? alignedMax : step,
    step,
  };
}

export function clampOrderQuantity(
  value: number,
  rules: OrderQuantityRules,
) {
  const normalized = Number.isFinite(value) ? Math.floor(value) : rules.min;
  const stepped =
    normalized <= rules.min
      ? rules.min
      : rules.min +
        Math.ceil((normalized - rules.min) / rules.step) * rules.step;
  return Math.min(rules.max, stepped);
}
