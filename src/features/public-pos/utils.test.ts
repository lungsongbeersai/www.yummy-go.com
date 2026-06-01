import { describe, expect, it } from "vitest";
import {
  ProductImageStatus,
  type ProductSortStatus,
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
import {
  addPublicSearchHistoryItem,
  buildPublicOrderInput,
  canAddQty,
  cartGroupTitle,
  getCategoryPathUuids,
  getCartItemStatus,
  getCartReceiptTotals,
  getConfirmableOrderPayload,
  getDirectAddListPayload,
  getProductActionState,
  getProductBlockedState,
  getProductModalMode,
  getRenderedMenuSections,
  isCanceledCartItem,
  isServedCartItem,
  hasMoreMenuToRender,
  maxAvailableQty,
  normalizePublicSearchHistory,
  promotionQuantity,
  statusSectionLabel,
  totalCartQty,
  visibleProductCountForCategory,
  withCategoryPathVisibleCounts,
} from "@/features/public-pos/utils";

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
    prod_uuid: "prod-1",
    prod_name: "Noodle",
    prod_image: "",
    prod_status_imge: ProductImageStatus.IMAGE,
    status_sort_fk: normalStatus,
    can_add: true,
    has_options: false,
    options_msg: "",
    count_option_all: 1,
    count_option_enabled: 1,
    count_topping_enabled: 0,
    pro_detail_uuid: "detail-1",
    pro_detail_sprice: 12000,
    ...overrides,
  };
}

function prodItem(overrides: Partial<ProdItem> = {}): ProdItem {
  return {
    prod_uuid: "prod-1",
    prod_name: "Noodle",
    prod_image: "",
    prod_status_imge: ProductImageStatus.IMAGE,
    prod_price: 12000,
    details: [],
    toppings: [],
    ...overrides,
  };
}

function category(
  cateUuid: string,
  products: CateProductItem[] = [],
): { cate_uuid: string; cate_name: string; products: CateProductItem[] } {
  return {
    cate_uuid: cateUuid,
    cate_name: cateUuid,
    products,
  };
}

describe("public POS product helpers", () => {
  it("blocks sold-out and expired promotion products before choosing actions", () => {
    expect(
      getProductBlockedState(product({ can_add: false }), normalStatus),
    ).toBe("sold-out");
    expect(
      getProductBlockedState(
        product({
          promo_expired: true,
          promo_state: "ACTIVE",
          status_sort_fk: promotionStatus,
        }),
        promotionStatus,
      ),
    ).toBe("promotion-ended");

    expect(
      getProductActionState(
        product({ can_add: false, has_options: true }),
        normalStatus,
      ),
    ).toBe("blocked");
  });

  it("selects list action states from options, direct-add data, and fallback view", () => {
    expect(
      getProductActionState(product({ has_options: true }), normalStatus),
    ).toBe("choose");
    expect(getProductActionState(product(), normalStatus)).toBe("add");
    expect(
      getProductActionState(product({ pro_detail_uuid: "" }), normalStatus),
    ).toBe("view");
  });

  it("detects product modal mode from menu status and product metadata", () => {
    expect(getProductModalMode(promotionStatus, prodItem())).toBe("promotion");
    expect(getProductModalMode(setStatus, prodItem())).toBe("set");
    expect(
      getProductModalMode(
        normalStatus,
        prodItem({ type_group: "promo bundle" }),
      ),
    ).toBe("promotion");
    expect(
      getProductModalMode(normalStatus, prodItem({ type_group: "lunch set" })),
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
      pro_detail_uuid: "detail-1",
      cut_stock: 1,
      qty_stock: 5,
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
        { pro_detail_cus_qtyBuy: 2, pro_detail_cus_qtyFree: 1 },
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
        detail: { pro_detail_uuid: "detail-1" },
        qty: 2,
        toppings: [{ prod_topping_uuid: "top-1" }],
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
          toppings: [{ prod_topping_uuid_fk: "top-1", topping_qty: 1 }],
        },
      ],
    });
  });
});

describe("public POS browse helpers", () => {
  it("builds rendered category sections from ordered uuids and visible counts", () => {
    const categories = [
      category("cate-1", [
        product({ prod_uuid: "p1" }),
        product({ prod_uuid: "p2" }),
      ]),
      category("cate-2", [product({ prod_uuid: "p3" })]),
    ];
    const categoryByUuid = new Map(
      categories.map((item) => [item.cate_uuid, item]),
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
        category: { cate_uuid: "cate-1" },
        products: [{ prod_uuid: "p1" }],
        totalProducts: 2,
        visibleCount: 1,
        loaded: true,
      },
      {
        category: { cate_uuid: "cate-2" },
        products: [{ prod_uuid: "p3" }],
        totalProducts: 1,
        visibleCount: 1,
        loading: true,
      },
    ]);
  });

  it("detects more menu content from hidden products or unrendered categories", () => {
    const categories = [
      category("cate-1", [
        product({ prod_uuid: "p1" }),
        product({ prod_uuid: "p2" }),
      ]),
      category("cate-2", [product({ prod_uuid: "p3" })]),
    ];
    const categoryByUuid = new Map(
      categories.map((item) => [item.cate_uuid, item]),
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
      category("cate-1", [product({ prod_uuid: "p1" })]),
      category("cate-2", [
        product({ prod_uuid: "p2" }),
        product({ prod_uuid: "p3" }),
      ]),
      category("cate-3", [product({ prod_uuid: "p4" })]),
    ];
    const categoryByUuid = new Map(
      categories.map((item) => [item.cate_uuid, item]),
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
      expect(direct.item.prod_uuid).toBe("prod-1");
      expect(direct.payload).toMatchObject({ qty: 1, toppings: [], note: "" });
    }

    expect(
      getDirectAddListPayload(product({ has_options: true }), normalStatus, []),
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
