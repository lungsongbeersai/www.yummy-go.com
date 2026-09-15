import { type ProdItem, type ProdTopping } from "@/services/pos";
import { optionalNumber, optionalString } from "@/lib/values";
import { clampQty, MAX_ORDER_QTY } from "./menu-structure";

// จำนวน topping ในโมดัลและ payload คือ "ต่อสินค้า 1 หน่วย" โดย backend จะคูณ order_it_qty ตอนคิดยอดรวม
export interface SelectedTopping {
  topping: ProdTopping;
  qty: number;
}

export function selectedToppingsFromQtyMap(
  product: ProdItem | null | undefined,
  qtyByUuid: Record<string, number>,
): SelectedTopping[] {
  return (product?.toppings ?? [])
    .map((topping) => ({ topping, qty: qtyByUuid[toppingUuid(topping)] ?? 0 }))
    .filter(
      (selected) =>
        isToppingAvailable(selected.topping) &&
        Number.isInteger(selected.qty) &&
        selected.qty >= 1 &&
        selected.qty <= MAX_ORDER_QTY,
    );
}

export function toggleToppingQty(
  current: Record<string, number>,
  uuid: string,
  rememberedQty = 1,
) {
  if (current[uuid]) {
    const next = { ...current };
    delete next[uuid];
    return next;
  }
  return {
    ...current,
    [uuid]: Math.min(clampQty(rememberedQty), toppingQtyCap()),
  };
}

export function changeToppingQty(
  current: Record<string, number>,
  uuid: string,
  qty: number,
) {
  if (qty < 1) {
    const next = { ...current };
    delete next[uuid];
    return next;
  }
  return {
    ...current,
    [uuid]: Math.min(clampQty(qty), toppingQtyCap()),
  };
}

export function toppingQtyCap() {
  return MAX_ORDER_QTY;
}

// prod_topping_max_select = จำนวน "ชนิด" ท็อปปิ้งที่แตกต่างกันสูงสุดที่เลือกได้ต่อสินค้า
// (ไม่ใช่จำนวนชิ้นของท็อปปิ้งเดียว) — 0/ไม่ระบุ = ไม่จำกัด (ถูกจำกัดโดยจำนวนท็อปปิ้งที่มีอยู่จริงอยู่แล้ว)
export function toppingSelectionLimit(
  availableCount: number,
  productMaxSelect?: number | string,
) {
  const configuredMax = optionalNumber(productMaxSelect) ?? 0;
  return configuredMax > 0 ? Math.min(availableCount, configuredMax) : availableCount;
}

export function canSelectMoreToppings(
  selectedCount: number,
  availableCount: number,
  productMaxSelect?: number | string,
) {
  return selectedCount < toppingSelectionLimit(availableCount, productMaxSelect);
}

export function countSelectedToppings(toppings: SelectedTopping[]) {
  return toppings.reduce((sum, selected) => sum + selected.qty, 0);
}

export function isToppingAvailable(topping?: ProdTopping | null) {
  if (!topping) return false;
  if (optionalNumber(topping.toppingEnabled) === 2) return false;
  if (optionalNumber(topping.toppingStatus) === 2) return false;
  return Boolean(toppingUuid(topping));
}

export function toppingUuid(topping: ProdTopping) {
  return (
    optionalString(
      topping.prodToppingUuid,
      topping.toppingUuidFk,
      topping.toppingUuid,
    ) ?? ""
  );
}

export function toppingPrice(topping: ProdTopping) {
  return optionalNumber(topping.toppingPrice) ?? 0;
}

export function toppingDisplayName(topping: ProdTopping) {
  return (
    optionalString(
      topping.toppingNameLa,
      topping.toppingName,
      topping.toppingNameEng,
    ) ?? "-"
  );
}
