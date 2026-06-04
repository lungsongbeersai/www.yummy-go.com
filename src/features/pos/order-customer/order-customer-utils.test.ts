import { describe, expect, it } from "vitest";
import {
  buildStaffOrderItems,
  buildStaffOrderInput,
  canDirectAddFromList,
  defaultOrderQty,
  firstStatusWithProducts,
  flattenProducts,
  getProductActionState,
  getProductBlockedState,
  getProductModalMode,
  nextMenuCategoryUuid,
  normalizeProdItem,
  orderCustomerUrl,
  productNeedsModal,
  selectedOrderTable,
  selectedToppingsFromUuids,
  toggleToppingUuid,
} from "@/features/pos/order-customer/order-customer-utils";
import {
  OrderChannelEnum,
  OrderSourceEnum,
  ProductSortStatus,
  TableStatus,
  type CateProductItem,
  type ProdDetail,
  type ProdItem,
  type ProdTopping,
} from "@/services/pos";

function product(overrides: Partial<CateProductItem> = {}): CateProductItem {
  return {
    cate_uuid_fk: "cate-1",
    prod_uuid: "prod-1",
    prod_name: "Noodle",
    prod_price: 12000,
    pro_detail_uuid: "detail-1",
    pro_detail_sprice: 12000,
    count_option_enabled: 1,
    count_option_all: 1,
    count_topping_enabled: 0,
    can_add: true,
    has_options: false,
    options_msg: "",
    prod_image: "",
    prod_status_imge: 1,
    status_sort_fk: ProductSortStatus.NORMAL,
    ...overrides,
  };
}

function detail(overrides: Partial<ProdDetail> = {}): ProdDetail {
  return {
    pro_detail_uuid: "detail-1",
    price: 12000,
    pro_detail_sprice: 12000,
    pro_detail_enabled: 1,
    cut_stock: 2,
    ...overrides,
  };
}

function topping(overrides: Partial<ProdTopping> = {}): ProdTopping {
  return {
    prod_topping_uuid: "top-1",
    topping_name: "Egg",
    topping_price: 2000,
    topping_enabled: 1,
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
      "/sale/order-customer?table_uuid=table+1&table_name=A%26B",
    );
  });

  it("flattens category products and picks first sort with products", () => {
    const menu = {
      [ProductSortStatus.NORMAL]: [],
      [ProductSortStatus.SET]: [
        { cate_uuid: "set-cate", cate_name: "Set", products: [product()] },
      ],
      [ProductSortStatus.PROMOTION]: [],
    };

    expect(flattenProducts(menu[ProductSortStatus.SET])).toEqual([
      {
        cateUuid: "set-cate",
        product: expect.objectContaining({ prod_uuid: "prod-1" }),
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
        categories: [{ cate_uuid: "first", cate_name: "First", products: [] }],
      }),
    ).toBe("requested");

    expect(
      nextMenuCategoryUuid({
        requestedCateUuid: "",
        selectedCateUuid: "",
        defaultCateUuid: "",
        categories: [{ cate_uuid: "first", cate_name: "First", products: [] }],
      }),
    ).toBe("first");
  });

  it("detects blocked, modal, and direct-add product states", () => {
    expect(
      getProductBlockedState(
        product({ stock_sold_out: true }),
        ProductSortStatus.NORMAL,
      ),
    ).toBe("sold-out");
    expect(
      getProductActionState(
        product({ has_options: true }),
        ProductSortStatus.NORMAL,
      ),
    ).toBe("choose");
    expect(canDirectAddFromList(product(), ProductSortStatus.NORMAL)).toBe(
      true,
    );
    expect(
      canDirectAddFromList(
        product({ status_sort_fk: ProductSortStatus.SET }),
        ProductSortStatus.SET,
      ),
    ).toBe(false);
  });

  it("normalizes product item fallback details and modal mode", () => {
    const normalized = normalizeProdItem(null, product());
    expect(normalized.details?.[0]?.pro_detail_uuid).toBe("detail-1");
    expect(getProductModalMode(ProductSortStatus.PROMOTION, normalized)).toBe(
      "promotion",
    );
    expect(
      productNeedsModal(product(), normalized, ProductSortStatus.NORMAL),
    ).toBe(false);

    const optionItem: ProdItem = {
      ...normalized,
      details: [detail(), detail({ pro_detail_uuid: "detail-2" })],
    };
    expect(
      productNeedsModal(product(), optionItem, ProductSortStatus.NORMAL),
    ).toBe(true);
  });

  it("normalizes default quantity and builds staff order payload", () => {
    const input = buildStaffOrderInput({
      branchUuid: "branch-1",
      detail: detail({ pro_detail_cus_qtyBuy: 2 }),
      lang: "lo",
      noteText: " less spicy ",
      quantity: defaultOrderQty(detail({ pro_detail_cus_qtyBuy: 2 })),
      tableUuid: "table-1",
      toppings: [topping()],
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

  it("builds staff set order items from every available product detail", () => {
    const setProduct: ProdItem = {
      ...normalizeProdItem(null, product({ status_sort_fk: ProductSortStatus.SET })),
      prod_set_price: 220000,
      type_group: "Set",
      details: [
        detail({ pro_detail_uuid: "beer", price: 0, pro_detail_sprice: 0 }),
        detail({
          pro_detail_uuid: "ice",
          default_qty: 2,
          price: 0,
          pro_detail_sprice: 0,
        }),
        detail({
          pro_detail_uuid: "disabled",
          pro_detail_enabled: 2,
          price: 0,
          pro_detail_sprice: 0,
        }),
      ],
    };

    const items = buildStaffOrderItems({
      detail: setProduct.details[0],
      mode: "set",
      noteText: " cold ",
      product: setProduct,
      quantity: 3,
      toppings: [topping()],
    });

    expect(items).toHaveLength(2);
    expect(items).toEqual([
      {
        prod_detail_uuid_fk: "beer",
        order_it_qty: 3,
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
        topping({ prod_topping_uuid: "top-1" }),
        topping({ prod_topping_uuid: "top-2", topping_name: "Cheese" }),
      ],
    };

    expect(
      selectedToppingsFromUuids(productItem, ["top-2"]).map(
        (item) => item.topping_name,
      ),
    ).toEqual(["Cheese"]);
    expect(toggleToppingUuid(["top-1"], "top-2")).toEqual(["top-1", "top-2"]);
    expect(toggleToppingUuid(["top-1", "top-2"], "top-1")).toEqual(["top-2"]);
  });
});
