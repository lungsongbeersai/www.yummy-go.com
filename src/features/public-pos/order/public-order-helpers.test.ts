import { describe, expect, it } from "vitest";
import { ProductImageStatus, type ProductSortStatus } from "@/config/pos-constants";
import {
  type CartItem,
  type CartOrder,
  type CateProductItem,
  type ProdDetail,
  type ProdItem,
} from "@/services/pos";
import {
  PUBLIC_MENU_KIND,
  publicMenuKindToStatusSortFk,
} from "@/stores/public-pos-store/helpers";
import { cartGroupTitle, getCartItemStatus, getCartReceiptTotals, getConfirmableOrderPayload, isCanceledCartItem, isServedCartItem, totalCartQty } from "@/features/public-pos/order/cart-domain";
import { getCategoryPathUuids, getRenderedMenuSections, hasMoreMenuToRender, missingPublicMenuCategoryRefUuids, nextPublicMenuCategoryReset, statusSectionLabel, visibleProductCountForCategory, withCategoryPathVisibleCounts } from "@/features/public-pos/order/menu-render";
import { buildPublicOrderInput, canAddQty, changePublicToppingQty, getDirectAddListPayload, getProductActionState, getProductBlockedState, getProductModalMode, getPublicOrderPriceTotals, maxAvailableQty, promotionQuantity, publicProductCardPrice, togglePublicToppingQty } from "@/features/public-pos/order/product-domain";
import { normalizePublicProductLayoutMode } from "@/features/public-pos/order/product-layout-mode";
import { addPublicSearchHistoryItem, normalizePublicSearchHistory } from "@/features/public-pos/order/search-history";

const normalStatus = publicMenuKindToStatusSortFk(
  PUBLIC_MENU_KIND.NORMAL,
) as ProductSortStatus;
const promotionStatus = publicMenuKindToStatusSortFk(
  PUBLIC_MENU_KIND.PROMOTION,
) as ProductSortStatus;
const setStatus = publicMenuKindToStatusSortFk(
  PUBLIC_MENU_KIND.SET,
) as ProductSortStatus;
const t = ((key: string) => key) as never;

function product(overrides: Partial<CateProductItem> = {}): CateProductItem {
  return {
    prodUuid: "prod-1",
    prodName: "Noodle",
    prodImage: "",
    prodStatusImge: ProductImageStatus.IMAGE,
    statusSortFk: normalStatus,
    canAdd: true,
    hasOptions: false,
    optionsMsg: "",
    countOptionAll: 1,
    countOptionEnabled: 1,
    countToppingEnabled: 0,
    proDetailUuid: "detail-1",
    proDetailSprice: 12000,
    ...overrides,
  };
}

function prodItem(overrides: Partial<ProdItem> = {}): ProdItem {
  return {
    prodUuid: "prod-1",
    prodName: "Noodle",
    prodImage: "",
    prodStatusImge: ProductImageStatus.IMAGE,
    prodPrice: 12000,
    details: [],
    toppings: [],
    ...overrides,
  };
}

function category(
  cateUuid: string,
  products: CateProductItem[] = [],
): { cateUuid: string; cateName: string; products: CateProductItem[] } {
  return {
    cateUuid,
    cateName: cateUuid,
    products,
  };
}

function productStatus(value: unknown): CateProductItem["statusSortFk"] {
  return value as CateProductItem["statusSortFk"];
}

describe("public menu category reset helpers", () => {
  it("selects the initial rendered category only when category order changes", () => {
    const categories = [
      category("cate-1", [product({ prodUuid: "prod-1" })]),
      category("cate-2", [
        product({ prodUuid: "prod-2" }),
        product({ prodUuid: "prod-3" }),
      ]),
    ];

    expect(
      nextPublicMenuCategoryReset({
        categoryOrderKey: "cate-1:cate-2",
        defaultCateUuid: "cate-1",
        menuCategories: categories,
        previousCategoryOrderKey: null,
        productRenderChunk: 1,
        selectedCateUuid: "cate-2",
      }),
    ).toEqual({
      activeCateUuid: "cate-2",
      categoryOrderKey: "cate-1:cate-2",
      renderedCateUuids: ["cate-2"],
      visibleProductCountByCate: { "cate-2": 1 },
    });

    expect(
      nextPublicMenuCategoryReset({
        categoryOrderKey: "cate-1:cate-2",
        defaultCateUuid: "cate-1",
        menuCategories: categories,
        previousCategoryOrderKey: "cate-1:cate-2",
        productRenderChunk: 1,
        selectedCateUuid: "cate-1",
      }),
    ).toBeNull();

    expect(
      nextPublicMenuCategoryReset({
        categoryOrderKey: "",
        defaultCateUuid: "",
        menuCategories: [],
        previousCategoryOrderKey: "cate-1:cate-2",
        productRenderChunk: 1,
        selectedCateUuid: "",
      }),
    ).toEqual({
      activeCateUuid: "",
      categoryOrderKey: "",
      renderedCateUuids: [],
      visibleProductCountByCate: {},
    });
  });

  it("identifies only stale category refs for pruning", () => {
    const liveRef = {};
    const removedRef = {};
    const refs = {
      "cate-live": liveRef,
      "cate-removed": removedRef,
    };

    expect(
      missingPublicMenuCategoryRefUuids(refs, ["cate-live", "cate-new"]),
    ).toEqual(["cate-removed"]);
    expect(refs["cate-live"]).toBe(liveRef);
    expect(refs["cate-removed"]).toBe(removedRef);
  });
});

describe("public POS product helpers", () => {
  it("uses the minimum as a starting price when enabled options have a price range", () => {
    expect(
      publicProductCardPrice(
        product({
          countOptionEnabled: 3,
          proDetailSprice: 99999,
          minPrice: "45000",
          maxPrice: 65000,
        }),
      ),
    ).toEqual({ kind: "starting", value: 45000 });

    expect(
      publicProductCardPrice(
        product({
          countOptionEnabled: 2,
          minPrice: 45000,
          maxPrice: undefined,
        }),
      ),
    ).toEqual({ kind: "starting", value: 45000 });
  });

  it("uses an exact price when all enabled options have the same price", () => {
    expect(
      publicProductCardPrice(
        product({
          countOptionEnabled: 2,
          minPrice: 45000,
          maxPrice: "45000",
        }),
      ),
    ).toEqual({ kind: "exact", value: 45000 });
  });

  it("does not claim a price for invalid or inverted option ranges", () => {
    expect(
      publicProductCardPrice(
        product({
          countOptionEnabled: 2,
          minPrice: undefined,
          maxPrice: 65000,
        }),
      ),
    ).toEqual({ kind: "variable", value: null });
    expect(
      publicProductCardPrice(
        product({
          countOptionEnabled: 2,
          minPrice: 65000,
          maxPrice: 45000,
        }),
      ),
    ).toEqual({ kind: "variable", value: null });
    expect(
      publicProductCardPrice(
        product({
          countOptionEnabled: 2,
          minPrice: 45000,
          maxPrice: "invalid",
        }),
      ),
    ).toEqual({ kind: "variable", value: null });
  });

  it("uses direct prices for products without multiple enabled options", () => {
    expect(publicProductCardPrice(product())).toEqual({
      kind: "exact",
      value: 12000,
    });
    expect(
      publicProductCardPrice(
        product({ proDetailSprice: 0, prodPrice: "18000" }),
      ),
    ).toEqual({ kind: "exact", value: 18000 });
    expect(
      publicProductCardPrice(
        product({ proDetailSprice: 0, prodPrice: 0, minPrice: 15000 }),
      ),
    ).toEqual({ kind: "exact", value: 15000 });
    expect(
      publicProductCardPrice(
        product({ proDetailSprice: 0, prodPrice: 0, minPrice: 0 }),
      ),
    ).toEqual({ kind: "variable", value: null });
  });

  it("normalizes product layout modes with grid as the safe fallback", () => {
    expect(normalizePublicProductLayoutMode("grid")).toBe("grid");
    expect(normalizePublicProductLayoutMode("list")).toBe("list");
    expect(normalizePublicProductLayoutMode("table")).toBe("grid");
    expect(normalizePublicProductLayoutMode(null)).toBe("grid");
  });

  it("blocks sold-out and expired promotion products before choosing actions", () => {
    expect(
      getProductBlockedState(product({ canAdd: false }), normalStatus),
    ).toBe("sold-out");
    expect(
      getProductBlockedState(
        product({
          promoExpired: true,
          promoState: "ACTIVE",
          statusSortFk: promotionStatus,
        }),
        promotionStatus,
      ),
    ).toBe("promotion-ended");

    expect(
      getProductActionState(
        product({ canAdd: false, hasOptions: true }),
        normalStatus,
      ),
    ).toBe("blocked");
  });

  it.each([
    { label: "malformed", value: "not-a-status" },
    { label: "empty", value: "" },
    { label: "non-finite", value: Number.POSITIVE_INFINITY },
  ])(
    "keeps public numeric coercion for $label product status",
    ({ value }) => {
      const statusSortFk = productStatus(value);

      expect(
        getProductBlockedState(
          product({
            promoExpired: true,
            promoMsg: "",
            promoState: "NONE",
            statusSortFk,
          }),
          promotionStatus,
        ),
      ).toBeNull();
      expect(
        getProductActionState(
          product({ statusSortFk }),
          setStatus,
        ),
      ).toBe("add");
    },
  );

  it("keeps public non-finite count coercion behavior", () => {
    expect(
      getProductActionState(
        product({ countOptionEnabled: Number.POSITIVE_INFINITY }),
        normalStatus,
      ),
    ).toBe("choose");
    expect(
      getProductActionState(
        product({ countOptionAll: Number.POSITIVE_INFINITY }),
        normalStatus,
      ),
    ).toBe("choose");
    expect(
      getProductActionState(
        product({ countToppingEnabled: Number.POSITIVE_INFINITY }),
        normalStatus,
      ),
    ).toBe("choose");
    expect(
      getProductActionState(
        product({ countOptionEnabled: Number.NaN }),
        normalStatus,
      ),
    ).toBe("view");
  });

  it("selects list action states from options, direct-add data, and fallback view", () => {
    expect(
      getProductActionState(product({ hasOptions: true }), normalStatus),
    ).toBe("choose");
    expect(getProductActionState(product(), normalStatus)).toBe("add");
    expect(
      getProductActionState(product({ proDetailUuid: "" }), normalStatus),
    ).toBe("view");
  });

  it("detects product modal mode from menu status and product metadata", () => {
    expect(getProductModalMode(promotionStatus, prodItem())).toBe("promotion");
    expect(getProductModalMode(setStatus, prodItem())).toBe("set");
    expect(
      getProductModalMode(
        normalStatus,
        prodItem({ typeGroup: "promo bundle" }),
      ),
    ).toBe("promotion");
    expect(
      getProductModalMode(normalStatus, prodItem({ typeGroup: "lunch set" })),
    ).toBe("set");
    expect(getProductModalMode(normalStatus, prodItem())).toBe("normal");
  });

  it("returns readable Lao and English status section labels", () => {
    expect(statusSectionLabel(PUBLIC_MENU_KIND.PROMOTION, "la")).toBe(
      "ໂປຣໂມຊັນ",
    );
    expect(statusSectionLabel(PUBLIC_MENU_KIND.SET, "la")).toBe("ເຊັດອາຫານ");
    expect(statusSectionLabel(PUBLIC_MENU_KIND.NORMAL, "la")).toBe("ທົ່ວໄປ");
    expect(statusSectionLabel(PUBLIC_MENU_KIND.PROMOTION, "en")).toBe(
      "Promotion",
    );
    expect(statusSectionLabel(PUBLIC_MENU_KIND.SET, "en")).toBe("Set");
    expect(statusSectionLabel(PUBLIC_MENU_KIND.NORMAL, "en")).toBe("Normal");
  });
});

describe("public POS quantity helpers", () => {
  it("limits stock by editable open cart quantity", () => {
    const detail: ProdDetail = {
      proDetailUuid: "detail-1",
      cutStock: 1,
      qtyStock: 5,
    };
    const cart: CartOrder[] = [
      {
        order_uuid: "order-1",
        items: [
          {
            order_it_uuid: "item-1",
            prod_uuid_fk: "prod-1",
            pro_detail_uuid_fk: "detail-1",
            detail: { order_it_qty: 2, order_it_status: 0 },
          },
        ],
      },
    ];

    expect(maxAvailableQty(prodItem(), detail, cart)).toBe(3);
    expect(canAddQty(prodItem(), detail, 3, cart)).toBe(true);
    expect(canAddQty(prodItem(), detail, 4, cart)).toBe(false);
  });

  it("normalizes promotion quantities and receive totals", () => {
    expect(
      promotionQuantity(
        { proDetailCusQtyBuy: 2, proDetailCusQtyFree: 1 },
        4,
      ),
    ).toEqual({
      hasPromotion: true,
      saleQty: 2,
      freeQty: 1,
      qtyStep: 2,
      totalReceiveQty: 4,
    });

    expect(
      promotionQuantity(
        { sale_qty: 3, free_qty: 1, order_it_promo_free_qty: 2 },
        6,
      ).totalReceiveQty,
    ).toBe(8);
  });
});

describe("public POS order payload helper", () => {
  it("extends the per-product topping price by the product quantity", () => {
    expect(
      getPublicOrderPriceTotals({
        basePrice: 65_000,
        productQty: 2,
        toppings: [
          {
            topping: {
              prodToppingUuid: "top-meat",
              toppingPrice: "10000",
            },
            qty: 3,
          },
          {
            topping: {
              prodToppingUuid: "top-egg",
              toppingPrice: 5_000,
            },
            qty: 1,
          },
        ],
      }),
    ).toEqual({
      productSubtotal: 130_000,
      toppingTotal: 70_000,
      total: 200_000,
    });
  });

  it("calculates a product subtotal without toppings", () => {
    expect(
      getPublicOrderPriceTotals({
        basePrice: 12_000,
        productQty: 3,
        toppings: [],
      }),
    ).toEqual({
      productSubtotal: 36_000,
      toppingTotal: 0,
      total: 36_000,
    });
  });

  it("adjusts topping quantity independently from product quantity", () => {
    expect(changePublicToppingQty({}, "top-1", 3)).toEqual({ "top-1": 3 });
    expect(changePublicToppingQty({ "top-1": 3 }, "top-1", 0)).toEqual({});
    expect(changePublicToppingQty({}, "top-1", 999)).toEqual({ "top-1": 99 });
    expect(togglePublicToppingQty({}, "top-1")).toEqual({ "top-1": 1 });
    expect(togglePublicToppingQty({ "top-1": 2 }, "top-1")).toEqual({});
    expect(togglePublicToppingQty({}, "top-1", 3)).toEqual({ "top-1": 3 });
  });

  it("builds the public QR create-order contract", () => {
    expect(
      buildPublicOrderInput({
        table: {
          status: "success",
          message: "",
          lang: "la",
          table_uuid: "table-1",
          table_name: "A1",
          table_status: 2,
          qr_enabled: true,
          branch_uuid_fk: "branch-1",
        },
        detail: { proDetailUuid: "detail-1" },
        qty: 2,
        toppings: [{ topping: { prodToppingUuid: "top-1" }, qty: 3 }],
        note: "less spicy",
        lang: "en",
      }),
    ).toMatchObject({
      table_uuid_fk: "table-1",
      branch_uuid_fk: "",
      order_created_by: "public_user",
      order_source: 2,
      order_channel: 1,
      lang: "en",
      items: [
        {
          prod_detail_uuid_fk: "detail-1",
          order_it_qty: 2,
          order_it_note: "less spicy",
          toppings: [{ prod_topping_uuid_fk: "top-1", topping_qty: 3 }],
        },
      ],
    });
  });
});

describe("public POS browse helpers", () => {
  it("builds rendered category sections from ordered uuids and visible counts", () => {
    const categories = [
      category("cate-1", [
        product({ prodUuid: "p1" }),
        product({ prodUuid: "p2" }),
      ]),
      category("cate-2", [product({ prodUuid: "p3" })]),
    ];
    const categoryByUuid = new Map(
      categories.map((item) => [item.cateUuid, item]),
    );

    expect(
      getRenderedMenuSections({
        renderedCateUuids: ["missing", "cate-1", "cate-2"],
        categoryByUuid,
        visibleProductCountByCate: { "cate-1": 1 },
        loadedCateUuids: ["cate-1"],
        loadingCateUuids: ["cate-2"],
        productRenderChunk: 12,
      }),
    ).toMatchObject([
      {
        category: { cateUuid: "cate-1" },
        products: [{ prodUuid: "p1" }],
        totalProducts: 2,
        visibleCount: 1,
        loaded: true,
      },
      {
        category: { cateUuid: "cate-2" },
        products: [{ prodUuid: "p3" }],
        totalProducts: 1,
        visibleCount: 1,
        loading: true,
      },
    ]);
  });

  it("detects more menu content from hidden products or unrendered categories", () => {
    const categories = [
      category("cate-1", [
        product({ prodUuid: "p1" }),
        product({ prodUuid: "p2" }),
      ]),
      category("cate-2", [product({ prodUuid: "p3" })]),
    ];
    const categoryByUuid = new Map(
      categories.map((item) => [item.cateUuid, item]),
    );

    expect(
      hasMoreMenuToRender({
        collapsedCateUuids: [],
        loadedCateUuids: ["cate-1"],
        menuCategories: categories,
        categoryByUuid,
        renderedCateUuids: ["cate-1"],
        visibleProductCountByCate: { "cate-1": 1 },
      }),
    ).toBe(true);

    expect(
      hasMoreMenuToRender({
        collapsedCateUuids: [],
        loadedCateUuids: ["cate-1"],
        menuCategories: categories,
        categoryByUuid,
        renderedCateUuids: ["cate-1"],
        visibleProductCountByCate: { "cate-1": 2 },
      }),
    ).toBe(true);

    expect(
      hasMoreMenuToRender({
        collapsedCateUuids: [],
        loadedCateUuids: ["cate-1", "cate-2"],
        menuCategories: categories,
        categoryByUuid,
        renderedCateUuids: ["cate-1", "cate-2"],
        visibleProductCountByCate: { "cate-1": 2, "cate-2": 1 },
      }),
    ).toBe(false);
  });

  it("calculates category path and initial visible counts", () => {
    const categories = [
      category("cate-1", [product({ prodUuid: "p1" })]),
      category("cate-2", [
        product({ prodUuid: "p2" }),
        product({ prodUuid: "p3" }),
      ]),
      category("cate-3", [product({ prodUuid: "p4" })]),
    ];
    const categoryByUuid = new Map(
      categories.map((item) => [item.cateUuid, item]),
    );
    const path = getCategoryPathUuids({
      activeCateUuid: "cate-1",
      targetCateUuid: "cate-3",
      renderedCateUuids: ["cate-1"],
      menuCategories: categories,
    });

    expect(path).toEqual(["cate-1", "cate-2", "cate-3"]);
    expect(visibleProductCountForCategory(categories[1], 1)).toBe(1);
    expect(
      withCategoryPathVisibleCounts({
        current: { "cate-1": 1 },
        pathCateUuids: path,
        categoryByUuid,
        productRenderChunk: 1,
      }),
    ).toEqual({ "cate-1": 1, "cate-2": 1, "cate-3": 1 });
  });

  it("returns direct add payload only when list product can be added without modal", () => {
    const direct = getDirectAddListPayload(product(), normalStatus, []);
    expect(direct.ok).toBe(true);
    if (direct.ok) {
      expect(direct.item.prodUuid).toBe("prod-1");
      expect(direct.payload).toMatchObject({ qty: 1, toppings: [], note: "" });
    }

    expect(
      getDirectAddListPayload(product({ hasOptions: true }), normalStatus, []),
    ).toEqual({
      ok: false,
      reason: "needs-modal",
    });
  });
});

describe("public POS cart helpers", () => {
  it("calculates cart quantity and receipt totals from mixed response shapes", () => {
    const cart: CartOrder[] = [
      {
        order_uuid: "order-1",
        totals: {
          order_subtotal: 30000,
          order_item_discount_amount: 1000,
          order_discount_amount: 2000,
          order_service_amount: 500,
          order_vat_amount: 300,
        },
        items: [
          { detail: { order_it_qty: 2, net_total: 27000, order_it_status: 0 } },
        ],
      },
      {
        order_uuid: "order-2",
        sum_grand_total: 12000,
        items: [{ qty: 3, total: 12000, detail: { order_it_status: 1 } }],
      },
    ];

    expect(totalCartQty(cart)).toBe(5);
    expect(getCartReceiptTotals(cart)).toEqual({
      subtotal: 42000,
      itemDiscount: 1000,
      orderDiscount: 2000,
      service: 500,
      vat: 300,
    });
  });

  it("uses API status labels for groups and fallback translated cart status labels", () => {
    const waitingItem: CartItem = { detail: { order_it_status: 0 } };
    const canceledItem: CartItem = { detail: { order_it_status: 9 } };
    const sameLabelItems: CartItem[] = [
      { detail: { order_it_status_text: "Waiting kitchen" } },
      { detail: { order_it_status_text: "Waiting kitchen" } },
    ];

    expect(cartGroupTitle(sameLabelItems, "Fallback")).toBe("Waiting kitchen");
    expect(
      cartGroupTitle(
        [...sameLabelItems, { detail: { order_it_status_text: "Served" } }],
        "Fallback",
      ),
    ).toBe("Fallback");
    expect(getCartItemStatus(waitingItem, t).label).toBe(
      "pos.cartStatusWaiting",
    );
    expect(getCartItemStatus(canceledItem, t).label).toBe(
      "pos.cartStatusCanceled",
    );
  });

  it("detects readable Lao cart status labels", () => {
    expect(
      isCanceledCartItem({ detail: { order_it_status_text: "ຍົກເລີກ" } }),
    ).toBe(true);
    expect(
      isServedCartItem({ detail: { order_it_status_text: "ເສີບແລ້ວ" } }),
    ).toBe(true);
  });

  it("builds confirm kitchen payload from the first order with confirmable draft items", () => {
    expect(
      getConfirmableOrderPayload(
        [
          {
            order_uuid: "served-order",
            items: [
              { order_it_uuid: "served", detail: { order_it_status: 4 } },
            ],
          },
          {
            order_uuid: "draft-order",
            items: [
              { order_it_uuid: "draft-1", detail: { order_it_status: 0 } },
              { order_it_uuid: "waiting", detail: { order_it_status: 1 } },
              { order_it_uuid: "draft-2", detail: { order_it_status: 0 } },
            ],
          },
        ],
        null,
      ),
    ).toEqual({
      orderUuid: "draft-order",
      orderItemUuids: ["draft-1", "draft-2"],
    });
  });
});

describe("public POS search history helpers", () => {
  it("trims, dedupes case-insensitively, and keeps newest search first", () => {
    expect(
      normalizePublicSearchHistory(["  Pho  ", "pho", "", "Khao soi"]),
    ).toEqual(["Pho", "Khao soi"]);
    expect(
      addPublicSearchHistoryItem(["Pho", "Khao soi"], " khao SOI "),
    ).toEqual(["khao SOI", "Pho"]);
  });
});
