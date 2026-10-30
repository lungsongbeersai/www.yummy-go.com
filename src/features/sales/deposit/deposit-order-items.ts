import type { CartItem } from "@/services/pos";
import {
  cartItemDisplayName,
  cartItemName,
  cartItemQty,
  cartItemStatus,
  isCanceledCartItem,
  optionalString
} from "@/features/pos/table-selection/utils";
import { remainingDepositQuantity } from "./deposit-utils";

export interface DepositableOrderItem {
  key: string;
  proDetailUuid: string;
  productCode: string;
  name: string;
  unitName: string;
  orderedQty: number;
  availableQty: number;
}

export function depositableOrderItems(
  orderItems: CartItem[],
  deposited: ReadonlyMap<string, number>
): DepositableOrderItem[] {
  const items = new Map<string, DepositableOrderItem>();
  for (const item of orderItems) {
    if (item.is_deposit_redemption || isCanceledCartItem(item)) continue;
    if (![1, 2, 3, 4].includes(cartItemStatus(item) ?? -1)) continue;
    if (Number(item.pro_detail_stock) !== 1) continue;
    const proDetailUuid = optionalString(item.pro_detail_uuid, item.pro_detail_uuid_fk);
    const qty = cartItemQty(item);
    if (!proDetailUuid || !Number.isFinite(qty) || qty <= 0) continue;
    const existing = items.get(proDetailUuid);
    if (existing) {
      existing.orderedQty = Math.round((existing.orderedQty + qty) * 1000) / 1000;
      continue;
    }
    items.set(proDetailUuid, {
      key: proDetailUuid,
      proDetailUuid,
      // A product's public SKU is not the UUID used to save its size/variant.
      productCode: optionalString(item.prod_code, item.product_code) ?? "",
      name: cartItemDisplayName(cartItemName(item), optionalString(item.detail?.size_name)),
      unitName: optionalString(item.unit_name, item.detail?.unit_name) ?? "",
      orderedQty: qty,
      availableQty: 0
    });
  }
  return [...items.values()].map((item) => ({
    ...item,
    availableQty: remainingDepositQuantity(item.orderedQty, deposited.get(item.proDetailUuid) ?? 0)
  })).filter((item) => item.availableQty > 0);
}

export function formatDepositQuantity(value: number) {
  return Number.isFinite(value) ? Number(value.toFixed(3)).toString() : "0";
}

export function formatDepositDate(value: string | null | undefined) {
  if (!value) return "—";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "—";
}
