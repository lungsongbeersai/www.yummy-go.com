import { describe, expect, it } from "vitest";
import {
  availableProductDetails,
  buildStaffOrderItems,
  buildStaffOrderInput,
  canDirectAddFromList,
  canSelectMoreToppings,
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
  groupedSetDetails,
  MAX_ORDER_QTY,
  nextMenuCategoryUuid,
  normalizeProdItem,
  orderCustomerUrl,
  orderQuantityRules,
  orderSelectionIssueLabel,
  ProductSortStatus,
  productCardPrice,
  productNeedsModal,
  productOptionCount,
  resolveSetOrderDetails,
  selectedOrderTable,
  selectedTastesFromUuids,
  selectedToppingsFromQtyMap,
  setChildOptionSelectionLimit,
  setChoiceGroupDisplayName,
  setChoiceGroupMaxSelect,
  setChoiceGroupUuid,
  toggleSetChoiceUuid,
  toggleSetChildOptionGroupUuid,
  toggleToppingQty,
  toppingQtyCap,
  toppingSelectionLimit,
  tasteSelectionLimit,
  toggleTasteUuid,
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
  type ProdSetChoiceGroup,
  type ProdTaste,
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

function taste(overrides: Partial<ProdTaste> = {}): ProdTaste {
  return {
    tasteUuid: "taste-1",
    tasteName: "Spicy",
    tasteStatus: 1,
    ...overrides,
  };
}

function choiceGroup(overrides: Partial<ProdSetChoiceGroup> = {}): ProdSetChoiceGroup {
  return {
    setChoiceGroupUuid: "group-1",
    groupName: "Choose protein",
    maxSelect: 1,
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
      "/posAll/order?table_uuid=table+1&table_name=A%26B",
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
    ).toBe("quantity-exceeds-stock");
    // เหลือสต็อกดิบ 1 ชิ้น แต่โปรฯ บังคับซื้อขั้นต่ำ 3 — ไม่ถึง 1 ชุดของโปรฯ เลย ต่างจาก
    // "quantity-exceeds-stock" ที่ยังพอมีให้สั่งอยู่ แค่พิมพ์เกินของที่เหลือ
    expect(
      getOrderSelectionIssue({
        detail: detail({
          cutStock: 1,
          qtyStock: 1,
          proDetailCusQtyBuy: 3,
          proDetailCusQtyFree: 2,
        }),
        mode: "promotion",
        quantity: 3,
        toppings: [],
      }),
    ).toBe("stock-insufficient");
    expect(
      getOrderSelectionIssue({
        detail: detail({ cutStock: 1, qtyStock: 5 }),
        mode: "normal",
        quantity: 0,
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
    // prodToppingMaxSelect = จำนวนชนิดท็อปปิ้งสูงสุด ไม่ใช่จำนวนชิ้น — เลือก 2 ชนิดทั้งที่
    // สินค้าตั้งเพดานไว้แค่ 1 ชนิด ต้องเป็น issue นี้แม้แต่ละชนิดจะเลือก qty แค่ 1 ก็ตาม
    const toppingLimitedProduct = {
      ...normalizeProdItem(null, product()),
      prodToppingMaxSelect: 1,
      toppings: [
        topping({ prodToppingUuid: "top-1" }),
        topping({ prodToppingUuid: "top-2" }),
      ],
    };
    expect(
      getOrderSelectionIssue({
        detail: detail(),
        mode: "normal",
        product: toppingLimitedProduct,
        quantity: 1,
        toppings: [
          { topping: topping({ prodToppingUuid: "top-1" }), qty: 1 },
          { topping: topping({ prodToppingUuid: "top-2" }), qty: 1 },
        ],
      }),
    ).toBe("topping-limit-exceeded");
    expect(
      getOrderSelectionIssue({
        detail: detail(),
        mode: "normal",
        product: toppingLimitedProduct,
        quantity: 1,
        toppings: [{ topping: topping({ prodToppingUuid: "top-1" }), qty: 1 }],
      }),
    ).toBe(null);
    expect(() =>
      buildStaffOrderItems({
        detail: detail({ price: 0, proDetailSprice: 0 }),
        noteText: "",
        quantity: 1,
        toppings: [],
      }),
    ).toThrow("price-invalid");
  });

  it("limits tastes and includes them in the staff order payload", () => {
    const item = {
      ...normalizeProdItem(null, product()),
      prodTasteMaxSelect: 1,
      tastes: [taste(), taste({ tasteUuid: "taste-2" })],
    };
    expect(tasteSelectionLimit(item)).toBe(1);
    expect(toggleTasteUuid([], "taste-1", 1)).toEqual(["taste-1"]);
    expect(toggleTasteUuid(["taste-1"], "taste-2", 1)).toEqual(["taste-1"]);
    expect(selectedTastesFromUuids(item, ["taste-2"])).toEqual([
      taste({ tasteUuid: "taste-2" }),
    ]);
    expect(
      buildStaffOrderItems({
        detail: detail(),
        noteText: "",
        product: item,
        quantity: 1,
        tastes: [taste()],
        toppings: [],
      }),
    ).toMatchObject([
      { tastes: [{ taste_uuid_fk: "taste-1" }] },
    ]);
    expect(
      getOrderSelectionIssue({
        detail: detail(),
        mode: "normal",
        product: item,
        quantity: 1,
        tastes: [taste(), taste({ tasteUuid: "taste-2" })],
        toppings: [],
      }),
    ).toBe("taste-limit-exceeded");
  });

  it("tells the user the actual stock/step number instead of a generic message", () => {
    const t = (key: string, options?: Record<string, unknown>) =>
      options ? `${key}:${JSON.stringify(options)}` : key;

    const limitedStockRules = orderQuantityRules(
      detail({ cutStock: 1, qtyStock: 2 }),
      "normal",
    );
    expect(
      orderSelectionIssueLabel("quantity-exceeds-stock", t, limitedStockRules),
    ).toBe(`pos.insufficientStockMax:${JSON.stringify({ max: 2 })}`);
    expect(orderSelectionIssueLabel("quantity-exceeds-stock", t)).toBe(
      "pos.insufficientStock",
    );

    const promoRules = orderQuantityRules(
      detail({ proDetailCusQtyBuy: 3, proDetailCusQtyFree: 2 }),
      "promotion",
    );
    expect(
      orderSelectionIssueLabel("quantity-invalid", t, promoRules),
    ).toBe(`pos.editQuantityInvalidStep:${JSON.stringify({ step: 3 })}`);

    const normalRules = orderQuantityRules(detail(), "normal");
    expect(orderSelectionIssueLabel("quantity-invalid", t, normalRules)).toBe(
      "pos.invalidQuantity",
    );
    expect(orderSelectionIssueLabel("stock-insufficient", t)).toBe(
      "pos.outOfStock",
    );
    expect(orderSelectionIssueLabel("topping-limit-exceeded", t)).toBe(
      "pos.toppingLimitExceeded",
    );
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
      setInstanceUuid: "50000000-0000-4000-8000-000000000001",
      toppings: [{ topping: topping(), qty: 1 }],
    });

    expect(items).toHaveLength(2);
    expect(items).toEqual([
      {
        prod_detail_uuid_fk: "beer",
        set_instance_uuid: "50000000-0000-4000-8000-000000000001",
        set_choice_group_uuid_fks: [],
        order_it_qty: 6,
        order_it_status: 1,
        order_it_note: "cold",
        toppings: [{ prod_topping_uuid_fk: "top-1", topping_qty: 1 }],
      },
      {
        prod_detail_uuid_fk: "ice",
        set_instance_uuid: "50000000-0000-4000-8000-000000000001",
        set_choice_group_uuid_fks: [],
        order_it_qty: 6,
        order_it_status: 1,
        order_it_note: "cold",
      },
    ]);
  });

  it("assigns one SET instance UUID to every child without reusing another instance", () => {
    const setProduct: ProdItem = {
      ...normalizeProdItem(null, product({ statusSortFk: ProductSortStatus.SET })),
      prodSetPrice: 220000,
      details: [
        detail({ proDetailUuid: "set-child-1", price: 0, proDetailSprice: 0 }),
        detail({ proDetailUuid: "set-child-2", price: 0, proDetailSprice: 0 }),
      ],
    };
    const build = (setInstanceUuid: string) => buildStaffOrderItems({
      detail: setProduct.details[0],
      mode: "set",
      noteText: "",
      product: setProduct,
      quantity: 1,
      setInstanceUuid,
      toppings: [],
    });

    const first = build("50000000-0000-4000-8000-000000000001");
    const second = build("50000000-0000-4000-8000-000000000002");

    expect(new Set(first.map((item) => item.set_instance_uuid))).toEqual(
      new Set(["50000000-0000-4000-8000-000000000001"]),
    );
    expect(new Set(second.map((item) => item.set_instance_uuid))).toEqual(
      new Set(["50000000-0000-4000-8000-000000000002"]),
    );
  });

  it("keeps a set's ungrouped items always included and groups its choice alternatives", () => {
    const proteinGroup = choiceGroup({
      setChoiceGroupUuid: "grp-protein",
      groupName: "Choose protein",
      maxSelect: 1,
    });
    const dessertGroup = choiceGroup({
      setChoiceGroupUuid: "grp-dessert",
      groupName: "Choose desserts",
      maxSelect: 2,
    });
    const setProduct: ProdItem = {
      ...normalizeProdItem(null, product({ statusSortFk: ProductSortStatus.SET })),
      prodSetPrice: 220000,
      setChoiceGroups: [dessertGroup, proteinGroup],
      details: [
        detail({ proDetailUuid: "rice", price: 0, proDetailSprice: 0 }),
        detail({
          proDetailUuid: "chicken",
          price: 0,
          proDetailSprice: 0,
          setChoiceGroupUuidFks: ["grp-protein"],
        }),
        detail({
          proDetailUuid: "pork",
          price: 0,
          proDetailSprice: 0,
          setChoiceGroupUuidFks: ["grp-protein"],
        }),
        detail({
          proDetailUuid: "cake",
          price: 0,
          proDetailSprice: 0,
          setChoiceGroupUuidFks: ["grp-dessert"],
        }),
        detail({
          proDetailUuid: "icecream",
          price: 0,
          proDetailSprice: 0,
          setChoiceGroupUuidFks: ["grp-dessert"],
        }),
        detail({
          // อ้างกลุ่มที่ไม่มีอยู่จริง (เช่นถูกลบไปแล้ว) — ต้องกลับไปเป็นบังคับรวมเหมือนไม่มีกลุ่ม
          proDetailUuid: "soup",
          price: 0,
          proDetailSprice: 0,
          setChoiceGroupUuidFks: ["grp-deleted"],
        }),
      ],
    };

    const grouped = groupedSetDetails(setProduct);
    expect(grouped.ungrouped.map((d) => d.proDetailUuid)).toEqual(["rice", "soup"]);
    expect(grouped.groups.map((g) => setChoiceGroupUuid(g.group))).toEqual([
      "grp-dessert",
      "grp-protein",
    ]);
    expect(setChoiceGroupDisplayName(proteinGroup)).toBe("Choose protein");
    expect(setChoiceGroupMaxSelect(dessertGroup)).toBe(2);

    // เลือกหมู (ไม่ใช่ไก่) และขนมหวานแค่ 1 จาก 2 ที่เลือกได้ — ไม่บังคับให้เลือกครบ
    const resolved = resolveSetOrderDetails(setProduct, {
      "grp-protein": ["pork"],
      "grp-dessert": ["cake"],
    });
    expect(resolved.map((d) => d.proDetailUuid).sort()).toEqual(
      ["cake", "pork", "rice", "soup"].sort(),
    );

    // ไม่เลือกอะไรเลยในกลุ่มไหน — เหลือแค่รายการที่ไม่มีกลุ่ม
    expect(resolveSetOrderDetails(setProduct, {}).map((d) => d.proDetailUuid).sort()).toEqual(
      ["rice", "soup"].sort(),
    );

    const items = buildStaffOrderItems({
      detail: setProduct.details[0],
      mode: "set",
      noteText: "",
      product: setProduct,
      quantity: 1,
      selectedSetChoiceUuids: { "grp-protein": ["chicken"] },
      toppings: [],
    });
    expect(items.map((item) => item.prod_detail_uuid_fk).sort()).toEqual(
      ["chicken", "rice", "soup"].sort(),
    );
    expect(
      items.find((item) => item.prod_detail_uuid_fk === "chicken")
        ?.set_choice_group_uuid_fks,
    ).toEqual(["grp-protein"]);
    expect(
      items.find((item) => item.prod_detail_uuid_fk === "rice")
        ?.set_choice_group_uuid_fks,
    ).toEqual([]);
  });

  it("lets one item belong to more than one choice group and dedupes it in the resolved order", () => {
    const sauceGroup = choiceGroup({ setChoiceGroupUuid: "grp-sauce", maxSelect: 1 });
    const spiceGroup = choiceGroup({ setChoiceGroupUuid: "grp-spice", maxSelect: 1 });
    const setProduct: ProdItem = {
      ...normalizeProdItem(null, product({ statusSortFk: ProductSortStatus.SET })),
      prodSetPrice: 220000,
      setChoiceGroups: [sauceGroup, spiceGroup],
      details: [
        // ไก่ทอดชิ้นเดียวกัน เป็นตัวเลือกได้ทั้งกลุ่มน้ำจิ้มและกลุ่มระดับความเผ็ด
        detail({
          proDetailUuid: "fried-chicken",
          price: 0,
          proDetailSprice: 0,
          setChoiceGroupUuidFks: ["grp-sauce", "grp-spice"],
        }),
        detail({
          proDetailUuid: "fried-tofu",
          price: 0,
          proDetailSprice: 0,
          setChoiceGroupUuidFks: ["grp-sauce"],
        }),
      ],
    };

    const grouped = groupedSetDetails(setProduct);
    expect(grouped.groups.find((g) => setChoiceGroupUuid(g.group) === "grp-sauce")?.members
      .map((d) => d.proDetailUuid)).toEqual(["fried-chicken", "fried-tofu"]);
    expect(grouped.groups.find((g) => setChoiceGroupUuid(g.group) === "grp-spice")?.members
      .map((d) => d.proDetailUuid)).toEqual(["fried-chicken"]);

    // เลือก fried-chicken จากกลุ่มเดียว (grp-spice) แต่ไม่ได้เลือกจาก grp-sauce เลย —
    // ยังต้องได้แค่ 1 ชิ้นในผลลัพธ์สุดท้าย ไม่ใช่ 2 (ไม่ dedupe แล้วจะสั่งซ้ำ)
    expect(
      resolveSetOrderDetails(setProduct, { "grp-spice": ["fried-chicken"] }).map(
        (d) => d.proDetailUuid,
      ),
    ).toEqual(["fried-chicken"]);

    // เลือกจากทั้งสองกลุ่มพร้อมกัน — ยังต้อง dedupe เหลือชิ้นเดียว
    expect(
      resolveSetOrderDetails(setProduct, {
        "grp-sauce": ["fried-chicken"],
        "grp-spice": ["fried-chicken"],
      }).map((d) => d.proDetailUuid),
    ).toEqual(["fried-chicken"]);

    const items = buildStaffOrderItems({
      detail: setProduct.details[0],
      mode: "set",
      noteText: "",
      product: setProduct,
      quantity: 1,
      selectedSetChoiceUuids: {
        "grp-sauce": ["fried-chicken"],
        "grp-spice": ["fried-chicken"],
      },
      toppings: [],
    });
    expect(items).toHaveLength(1);
    expect(items[0]?.set_choice_group_uuid_fks).toEqual(["grp-sauce", "grp-spice"]);
  });

  it("attaches nested sauces to the selected SET option only", () => {
    const sauceMala = taste({ tasteUuid: "taste-mala", tasteName: "Mala" });
    const sauceSesame = taste({ tasteUuid: "taste-sesame", tasteName: "Sesame" });
    const setProduct: ProdItem = {
      ...normalizeProdItem(null, product({ statusSortFk: ProductSortStatus.SET })),
      prodSetPrice: 220000,
      setChoiceGroups: [choiceGroup({ setChoiceGroupUuid: "grp-dumpling" })],
      details: [
        detail({
          proDetailUuid: "chicken",
          price: 0,
          proDetailSprice: 0,
          setChoiceGroupUuidFks: ["grp-dumpling"],
          setTasteMaxSelect: 1,
          setTastes: [sauceMala, sauceSesame],
        }),
        detail({
          proDetailUuid: "pork",
          price: 0,
          proDetailSprice: 0,
          setChoiceGroupUuidFks: ["grp-dumpling"],
          setTasteMaxSelect: 1,
          setTastes: [sauceMala, sauceSesame],
        }),
      ],
    };

    const items = buildStaffOrderItems({
      detail: setProduct.details[0],
      mode: "set",
      noteText: "",
      product: setProduct,
      quantity: 1,
      selectedSetChoiceUuids: { "grp-dumpling": ["chicken"] },
      selectedSetChoiceTasteUuids: { chicken: ["taste-sesame"] },
      toppings: [],
    });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      prod_detail_uuid_fk: "chicken",
      tastes: [{ taste_uuid_fk: "taste-sesame" }],
    });
    expect(() => buildStaffOrderItems({
      detail: setProduct.details[0],
      mode: "set",
      noteText: "",
      product: setProduct,
      quantity: 1,
      selectedSetChoiceUuids: { "grp-dumpling": ["chicken"] },
      selectedSetChoiceTasteUuids: {
        chicken: ["taste-mala", "taste-sesame"],
      },
      toppings: [],
    })).toThrow("Invalid SET taste selection");
  });

  it("keeps multiple child option groups separate in the SET order payload", () => {
    const mala = taste({ tasteUuid: "taste-mala" });
    const sesame = taste({ tasteUuid: "taste-sesame" });
    const spicy = taste({ tasteUuid: "taste-spicy" });
    const setProduct: ProdItem = {
      ...normalizeProdItem(null, product({ statusSortFk: ProductSortStatus.SET })),
      prodSetPrice: 220000,
      setChoiceGroups: [choiceGroup({ setChoiceGroupUuid: "grp-main" })],
      details: [
        detail({
          proDetailUuid: "chicken",
          setChoiceGroupUuidFks: ["grp-main"],
          setOptionGroups: [
            {
              setDetailOptionGroupUuid: "group-sauce",
              groupName: "Sauce",
              maxSelect: 1,
              tastes: [mala, sesame],
            },
            {
              setDetailOptionGroupUuid: "group-spice",
              groupName: "Spice",
              maxSelect: 2,
              tastes: [mala, spicy],
            },
          ],
        }),
      ],
    };

    const items = buildStaffOrderItems({
      detail: setProduct.details[0],
      mode: "set",
      noteText: "",
      product: setProduct,
      quantity: 1,
      selectedSetChoiceUuids: { "grp-main": ["chicken"] },
      selectedSetChoiceTasteUuids: {
        "chicken:group-sauce": ["taste-sesame"],
        "chicken:group-spice": ["taste-mala", "taste-spicy"],
      },
      toppings: [],
    });

    expect(items[0]).toMatchObject({
      set_option_group_selections: [
        {
          set_detail_option_group_uuid_fk: "group-sauce",
          taste_uuid_fks: ["taste-sesame"],
        },
        {
          set_detail_option_group_uuid_fk: "group-spice",
          taste_uuid_fks: ["taste-mala", "taste-spicy"],
        },
      ],
      tastes: [
        { taste_uuid_fk: "taste-sesame" },
        { taste_uuid_fk: "taste-mala" },
        { taste_uuid_fk: "taste-spicy" },
      ],
    });
  });

  it("submits only the selected child option and enforces its parent limit", () => {
    const mala = taste({ tasteUuid: "taste-mala" });
    const sesame = taste({ tasteUuid: "taste-sesame" });
    const parentDetail = detail({
      proDetailUuid: "dumpling",
      setChildOptionMaxSelect: 1,
      setOptionGroups: [
        {
          setDetailOptionGroupUuid: "child-chicken",
          groupName: "Chicken",
          maxSelect: 1,
          tastes: [mala],
        },
        {
          setDetailOptionGroupUuid: "child-pork",
          groupName: "Pork",
          maxSelect: 1,
          tastes: [sesame],
        },
      ],
    });
    const setProduct: ProdItem = {
      ...normalizeProdItem(null, product({ statusSortFk: ProductSortStatus.SET })),
      prodSetPrice: 220000,
      details: [parentDetail],
    };

    const items = buildStaffOrderItems({
      detail: parentDetail,
      mode: "set",
      noteText: "",
      product: setProduct,
      quantity: 1,
      selectedSetChildOptionGroupUuids: {
        dumpling: ["child-chicken"],
      },
      selectedSetChoiceTasteUuids: {
        "dumpling:child-chicken": ["taste-mala"],
      },
      toppings: [],
    });

    expect(items[0]?.set_option_group_selections).toEqual([
      {
        set_detail_option_group_uuid_fk: "child-chicken",
        taste_uuid_fks: ["taste-mala"],
      },
    ]);
    expect(() => buildStaffOrderItems({
      detail: parentDetail,
      mode: "set",
      noteText: "",
      product: setProduct,
      quantity: 1,
      selectedSetChildOptionGroupUuids: {
        dumpling: ["child-chicken", "child-pork"],
      },
      toppings: [],
    })).toThrow("Invalid SET child option selection");
  });

  it("caps set choice selection at max_select without requiring it to be filled", () => {
    expect(toggleSetChoiceUuid([], "a", 1)).toEqual(["a"]);
    expect(toggleSetChoiceUuid(["a"], "a", 1)).toEqual([]);
    // ครบเพดานแล้ว เลือกตัวใหม่ต้องไม่ทำอะไร (ไม่ใช่แทนที่ตัวเดิม)
    expect(toggleSetChoiceUuid(["a"], "b", 1)).toEqual(["a"]);
    expect(toggleSetChoiceUuid(["a"], "b", 2)).toEqual(["a", "b"]);
    expect(setChildOptionSelectionLimit(detail({
      setChildOptionMaxSelect: 1,
      setOptionGroups: [
        { setDetailOptionGroupUuid: "a" },
        { setDetailOptionGroupUuid: "b" },
      ],
    }))).toBe(1);
    expect(toggleSetChildOptionGroupUuid(["a"], "b", 1)).toEqual(["a"]);
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
    expect(toppingQtyCap()).toBe(MAX_ORDER_QTY);
    expect(changeToppingQty({}, "top-1", 5)).toEqual({ "top-1": 5 });
    expect(toggleToppingQty({}, "top-1", 5)).toEqual({ "top-1": 5 });
    expect(
      countSelectedToppings([
        { topping: topping(), qty: 2 },
        { topping: topping({ prodToppingUuid: "top-2" }), qty: 1 },
      ]),
    ).toBe(3);
  });

  it("caps the number of distinct toppings selectable, not the quantity of any one topping", () => {
    // 0/ไม่ระบุ = ไม่จำกัด (เพดานตามธรรมชาติคือจำนวนท็อปปิ้งที่มีอยู่จริง)
    expect(toppingSelectionLimit(5, 0)).toBe(5);
    expect(toppingSelectionLimit(5, undefined)).toBe(5);
    // ตั้งเพดานไว้น้อยกว่าจำนวนท็อปปิ้งที่มี
    expect(toppingSelectionLimit(5, 2)).toBe(2);
    expect(toppingSelectionLimit(5, "2")).toBe(2);
    // ตั้งเพดานไว้มากกว่าจำนวนท็อปปิ้งที่มีจริง — ถูก clamp ด้วยจำนวนที่มีจริง
    expect(toppingSelectionLimit(2, 5)).toBe(2);

    expect(canSelectMoreToppings(1, 5, 2)).toBe(true);
    expect(canSelectMoreToppings(2, 5, 2)).toBe(false);
    expect(canSelectMoreToppings(3, 5, 2)).toBe(false);
    expect(canSelectMoreToppings(4, 5, 0)).toBe(true);
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
