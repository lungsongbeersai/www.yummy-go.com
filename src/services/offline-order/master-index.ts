// Prices and product names for the offline cart, indexed out of the responses
// already cached in Dexie. The Local Printer Agent reads these from its entity
// tables; the browser only ever cached raw API responses, so this rebuilds the
// same lookup from `fetch_cate_products` (one default detail per product) and
// `get_prod_item` (every detail and topping for products with options).

export interface OfflineProductDetail {
  prodDetailUuid: string;
  prodUuid: string;
  price: number;
  productName: string;
  productImage: string;
  productHasImage: number;
  sizeName?: string;
}

export interface OfflineMasterIndex {
  details: Map<string, OfflineProductDetail>;
  toppingPrices: Map<string, number>;
  toppingNames: Map<string, string>;
  simpleProducts: Set<string>;
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" && value ? value : fallback;
}

function count(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function emptyOfflineMasterIndex(): OfflineMasterIndex {
  return { details: new Map(), toppingPrices: new Map(), toppingNames: new Map(), simpleProducts: new Set() };
}

function price(value: unknown): number | null {
  if (value === null || value === undefined || value === "" || typeof value === "boolean") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function addDetail(index: OfflineMasterIndex, detail: Omit<OfflineProductDetail, "price"> & { price: number | null }) {
  if (!detail.prodDetailUuid || detail.price === null) return;
  // Unknown prices are excluded above; an explicit zero is a legitimate price.
  index.details.set(detail.prodDetailUuid, { ...detail, price: detail.price });
}

/** Index a cached `GET /api/v1/posAll/fetch_cate_products` response. */
export function indexCategoryProducts(response: unknown, index: OfflineMasterIndex) {
  const body = record(response);
  const products = [
    ...list(body.data).flatMap((category) => list(record(category).products)),
    ...list(body.special_products),
  ];
  for (const rawProduct of products) {
    const product = record(rawProduct);
    const prodUuid = text(product.prod_uuid);
    const needsOptions = product.has_options === true || count(product.count_option_all) > 1 ||
      count(product.count_option_enabled) > 1 || count(product.count_topping_enabled) > 0 ||
      [2, 3].includes(count(product.status_sort_fk));
    if (needsOptions) index.simpleProducts.delete(prodUuid);
    else if (text(product.pro_detail_uuid)) index.simpleProducts.add(prodUuid);
    addDetail(index, {
      prodDetailUuid: text(product.pro_detail_uuid),
      prodUuid: text(product.prod_uuid),
      price: price(product.pro_detail_sprice),
      productName: text(product.prod_name),
      productImage: text(product.prod_image),
      productHasImage: count(product.prod_status_imge),
    });
  }
  return index;
}

/** Index a cached `POST /api/v1/posAll/get_prod_item` response. */
export function indexProductItem(response: unknown, index: OfflineMasterIndex) {
  const body = record(response);
  const product = record(body.data ?? body);
  const prodUuid = text(product.prod_uuid);
  const productName = text(product.prod_name);
  const productImage = text(product.prod_image);
  const productHasImage = count(product.prod_status_imge);

  for (const key of ["details", "product_details", "prod_details", "sizes", "options"]) {
    for (const rawDetail of list(product[key])) {
      const detail = record(rawDetail);
      addDetail(index, {
        prodDetailUuid: text(detail.pro_detail_uuid) || text(detail.prod_detail_uuid),
        prodUuid: text(detail.prod_uuid_fk) || prodUuid,
        price: price(detail.pro_detail_sprice ?? detail.price),
        productName,
        productImage,
        productHasImage,
        sizeName: text(detail.size_name),
      });
    }
  }

  for (const key of ["toppings", "product_toppings"]) {
    for (const rawTopping of list(product[key])) {
      const topping = record(rawTopping);
      const uuid = text(topping.prod_topping_uuid) || text(topping.prod_topping_uuid_fk);
      if (!uuid) continue;
      const toppingPrice = price(topping.topping_price ?? topping.prod_topping_price);
      if (toppingPrice !== null) index.toppingPrices.set(uuid, toppingPrice);
      index.toppingNames.set(uuid, text(topping.topping_name) || text(topping.topping_name_la));
    }
  }
  return index;
}

/**
 * Index a cached `GET /api/v1/posAll/fetch_cart` response. A real, already-
 * confirmed order line carries its own name/image/price straight from the
 * Backend — the same fields `cart-projection.ts`'s own synthesized lines
 * carry, so a real response and our synthesized one index identically. This
 * is what lets an order line the cashier already sent to the kitchen still
 * show its name/photo/price offline even once the product has scrolled out
 * of `fetch_cate_products`' cache window (a long-running table's history can
 * span more categories, and more time, than the menu cache retains) —
 * without this, projectOfflineCartOrder's `master.details.get(...)` lookup
 * for that line comes back empty and the whole row renders blank.
 */
export function indexCartItems(response: unknown, index: OfflineMasterIndex) {
  const body = record(response);
  const orders = list(body.orders).length ? list(body.orders) : list(body.data);
  for (const rawOrder of orders) {
    for (const rawItem of list(record(rawOrder).items)) {
      const item = record(rawItem);
      const prodDetailUuid = text(item.pro_detail_uuid) || text(item.prod_detail_uuid);
      if (!prodDetailUuid || index.details.has(prodDetailUuid)) continue;
      const detail = record(item.detail);
      addDetail(index, {
        prodDetailUuid,
        prodUuid: text(item.prod_uuid),
        price: price(detail.unit_price ?? item.price),
        productName: text(item.prod_name) || text(item.title),
        productImage: text(item.prod_image),
        productHasImage: count(item.prod_status_imge),
      });
    }
  }
  return index;
}

export function buildOfflineMasterIndex(
  cached: Array<{ path: string; response: unknown }>,
): OfflineMasterIndex {
  const index = emptyOfflineMasterIndex();
  for (const entry of cached) {
    if (entry.path === "/api/v1/posAll/fetch_cate_products") indexCategoryProducts(entry.response, index);
    else if (entry.path === "/api/v1/posAll/get_prod_item") indexProductItem(entry.response, index);
    else if (entry.path === "/api/v1/posAll/fetch_cart") indexCartItems(entry.response, index);
  }
  return index;
}

/**
 * The one detail a category listing carries for a product (its default
 * size, no toppings) — enough to find it by `prod_uuid` even when this
 * device has never cached a `get_prod_item` response for it specifically.
 */
export function findDetailByProdUuid(
  index: OfflineMasterIndex,
  prodUuid: string,
): OfflineProductDetail | null {
  // A cart line or one cached size cannot stand in for the full option modal.
  if (!prodUuid || !index.simpleProducts.has(prodUuid)) return null;
  for (const detail of index.details.values()) {
    if (detail.prodUuid === prodUuid) return detail;
  }
  return null;
}

/**
 * A `get_prod_item`-shaped response built from category-listing data alone,
 * for a device that opened the menu (caching `fetch_cate_products` for every
 * product in view) but never individually tapped this one product while
 * online. Without this, offline order-taking would require a cashier to have
 * pre-viewed every one of a menu's 200-300 items before an outage — instead
 * this covers any product simple enough to need no options/toppings modal,
 * which `canDirectAddFromList` (product-classification.ts) already decides
 * from the same category data, independent of what this returns.
 *
 * The single synthesized detail is always treated as available (`cut_stock:
 * 2` mirrors normalizeProdItem's own online fallback, product-availability.ts)
 * — offline stock guarding is out of v1 scope (docs/Decisions.md).
 */
export function projectOfflineProdItem(detail: OfflineProductDetail) {
  return {
    status: "success",
    message: "ok",
    offline: true,
    data: {
      prod_uuid: detail.prodUuid,
      prod_name: detail.productName,
      prod_status_imge: detail.productHasImage,
      prod_image: detail.productImage,
      prod_price: detail.price,
      pro_detail_sprice: detail.price,
      details: [
        {
          pro_detail_uuid: detail.prodDetailUuid,
          price: detail.price,
          pro_detail_sprice: detail.price,
          pro_detail_enabled: 1,
          cut_stock: 2,
        },
      ],
      toppings: [],
    },
  };
}
