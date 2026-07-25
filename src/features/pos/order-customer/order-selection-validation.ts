import { type ProdDetail, type ProdItem } from "@/services/pos";
import {
  MAX_ORDER_QTY,
  type OrderSelectionIssue,
  type ProductModalMode,
  type Translate,
} from "./menu-structure";
import { isDetailAvailable, isDetailEnabled } from "./product-availability";
import { getModalBasePrice } from "./pricing";
import { orderQuantityRules } from "./quantity-rules";
import { isToppingAvailable, toppingPrice, type SelectedTopping } from "./topping-selection";

export function getOrderSelectionIssue({
  detail,
  mode,
  product,
  quantity,
  toppings,
}: {
  detail: ProdDetail | null | undefined;
  mode: ProductModalMode;
  product?: ProdItem | null;
  quantity: number;
  toppings: SelectedTopping[];
}): OrderSelectionIssue | null {
  if (!detail || !isDetailEnabled(detail)) return "detail-unavailable";
  if (mode !== "set" && !isDetailAvailable(detail)) {
    return "detail-unavailable";
  }

  const basePrice = getModalBasePrice(product ?? null, detail, mode);
  if (!Number.isFinite(basePrice) || basePrice <= 0) return "price-invalid";

  const rules = orderQuantityRules(detail, mode, product);
  if (!rules.canOrder) return "stock-insufficient";
  if (
    !Number.isInteger(quantity) ||
    quantity < rules.min ||
    quantity > rules.max ||
    (quantity - rules.min) % rules.step !== 0
  ) {
    return "quantity-invalid";
  }

  const hasInvalidTopping = toppings.some(
    (selected) =>
      !isToppingAvailable(selected.topping) ||
      !Number.isInteger(selected.qty) ||
      selected.qty < 1 ||
      selected.qty > MAX_ORDER_QTY ||
      toppingPrice(selected.topping) < 0,
  );
  return hasInvalidTopping ? "topping-invalid" : null;
}

export function orderSelectionIssueLabel(
  issue: OrderSelectionIssue,
  t: Translate,
) {
  if (issue === "detail-unavailable") return t("pos.noAvailableOptions");
  if (issue === "price-invalid") return t("pos.invalidProductPrice");
  if (issue === "stock-insufficient") return t("pos.insufficientStock");
  if (issue === "topping-invalid") return t("pos.invalidTopping");
  return t("pos.invalidQuantity");
}
