import type {
  CartItem,
  CateProductItem,
  ProdDetail,
  ProdItem,
  ProdTopping,
} from "@/services/pos";
import type { PublicMenuKind } from "@/stores/public-pos-store/helpers";

export interface PublicAddToCartPayload {
  detail: ProdDetail;
  qty: number;
  toppings: ProdTopping[];
  note: string;
}

export interface PublicDisplayProduct {
  product: CateProductItem;
  cateUuid: string;
  statusKind: PublicMenuKind;
}

export type ProductBlockedState = "promotion-ended" | "sold-out";
export type ProductActionState = "blocked" | "choose" | "add" | "view";
export type ProductModalMode = "normal" | "set" | "promotion";
export type PromotionQuantitySource =
  | ProdDetail
  | NonNullable<CartItem["detail"]>
  | null
  | undefined;
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
