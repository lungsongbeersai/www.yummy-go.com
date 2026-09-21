import { type ProdDetail, type ProdItem, type ProdTaste } from "@/services/pos";
import { optionalNumber } from "@/lib/values";
import {
  MAX_ORDER_QTY,
  type OrderSelectionIssue,
  type ProductModalMode,
  type Translate,
} from "./menu-structure";
import { isDetailAvailable, isDetailEnabled } from "./product-availability";
import { getModalBasePrice } from "./pricing";
import { orderQuantityRules, type OrderQuantityRules } from "./quantity-rules";
import { areSetSelectionsComplete } from "./set-choice-selection";
import {
  isToppingAvailable,
  toppingPrice,
  toppingSelectionLimit,
  type SelectedTopping,
} from "./topping-selection";
import { isTasteAvailable, tasteSelectionLimit } from "./taste-selection";

export function getOrderSelectionIssue({
  detail,
  mode,
  product,
  quantity,
  selectedSetChildOptionGroupUuids = {},
  selectedSetChoiceTasteUuids = {},
  selectedSetChoiceUuids = {},
  tastes,
  toppings,
}: {
  detail: ProdDetail | null | undefined;
  mode: ProductModalMode;
  product?: ProdItem | null;
  quantity: number;
  selectedSetChildOptionGroupUuids?: Record<string, string[]>;
  selectedSetChoiceTasteUuids?: Record<string, string[]>;
  selectedSetChoiceUuids?: Record<string, string[]>;
  tastes?: ProdTaste[];
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
  if (hasInvalidTopping) return "topping-invalid";

  const selectedTastes = tastes ?? [];
  if (selectedTastes.some((taste) => !isTasteAvailable(taste))) {
    return "taste-invalid";
  }
  const tasteLimit = product ? tasteSelectionLimit(product) : 0;
  if (mode !== "set" && tasteLimit > 0 && selectedTastes.length === 0) {
    return "taste-required";
  }
  if (product && selectedTastes.length > tasteLimit) {
    return "taste-limit-exceeded";
  }
  if (mode === "set" && product) {
    if (!areSetSelectionsComplete({
      product,
      selectedSetChildOptionGroupUuids,
      selectedSetChoiceTasteUuids,
      selectedSetChoiceUuids,
    })) {
      return "set-options-incomplete";
    }
    const hasNestedSelections = product.details.some(
      (itemDetail) =>
        (itemDetail.setOptionGroups ?? []).length > 0 ||
        (optionalNumber(itemDetail.setTasteMaxSelect) ?? 0) > 0,
    );
    const requiredSetTasteCount = tasteSelectionLimit(product);
    if (
      !hasNestedSelections &&
      requiredSetTasteCount > 0 &&
      selectedTastes.length !== requiredSetTasteCount
    ) {
      return "set-options-incomplete";
    }
  }

  // ตรวจเพดานจำนวนชนิดได้ก็ต่อเมื่อรู้จัก product ที่มีลิสต์ toppings จริงให้อ้างอิง — ผู้เรียกบางจุด
  // (เช่น buildStaffOrderItems ที่ประกอบ payload จาก toppings ที่เลือกไว้แล้วโดยตรง) ไม่ได้ส่ง product
  // มาด้วย หรือส่งมาแบบไม่มี toppings ติดมา จึงไม่มีทางรู้จำนวนท็อปปิ้งที่มีอยู่จริง ต้องข้ามการเช็คนี้ไป
  // ไม่ใช่ตีความว่า "ไม่รู้ = มี 0 ชนิด" ซึ่งจะ reject ทุกออเดอร์ที่มี topping ไปเสีย
  if (product?.toppings?.length) {
    const availableToppingCount = product.toppings.filter(
      isToppingAvailable,
    ).length;
    if (
      toppings.length >
      toppingSelectionLimit(availableToppingCount, product.prodToppingMaxSelect)
    ) {
      return "topping-limit-exceeded";
    }
  }

  return null;
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
  if (issue === "taste-invalid") return t("pos.invalidTaste");
  if (issue === "taste-required") return t("pos.tasteRequired");
  if (issue === "taste-limit-exceeded") return t("pos.tasteLimitExceeded");
  if (issue === "set-options-incomplete") return t("pos.setOptionsIncomplete");
  if (issue === "quantity-exceeds-stock") {
    return rules
      ? t("pos.insufficientStockMax", { max: rules.max })
      : t("pos.insufficientStock");
  }
  if (issue === "topping-invalid") return t("pos.invalidTopping");
  if (issue === "topping-limit-exceeded") return t("pos.toppingLimitExceeded");
  if (issue === "quantity-invalid" && rules && rules.step > 1) {
    return t("pos.editQuantityInvalidStep", { step: rules.step });
  }
  return t("pos.invalidQuantity");
}
