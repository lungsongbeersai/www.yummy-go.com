import type { DepositableOrderItem } from "./deposit-order-items";
import { validDepositQuantity } from "./deposit-utils";

export interface DepositCreateDraftItem extends DepositableOrderItem {
  qty: number;
}

export function buildDepositCreateDraft(
  eligibleItems: readonly DepositableOrderItem[],
  enteredQuantities: ReadonlyMap<string, string>
): { items: DepositCreateDraftItem[]; invalidKeys: Set<string> } {
  const items: DepositCreateDraftItem[] = [];
  const invalidKeys = new Set<string>();
  for (const item of eligibleItems) {
    const raw = enteredQuantities.get(item.key)?.trim() || "";
    // An untouched/cleared row is not a deposit. Never infer its quantity
    // from the bill's maximum; the cashier records what was actually received.
    if (!raw) continue;
    const qty = Number(raw);
    if (qty === 0) continue;
    if (!validDepositQuantity(qty) || qty > item.availableQty) invalidKeys.add(item.key);
    if (Number.isFinite(qty) && qty > 0) items.push({ ...item, qty });
  }
  return { items, invalidKeys };
}
