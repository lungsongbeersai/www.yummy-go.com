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

export type ProductBlockedState = "promotion-ended" | "sold-out";
export type ProductActionState = "blocked" | "choose" | "add" | "view";
export type PublicProductLayoutMode = "grid" | "list";
export type ProductModalMode = "normal" | "set" | "promotion";
// promotionQuantity() reads this off EITHER a catalog ProdDetail (not yet in
// cart: proDetailCusQtyBuy/Free) OR a cart line's CartItemDetail (server's
// resolved snapshot: sale_qty/free_qty/order_it_promo_*/total_receive_qty).
// A plain ProdDetail | CartItemDetail union doesn't typecheck here because
// each field only exists on one side; this lists the read surface directly
// so both callers stay structurally assignable without a runtime cast.
export type PromotionQuantitySource =
  | {
      sale_qty?: number;
      order_it_promo_sale_qty?: number;
      proDetailCusQtyBuy?: number;
      free_qty?: number;
      proDetailCusQtyFree?: number;
      order_it_promo_free_qty?: number;
      total_receive_qty?: number;
    }
  | null;
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
