import { describe, expect, it } from "vitest";
import {
  mergeBestSellingProductGroups,
  normalizeBestSellingProductsReportResponse
} from "@/stores/report-store/best-selling-normalizers";

describe("best selling products report normalizers", () => {
  it("normalizes nested data groups and items", () => {
    const normalized = normalizeBestSellingProductsReportResponse(
      {
        status: "success",
        message: "ok",
        data: [
          {
            branch_name: "Main",
            groups: [
              {
                group_uuid: "group-1",
                group_name: "Drinks",
                items: [
                  {
                    final_total: 120000,
                    prod_name: "Iced tea",
                    product_uuid: "product-1",
                    qty: 6,
                    rank: 1
                  }
                ]
              }
            ]
          }
        ],
        filters: { sort_by: "qty" },
        pagination: { limit: 20, page: 2, total: 21, totalPages: 3 },
        report: { summary: { final_total: 120000, qty: 6 } }
      },
      20,
      2
    );

    expect(normalized.summary).toMatchObject({ final_total: 120000, qty: 6 });
    expect(normalized.pagination).toMatchObject({ page: 2, total: 21, totalPages: 3 });
    expect(normalized.filters).toMatchObject({ sort_by: "qty" });
    expect(normalized.groups).toHaveLength(1);
    expect(normalized.groups[0]).toMatchObject({
      finalTotal: 120000,
      id: "group-1",
      name: "Drinks",
      productCount: 1,
      qtyTotal: 6
    });
    expect(normalized.rows[0]).toMatchObject({
      finalTotal: 120000,
      groupName: "Drinks",
      productName: "Iced tea",
      qty: 6,
      rank: 1
    });
  });

  it("keeps full financial details from the API response", () => {
    const normalized = normalizeBestSellingProductsReportResponse({
      status: "success",
      message: "success",
      report: {
        summary: {
          bill_discount_share: 0,
          charge: 57820,
          final_total: 972198,
          item_discount: 0,
          qty: 24,
          subtotal: 825996,
          vat: 88382
        }
      },
      data: [
        {
          groups: [
            {
              group_uuid_fk: "group-1",
              group_name: "Drinks",
              summary: {
                bill_discount_share: 0,
                charge: 51660.01,
                final_total: 868622,
                item_discount: 0,
                qty: 21,
                subtotal: 737996,
                vat: 78966
              },
              items: [
                {
                  bill_discount_share: 0,
                  cate_name: "Beer",
                  charge: 2799.76,
                  final_total: 47075.39,
                  item_discount: 0,
                  prod_code: "PRD-MPOUE39V",
                  product_name: "Product 5 - Medium",
                  qty: 6,
                  rank: 1,
                  sale_price: 6666,
                  subtotal: 39996,
                  vat: 4279.63
                }
              ]
            }
          ]
        }
      ],
      filters: { sort_by: "qty" },
      pagination: { limit: 10, page: 1, total: 12, totalPages: 2 }
    });

    expect(normalized.summary).toMatchObject({
      bill_discount_share: 0,
      charge: 57820,
      final_total: 972198,
      item_discount: 0,
      qty: 24,
      subtotal: 825996,
      vat: 88382
    });
    expect(normalized.groups[0]).toMatchObject({
      billDiscountShare: 0,
      charge: 51660.01,
      finalTotal: 868622,
      itemDiscount: 0,
      qtyTotal: 21,
      subtotal: 737996,
      vat: 78966
    });
    expect(normalized.rows[0]).toMatchObject({
      billDiscountShare: 0,
      categoryName: "Beer",
      charge: 2799.76,
      finalTotal: 47075.39,
      itemDiscount: 0,
      productCode: "PRD-MPOUE39V",
      salePrice: 6666,
      subtotal: 39996,
      vat: 4279.63
    });
  });

  it("falls back to calculated pagination when totalPages is missing", () => {
    const normalized = normalizeBestSellingProductsReportResponse(
      {
        status: "success",
        message: "ok",
        data: [
          {
            groups: [
              {
                group_name: "Food",
                items: [{ final_total: 50000, prod_name: "Noodle", qty_total: 2 }]
              }
            ]
          }
        ],
        pagination: { limit: 20, page: 1, total: 45 }
      },
      20,
      1
    );

    expect(normalized.pagination.totalPages).toBe(3);
  });

  it("handles missing or empty groups without throwing", () => {
    const empty = normalizeBestSellingProductsReportResponse(
      {
        status: "success",
        message: "ok",
        data: [{ groups: [{ group_uuid: "empty-group", group_name: "Empty", items: [] }] }]
      },
      20,
      1
    );
    const missing = normalizeBestSellingProductsReportResponse(
      { status: "success", message: "ok", data: [] },
      20,
      1
    );

    expect(empty.groups).toHaveLength(1);
    expect(empty.rows).toHaveLength(0);
    expect(missing.groups).toHaveLength(0);
    expect(missing.summary).toMatchObject({ final_total: 0, group_count: 0, product_count: 0, qty: 0 });
  });

  it("merges repeated groups for all-page exports", () => {
    const first = normalizeBestSellingProductsReportResponse({
      status: "success",
      message: "ok",
      data: [{ groups: [{ group_uuid: "g1", group_name: "Drinks", items: [{ prod_name: "Tea", qty: 1, final_total: 10, rank: 1 }] }] }]
    });
    const second = normalizeBestSellingProductsReportResponse({
      status: "success",
      message: "ok",
      data: [{ groups: [{ group_uuid: "g1", group_name: "Drinks", items: [{ prod_name: "Coffee", qty: 2, final_total: 20, rank: 2 }] }] }]
    });

    const merged = mergeBestSellingProductGroups([...first.groups, ...second.groups]);

    expect(merged).toHaveLength(1);
    expect(merged[0].items.map((item) => item.productName)).toEqual(["Tea", "Coffee"]);
    expect(merged[0]).toMatchObject({ finalTotal: 30, qtyTotal: 3 });
  });
});
