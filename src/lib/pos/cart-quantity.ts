/**
 * Shared "buy X get Y free" quantity-step rules for the two independent cart
 * surfaces: public-pos/order/product-domain.ts and pos/table-selection
 * (P3.3-style relocation — see cart-status.ts in this folder for the same
 * pattern). Both read the same CartItemDetail shape from @/services/pos, so
 * one implementation covers a catalog ProdDetail (not yet in cart:
 * proDetailCusQtyBuy/Free) and a cart line's server-resolved snapshot
 * (sale_qty, free_qty, order_it_promo_sale_qty/free_qty, total_receive_qty)
 * without a cast.
 */

// promotionQuantity() reads this off EITHER a catalog ProdDetail (not yet in
// cart) OR a cart line's CartItemDetail — each field only exists on one
// side, so this lists the read surface directly instead of unioning the two.
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

export const MAX_CART_ITEM_QTY = 99;

export function positiveQuantity(value: unknown) {
  const qty = Number(value);
  return Number.isFinite(qty) && qty > 0 ? qty : undefined;
}

export function promotionQuantity(
  source?: PromotionQuantitySource,
  orderQty?: number,
) {
  const saleQty =
    positiveQuantity(source?.sale_qty) ??
    positiveQuantity(source?.order_it_promo_sale_qty) ??
    positiveQuantity(source?.proDetailCusQtyBuy) ??
    0;
  const freeQty =
    positiveQuantity(source?.free_qty) ??
    positiveQuantity(source?.proDetailCusQtyFree) ??
    positiveQuantity(source?.order_it_promo_free_qty) ??
    0;
  const lineFreeQty = positiveQuantity(source?.order_it_promo_free_qty) ?? 0;
  const hasPromotion = saleQty > 0 && freeQty > 0;

  return {
    hasPromotion,
    saleQty,
    freeQty,
    qtyStep: hasPromotion ? saleQty : 1,
    totalReceiveQty:
      positiveQuantity(source?.total_receive_qty) ??
      (hasPromotion && orderQty ? orderQty + lineFreeQty : null),
  };
}

export type CartQuantityErrorReason = "invalid" | "step" | "max";

export interface CartQuantityCheck {
  value: number | null;
  error: CartQuantityErrorReason | null;
}

// ตัวเลขที่ป้อนต้องเป็นจำนวนเต็มบวก, ไม่เกิน max, และเป็นทวีคูณของ step เสมอ
// (step=1 เมื่อไม่มีโปรโมชั่น จึงไม่มีทางติดเงื่อนไข step) — ใช้ตรวจก่อนยิง API
// ทั้งจากช่องกรอกในโมดัลและตอนคำนวณ delta ไปที่ updateQty
export function checkCartQuantity(
  raw: string,
  step: number,
  max: number = MAX_CART_ITEM_QTY,
): CartQuantityCheck {
  const trimmed = raw.trim();
  const value = Number(trimmed);
  const isPositiveInteger = trimmed !== "" && Number.isInteger(value) && value > 0;

  if (!isPositiveInteger) return { value: null, error: "invalid" };
  if (value > max) return { value: null, error: "max" };
  if (value < step || value % step !== 0) return { value: null, error: "step" };
  return { value, error: null };
}

export type CartQuantityKeypadKey =
  | "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"
  | "delete"
  | "clear";

// สะสมตัวเลขจากปุ่มกด numpad — ไม่บล็อกเลขที่เกิน max เงียบ ๆ อีกต่อไป (เดิมทำแบบ
// appendDiscountCalculatorInput ที่กันเปอร์เซ็นต์เกิน 100 ไปเลย) เพราะเมื่อค่าเริ่มต้น
// ที่พรีฟิลไว้ชนขอบ max พอดี (เช่น ยกเลิกทั้งหมด 4 ชิ้น ค่าเริ่มต้น = 4 = max) ตัวเลขที่
// พิมพ์ต่อจะเกิน max เสมอ กลายเป็นกดปุ่มแล้วไม่มีอะไรเกิดขึ้นเลยแบบไม่มีคำอธิบาย —
// ปล่อยให้ค่าที่พิมพ์เกินผ่านไปได้ แล้วให้ checkCartQuantity/errorText (ผู้เรียกอยู่แล้ว)
// เป็นคนแจ้งเตือนแทน
export function appendCartQuantityDigit(draft: string, key: CartQuantityKeypadKey) {
  if (key === "clear") return "";
  if (key === "delete") return draft.slice(0, -1);

  return `${draft}${key}`.replace(/^0+(?=\d)/, "");
}
