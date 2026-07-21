import type { Route } from "next";
import { getProductImageUrl } from "@/lib/image";
import {
  OrderChannelEnum,
  OrderSourceEnum,
  ProductImageStatus,
  ProductSortStatus as ProductSortStatusValue,
  TableStatus,
  type ProductSortStatus as ProductSortStatusType,
} from "@/config/pos-constants";
import {
  type CateProductItem,
  type CateWithProducts,
  type CreateOrderInput,
  type CreateOrderItem,
  type CreateOrderTopping,
  type PosTable,
  type ProdDetail,
  type ProdItem,
  type ProdTopping,
} from "@/services/pos";
import { optionalNumber, optionalString } from "../table-selection/utils";

export const ProductSortStatus = ProductSortStatusValue;
export type ProductSortStatus = ProductSortStatusType;

export const MAX_ORDER_QTY = 99;
export const PRODUCT_GRID_CLASS =
  "grid grid-cols-2 gap-2.5 md:grid-cols-[repeat(auto-fill,minmax(190px,1fr))]";

export const SORT_TABS: Array<{
  labelKey: string;
  status: ProductSortStatus;
}> = [
  { labelKey: "pos.menuNormal", status: ProductSortStatus.NORMAL },
  { labelKey: "pos.menuSet", status: ProductSortStatus.SET },
  { labelKey: "pos.menuPromotion", status: ProductSortStatus.PROMOTION },
];

export type MenuBySort = Record<ProductSortStatus, CateWithProducts[]>;
export type ProductCardEntry = {
  cateUuid: string;
  product: CateProductItem;
};
export type ProductMedia =
  | { type: "image"; src: string }
  | { type: "color"; color: string }
  | { type: "empty" };
export type ProductActionState = "blocked" | "choose" | "add" | "view";
export type ProductModalMode = "normal" | "set" | "promotion";
export type OrderSelectionIssue =
  | "detail-unavailable"
  | "price-invalid"
  | "quantity-invalid"
  | "stock-insufficient"
  | "topping-invalid";
export type ProductCardPrice =
  | { kind: "exact" | "starting"; value: number }
  | { kind: "unavailable" | "variable"; value: null };
export type Translate = (key: string) => string;

export function emptyMenuBySort(): MenuBySort {
  return {
    [ProductSortStatus.NORMAL]: [],
    [ProductSortStatus.SET]: [],
    [ProductSortStatus.PROMOTION]: [],
  };
}

export function flattenProducts(
  categories: CateWithProducts[],
): ProductCardEntry[] {
  return categories.flatMap((category) =>
    (category.products ?? []).map((product) => ({
      cateUuid: category.cate_uuid,
      product,
    })),
  );
}

export function countProducts(categories: CateWithProducts[]) {
  return categories.reduce(
    (sum, category) => sum + (category.products?.length ?? 0),
    0,
  );
}

export function firstStatusWithProducts(menuBySort: MenuBySort) {
  return (
    SORT_TABS.find((tab) => countProducts(menuBySort[tab.status]) > 0)
      ?.status ?? ProductSortStatus.NORMAL
  );
}

export function selectedOrderTable({
  tableName,
  tableUuid,
  zones,
}: {
  tableName: string;
  tableUuid: string;
  zones: Array<{ tables?: PosTable[] | null }>;
}): PosTable {
  const found = zones
    .flatMap((zone) => zone.tables ?? [])
    .find((table) => table.table_uuid === tableUuid);

  return (
    found ?? {
      table_uuid: tableUuid,
      table_name: tableName || "-",
      table_status: TableStatus.OCCUPIED,
      number_of_seats: 0,
    }
  );
}

export function orderCustomerUrl({
  tableName,
  tableUuid,
}: {
  tableName: string;
  tableUuid: string;
}): Route {
  const params = new URLSearchParams({
    table_uuid: tableUuid,
    table_name: tableName,
  });
  // path เป็น route จริง ส่วน query เป็นค่า runtime — typedRoutes ตรวจ template แบบนี้ไม่ได้
  return `/sale/order-customer?${params.toString()}` as Route;
}

export function nextMenuCategoryUuid({
  categories,
  defaultCateUuid,
  requestedCateUuid,
  selectedCateUuid,
}: {
  categories: CateWithProducts[];
  defaultCateUuid?: string | null;
  requestedCateUuid?: string | null;
  selectedCateUuid?: string | null;
}) {
  return (
    optionalString(requestedCateUuid) ??
    optionalString(selectedCateUuid) ??
    optionalString(defaultCateUuid) ??
    optionalString(categories[0]?.cate_uuid) ??
    ""
  );
}

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

export function productPrice(product: CateProductItem | ProdItem) {
  return (
    optionalNumber(
      product.pro_detail_sprice,
      product.prod_set_price,
      product.prod_price,
    ) ?? 0
  );
}

export function productOptionCount(product: CateProductItem) {
  return Math.max(
    0,
    optionalNumber(
      product.count_option_enabled,
      product.count_option_all,
    ) ?? 0,
  );
}

export function productToppingCount(product: CateProductItem) {
  return Math.max(0, optionalNumber(product.count_topping_enabled) ?? 0);
}

export function productCardPrice(
  product: CateProductItem,
  activeSort: ProductSortStatus,
): ProductCardPrice {
  const productStatusSort =
    optionalNumber(product.status_sort_fk) ?? activeSort;
  const exactPrice =
    productStatusSort === ProductSortStatus.SET
      ? optionalNumber(
          product.prod_set_price,
          product.prod_price,
          product.pro_detail_sprice,
        ) ?? 0
      : productPrice(product);

  if (
    productStatusSort === ProductSortStatus.SET ||
    productOptionCount(product) <= 1
  ) {
    return exactPrice > 0
      ? { kind: "exact", value: exactPrice }
      : { kind: "unavailable", value: null };
  }

  // The menu endpoint must provide branch-aware aggregates. Fetching every
  // product detail here would turn menu loading into an N+1 request pattern.
  const minPrice = optionalNumber(product.min_price);
  const maxPrice = optionalNumber(product.max_price);
  if (minPrice === null || minPrice <= 0) {
    return { kind: "variable", value: null };
  }
  if (maxPrice !== null && maxPrice > 0 && maxPrice === minPrice) {
    return { kind: "exact", value: minPrice };
  }
  if (maxPrice !== null && maxPrice > 0 && maxPrice < minPrice) {
    return { kind: "variable", value: null };
  }
  return { kind: "starting", value: minPrice };
}

export function productPriceFromDetail(detail?: ProdDetail | null) {
  return optionalNumber(detail?.pro_detail_sprice, detail?.price) ?? 0;
}

export function normalizeProdItem(
  item: ProdItem | null | undefined,
  fallback: CateProductItem,
): ProdItem {
  const price = productPrice(fallback);
  const fallbackDetails: ProdDetail[] = fallback.pro_detail_uuid
    ? [
        {
          pro_detail_uuid: String(fallback.pro_detail_uuid),
          price,
          pro_detail_sprice: price,
          pro_detail_enabled: 1,
          cut_stock: 2,
        },
      ]
    : [];

  if (item?.prod_uuid) {
    return {
      ...item,
      prod_color:
        optionalString(item.prod_color, fallback.prod_color) ?? undefined,
      prod_image: optionalString(item.prod_image, fallback.prod_image) ?? "",
      prod_price: item.prod_price ?? price,
      prod_status_imge: productImageStatus(
        item.prod_status_imge,
        fallback.prod_status_imge,
      ),
      details: item.details?.length ? item.details : fallbackDetails,
      toppings: item.toppings ?? [],
    };
  }

  return {
    prod_uuid: fallback.prod_uuid,
    prod_name: fallback.prod_name,
    prod_color: optionalString(fallback.prod_color) ?? undefined,
    prod_image: optionalString(fallback.prod_image) ?? "",
    prod_price: price,
    prod_status_imge: productImageStatus(fallback.prod_status_imge),
    details: fallbackDetails,
    toppings: [],
  };
}

export function isDetailEnabled(detail?: ProdDetail | null) {
  if (!detail) return false;
  if (optionalNumber(detail.pro_detail_enabled) === 2) return false;
  if (optionalNumber(detail.pro_detail_status) === 2) return false;

  return Boolean(optionalString(detail.pro_detail_uuid));
}

export function isDetailAvailable(detail?: ProdDetail | null) {
  if (!detail || !isDetailEnabled(detail)) return false;

  const cutStock = optionalNumber(detail.cut_stock);
  const stock = optionalNumber(detail.qty_stock, detail.pro_detail_qty_stock);
  if (cutStock !== 2 && stock !== null && stock <= 0) return false;

  return true;
}

function detailSortValue(detail: ProdDetail) {
  const sort = optionalNumber(detail.pro_detail_sort);
  return sort !== null && sort > 0 ? sort : null;
}

function sortProductDetails(details: ProdDetail[]) {
  return details.sort((left, right) => {
    const leftSort = detailSortValue(left);
    const rightSort = detailSortValue(right);
    if (leftSort === null && rightSort === null) return 0;
    if (leftSort === null) return 1;
    if (rightSort === null) return -1;
    return leftSort - rightSort;
  });
}

export function enabledProductDetails(product?: ProdItem | null) {
  return sortProductDetails((product?.details ?? []).filter(isDetailEnabled));
}

export function availableProductDetails(product?: ProdItem | null) {
  return sortProductDetails((product?.details ?? []).filter(isDetailAvailable));
}

export function firstAvailableDetail(
  product?: ProdItem | null,
  mode: ProductModalMode = "normal",
) {
  const details =
    mode === "set"
      ? enabledProductDetails(product)
      : availableProductDetails(product);
  return details[0] ?? null;
}

export function defaultOrderQty(detail?: ProdDetail | null) {
  const qty =
    optionalNumber(detail?.pro_detail_cus_qtyBuy, detail?.default_qty) ?? 1;
  return clampQty(qty);
}

export function clampQty(value: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.min(MAX_ORDER_QTY, Math.max(1, Math.floor(value)));
}

export interface OrderQuantityRules {
  canOrder: boolean;
  min: number;
  max: number;
  step: number;
}

function promotionOrderStep(detail?: ProdDetail | null) {
  const buy = optionalNumber(detail?.pro_detail_cus_qtyBuy) ?? 0;
  const free = optionalNumber(detail?.pro_detail_cus_qtyFree) ?? 0;
  return buy > 0 && free > 0 ? clampQty(buy) : 1;
}

function detailOrderStockLimit(
  detail: ProdDetail | null | undefined,
  unitsPerOrder = 1,
) {
  if (!detail || optionalNumber(detail.cut_stock) === 2) return MAX_ORDER_QTY;

  const stock = optionalNumber(detail.qty_stock, detail.pro_detail_qty_stock);
  if (stock === null) return MAX_ORDER_QTY;
  return Math.max(0, Math.floor(stock / Math.max(1, unitsPerOrder)));
}

function setOrderStockLimit(product?: ProdItem | null) {
  const details = enabledProductDetails(product);
  if (!details.length) return 0;
  return Math.min(
    ...details.map((detail) =>
      detailOrderStockLimit(detail, defaultOrderQty(detail)),
    ),
  );
}

export function orderQuantityRules(
  detail: ProdDetail | null | undefined,
  mode: ProductModalMode,
  product?: ProdItem | null,
): OrderQuantityRules {
  const step = mode === "promotion" ? promotionOrderStep(detail) : 1;
  const stockLimit =
    mode === "set"
      ? setOrderStockLimit(product)
      : detailOrderStockLimit(detail);
  const alignedMax =
    Math.floor(Math.min(MAX_ORDER_QTY, stockLimit) / step) * step;
  const canOrder = alignedMax >= step;
  return {
    canOrder,
    min: step,
    max: canOrder ? alignedMax : step,
    step,
  };
}

export function clampOrderQuantity(
  value: number,
  rules: OrderQuantityRules,
) {
  const normalized = Number.isFinite(value) ? Math.floor(value) : rules.min;
  const stepped =
    normalized <= rules.min
      ? rules.min
      : rules.min +
        Math.ceil((normalized - rules.min) / rules.step) * rules.step;
  return Math.min(rules.max, stepped);
}

export function isToppingAvailable(topping?: ProdTopping | null) {
  if (!topping) return false;
  if (optionalNumber(topping.topping_enabled) === 2) return false;
  if (optionalNumber(topping.topping_status) === 2) return false;
  return Boolean(toppingUuid(topping));
}

export function toppingUuid(topping: ProdTopping) {
  return (
    optionalString(
      topping.prod_topping_uuid,
      topping.topping_uuid_fk,
      topping.topping_uuid,
    ) ?? ""
  );
}

export function toppingPrice(topping: ProdTopping) {
  return optionalNumber(topping.topping_price) ?? 0;
}

export function toppingDisplayName(topping: ProdTopping) {
  return (
    optionalString(
      topping.topping_name_la,
      topping.topping_name,
      topping.topping_name_eng,
    ) ?? "-"
  );
}

export function getModalBasePrice(
  product: ProdItem | null,
  detail: ProdDetail | null | undefined,
  mode: ProductModalMode,
) {
  return mode === "set"
    ? (optionalNumber(product?.prod_set_price) ?? 0)
    : productPriceFromDetail(detail);
}

export function getModalUnitPrice(
  product: ProdItem | null,
  detail: ProdDetail | null | undefined,
  toppings: SelectedTopping[],
  mode: ProductModalMode,
) {
  const basePrice = getModalBasePrice(product, detail, mode);
  return (
    basePrice +
    toppings.reduce(
      (sum, selected) => sum + toppingPrice(selected.topping) * selected.qty,
      0,
    )
  );
}

export function getOrderSelectionIssue({
  detail,
  mode,
  product,
  quantity,
  toppings,
}: {
  detail: ProdDetail | null | undefined;
  mode: ProductModalMode;
  product?: ProdItem | null;
  quantity: number;
  toppings: SelectedTopping[];
}): OrderSelectionIssue | null {
  if (!detail || !isDetailEnabled(detail)) return "detail-unavailable";
  if (mode !== "set" && !isDetailAvailable(detail)) {
    return "detail-unavailable";
  }

  const basePrice = getModalBasePrice(product ?? null, detail, mode);
  if (!Number.isFinite(basePrice) || basePrice <= 0) return "price-invalid";

  const rules = orderQuantityRules(detail, mode, product);
  if (!rules.canOrder) return "stock-insufficient";
  if (
    !Number.isInteger(quantity) ||
    quantity < rules.min ||
    quantity > rules.max ||
    (quantity - rules.min) % rules.step !== 0
  ) {
    return "quantity-invalid";
  }

  const hasInvalidTopping = toppings.some(
    (selected) =>
      !isToppingAvailable(selected.topping) ||
      !Number.isInteger(selected.qty) ||
      selected.qty < 1 ||
      selected.qty > MAX_ORDER_QTY ||
      toppingPrice(selected.topping) < 0,
  );
  return hasInvalidTopping ? "topping-invalid" : null;
}

export function orderSelectionIssueLabel(
  issue: OrderSelectionIssue,
  t: Translate,
) {
  if (issue === "detail-unavailable") return t("pos.noAvailableOptions");
  if (issue === "price-invalid") return t("pos.invalidProductPrice");
  if (issue === "stock-insufficient") return t("pos.insufficientStock");
  if (issue === "topping-invalid") return t("pos.invalidTopping");
  return t("pos.invalidQuantity");
}

export function productMedia(
  product: CateProductItem | ProdItem,
): ProductMedia {
  const image = optionalString(product.prod_image);
  const color = optionalString(product.prod_color, product.prod_image);
  const imageStatus = optionalNumber(product.prod_status_imge);

  if (imageStatus === ProductImageStatus.IMAGE && image && !isHexColor(image)) {
    return { type: "image", src: productImageSrc(image) };
  }

  if (imageStatus === ProductImageStatus.COLOR && color && isHexColor(color)) {
    return { type: "color", color };
  }

  return { type: "empty" };
}

export function productImageStatus(...values: unknown[]): ProductImageStatus {
  const status = optionalNumber(...values);
  return status === ProductImageStatus.COLOR
    ? ProductImageStatus.COLOR
    : ProductImageStatus.IMAGE;
}

export function hasPromo(product: CateProductItem) {
  const promoState = String(product.promo_state ?? "")
    .trim()
    .toUpperCase();
  return Boolean(
    promoState && promoState !== "NONE" && product.promo_expired !== true,
  );
}

export function getProductBlockedState(
  product: CateProductItem,
  activeSort: ProductSortStatus,
) {
  if (isPromotionEnded(product, activeSort)) return "promotion-ended";
  if (isProductUnavailable(product)) return "sold-out";
  return null;
}

export function productBlockedLabel(
  blockedState: ReturnType<typeof getProductBlockedState>,
  product: CateProductItem,
  t: Translate,
) {
  if (blockedState === "promotion-ended") return t("pos.promotionEnded");
  if (blockedState === "sold-out")
    return optionalString(product.sold_out_msg) ?? t("pos.outOfStock");
  return "";
}

export function productNeedsModal(
  product: CateProductItem,
  item: ProdItem,
  activeSort: ProductSortStatus,
) {
  const enabledDetails = (item.details ?? []).filter(isDetailAvailable);
  const enabledToppings = (item.toppings ?? []).filter(isToppingAvailable);
  return (
    !canDirectAddFromList(product, activeSort) ||
    isKnownModalProduct(product, activeSort) ||
    enabledDetails.length > 1 ||
    enabledToppings.length > 0
  );
}

export function canDirectAddFromList(
  product: CateProductItem,
  activeSort: ProductSortStatus,
) {
  const detailUuid = optionalString(product.pro_detail_uuid);
  const price = optionalNumber(product.pro_detail_sprice, product.prod_price);
  const productStatusSort =
    optionalNumber(product.status_sort_fk) ?? activeSort;
  const enabledOptionCount = optionalNumber(product.count_option_enabled) ?? 1;
  const allOptionCount = optionalNumber(product.count_option_all) ?? 1;

  return (
    Boolean(detailUuid) &&
    price !== null &&
    price > 0 &&
    product.has_options !== true &&
    enabledOptionCount <= 1 &&
    allOptionCount <= 1 &&
    (optionalNumber(product.count_topping_enabled) ?? 0) <= 0 &&
    productStatusSort !== ProductSortStatus.SET &&
    productStatusSort !== ProductSortStatus.PROMOTION &&
    !hasPromo(product) &&
    !getProductBlockedState(product, activeSort)
  );
}

export function getProductActionState(
  product: CateProductItem,
  activeSort: ProductSortStatus,
): ProductActionState {
  if (getProductBlockedState(product, activeSort)) return "blocked";
  if (isKnownModalProduct(product, activeSort)) return "choose";
  if (canDirectAddFromList(product, activeSort)) return "add";
  return "view";
}

export function productActionLabel(
  actionState: ProductActionState,
  product: CateProductItem,
  activeSort: ProductSortStatus,
  t: Translate,
) {
  if (actionState === "blocked")
    return productBlockedLabel(
      getProductBlockedState(product, activeSort),
      product,
      t,
    );
  if (actionState === "choose") return t("pos.chooseOptions");
  if (actionState === "view") return t("pos.viewDetails");
  return t("pos.addItem");
}

export function getProductModalMode(
  activeSort: ProductSortStatus,
  product?: ProdItem | null,
): ProductModalMode {
  if (activeSort === ProductSortStatus.PROMOTION) return "promotion";
  if (activeSort === ProductSortStatus.SET) return "set";

  const productStatus = optionalNumber(product?.status_sort_fk);
  if (productStatus === ProductSortStatus.PROMOTION) return "promotion";
  if (productStatus === ProductSortStatus.SET) return "set";

  const typeGroup = String(product?.type_group ?? "").toLowerCase();
  if (typeGroup.includes("promo")) return "promotion";
  if (
    typeGroup.includes("set") ||
    (optionalNumber(product?.prod_set_price) ?? 0) > 0
  )
    return "set";
  return "normal";
}

export function productModeLabel(
  mode: ProductModalMode,
  product: ProdItem,
  t: Translate,
) {
  if (product.type_group) return product.type_group;
  if (mode === "promotion") return t("pos.menuPromotion");
  if (mode === "set") return t("pos.menuSet");
  return t("pos.menuNormal");
}

export function getPromoLabel(
  detail: ProdDetail | null | undefined,
  t: Translate,
) {
  const buy = optionalNumber(detail?.pro_detail_cus_qtyBuy) ?? 0;
  const free = optionalNumber(detail?.pro_detail_cus_qtyFree) ?? 0;

  if (buy > 0 && free > 0)
    return `${t("pos.buyShort")} ${buy} ${t("pos.freeShort")} ${free}`;
  if (free > 0) return `${t("pos.freeShort")} ${free}`;
  return t("pos.promotion");
}

function buildStaffOrderToppings(toppings: SelectedTopping[]) {
  return toppings
    .map((selected) => {
      const uuid = toppingUuid(selected.topping);
      if (!uuid) return null;
      return {
        prod_topping_uuid_fk: uuid,
        topping_qty: selected.qty,
      } satisfies CreateOrderTopping;
    })
    .filter((topping): topping is CreateOrderTopping => Boolean(topping));
}

export function buildStaffOrderItems({
  detail,
  mode = "normal",
  noteText,
  product,
  quantity,
  toppings,
}: {
  detail: ProdDetail;
  mode?: ProductModalMode;
  noteText: string;
  product?: ProdItem | null;
  quantity: number;
  toppings: SelectedTopping[];
}) {
  const issue = getOrderSelectionIssue({
    detail,
    mode,
    product,
    quantity,
    toppings,
  });
  if (issue) throw new Error(`Invalid order selection: ${issue}`);

  const details = mode === "set" ? enabledProductDetails(product) : [detail];
  if (!details.length) throw new Error("pro_detail_uuid is required");

  const note = noteText.trim() || undefined;
  const orderToppings = buildStaffOrderToppings(toppings);

  return details.map((itemDetail, index) => {
    const detailId = optionalString(itemDetail.pro_detail_uuid);
    if (!detailId) throw new Error("pro_detail_uuid is required");

    const item: CreateOrderItem = {
      prod_detail_uuid_fk: detailId,
      order_it_qty:
        mode === "set" ? defaultOrderQty(itemDetail) * quantity : quantity,
      order_it_status: 1,
      order_it_note: note,
    };

    if (index === 0) item.toppings = orderToppings;
    return item;
  });
}

export function buildStaffOrderInput({
  branchUuid,
  detail,
  lang,
  mode = "normal",
  noteText,
  product,
  quantity,
  tableUuid,
  toppings,
  userUuid,
}: {
  branchUuid: string;
  detail: ProdDetail;
  lang: string;
  mode?: ProductModalMode;
  noteText: string;
  product?: ProdItem | null;
  quantity: number;
  tableUuid: string;
  toppings: SelectedTopping[];
  userUuid: string;
}): CreateOrderInput {
  if (!branchUuid) throw new Error("branch_uuid_fk is required");
  if (!userUuid) throw new Error("order_created_by is required");

  return {
    table_uuid_fk: tableUuid,
    branch_uuid_fk: branchUuid,
    lang,
    order_created_by: userUuid,
    order_source: OrderSourceEnum.POS,
    order_channel: OrderChannelEnum.DINE_IN,
    order_service_rate: 0,
    order_vat_rate: 0,
    items: buildStaffOrderItems({
      detail,
      mode,
      noteText,
      product,
      quantity,
      toppings,
    }),
  };
}

function isHexColor(value?: string | null) {
  return Boolean(
    value &&
      /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(
        value.trim(),
      ),
  );
}

function productImageSrc(value: string) {
  const src = value.trim();
  return isRemoteUrl(src) ? src : getProductImageUrl(src);
}

export function isRemoteUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function isPromotionEnded(
  product: CateProductItem,
  activeSort: ProductSortStatus,
) {
  if (product.promo_expired !== true) return false;

  const promoState = String(product.promo_state ?? "")
    .trim()
    .toUpperCase();
  const productStatusSort =
    optionalNumber(product.status_sort_fk) ?? activeSort;
  return (
    productStatusSort === ProductSortStatus.PROMOTION ||
    Boolean(promoState && promoState !== "NONE") ||
    Boolean(optionalString(product.promo_msg))
  );
}

function isProductUnavailable(product: CateProductItem) {
  return (
    product.can_add === false ||
    product.sold_out_manual === true ||
    product.stock_available === false ||
    product.stock_sold_out === true
  );
}

function isKnownModalProduct(
  product: CateProductItem,
  activeSort: ProductSortStatus,
) {
  const productStatusSort =
    optionalNumber(product.status_sort_fk) ?? activeSort;
  const enabledOptionCount = optionalNumber(product.count_option_enabled) ?? 1;
  const allOptionCount = optionalNumber(product.count_option_all) ?? 1;

  return (
    product.has_options === true ||
    enabledOptionCount > 1 ||
    allOptionCount > 1 ||
    (optionalNumber(product.count_topping_enabled) ?? 0) > 0 ||
    productStatusSort === ProductSortStatus.SET ||
    productStatusSort === ProductSortStatus.PROMOTION ||
    hasPromo(product)
  );
}
