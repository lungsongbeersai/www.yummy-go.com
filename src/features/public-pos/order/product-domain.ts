import type { TFunction } from "i18next";
import { OrderChannelEnum, OrderSourceEnum } from "@/config/pos-constants";
import { formatMoney, formatShortDate } from "@/lib/format";
import {
  getProductBlockedStateCore,
  isKnownModalProductCore,
  isProductUnavailable,
  isPromotionEndedCore,
} from "@/lib/pos/product-classification";
import {
  publicHasRemoteProductImage,
  publicIsHexColor,
  publicProductImageUrl,
} from "@/lib/pos/product-media";
import type {
  CartOrder,
  CateProductItem,
  ProdDetail,
  ProdItem,
  ProdTopping,
} from "@/services/pos";
import type {
  CustomerCreateOrderInput,
  QRScanResponse,
} from "@/services/public-pos";
import {
  PUBLIC_MENU_KIND,
  publicMenuKindToStatusSortFk,
} from "@/stores/public-pos-store/helpers";
import { MAX_OPEN_QTY } from "@/features/public-pos/order/constants";
import type {
  ProductActionState,
  ProductModalMode,
  PromotionQuantitySource,
  PublicAddToCartPayload,
  PublicSelectedTopping,
} from "@/features/public-pos/order/types";
import { getCartItemQty, isOpenCartItemForStock } from "./cart-domain";
import { statusSectionLabel } from "./menu-render";
import { numeric } from "./numeric";

// P3.3: relocated to src/lib/pos/product-media.ts, alongside the staff POS's
// diverging productMedia() resolver — re-exported unchanged under the
// original names so this module's ~6 importers don't need to change.
export {
  publicProductImageUrl as productImageUrl,
  publicHasRemoteProductImage as hasRemoteProductImage,
  publicIsHexColor as isHexColor,
};

// P3.3: relocated to src/lib/format.ts alongside money(); re-exported
// unchanged (see that file for why they weren't folded into money()).
export { formatMoney, formatShortDate };

export function formatProductPrice(product: CateProductItem, lang: string) {
  const rawPrice = product.pro_detail_sprice ?? product.prod_price;
  const price = Number(rawPrice);
  if (!Number.isFinite(price) || price <= 0) return "";

  return formatMoney(price, lang);
}

function positivePrice(value: unknown) {
  const price = Number(value);
  return Number.isFinite(price) && price > 0 ? price : null;
}

function hasPriceValue(value: unknown) {
  return (
    value !== null &&
    value !== undefined &&
    (typeof value !== "string" || value.trim() !== "")
  );
}

export function publicProductCardPrice(
  product: CateProductItem,
):
  | { kind: "exact" | "starting"; value: number }
  | { kind: "variable"; value: null } {
  if (Number(product.count_option_enabled ?? 0) > 1) {
    const minPrice = positivePrice(product.min_price);
    if (minPrice === null) return { kind: "variable", value: null };

    if (!hasPriceValue(product.max_price)) {
      return { kind: "starting", value: minPrice };
    }

    const maxPrice = positivePrice(product.max_price);
    if (maxPrice === null || maxPrice < minPrice) {
      return { kind: "variable", value: null };
    }

    return maxPrice === minPrice
      ? { kind: "exact", value: minPrice }
      : { kind: "starting", value: minPrice };
  }

  const exactPrice =
    positivePrice(product.pro_detail_sprice) ??
    positivePrice(product.prod_price);
  if (exactPrice !== null) return { kind: "exact", value: exactPrice };

  const minPrice = positivePrice(product.min_price);
  return minPrice === null
    ? { kind: "variable", value: null }
    : { kind: "exact", value: minPrice };
}

export function getPublicOrderPriceTotals({
  basePrice,
  productQty,
  toppings,
}: {
  basePrice: number;
  productQty: number;
  toppings: PublicSelectedTopping[];
}) {
  const normalizedProductQty = numeric(productQty);
  const productSubtotal = numeric(basePrice) * normalizedProductQty;
  const toppingUnitTotal = toppings.reduce(
    (sum, selected) =>
      sum + numeric(selected.topping.topping_price) * numeric(selected.qty),
    0,
  );
  // topping_qty is per product; only its price is extended by the product quantity.
  const toppingTotal = toppingUnitTotal * normalizedProductQty;

  return {
    productSubtotal,
    toppingTotal,
    total: productSubtotal + toppingTotal,
  };
}

// P3.3: NOT merged with pos/order-customer's identically-named
// getProductModalMode — for status, this public version uses only the passed
// statusSortFk and also matches the Lao menu's "③"/"②" glyph markers in
// type_group; the staff version additionally checks product?.status_sort_fk.
export function getProductModalMode(
  statusSortFk: number,
  product?: ProdItem | null,
): ProductModalMode {
  const status = Number(statusSortFk);
  if (status === publicMenuKindToStatusSortFk(PUBLIC_MENU_KIND.PROMOTION))
    return "promotion";
  if (status === publicMenuKindToStatusSortFk(PUBLIC_MENU_KIND.SET))
    return "set";

  const typeGroup = String(product?.type_group ?? "").toLowerCase();
  if (typeGroup.includes("③") || typeGroup.includes("promo"))
    return "promotion";
  if (
    typeGroup.includes("②") ||
    typeGroup.includes("set") ||
    product?.prod_set_price !== undefined
  )
    return "set";
  return "normal";
}

export function productModeLabel(
  mode: ProductModalMode,
  product: ProdItem,
  lang: string,
) {
  if (product.type_group) return product.type_group;
  if (mode === "promotion")
    return statusSectionLabel(PUBLIC_MENU_KIND.PROMOTION, lang);
  if (mode === "set") return statusSectionLabel(PUBLIC_MENU_KIND.SET, lang);
  return statusSectionLabel(PUBLIC_MENU_KIND.NORMAL, lang);
}

export function getModalBasePrice(
  product: ProdItem | null,
  detail: ProdDetail | null | undefined,
  mode: ProductModalMode,
) {
  if (mode === "set") {
    return numeric(
      product?.prod_set_price ??
        product?.prod_price ??
        productPriceFromDetail(detail),
    );
  }

  return productPriceFromDetail(detail);
}

// P3.3: NOT merged with pos/order-customer's identically-named
// getPromoLabel — this version uses the "pos.getShort" i18n key for the
// "buy X get Y" message; the staff version reuses "pos.freeShort" there
// instead, a real text difference, not just a style one.
export function getPromoLabel(
  detail: ProdDetail | null | undefined,
  t: TFunction,
) {
  const buy = Number(detail?.pro_detail_cus_qtyBuy ?? 0);
  const free = Number(detail?.pro_detail_cus_qtyFree ?? 0);

  if (buy > 0 && free > 0)
    return `${t("pos.buyShort")} ${buy} ${t("pos.getShort")} ${free}`;
  if (free > 0) return `${t("pos.freeShort")} ${free}`;
  return t("pos.promotion");
}

export function isToppingAvailable(topping?: ProdTopping | null) {
  if (!topping) return false;
  if (topping.topping_enabled === 2) return false;
  if (topping.topping_status === 2) return false;
  return true;
}

export function toppingDisplayName(topping: ProdTopping, lang: string) {
  if (lang === "en") {
    return (
      topping.topping_name_eng ||
      topping.topping_name ||
      topping.topping_name_la ||
      ""
    );
  }

  return (
    topping.topping_name_la ||
    topping.topping_name ||
    topping.topping_name_eng ||
    ""
  );
}

// Public ordering intentionally preserves direct Number(...) coercion from
// its pre-P3.3 implementation; shared classification receives those resolved
// values without imposing staff POS fallback semantics.
function publicProductStatusSort(
  product: CateProductItem,
  activeStatusSortFk: number,
) {
  return Number(product.status_sort_fk ?? activeStatusSortFk);
}

export function isPromotionEnded(
  product: CateProductItem,
  activeStatusSortFk: number,
) {
  return isPromotionEndedCore(
    product,
    publicProductStatusSort(product, activeStatusSortFk),
  );
}

export function getProductBlockedState(
  product: CateProductItem,
  activeStatusSortFk: number,
) {
  return getProductBlockedStateCore(
    product,
    publicProductStatusSort(product, activeStatusSortFk),
  );
}

export { isProductUnavailable };

export function productBlockedLabel(
  blockedState: ReturnType<typeof getProductBlockedState>,
  product: CateProductItem,
  t: TFunction,
) {
  if (blockedState === "promotion-ended") return t("pos.promotionEnded");
  if (blockedState === "sold-out")
    return product.sold_out_msg || t("pos.outOfStock");
  return "";
}

export function getProductActionState(
  product: CateProductItem,
  activeStatusSortFk: number,
): ProductActionState {
  if (getProductBlockedState(product, activeStatusSortFk)) return "blocked";
  if (isKnownModalProduct(product, activeStatusSortFk)) return "choose";
  if (canDirectAddFromList(product, activeStatusSortFk)) return "add";
  return "view";
}

export function isKnownModalProduct(
  product: CateProductItem,
  activeStatusSortFk: number,
) {
  return isKnownModalProductCore({
    allOptionCount: Number(product.count_option_all ?? 1),
    enabledOptionCount: Number(product.count_option_enabled ?? 1),
    enabledToppingCount: Number(product.count_topping_enabled ?? 0),
    hasOptions: product.has_options === true,
    hasPromo: hasPromo(product),
    productStatusSort: publicProductStatusSort(
      product,
      activeStatusSortFk,
    ),
  });
}

export function hasPromo(product: CateProductItem) {
  const promoState = String(product.promo_state ?? "").toUpperCase();
  return Boolean(
    promoState && promoState !== "NONE" && product.promo_expired !== true,
  );
}

export function productNeedsModal(
  product: CateProductItem,
  item: ProdItem,
  activeStatusSortFk: number,
) {
  const enabledDetails = (item.details ?? []).filter(isDetailAvailable);
  const enabledToppings = (item.toppings ?? []).filter(isToppingAvailable);
  const productStatusSort = Number(
    product.status_sort_fk ?? activeStatusSortFk,
  );
  return (
    product.has_options === true ||
    Number(product.count_topping_enabled ?? 0) > 0 ||
    productStatusSort === publicMenuKindToStatusSortFk(PUBLIC_MENU_KIND.SET) ||
    productStatusSort ===
      publicMenuKindToStatusSortFk(PUBLIC_MENU_KIND.PROMOTION) ||
    hasPromo(product) ||
    enabledDetails.length > 1 ||
    enabledToppings.length > 0
  );
}

// P3.3: NOT merged with pos/order-customer's identically-named
// canDirectAddFromList — this version accepts any finite price (including
// 0 or negative), lacks the staff version's extra count_option_all<=1
// guard, and doesn't gate on getProductBlockedState. Real divergence, not
// style — see product-classification.ts over there.
export function canDirectAddFromList(
  product: CateProductItem,
  activeStatusSortFk: number,
) {
  const detailUuid = String(product.pro_detail_uuid ?? "").trim();
  const price = Number(product.pro_detail_sprice ?? product.prod_price);
  const productStatusSort = Number(
    product.status_sort_fk ?? activeStatusSortFk,
  );
  return (
    Boolean(detailUuid) &&
    Number.isFinite(price) &&
    product.has_options !== true &&
    Number(product.count_option_enabled ?? 1) <= 1 &&
    Number(product.count_topping_enabled ?? 0) <= 0 &&
    productStatusSort !== publicMenuKindToStatusSortFk(PUBLIC_MENU_KIND.SET) &&
    productStatusSort !==
      publicMenuKindToStatusSortFk(PUBLIC_MENU_KIND.PROMOTION) &&
    !hasPromo(product)
  );
}

export function productListItemToProdItem(product: CateProductItem): ProdItem {
  const price = product.pro_detail_sprice ?? product.prod_price ?? 0;
  return {
    prod_uuid: product.prod_uuid,
    prod_name: product.prod_name,
    prod_image: product.prod_image,
    prod_color: product.prod_color,
    prod_price: price,
    prod_status_imge: product.prod_status_imge,
    details: [
      {
        pro_detail_uuid: String(product.pro_detail_uuid ?? ""),
        price,
        pro_detail_sprice: price,
        cut_stock: 2,
        pro_detail_enabled: 1,
      },
    ],
    toppings: [],
  };
}

// P3.3: NOT merged with pos/order-customer's identically-named
// isDetailAvailable/firstAvailableDetail/getModalBasePrice/
// productPriceFromDetail — see product-availability.ts and pricing.ts over
// there for the specific divergence found in each.
export function isDetailAvailable(detail?: ProdDetail) {
  if (!detail) return false;
  if (detail.pro_detail_enabled === 2) return false;
  if (detail.pro_detail_status === 2) return false;
  if (detail.cut_stock !== 2 && Number(detail.qty_stock ?? 1) <= 0)
    return false;
  return true;
}

export function firstAvailableDetail(product?: ProdItem | null) {
  return (
    (product?.details ?? []).find(isDetailAvailable) ??
    product?.details?.[0] ??
    null
  );
}

export function defaultOrderQty(detail?: ProdDetail | null) {
  const qty = Number(detail?.pro_detail_cus_qtyBuy ?? detail?.default_qty ?? 1);
  return Number.isFinite(qty) && qty > 0 ? qty : 1;
}

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
    positiveQuantity(source?.pro_detail_cus_qtyBuy) ??
    0;
  const freeQty =
    positiveQuantity(source?.free_qty) ??
    positiveQuantity(source?.pro_detail_cus_qtyFree) ??
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

export function productPriceFromDetail(detail?: ProdDetail | null) {
  return numeric(detail?.pro_detail_sprice ?? detail?.price);
}

export function maxAvailableQty(
  product: ProdItem | null,
  detail: ProdDetail | undefined,
  cart: CartOrder[],
) {
  if (!detail) return 1;
  if (detail.cut_stock === 2) return MAX_OPEN_QTY;

  const stock = Number(detail.qty_stock ?? MAX_OPEN_QTY);
  if (!Number.isFinite(stock) || stock <= 0) return 0;

  const usedQty = cart
    .flatMap((order) => order.items ?? [])
    .filter(isOpenCartItemForStock)
    .filter((item) => {
      const itemDetailUuid = String(
        item.pro_detail_uuid_fk ??
          item.pro_detail_uuid ??
          item.detail?.pro_detail_uuid ??
          "",
      );
      const itemProductUuid = String(item.prod_uuid_fk ?? item.prod_uuid ?? "");
      return (
        itemDetailUuid === detail.pro_detail_uuid ||
        Boolean(product?.prod_uuid && itemProductUuid === product.prod_uuid)
      );
    })
    .reduce((sum, item) => sum + getCartItemQty(item), 0);

  return Math.max(1, stock - usedQty);
}

export function canAddQty(
  product: ProdItem,
  detail: ProdDetail,
  qty: number,
  cart: CartOrder[],
) {
  return (
    isDetailAvailable(detail) && qty <= maxAvailableQty(product, detail, cart)
  );
}

export function buildPublicOrderInput({
  table,
  detail,
  qty,
  toppings,
  note,
  lang,
}: {
  table: QRScanResponse;
  detail: ProdDetail;
  qty: number;
  toppings: PublicSelectedTopping[];
  note: string;
  lang: string;
}): CustomerCreateOrderInput {
  return {
    table_uuid_fk: table.table_uuid,
    branch_uuid_fk: "",
    order_created_by: "public_user",
    order_source: OrderSourceEnum.QR,
    order_channel: OrderChannelEnum.DINE_IN,
    order_service_rate: 0,
    order_vat_rate: 0,
    lang,
    items: [
      {
        prod_detail_uuid_fk: detail.pro_detail_uuid,
        order_it_qty: qty,
        order_it_note: note || "",
        order_it_status: 0,
        toppings: toppings.map((selected) => ({
          prod_topping_uuid_fk: selected.topping.prod_topping_uuid,
          topping_qty: selected.qty,
        })),
      },
    ],
  };
}

export function changePublicToppingQty(
  current: Record<string, number>,
  toppingUuid: string,
  qty: number,
) {
  const normalizedQty = Number.isFinite(qty) ? Math.floor(qty) : 0;
  if (normalizedQty < 1) {
    const next = { ...current };
    delete next[toppingUuid];
    return next;
  }

  return {
    ...current,
    [toppingUuid]: Math.min(MAX_OPEN_QTY, normalizedQty),
  };
}

export function togglePublicToppingQty(
  current: Record<string, number>,
  toppingUuid: string,
  rememberedQty = 1,
) {
  return changePublicToppingQty(
    current,
    toppingUuid,
    current[toppingUuid] ? 0 : rememberedQty,
  );
}

export type DirectAddListResult =
  | {
      ok: true;
      item: ProdItem;
      payload: PublicAddToCartPayload;
    }
  | {
      ok: false;
      reason: "needs-modal" | "sold-out";
    };

export function getDirectAddListPayload(
  product: CateProductItem,
  activeStatusSortFk: number,
  cart: CartOrder[],
): DirectAddListResult {
  if (!canDirectAddFromList(product, activeStatusSortFk)) {
    return { ok: false, reason: "needs-modal" };
  }

  const item = productListItemToProdItem(product);
  const detail = firstAvailableDetail(item);
  if (!detail) return { ok: false, reason: "sold-out" };

  const qty = defaultOrderQty(detail);
  if (!canAddQty(item, detail, qty, cart)) {
    return { ok: false, reason: "sold-out" };
  }

  return {
    ok: true,
    item,
    payload: { detail, qty, toppings: [], note: "" },
  };
}
