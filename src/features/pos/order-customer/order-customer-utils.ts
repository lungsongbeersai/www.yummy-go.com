import { getProductImageUrl } from "@/services/product";
import {
  OrderChannelEnum,
  OrderSourceEnum,
  ProductImageStatus,
  ProductSortStatus,
  TableStatus,
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

export const MAX_ORDER_QTY = 99;
export const PRODUCT_GRID_CLASS =
  "grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-[repeat(auto-fill,minmax(190px,1fr))] 2xl:grid-cols-[repeat(auto-fill,minmax(210px,1fr))]";

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
}) {
  const params = new URLSearchParams({
    table_uuid: tableUuid,
    table_name: tableName,
  });
  return `/sale/order-customer?${params.toString()}`;
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

export function selectedToppingsFromUuids(
  product: ProdItem | null | undefined,
  toppingUuids: string[],
) {
  const selected = new Set(toppingUuids);
  return (product?.toppings ?? []).filter((topping) =>
    selected.has(toppingUuid(topping)),
  );
}

export function toggleToppingUuid(current: string[], uuid: string) {
  return current.includes(uuid)
    ? current.filter((item) => item !== uuid)
    : [...current, uuid];
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

export function isDetailAvailable(detail?: ProdDetail | null) {
  if (!detail) return false;
  if (optionalNumber(detail.pro_detail_enabled) === 2) return false;
  if (optionalNumber(detail.pro_detail_status) === 2) return false;

  const cutStock = optionalNumber(detail.cut_stock);
  const stock = optionalNumber(detail.qty_stock, detail.pro_detail_qty_stock);
  if (cutStock !== 2 && stock !== null && stock <= 0) return false;

  return Boolean(optionalString(detail.pro_detail_uuid));
}

export function firstAvailableDetail(product?: ProdItem | null) {
  return (
    (product?.details ?? []).find(isDetailAvailable) ??
    product?.details?.[0] ??
    null
  );
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

export function getModalUnitPrice(
  product: ProdItem | null,
  detail: ProdDetail | null | undefined,
  toppings: ProdTopping[],
  mode: ProductModalMode,
) {
  const basePrice =
    mode === "set"
      ? (optionalNumber(
          product?.prod_set_price,
          product?.prod_price,
          productPriceFromDetail(detail),
        ) ?? 0)
      : productPriceFromDetail(detail);
  return (
    basePrice +
    toppings.reduce((sum, topping) => sum + toppingPrice(topping), 0)
  );
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

  const typeGroup = String(product?.type_group ?? "").toLowerCase();
  if (typeGroup.includes("promo")) return "promotion";
  if (typeGroup.includes("set") || product?.prod_set_price !== undefined)
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

function buildStaffOrderToppings(toppings: ProdTopping[]) {
  return toppings
    .map((topping) => {
      const uuid = toppingUuid(topping);
      if (!uuid) return null;
      return {
        prod_topping_uuid_fk: uuid,
        topping_qty: 1,
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
  toppings: ProdTopping[];
}) {
  const details =
    mode === "set"
      ? (product?.details ?? []).filter(isDetailAvailable)
      : [detail];
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
  toppings: ProdTopping[];
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
