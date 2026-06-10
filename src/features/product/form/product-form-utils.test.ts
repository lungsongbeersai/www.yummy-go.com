import { describe, expect, it } from "vitest";
import type { Product } from "@/services/product";
import {
  TOPPING_HAS,
  TOPPING_NONE,
  binaryFlag,
  buildDetailPayload,
  buildSaveProductPayload,
  detailFromProduct,
  detailStockSummary,
  emptyDetail,
  filterSizeOptionsByText,
  findSizeUuidByName,
  findToppingUuidByName,
  mergeProductFormToppingPrices,
  parseProductFormDefaults,
  isHexColor,
  productFormDefaultsForOptions,
  productFormDefaultsStorageKey,
  productFormToppingDefaultPrice,
  normalizeDetailsForStatus,
  productColorValue,
  productFormSizeOptions,
  productHasToppings,
  productHydrationKey,
  productImageStatus,
  rawProductImage,
  requiredFieldErrors,
} from "./product-form-utils";
import type { DetailRow } from "./product-form-types";

const t = (key: string) => key;

function detail(overrides: Partial<DetailRow> = {}): DetailRow {
  return {
    ...emptyDetail("1"),
    id: "row-1",
    size_uuid_fk: "size-1",
    pro_detail_bprice: "10000",
    pro_detail_sprice: "12000",
    ...overrides,
  };
}

describe("product form image and hydration helpers", () => {
  it("normalizes image filenames, color mode, and binary flags", () => {
    expect(
      rawProductImage({
        prod_image: "https://cdn.example.com/upload/products/noodle.png",
      }),
    ).toBe("noodle.png");
    expect(productImageStatus({ prod_image: "#10b981" })).toBe("2");
    expect(productColorValue({ prod_image_raw: "#ffffff" })).toBe("#ffffff");
    expect(binaryFlag(1)).toBe("1");
    expect(binaryFlag("bad", "1")).toBe("2");
    expect(isHexColor("#10b981")).toBe(true);
    expect(isHexColor("10b981")).toBe(false);
  });

  it("builds a stable hydration key from product fields, details, and toppings", () => {
    const product: Product = {
      prod_uuid: "prod-1",
      prod_code: "P-1",
      prod_name_la: "ເຝີ",
      cate_uuid_fk: "cate-1",
      unite_uuid_fk: "unit-1",
      details: [
        {
          pro_detail_uuid: "detail-1",
          size_uuid_fk: "size-1",
          pro_detail_bprice: 100,
          pro_detail_sprice: 120,
        },
      ],
      toppings: [{ topping_uuid_fk: "top-1", topping_price: 5 }],
    };

    expect(productHydrationKey(product)).toContain("prod-1");
    expect(productHydrationKey(product)).toContain("detail-1:size-1");
    expect(productHasToppings(product)).toBe(true);
  });
});

describe("product form saved defaults helpers", () => {
  it("builds storage keys per store and parses saved defaults safely", () => {
    expect(productFormDefaultsStorageKey("store-1")).toBe(
      "yummy-go-product-form-defaults:store-1",
    );

    expect(parseProductFormDefaults("bad json")).toEqual({
      cateUuidFk: "",
      uniteUuidFk: "",
      toppingPrices: {},
    });

    expect(
      parseProductFormDefaults(
        JSON.stringify({
          cateUuidFk: " cate-1 ",
          uniteUuidFk: "unit-1",
          toppingPrices: {
            " top-1 ": 15,
            "top-2": "",
            "": "10",
          },
        }),
      ),
    ).toEqual({
      cateUuidFk: "cate-1",
      uniteUuidFk: "unit-1",
      toppingPrices: {
        "top-1": "15",
        "top-2": "0",
      },
    });
  });

  it("uses saved category and unit only when options still exist", () => {
    const defaults = {
      cateUuidFk: "missing-cate",
      uniteUuidFk: "unit-1",
      toppingPrices: {},
    };

    expect(
      productFormDefaultsForOptions(
        defaults,
        [{ cate_uuid: "cate-1" }],
        [{ unite_uuid: "unit-1" }],
      ),
    ).toEqual({
      cateUuidFk: "",
      uniteUuidFk: "unit-1",
      toppingPrices: {},
    });
  });

  it("normalizes topping price defaults and keeps the latest selected prices", () => {
    expect(
      productFormToppingDefaultPrice(
        { toppingPrices: { "top-1": "12" } },
        "top-1",
      ),
    ).toBe("12");
    expect(
      productFormToppingDefaultPrice(
        { toppingPrices: { "top-1": "" } },
        "top-1",
      ),
    ).toBe("0");

    expect(
      mergeProductFormToppingPrices(
        { "top-1": "5", "top-2": "8" },
        [
          { topping_uuid_fk: "top-1", topping_price: "9" },
          { topping_uuid_fk: "top-3", topping_price: "" },
        ],
      ),
    ).toEqual({
      "top-1": "9",
      "top-2": "8",
      "top-3": "0",
    });
  });
});

describe("product form detail helpers", () => {
  it("hydrates detail rows and resets promotion fields when leaving promotion", () => {
    const row = detailFromProduct(
      {
        pro_detail_uuid: "detail-1",
        size_uuid_fk: "size-1",
        pro_detail_bprice: 100,
        pro_detail_sprice: 120,
        pro_detail_sDate: "2026-05-29T00:00:00.000Z",
        pro_detail_sTime: "09:30:00",
      },
      "3",
    );

    expect(row.pro_detail_sDate).toBe("2026-05-29");
    expect(row.pro_detail_sTime).toBe("09:30");

    const normalized = normalizeDetailsForStatus([row], "1", "3");
    expect(normalized[0]?.pro_detail_status).toBe("2");
    expect(normalized[0]?.pro_detail_sDate).toBe("");
  });

  it("builds detail payloads by product type and summarizes stock mode", () => {
    expect(buildDetailPayload(detail(), "1")).toMatchObject({
      size_uuid_fk: "size-1",
      pro_detail_sprice: 12000,
    });
    expect(buildDetailPayload(detail(), "2")).toMatchObject({
      pro_detail_status: 2,
    });
    expect(buildDetailPayload(detail(), "2")).not.toHaveProperty(
      "pro_detail_sprice",
    );
    expect(
      buildDetailPayload(
        detail({
          pro_detail_status: "2",
          pro_detail_cus_qtyBuy: "2",
          pro_detail_cus_qtyFree: "1",
          pro_detail_sDate: "2026-05-01",
          pro_detail_eDate: "2026-05-31",
          pro_detail_sTime: "10:00",
          pro_detail_eTime: "12:00",
        }),
        "3",
      ),
    ).toMatchObject({
      pro_detail_cus_qtyBuy: 2,
      pro_detail_cus_qtyFree: 1,
      pro_detail_sTime: "10:00",
    });

    expect(detailStockSummary([detail({ pro_detail_stock: "1" })])).toBe(
      "deduct",
    );
    expect(detailStockSummary([detail({ pro_detail_stock: "2" })])).toBe(
      "noDeduct",
    );
    expect(
      detailStockSummary([
        detail({ pro_detail_stock: "1" }),
        detail({ pro_detail_stock: "2" }),
      ]),
    ).toBe("mixed");
  });

  it("clears previous size selections when switching to food set", () => {
    const normalized = normalizeDetailsForStatus(
      [detail({ size_uuid_fk: "regular-size" })],
      "2",
      "1",
    );

    expect(normalized[0]?.size_uuid_fk).toBe("");
    expect(
      normalizeDetailsForStatus(
        [detail({ size_uuid_fk: "set-option" })],
        "2",
        "2",
      )[0]?.size_uuid_fk,
    ).toBe("set-option");
  });

  it("does not show status 1 sizes for food set detail options", () => {
    const statusOneSize = {
      size_uuid: "regular-size",
      size_name_la: "Regular",
      size_name_eng: "Regular",
    };
    const statusTwoSize = {
      size_uuid: "set-option",
      size_name_la: "Set A",
      size_name_eng: "Set A",
    };
    const base = {
      statusSortFk: "2" as const,
      sizes: [statusOneSize],
      details: [detail({ size_uuid_fk: "" })],
    };

    expect(
      productFormSizeOptions({
        ...base,
        sizesByStatus: [],
        sizesByStatusStatus: null,
      }),
    ).toEqual([]);
    expect(
      productFormSizeOptions({
        ...base,
        sizesByStatus: [statusOneSize],
        sizesByStatusStatus: 1,
      }),
    ).toEqual([]);
    expect(
      productFormSizeOptions({
        ...base,
        sizesByStatus: [statusTwoSize],
        sizesByStatusStatus: 2,
      }),
    ).toEqual([statusTwoSize]);
  });
});

describe("product form validation and payload helpers", () => {
  it("returns required field errors using translation keys", () => {
    expect(
      requiredFieldErrors(
        {
          prodNameLa: "",
          cateUuidFk: "",
          uniteUuidFk: "",
          details: [detail({ size_uuid_fk: "", pro_detail_bprice: "" })],
          statusSortFk: "1",
          prodToppingStatus: TOPPING_HAS,
          selectedToppings: [],
        },
        t,
      ),
    ).toEqual([
      "fields.prod_name",
      "nav.category",
      "nav.unit",
      "fields.size",
      "fields.bprice",
      "product.sections.toppings",
    ]);
  });

  it("uses the product label for missing food set detail options", () => {
    expect(
      requiredFieldErrors(
        {
          prodNameLa: "Set",
          cateUuidFk: "cate-1",
          uniteUuidFk: "unit-1",
          details: [detail({ size_uuid_fk: "" })],
          statusSortFk: "2",
          prodToppingStatus: TOPPING_NONE,
          selectedToppings: [],
        },
        t,
      ),
    ).toEqual(["pos.product"]);
  });

  it("builds the save product API payload without changing the contract", () => {
    const payload = buildSaveProductPayload({
      branchUuid: "branch-1",
      prodCode: "P-1",
      prodNameLa: "ເຝີ",
      prodNameEng: "",
      cateUuidFk: "cate-1",
      uniteUuidFk: "unit-1",
      prodOrderPoint: "5",
      prodNotification: "2",
      statusSortFk: "1",
      prodSetPrice: "0",
      prodStatusImge: "2",
      prodImage: "#10b981",
      details: [detail()],
      prodToppingStatus: TOPPING_NONE,
      selectedToppings: [{ topping_uuid_fk: "top-1", topping_price: "5" }],
    });

    expect(payload).toMatchObject({
      branch_uuid_fk: "branch-1",
      prod_name_eng: "ເຝີ",
      prod_status_imge: 2,
      prod_topping_status: 1,
      toppings: [],
    });
    expect(payload.details?.[0]).toMatchObject({ pro_detail_sprice: 12000 });
  });

  it("strips formatted numeric strings before building product payloads", () => {
    expect(
      buildDetailPayload(
        detail({
          pro_detail_bprice: "1,000",
          pro_detail_sprice: "2,500",
          pro_detail_qty_stock: "10,000",
          pro_detail_cus_qtyBuy: "1,200",
          pro_detail_cus_qtyFree: "300",
        }),
        "3",
      ),
    ).toMatchObject({
      pro_detail_bprice: 1000,
      pro_detail_sprice: 2500,
      pro_detail_qty_stock: 10000,
      pro_detail_cus_qtyBuy: 1200,
      pro_detail_cus_qtyFree: 300,
    });

    const payload = buildSaveProductPayload({
      branchUuid: "branch-1",
      prodCode: "P-1",
      prodNameLa: "Set",
      prodNameEng: "",
      cateUuidFk: "cate-1",
      uniteUuidFk: "unit-1",
      prodOrderPoint: "5",
      prodNotification: "2",
      statusSortFk: "2",
      prodSetPrice: "99,000",
      prodStatusImge: "2",
      prodImage: "#10b981",
      details: [detail({ pro_detail_bprice: "10,000" })],
      prodToppingStatus: TOPPING_HAS,
      selectedToppings: [{ topping_uuid_fk: "top-1", topping_price: "5,500" }],
    });

    expect(payload.prod_set_price).toBe(99000);
    expect(payload.toppings?.[0]?.topping_price).toBe(5500);
    expect(payload.details?.[0]?.pro_detail_bprice).toBe(10000);
  });

  it("matches saved toppings by localized names", () => {
    expect(
      findToppingUuidByName(
        [
          {
            topping_uuid: "top-1",
            topping_name_la: "ໄຂ່",
            topping_name_eng: "Egg",
          },
        ],
        "",
        "egg",
      ),
    ).toBe("top-1");
  });

  it("matches saved set product options by localized size names", () => {
    expect(
      findSizeUuidByName(
        [
          { size_uuid: "size-1", size_name_la: "ຊຸດ A", size_name_eng: "Set A" },
          { size_uuid: "size-2", size_name_la: "ຊຸດ B", size_name_eng: "Set B" },
        ],
        "ຊຸດ B",
        ""
      )
    ).toBe("size-2");
  });

  it("filters set product options by localized size names", () => {
    expect(
      filterSizeOptionsByText(
        [
          { size_uuid: "size-1", size_name_la: "ຊຸດ A", size_name_eng: "Set A" },
          { size_uuid: "size-2", size_name_la: "ຊຸດ B", size_name_eng: "Set B" },
        ],
        "set b"
      )
    ).toEqual([{ size_uuid: "size-2", size_name_la: "ຊຸດ B", size_name_eng: "Set B" }]);
  });
});
