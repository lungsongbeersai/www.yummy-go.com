import { describe, expect, it } from "vitest";
import {
  availableProductDetails,
  buildStaffOrderItems,
  buildStaffOrderInput,
  canDirectAddFromList,
  clampOrderQuantity,
  changeToppingQty,
  counterOrderTable,
  countSelectedToppings,
  defaultOrderQty,
  firstAvailableDetail,
  firstStatusWithProducts,
  flattenProducts,
  getModalBasePrice,
  getModalUnitPrice,
  getOrderSelectionIssue,
  getProductActionState,
  getProductBlockedState,
  getProductModalMode,
  nextMenuCategoryUuid,
  normalizeProdItem,
  orderCustomerUrl,
  orderQuantityRules,
  ProductSortStatus,
  productCardPrice,
  productNeedsModal,
  productOptionCount,
  selectedOrderTable,
  selectedToppingsFromQtyMap,
  toggleToppingQty,
} from "@/features/pos/order-customer/order-customer-utils";
import {
  OrderChannelEnum,
  OrderSourceEnum,
  TableStatus,
} from "@/config/pos-constants";
import {
  type CateProductItem,
  type ProdDetail,
  type ProdItem,
  type ProdTopping,
} from "@/services/pos";

function product(overrides: Partial<CateProductItem> = {}): CateProductItem {
  return {
    prodUuid: "prod-1",
    prodName: "Noodle",
    prodPrice: 12000,
    proDetailUuid: "detail-1",
    proDetailSprice: 12000,
    countOptionEnabled: 1,
    countOptionAll: 1,
    countToppingEnabled: 0,
    canAdd: true,
    hasOptions: false,
    optionsMsg: "",
    prodImage: "",
    prodStatusImge: 1,
    statusSortFk: ProductSortStatus.NORMAL,
    ...overrides,
  };
}

function productStatus(value: unknown): CateProductItem["statusSortFk"] {
  return value as CateProductItem["statusSortFk"];
}

function detail(overrides: Partial<ProdDetail> = {}): ProdDetail {
  return {
    proDetailUuid: "detail-1",
    price: 12000,
    proDetailSprice: 12000,
    proDetailEnabled: 1,
    cutStock: 2,
    ...overrides,
  };
}

function topping(overrides: Partial<ProdTopping> = {}): ProdTopping {
  return {
    prodToppingUuid: "top-1",
    toppingName: "Egg",
    toppingPrice: 2000,
    toppingEnabled: 1,
    ...overrides,
  };
}

describe("order customer helpers", () => {
  it("derives selected table fallback and refresh target URL", () => {
    expect(
      selectedOrderTable({
        tableUuid: "table-1",
        tableName: "A1",
        zones: [
          {
            tables: [
              {
                table_uuid: "table-1",
                table_name: "VIP",
                table_status: TableStatus.AVAILABLE,
                number_of_seats: 4,
              },
            ],
          },
        ],
      }),
    ).toMatchObject({ table_name: "VIP", table_status: TableStatus.AVAILABLE });

    expect(
      selectedOrderTable({
        tableUuid: "missing",
        tableName: "",
        zones: [],
      }),
    ).toMatchObject({
      table_uuid: "missing",
      table_name: "-",
      table_status: TableStatus.OCCUPIED,
    });

    expect(orderCustomerUrl({ tableUuid: "table 1", tableName: "A&B" })).toBe(
      "/pos/order?table_uuid=table+1&table_name=A%26B",
    );
  });

  it("builds a synthetic table identity for counter orders (no real table)", () => {
    expect(counterOrderTable("order-1", "Counter order")).toMatchObject({
      table_uuid: "order-1",
      table_name: "Counter order",
      table_status: TableStatus.OCCUPIED,
    });
  });

  it("flattens category products and picks first sort with products", () => {
    const menu = {
      [ProductSortStatus.NORMAL]: [],
      [ProductSortStatus.SET]: [
        { cateUuid: "set-cate", cateName: "Set", products: [product()] },
      ],
      [ProductSortStatus.PROMOTION]: [],
    };

    expect(flattenProducts(menu[ProductSortStatus.SET])).toEqual([
      {
        cateUuid: "set-cate",
        product: expect.objectContaining({ prodUuid: "prod-1" }),
      },
    ]);
    expect(firstStatusWithProducts(menu)).toBe(ProductSortStatus.SET);
  });

  it("chooses the next category path without losing requested category", () => {
    expect(
      nextMenuCategoryUuid({
        requestedCateUuid: "requested",
        selectedCateUuid: "selected",
        defaultCateUuid: "default",
        categories: [{ cateUuid: "first", cateName: "First", products: [] }],
      }),
    ).toBe("requested");

    expect(
      nextMenuCategoryUuid({
        requestedCateUuid: "",
        selectedCateUuid: "",
        defaultCateUuid: "",
        categories: [{ cateUuid: "first", cateName: "First", products: [] }],
      }),
    ).toBe("first");
  });

  it("detects blocked, modal, and direct-add product states", () => {
    expect(
      getProductBlockedState(
        product({ stockSoldOut: true }),
        ProductSortStatus.NORMAL,
      ),
    ).toBe("sold-out");
    expect(
      getProductActionState(
        product({ hasOptions: true }),
        ProductSortStatus.NORMAL,
      ),
    ).toBe("choose");
    expect(canDirectAddFromList(product(), ProductSortStatus.NORMAL)).toBe(
      true,
    );
    expect(
      canDirectAddFromList(
        product({ statusSortFk: ProductSortStatus.SET }),
        ProductSortStatus.SET,
      ),
    ).toBe(false);
  });

  it.each([
    { label: "malformed", value: "not-a-status" },
    { label: "empty", value: "" },
    { label: "non-finite", value: Number.POSITIVE_INFINITY },
  ])(
    "keeps staff fallback behavior for $label product status",
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
          ProductSortStatus.PROMOTION,
        ),
      ).toBe("promotion-ended");
      expect(
        getProductActionState(
          product({ statusSortFk }),
          ProductSortStatus.SET,
        ),
      ).toBe("choose");
    },
  );

  it.each([
    {
      label: "enabled option count",
      overrides: { countOptionEnabled: Number.POSITIVE_INFINITY },
    },
    {
      label: "all option count",
      overrides: { countOptionAll: Number.POSITIVE_INFINITY },
    },
    {
      label: "enabled topping count",
      overrides: { countToppingEnabled: Number.POSITIVE_INFINITY },
    },
    {
      label: "NaN option count",
      overrides: { countOptionEnabled: Number.NaN },
    },
  ])(
    "does not force staff choice for non-finite $label",
    ({ overrides }) => {
      expect(
        getProductActionState(
          product(overrides),
          ProductSortStatus.NORMAL,
        ),
      ).toBe("add");
    },
  );

  it("builds truthful card prices without guessing a multi-size minimum", () => {
    expect(productOptionCount(product())).toBe(1);
    expect(
      productOptionCount(
        product({ countOptionEnabled: 2, countOptionAll: 4 }),
      ),
    ).toBe(2);
    expect(
      productOptionCount(
        product({ countOptionEnabled: 0, countOptionAll: 4 }),
      ),
    ).toBe(0);
    expect(
      productCardPrice(product(), ProductSortStatus.NORMAL),
    ).toEqual({ kind: "exact", value: 12000 });
    expect(
      productCardPrice(
        product({ countOptionEnabled: 3, countOptionAll: 4 }),
        ProductSortStatus.NORMAL,
      ),
    ).toEqual({ kind: "variable", value: null });
    expect(
      productCardPrice(
        product({
          countOptionEnabled: 3,
          minPrice: "10000",
          maxPrice: 15000,
        }),
        ProductSortStatus.NORMAL,
      ),
    ).toEqual({ kind: "starting", value: 10000 });
    expect(
      productCardPrice(
        product({
          countOptionEnabled: 2,
          minPrice: 12000,
          maxPrice: "12000",
        }),
        ProductSortStatus.NORMAL,
      ),
    ).toEqual({ kind: "exact", value: 12000 });
    expect(
      productCardPrice(
        product({ countOptionEnabled: 2, minPrice: 0, maxPrice: 15000 }),
        ProductSortStatus.NORMAL,
      ),
    ).toEqual({ kind: "variable", value: null });
    expect(
      productCardPrice(
        product({
          countOptionEnabled: 2,
          minPrice: 15000,
          maxPrice: 10000,
        }),
        ProductSortStatus.NORMAL,
      ),
    ).toEqual({ kind: "variable", value: null });
    expect(
      productCardPrice(
        product({ countToppingEnabled: 3 }),
        ProductSortStatus.NORMAL,
      ),
    ).toEqual({ kind: "exact", value: 12000 });
    expect(
      productCardPrice(
        product({
          statusSortFk: ProductSortStatus.SET,
          countOptionEnabled: 2,
          prodSetPrice: 50000,
        }),
        ProductSortStatus.SET,
      ),
    ).toEqual({ kind: "exact", value: 50000 });
    expect(
      productCardPrice(
        product({ proDetailSprice: 0, prodPrice: 0 }),
        ProductSortStatus.NORMAL,
      ),
    ).toEqual({ kind: "unavailable", value: null });
  });

  it("normalizes product item fallback details and modal mode", () => {
    const normalized = normalizeProdItem(null, product());
    expect(normalized.details?.[0]?.proDetailUuid).toBe("detail-1");
    expect(getProductModalMode(ProductSortStatus.PROMOTION, normalized)).toBe(
      "promotion",
    );
    expect(
      productNeedsModal(product(), normalized, ProductSortStatus.NORMAL),
    ).toBe(false);

    const optionItem: ProdItem = {
      ...normalized,
      details: [detail(), detail({ proDetailUuid: "detail-2" })],
    };
    expect(
      productNeedsModal(product(), optionItem, ProductSortStatus.NORMAL),
    ).toBe(true);
  });

  it("sorts available details and never falls back to an unavailable option", () => {
    const item = normalizeProdItem(null, product());
    item.details = [
      detail({ proDetailUuid: "large", proDetailSort: 3 }),
      detail({
        proDetailUuid: "disabled",
        proDetailEnabled: 2,
        proDetailSort: 1,
      }),
      detail({ proDetailUuid: "small", proDetailSort: 1 }),
      detail({ proDetailUuid: "medium", proDetailSort: 2 }),
      detail({ proDetailUuid: "invalid-sort", proDetailSort: 0 }),
    ];

    expect(
      availableProductDetails(item).map((option) => option.proDetailUuid),
    ).toEqual(["small", "medium", "large", "invalid-sort"]);
    expect(firstAvailableDetail(item)?.proDetailUuid).toBe("small");
    expect(
      firstAvailableDetail({
        ...item,
        details: [detail({ proDetailEnabled: 2 })],
      }),
    ).toBeNull();
  });

  it("enforces promotion quantity steps without changing normal quantities", () => {
    const normalRules = orderQuantityRules(detail(), "normal");
    expect(normalRules).toEqual({
      canOrder: true,
      min: 1,
      max: 99,
      step: 1,
    });
    expect(clampOrderQuantity(7, normalRules)).toBe(7);

    expect(
      orderQuantityRules(
        detail({ proDetailCusQtyBuy: 2, defaultQty: 6 }),
        "promotion",
      ),
    ).toEqual({ canOrder: true, min: 1, max: 99, step: 1 });

    const promotionRules = orderQuantityRules(
      detail({ proDetailCusQtyBuy: 2, proDetailCusQtyFree: 1 }),
      "promotion",
    );
    expect(promotionRules).toEqual({
      canOrder: true,
      min: 2,
      max: 98,
      step: 2,
    });
    expect(clampOrderQuantity(1, promotionRules)).toBe(2);
    expect(clampOrderQuantity(3, promotionRules)).toBe(4);
    expect(clampOrderQuantity(99, promotionRules)).toBe(98);

    expect(
      orderQuantityRules(
        detail({
          cutStock: 1,
          qtyStock: 5,
          proDetailCusQtyBuy: 2,
          proDetailCusQtyFree: 1,
        }),
        "promotion",
      ),
    ).toEqual({ canOrder: true, min: 2, max: 4, step: 2 });
    expect(
      orderQuantityRules(
        detail({
          cutStock: 1,
          qtyStock: 1,
          proDetailCusQtyBuy: 2,
          proDetailCusQtyFree: 1,
        }),
        "promotion",
      ),
    ).toEqual({ canOrder: false, min: 2, max: 2, step: 2 });
  });

  it("requires an explicit set price and does not infer set mode from null", () => {
    const normalProduct = {
      ...normalizeProdItem(null, product()),
      prodPrice: 50000,
      prodSetPrice: null,
    };

    expect(
      getProductModalMode(ProductSortStatus.NORMAL, normalProduct),
    ).toBe("normal");
    expect(getModalBasePrice(normalProduct, detail(), "set")).toBe(0);
    expect(
      getOrderSelectionIssue({
        detail: detail(),
        mode: "set",
        product: normalProduct,
        quantity: 1,
        toppings: [],
      }),
    ).toBe("price-invalid");
  });

  it("validates price, stock, quantity, and toppings before building payload", () => {
    expect(
      getOrderSelectionIssue({
        detail: detail({ price: 0, proDetailSprice: 0 }),
        mode: "normal",
        quantity: 1,
        toppings: [],
      }),
    ).toBe("price-invalid");
    expect(
      getOrderSelectionIssue({
        detail: detail({ cutStock: 1, qtyStock: 2 }),
        mode: "normal",
        quantity: 3,
        toppings: [],
      }),
    ).toBe("quantity-invalid");
    expect(
      getOrderSelectionIssue({
        detail: detail(),
        mode: "normal",
        quantity: 1,
        toppings: [
          { topping: topping({ toppingEnabled: 2 }), qty: 1 },
        ],
      }),
    ).toBe("topping-invalid");
    expect(() =>
      buildStaffOrderItems({
        detail: detail({ price: 0, proDetailSprice: 0 }),
        noteText: "",
        quantity: 1,
        toppings: [],
      }),
    ).toThrow("price-invalid");
  });

  it("normalizes default quantity and builds staff order payload", () => {
    const input = buildStaffOrderInput({
      branchUuid: "branch-1",
      detail: detail({ proDetailCusQtyBuy: 2 }),
      lang: "lo",
      noteText: " less spicy ",
      quantity: defaultOrderQty(detail({ proDetailCusQtyBuy: 2 })),
      tableUuid: "table-1",
      toppings: [{ topping: topping(), qty: 1 }],
      userUuid: "user-1",
    });

    expect(input).toMatchObject({
      table_uuid_fk: "table-1",
      branch_uuid_fk: "branch-1",
      order_created_by: "user-1",
      order_source: OrderSourceEnum.POS,
      order_channel: OrderChannelEnum.DINE_IN,
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

  it("omits table_uuid_fk for counter orders with no table", () => {
    const input = buildStaffOrderInput({
      branchUuid: "branch-1",
      detail: detail({ proDetailCusQtyBuy: 2 }),
      lang: "lo",
      noteText: "",
      quantity: defaultOrderQty(detail({ proDetailCusQtyBuy: 2 })),
      tableUuid: "",
      toppings: [],
      userUuid: "user-1",
    });

    expect(input).not.toHaveProperty("table_uuid_fk");
  });

  it("builds staff set order items from every available product detail", () => {
    const setProduct: ProdItem = {
      ...normalizeProdItem(null, product({ statusSortFk: ProductSortStatus.SET })),
      prodSetPrice: 220000,
      typeGroup: "Set",
      details: [
        detail({
          proDetailUuid: "beer",
          defaultQty: 2,
          price: 0,
          proDetailSprice: 0,
        }),
        detail({
          proDetailUuid: "ice",
          defaultQty: 2,
          price: 0,
          proDetailSprice: 0,
        }),
        detail({
          proDetailUuid: "disabled",
          proDetailEnabled: 2,
          price: 0,
          proDetailSprice: 0,
        }),
      ],
    };

    const items = buildStaffOrderItems({
      detail: setProduct.details[0],
      mode: "set",
      noteText: " cold ",
      product: setProduct,
      quantity: 3,
      toppings: [{ topping: topping(), qty: 1 }],
    });

    expect(items).toHaveLength(2);
    expect(items).toEqual([
      {
        prod_detail_uuid_fk: "beer",
        order_it_qty: 6,
        order_it_status: 1,
        order_it_note: "cold",
        toppings: [{ prod_topping_uuid_fk: "top-1", topping_qty: 1 }],
      },
      {
        prod_detail_uuid_fk: "ice",
        order_it_qty: 6,
        order_it_status: 1,
        order_it_note: "cold",
      },
    ]);
  });

  it("maps product option sheet topping selection predictably", () => {
    const productItem: ProdItem = {
      ...normalizeProdItem(null, product()),
      toppings: [
        topping({ prodToppingUuid: "top-1" }),
        topping({ prodToppingUuid: "top-2", toppingName: "Cheese" }),
      ],
    };

    expect(
      selectedToppingsFromQtyMap(productItem, { "top-2": 2 }).map(
        (selected) => `${selected.topping.toppingName} x${selected.qty}`,
      ),
    ).toEqual(["Cheese x2"]);
    expect(toggleToppingQty({ "top-1": 1 }, "top-2")).toEqual({
      "top-1": 1,
      "top-2": 1,
    });
    expect(toggleToppingQty({ "top-1": 1, "top-2": 2 }, "top-1")).toEqual({
      "top-2": 2,
    });
    expect(toggleToppingQty({ "top-1": 1 }, "top-2", 3)).toEqual({
      "top-1": 1,
      "top-2": 3,
    });
    expect(changeToppingQty({ "top-1": 1 }, "top-1", 3)).toEqual({
      "top-1": 3,
    });
    expect(changeToppingQty({ "top-1": 2, "top-2": 1 }, "top-1", 0)).toEqual({
      "top-2": 1,
    });
    expect(
      countSelectedToppings([
        { topping: topping(), qty: 2 },
        { topping: topping({ prodToppingUuid: "top-2" }), qty: 1 },
      ]),
    ).toBe(3);
  });

  it("keeps topping_qty per product without multiplying by product quantity", () => {
    const productItem = normalizeProdItem(null, product());

    // ข้าวผัด 1 จาน + ไข่ 3 ฟอง/จาน → ราคาต่อจานรวมไข่ 3 ฟอง
    expect(
      getModalUnitPrice(
        productItem,
        detail(),
        [{ topping: topping(), qty: 3 }],
        "normal",
      ),
    ).toBe(12000 + 2000 * 3);

    // ข้าวผัด 2 จาน × ไข่ 3 ฟอง/จาน → backend คูณ order_it_qty ตอนคิดยอดรวม
    expect(
      buildStaffOrderItems({
        detail: detail(),
        noteText: "",
        quantity: 2,
        toppings: [{ topping: topping(), qty: 3 }],
      }),
    ).toEqual([
      {
        prod_detail_uuid_fk: "detail-1",
        order_it_qty: 2,
        order_it_status: 1,
        order_it_note: undefined,
        toppings: [{ prod_topping_uuid_fk: "top-1", topping_qty: 3 }],
      },
    ]);
  });
});
