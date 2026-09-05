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
}

export interface OfflineMasterIndex {
  details: Map<string, OfflineProductDetail>;
  toppingPrices: Map<string, number>;
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
  return { details: new Map(), toppingPrices: new Map() };
}

function addDetail(index: OfflineMasterIndex, detail: OfflineProductDetail) {
  if (!detail.prodDetailUuid) return;
  const existing = index.details.get(detail.prodDetailUuid);
  // get_prod_item carries the authoritative per-detail price, so it wins over the
  // default detail summarised in the category listing.
  if (existing && existing.price > 0 && detail.price <= 0) return;
  index.details.set(detail.prodDetailUuid, detail);
}

/** Index a cached `POST /api/v1/posAll/fetch_cate_products` response. */
export function indexCategoryProducts(response: unknown, index: OfflineMasterIndex) {
  for (const rawCategory of list(record(response).data)) {
    for (const rawProduct of list(record(rawCategory).products)) {
      const product = record(rawProduct);
      addDetail(index, {
        prodDetailUuid: text(product.pro_detail_uuid),
        prodUuid: text(product.prod_uuid),
        price: count(product.pro_detail_sprice),
        productName: text(product.prod_name),
        productImage: text(product.prod_image),
        productHasImage: count(product.prod_status_imge),
      });
    }
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
        price: count(detail.pro_detail_sprice, count(detail.price)),
        productName,
        productImage,
        productHasImage,
      });
    }
  }

  for (const key of ["toppings", "product_toppings"]) {
    for (const rawTopping of list(product[key])) {
      const topping = record(rawTopping);
      const uuid = text(topping.prod_topping_uuid) || text(topping.prod_topping_uuid_fk);
      if (!uuid) continue;
      index.toppingPrices.set(
        uuid,
        count(topping.topping_price, count(topping.prod_topping_price)),
      );
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
  if (!prodUuid) return null;
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
