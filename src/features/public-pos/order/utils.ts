import type { TFunction } from "i18next";
import { Ban, CheckCircle2, ChefHat, Clock3, Send } from "lucide-react";
import {
  OrderChannelEnum,
  OrderSourceEnum,
  ProductImageStatus,
  TableStatus,
  type CartItem,
  type CartOrder,
  type CateProductItem,
  type CateWithProducts,
  type FetchCartStatusRule,
  type ProdDetail,
  type ProdItem,
  type ProdTopping,
} from "@/services/pos";
import type {
  CustomerCreateOrderInput,
  QRScanResponse,
} from "@/services/public-pos";
import {
  PUBLIC_MENU_KIND,
  publicMenuKindToStatusSortFk,
  type PublicMenuKind,
} from "@/stores/public-pos-store/helpers";
import {
  CATEGORY_BOTTOM_ACTIVE_THRESHOLD_PX,
  DEFAULT_PUBLIC_CATEGORY_ICON,
  MAX_OPEN_QTY,
  PUBLIC_SEARCH_HISTORY_LIMIT,
  PUBLIC_SEARCH_HISTORY_STORAGE_PREFIX,
} from "@/features/public-pos/order/constants";
import type {
  ProductActionState,
  ProductBlockedState,
  ProductModalMode,
  PromotionQuantitySource,
  PublicAddToCartPayload,
  PublicDisplayProduct,
  RectSnapshot,
  ScrollJumpEdge,
} from "@/features/public-pos/order/types";
export function tableStatusLabel(status: number, t: TFunction) {
  if (Number(status) === TableStatus.AVAILABLE) return t("common.free");
  if (Number(status) === TableStatus.OCCUPIED) return t("common.busy");
  return String(status);
}

export function publicSearchHistoryKey(
  branchUuid: string | null | undefined,
  lang: string,
) {
  return `${PUBLIC_SEARCH_HISTORY_STORAGE_PREFIX}:${branchUuid?.trim() || "global"}:${lang}`;
}

export function addPublicSearchHistoryItem(history: string[], query: string) {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return normalizePublicSearchHistory(history);

  return normalizePublicSearchHistory([normalizedQuery, ...history]);
}

export function normalizePublicSearchHistory(history: string[]) {
  const seen = new Set<string>();
  const nextHistory: string[] = [];

  history.forEach((item) => {
    const query = item.trim();
    const lookupKey = query.toLocaleLowerCase();
    if (!query || seen.has(lookupKey)) return;

    seen.add(lookupKey);
    nextHistory.push(query);
  });

  return nextHistory.slice(0, PUBLIC_SEARCH_HISTORY_LIMIT);
}

export function readPublicSearchHistory(key: string) {
  if (typeof window === "undefined") return [];

  try {
    const rawValue = window.localStorage.getItem(key);
    const parsedValue = rawValue ? JSON.parse(rawValue) : [];
    if (!Array.isArray(parsedValue)) return [];

    return normalizePublicSearchHistory(
      parsedValue.filter((item): item is string => typeof item === "string"),
    );
  } catch {
    return [];
  }
}

export function writePublicSearchHistory(key: string, history: string[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      key,
      JSON.stringify(normalizePublicSearchHistory(history)),
    );
  } catch {
    // Ignore localStorage failures in private or restricted browser contexts.
  }
}

export function clearPublicSearchHistory(key: string) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore localStorage failures in private or restricted browser contexts.
  }
}

export function publicCategoryIconName(icon?: string | null) {
  const value = icon?.trim().toLowerCase() ?? "";
  if (!value) return "";

  const iconName = value.includes(":") ? value : `mdi:${value}`;
  if (!iconName.startsWith("mdi:")) return DEFAULT_PUBLIC_CATEGORY_ICON;

  return iconName;
}

export function flattenStatusProducts(
  categories: CateWithProducts[],
  statusKind: PublicMenuKind,
): PublicDisplayProduct[] {
  const products: PublicDisplayProduct[] = [];

  categories.forEach((category) => {
    const cateUuid = category.cate_uuid.startsWith("__special_")
      ? ""
      : category.cate_uuid;

    (category.products ?? []).forEach((product) => {
      products.push({
        product,
        cateUuid,
        statusKind,
      });
    });
  });

  return products;
}

export function productImageUrl(product: CateProductItem | ProdItem) {
  return product.prod_status_imge === ProductImageStatus.IMAGE &&
    product.prod_image?.startsWith("http")
    ? product.prod_image
    : "";
}

export function hasRemoteProductImage(product: CateProductItem | ProdItem) {
  return Boolean(productImageUrl(product));
}

export function statusSectionLabel(statusKind: PublicMenuKind, lang: string) {
  const isEnglish = lang === "en";
  if (statusKind === PUBLIC_MENU_KIND.PROMOTION)
    return isEnglish ? "Promotion" : "ໂປຣໂມຊັນ";
  if (statusKind === PUBLIC_MENU_KIND.SET)
    return isEnglish ? "Set" : "ເຊັດອາຫານ";
  return isEnglish ? "Normal" : "ທົ່ວໄປ";
}

export function orderCateUuidsByMenu(
  cateUuids: string[],
  menuCategories: CateWithProducts[],
) {
  const requested = new Set(cateUuids.filter(Boolean));
  return menuCategories
    .map((category) => category.cate_uuid)
    .filter((cateUuid) => requested.has(cateUuid));
}

export interface RenderedMenuSection {
  category: CateWithProducts;
  products: CateProductItem[];
  totalProducts: number;
  visibleCount: number;
  loaded: boolean;
  loading: boolean;
}

export function getRenderedMenuSections({
  renderedCateUuids,
  categoryByUuid,
  visibleProductCountByCate,
  loadedCateUuids,
  loadingCateUuids,
  productRenderChunk,
}: {
  renderedCateUuids: string[];
  categoryByUuid: Map<string, CateWithProducts>;
  visibleProductCountByCate: Record<string, number>;
  loadedCateUuids: string[];
  loadingCateUuids: string[];
  productRenderChunk: number;
}): RenderedMenuSection[] {
  return renderedCateUuids
    .map((cateUuid) => {
      const category = categoryByUuid.get(cateUuid);
      if (!category) return null;

      const totalProducts = category.products?.length ?? 0;
      const visibleCount = Math.min(
        totalProducts,
        visibleProductCountByCate[cateUuid] ?? productRenderChunk,
      );

      return {
        category,
        products: (category.products ?? []).slice(0, visibleCount),
        totalProducts,
        visibleCount,
        loaded: loadedCateUuids.includes(cateUuid),
        loading: loadingCateUuids.includes(cateUuid),
      };
    })
    .filter((section): section is RenderedMenuSection => Boolean(section));
}

export function hasMoreMenuToRender({
  collapsedCateUuids,
  loadedCateUuids,
  menuCategories,
  categoryByUuid,
  renderedCateUuids,
  visibleProductCountByCate,
}: {
  collapsedCateUuids: string[];
  loadedCateUuids: string[];
  menuCategories: CateWithProducts[];
  categoryByUuid: Map<string, CateWithProducts>;
  renderedCateUuids: string[];
  visibleProductCountByCate: Record<string, number>;
}) {
  const lastCateUuid = renderedCateUuids.at(-1);
  if (!lastCateUuid) return Boolean(menuCategories.length);
  if (!loadedCateUuids.includes(lastCateUuid)) return false;

  const lastCategory = categoryByUuid.get(lastCateUuid);
  const collapsed = collapsedCateUuids.includes(lastCateUuid);
  if (
    !collapsed &&
    lastCategory &&
    (visibleProductCountByCate[lastCateUuid] ?? 0) <
      (lastCategory.products?.length ?? 0)
  ) {
    return true;
  }

  const lastIndex = menuCategories.findIndex(
    (category) => category.cate_uuid === lastCateUuid,
  );
  return (
    lastIndex >= 0 &&
    menuCategories
      .slice(lastIndex + 1)
      .some((category) => !renderedCateUuids.includes(category.cate_uuid))
  );
}

export function visibleProductCountForCategory(
  category: CateWithProducts,
  productRenderChunk: number,
) {
  const totalProducts = category.products?.length ?? 0;
  return totalProducts > 0 ? Math.min(productRenderChunk, totalProducts) : 0;
}

export function getCategoryPathUuids({
  activeCateUuid,
  targetCateUuid,
  renderedCateUuids,
  menuCategories,
}: {
  activeCateUuid: string;
  targetCateUuid: string;
  renderedCateUuids: string[];
  menuCategories: CateWithProducts[];
}) {
  const targetIndex = menuCategories.findIndex(
    (category) => category.cate_uuid === targetCateUuid,
  );
  if (targetIndex < 0) return [];

  const anchorCateUuid =
    activeCateUuid ||
    renderedCateUuids.at(-1) ||
    menuCategories[0]?.cate_uuid ||
    "";
  const anchorIndex = Math.max(
    0,
    menuCategories.findIndex(
      (category) => category.cate_uuid === anchorCateUuid,
    ),
  );
  const fromIndex = Math.min(anchorIndex, targetIndex);
  const toIndex = Math.max(anchorIndex, targetIndex);

  return menuCategories
    .slice(fromIndex, toIndex + 1)
    .map((category) => category.cate_uuid);
}

export function withCategoryPathVisibleCounts({
  current,
  pathCateUuids,
  categoryByUuid,
  productRenderChunk,
}: {
  current: Record<string, number>;
  pathCateUuids: string[];
  categoryByUuid: Map<string, CateWithProducts>;
  productRenderChunk: number;
}) {
  let next = current;

  pathCateUuids.forEach((cateUuid) => {
    const category = categoryByUuid.get(cateUuid);
    const visibleCount = category
      ? visibleProductCountForCategory(category, productRenderChunk)
      : 0;
    if (visibleCount <= 0 || next[cateUuid]) return;

    next = {
      ...next,
      [cateUuid]: visibleCount,
    };
  });

  return next;
}

export function formatProductPrice(product: CateProductItem, lang: string) {
  const rawPrice = product.pro_detail_sprice ?? product.prod_price;
  const price = Number(rawPrice);
  if (!Number.isFinite(price) || price <= 0) return "";

  return formatMoney(price, lang);
}

export function formatMoney(price: number, lang: string) {
  if (!Number.isFinite(price) || price <= 0) return "0 LAK";

  const locale = lang === "en" ? "en-US" : "lo-LA";
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(price)} LAK`;
}

export function numeric(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

export function isHexColor(value?: string) {
  return Boolean(value && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value));
}

export function snapshotRect(rect: DOMRect | DOMRectReadOnly): RectSnapshot {
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  };
}

export function prefersReducedMotion() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function")
    return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function easeOutCubic(value: number) {
  return 1 - Math.pow(1 - value, 3);
}

export function getWindowMaxScrollY() {
  if (typeof window === "undefined" || typeof document === "undefined")
    return 0;

  const scrollingElement =
    document.scrollingElement ?? document.documentElement;
  return Math.max(0, scrollingElement.scrollHeight - window.innerHeight);
}

export function getScrollJumpEdgeFromViewport(): ScrollJumpEdge {
  if (typeof window === "undefined") return "bottom";
  return getWindowMaxScrollY() - window.scrollY <=
    CATEGORY_BOTTOM_ACTIVE_THRESHOLD_PX
    ? "top"
    : "bottom";
}

export function publicQrDownloadFilename(tableName?: string | null) {
  const basename = tableName?.trim() || "public-pos";
  const safeBasename =
    basename.replace(/[\\/:*?"<>|]+/g, "-").trim() || "public-pos";
  return `${safeBasename}-qr.png`;
}

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

export function formatShortDate(value: string, lang: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat(lang === "en" ? "en-US" : "lo-LA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
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

export function isProductUnavailable(product: CateProductItem) {
  return (
    product.sold_out_manual === true ||
    product.stock_sold_out === true ||
    product.stock_available === false ||
    product.can_add === false
  );
}

export function isPromotionEnded(
  product: CateProductItem,
  activeStatusSortFk: number,
) {
  if (product.promo_expired !== true) return false;

  const promoState = String(product.promo_state ?? "")
    .trim()
    .toUpperCase();
  const productStatusSort = Number(
    product.status_sort_fk ?? activeStatusSortFk,
  );
  return (
    productStatusSort ===
      publicMenuKindToStatusSortFk(PUBLIC_MENU_KIND.PROMOTION) ||
    Boolean(promoState && promoState !== "NONE") ||
    Boolean(String(product.promo_msg ?? "").trim())
  );
}

export function getProductBlockedState(
  product: CateProductItem,
  activeStatusSortFk: number,
): ProductBlockedState | null {
  if (isPromotionEnded(product, activeStatusSortFk)) return "promotion-ended";
  if (isProductUnavailable(product)) return "sold-out";
  return null;
}

export function productBlockedLabel(
  blockedState: ProductBlockedState | null,
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
  const productStatusSort = Number(
    product.status_sort_fk ?? activeStatusSortFk,
  );
  return (
    product.has_options === true ||
    Number(product.count_option_enabled ?? 1) > 1 ||
    Number(product.count_option_all ?? 1) > 1 ||
    Number(product.count_topping_enabled ?? 0) > 0 ||
    productStatusSort === publicMenuKindToStatusSortFk(PUBLIC_MENU_KIND.SET) ||
    productStatusSort ===
      publicMenuKindToStatusSortFk(PUBLIC_MENU_KIND.PROMOTION) ||
    hasPromo(product)
  );
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
  toppings: ProdTopping[];
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
        toppings: toppings.map((topping) => ({
          prod_topping_uuid_fk: topping.prod_topping_uuid,
          topping_qty: 1,
        })),
      },
    ],
  };
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

export function getConfirmableOrderPayload(
  cart: CartOrder[],
  statusRule: FetchCartStatusRule | null,
) {
  const order = cart.find((cartOrder) =>
    (cartOrder.items ?? []).some((item) =>
      isConfirmableCartItem(item, statusRule),
    ),
  );
  if (!order?.order_uuid) return null;

  const orderItemUuids = (order.items ?? [])
    .filter((item) => isConfirmableCartItem(item, statusRule))
    .map(getOrderItemUuid)
    .filter(Boolean);

  return orderItemUuids.length
    ? { orderUuid: order.order_uuid, orderItemUuids }
    : null;
}

export function findExistingCartItem(
  cart: CartOrder[],
  product: ProdItem,
  payload: PublicAddToCartPayload,
  statusRule: FetchCartStatusRule | null,
) {
  const detailUuid = payload.detail.pro_detail_uuid;
  const toppingIds = payload.toppings
    .map((topping) => topping.prod_topping_uuid)
    .sort();
  const toppingNames = payload.toppings
    .map((topping) => topping.topping_name ?? "")
    .filter(Boolean)
    .sort();

  for (const order of cart) {
    for (const item of order.items ?? []) {
      if (!isEditableCartItem(item, statusRule)) continue;
      if ((item.detail?.order_it_note || "") !== (payload.note || "")) continue;

      const itemDetailUuid = String(
        item.pro_detail_uuid_fk ??
          item.pro_detail_uuid ??
          item.detail?.pro_detail_uuid ??
          "",
      );
      const itemProductUuid = String(item.prod_uuid_fk ?? item.prod_uuid ?? "");
      const matchesProduct =
        itemDetailUuid === detailUuid ||
        itemProductUuid === product.prod_uuid ||
        cartItemTitle(item).includes(product.prod_name);

      if (!matchesProduct) continue;

      const existingIds = (item.toppings ?? [])
        .map((topping) =>
          String(
            topping.prod_topping_uuid_fk ?? topping.prod_topping_uuid ?? "",
          ),
        )
        .filter(Boolean)
        .sort();
      const existingNames = (item.toppings ?? [])
        .map((topping) => topping.topping_name ?? "")
        .filter(Boolean)
        .sort();
      const idsMatch =
        existingIds.length === toppingIds.length &&
        existingIds.every((id, index) => id === toppingIds[index]);
      const namesMatch =
        existingNames.length === toppingNames.length &&
        existingNames.every((name, index) => name === toppingNames[index]);

      if (
        idsMatch ||
        namesMatch ||
        (!existingIds.length &&
          !existingNames.length &&
          !toppingIds.length &&
          !toppingNames.length)
      ) {
        return item;
      }
    }
  }

  return null;
}

export function totalCartQty(cart: CartOrder[]) {
  return cart.reduce(
    (sum, order) =>
      sum +
      (order.items ?? []).reduce(
        (itemSum, item) => itemSum + getCartItemQty(item),
        0,
      ),
    0,
  );
}

export function getCartItemStatusCode(item: CartItem) {
  const status = Number(
    item.detail?.order_it_status ?? item.order_it_status ?? 0,
  );
  return Number.isFinite(status) ? status : 0;
}

export function getCartItemApiStatusText(item: CartItem) {
  return String(item.detail?.order_it_status_text ?? "").trim();
}

export function cartGroupTitle(items: CartItem[], fallback: string) {
  const apiLabels = items.map(getCartItemApiStatusText).filter(Boolean);
  if (!apiLabels.length) return fallback;

  const [firstLabel] = apiLabels;
  return apiLabels.every((label) => label === firstLabel)
    ? firstLabel
    : fallback;
}

export function normalizedStatusText(item: CartItem) {
  return getCartItemApiStatusText(item).toLowerCase();
}

export function statusTextIncludes(text: string, values: string[]) {
  return values.some((value) => text.includes(value));
}

export function isCanceledCartItem(item: CartItem) {
  const text = normalizedStatusText(item);
  return (
    getCartItemStatusCode(item) === 9 ||
    statusTextIncludes(text, [
      "cancel",
      "canceled",
      "cancelled",
      "ຍົກເລີກ",
    ])
  );
}

export function isServedCartItem(item: CartItem) {
  const text = normalizedStatusText(item);
  return (
    getCartItemStatusCode(item) === 4 ||
    statusTextIncludes(text, ["served", "ເສີບ"])
  );
}

export function isConfirmableCartItem(
  item: CartItem,
  statusRule: FetchCartStatusRule | null,
) {
  const ruleStatus = Number(statusRule?.not_confirmed_status);
  const status = getCartItemStatusCode(item);

  if (
    Number.isFinite(ruleStatus) &&
    ruleStatus !== 0 &&
    status === ruleStatus
  ) {
    return false;
  }

  return isCustomerDraftCartItem(item);
}

export function isEditableCartItem(
  item: CartItem,
  statusRule: FetchCartStatusRule | null,
) {
  return (
    isConfirmableCartItem(item, statusRule) && Boolean(getOrderItemUuid(item))
  );
}

export function isCustomerDraftCartItem(item: CartItem) {
  return (
    getCartItemStatusCode(item) === 0 &&
    !isCanceledCartItem(item) &&
    !isServedCartItem(item)
  );
}

export function isWaitingStaffConfirmCartItem(item: CartItem) {
  return (
    getCartItemStatusCode(item) === 1 &&
    !isCanceledCartItem(item) &&
    !isServedCartItem(item)
  );
}

export function isOpenCartItemForStock(item: CartItem) {
  return isCustomerDraftCartItem(item) || isWaitingStaffConfirmCartItem(item);
}

export function getCartItemStatus(item: CartItem, t: TFunction) {
  const status = getCartItemStatusCode(item);
  const apiLabel = getCartItemApiStatusText(item);

  if (status === 9 || isCanceledCartItem(item)) {
    return {
      label: apiLabel || t("pos.cartStatusCanceled"),
      className:
        "border-red-200 bg-red-50 text-red-700 dark:border-red-500/35 dark:bg-red-950/35 dark:text-red-200",
      Icon: Ban,
    };
  }

  if (status === 0) {
    return {
      label: apiLabel || t("pos.cartStatusWaiting"),
      className:
        "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/35 dark:bg-amber-950/35 dark:text-amber-200",
      Icon: Clock3,
    };
  }

  if (status === 1) {
    return {
      label: apiLabel || t("pos.cartStatusWaitingConfirm"),
      className:
        "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/35 dark:bg-sky-950/35 dark:text-sky-200",
      Icon: Clock3,
    };
  }

  if (status === 2) {
    return {
      label: apiLabel || t("pos.cartStatusSentKitchen"),
      className:
        "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/35 dark:bg-emerald-950/35 dark:text-emerald-200",
      Icon: ChefHat,
    };
  }

  if (status === 4) {
    return {
      label: apiLabel || t("pos.cartStatusServed"),
      className:
        "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/35 dark:bg-emerald-950/35 dark:text-emerald-200",
      Icon: CheckCircle2,
    };
  }

  return {
    label: apiLabel || t("pos.cartStatusCooking"),
    className:
      "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/35 dark:bg-sky-950/35 dark:text-sky-200",
    Icon: Send,
  };
}

export function getOrderItemUuid(item: CartItem) {
  return String(
    item.order_it_uuid ?? item.order_item_uuid ?? item.id ?? "",
  ).trim();
}

export function getCartItemQty(item: CartItem) {
  const qty = Number(
    item.detail?.order_it_qty ?? item.qty ?? item.quantity ?? 0,
  );
  return Number.isFinite(qty) ? qty : 0;
}

export function getCartItemTotal(item: CartItem) {
  return numeric(item.detail?.net_total ?? item.total ?? item.price);
}

export function getOrderGrandTotal(order: CartOrder) {
  return numeric(
    order.sum_grand_total ??
      order.totals?.order_grand_total ??
      order.totals?.total ??
      order.totals?.subtotal ??
      order.sum_detail_total,
  );
}

export function getCartReceiptTotals(cart: CartOrder[]) {
  return cart.reduce(
    (totals, order) => {
      const itemDiscount = numeric(
        order.totals?.order_item_discount_amount ??
          (order.items ?? []).reduce(
            (sum, item) => sum + numeric(item.detail?.order_it_discount_amount),
            0,
          ),
      );
      const orderDiscount =
        order.totals?.order_discount_amount !== undefined
          ? numeric(order.totals.order_discount_amount)
          : numeric(order.sum_discount_total) - itemDiscount;

      totals.subtotal += numeric(
        order.totals?.order_subtotal ??
          order.totals?.order_total ??
          (order.items ?? []).reduce(
            (sum, item) =>
              sum +
              numeric(
                item.detail?.gross_total ??
                  item.detail?.net_total ??
                  item.total,
              ),
            0,
          ),
      );
      totals.itemDiscount += Math.max(0, itemDiscount);
      totals.orderDiscount += Math.max(0, orderDiscount);
      totals.service += numeric(
        order.totals?.order_service_amount ??
          order.service_charge_amount ??
          order.sum_service_total,
      );
      totals.vat += numeric(
        order.totals?.order_vat_amount ??
          order.vat_amount ??
          order.sum_vat_total,
      );
      return totals;
    },
    { subtotal: 0, itemDiscount: 0, orderDiscount: 0, service: 0, vat: 0 },
  );
}

export function cartItemTitle(item: CartItem) {
  return item.title || item.prod_name || "";
}
