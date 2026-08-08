import type {
  CateProductItem,
  ProdDetail,
  ProdItem,
  ProdTopping,
} from "@/services/pos";
import type { PublicMenuKind } from "@/stores/public-pos-store/helpers";

export interface PublicAddToCartPayload {
  detail: ProdDetail;
  qty: number;
  toppings: PublicSelectedTopping[];
  note: string;
}

export interface PublicSelectedTopping {
  topping: ProdTopping;
  qty: number;
}

export interface PublicDisplayProduct {
  product: CateProductItem;
  cateUuid: string;
  statusKind: PublicMenuKind;
}

// ค่าที่ใส่ใน data-yg-accent — ต้องตรงกับบล็อกที่ประกาศไว้ใน nightfall.css
export type PublicPosAccent = "emerald" | "gold" | "rose";
export type ProductBlockedState = "promotion-ended" | "sold-out";
export type ProductActionState = "blocked" | "choose" | "add" | "view";
export type PublicProductLayoutMode = "grid" | "list";
export type ProductModalMode = "normal" | "set" | "promotion";
// P3.3: relocated to src/lib/pos/cart-quantity.ts, re-exported unchanged so
// this module's importers don't need to change.
export type { PromotionQuantitySource } from "@/lib/pos/cart-quantity";
export type ScrollJumpEdge = "top" | "bottom";

export interface RectSnapshot {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface CartFlyAnimationState {
  id: number;
  product: CateProductItem | ProdItem;
  start: RectSnapshot;
  end: RectSnapshot;
}
