import { type ProdDetail, type ProdItem } from "@/services/pos";
import {
  MAX_ORDER_QTY,
  type OrderSelectionIssue,
  type ProductModalMode,
  type Translate,
} from "./menu-structure";
import { isDetailAvailable, isDetailEnabled } from "./product-availability";
import { getModalBasePrice } from "./pricing";
import { orderQuantityRules, type OrderQuantityRules } from "./quantity-rules";
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
  // rules.canOrder=false คือของหมดจริง (ไม่มีจำนวนใดสั่งได้เลย) ต่างจากกรณีถัดไปที่ยังสั่งได้
  // แต่พิมพ์เกินของที่เหลือ — แยก issue กันเพื่อขึ้นข้อความที่บอกตัวเลขที่ต้องแก้ให้ตรงจริง
  if (!rules.canOrder) return "stock-insufficient";
  if (quantity > rules.max) return "quantity-exceeds-stock";
  if (
    !Number.isInteger(quantity) ||
    quantity < rules.min ||
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

// rules มีให้เฉพาะตอนเรียกจากบริบทที่รู้ min/max/step ของสินค้าตัวนั้น (โมดัลเลือกสินค้า) —
// ใช้เติมตัวเลขจริงลงข้อความเตือน ("เหลือ 50 ชิ้น" / "ต้องเป็นจำนวนทวีคูณของ 3") แทนข้อความรวมๆ
// ที่ผู้ใช้ไม่รู้ว่าต้องแก้เป็นเท่าไหร่ — ไม่มี rules (เช่นเรียกจาก toast อื่น) ก็ยัง fallback ได้
export function orderSelectionIssueLabel(
  issue: OrderSelectionIssue,
  t: Translate,
  rules?: OrderQuantityRules,
) {
  if (issue === "detail-unavailable") return t("pos.noAvailableOptions");
  if (issue === "price-invalid") return t("pos.invalidProductPrice");
  if (issue === "stock-insufficient") return t("pos.outOfStock");
  if (issue === "quantity-exceeds-stock") {
    return rules
      ? t("pos.insufficientStockMax", { max: rules.max })
      : t("pos.insufficientStock");
  }
  if (issue === "topping-invalid") return t("pos.invalidTopping");
  if (issue === "quantity-invalid" && rules && rules.step > 1) {
    return t("pos.editQuantityInvalidStep", { step: rules.step });
  }
  return t("pos.invalidQuantity");
}
