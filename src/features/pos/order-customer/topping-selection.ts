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
  return { ...current, [uuid]: clampQty(rememberedQty) };
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
  return { ...current, [uuid]: clampQty(qty) };
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
