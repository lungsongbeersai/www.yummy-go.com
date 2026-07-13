import { describe, expect, it } from "vitest";
import type { CategorySalesReportResponse } from "@/services/report";
import {
  normalizeCategorySalesReportResponse,
  reindexCategorySalesGroups,
} from "./category-sales-normalizers";

const response: CategorySalesReportResponse = {
  status: "success",
  message: "success",
  lang: "la",
  page: 1,
  limit: 20,
  total: 100,
  totalPages: 5,
  filters: {
    search: "",
    date_from: "2026-06-01",
    date_to: "2026-06-29",
    payment_method: null,
    payment_method_name: "All",
    sortBy: "grouped_items",
    orderBy: "DESC"
  },
  summary: {
    product_count: 100,
    bill_count: 61,
    total_qty: 433,
    product_price_total: 29627726,
    topping_total: 371000,
    total: 29998726,
    discount_item_amount: 421460,
    after_discount_item: 29577266,
    discount_bill: 1843556,
    after_discount_bill: 27777371.62,
    sum_servicecharge: 2151676,
    sum_vate: 3092041,
    grand_total: 33021088.62
  },
  groups: [
      {
        group_uuid: null,
        group_name: "No group",
        categories: [
          {
            cate_uuid: null,
            cate_name: "No category",
            summary: {
              product_count: 1,
              total_qty: 1,
              product_price_total: 55000,
              topping_total: 16000,
              total: 71000,
              discount_item_amount: 0,
              after_discount_item: 71000,
              discount_bill: 4961.73,
              after_discount_bill: 66038.27,
              sum_servicecharge: 4614.43,
              sum_vate: 7053.48,
              grand_total: 77706.19
            },
            items: [
              {
                prod_uuid: null,
                product_full_name: "Unknown item",
                bill_count: 1,
                total_qty: 1,
                product_price_total: 55000,
                topping_total: 16000,
                total: 71000,
                discount_item_amount: 0,
                after_discount_item: 71000,
                discount_bill: 4961.73,
                after_discount_bill: 66038.27,
                service_rate: 7,
                sum_servicecharge: 4614.43,
                vat_rate: 10,
                sum_vate: 7053.48,
                grand_total: 77706.19
              }
            ]
          }
        ]
      },
      {
        group_uuid: "group-drinks",
        group_name: "Drinks",
        categories: [
          {
            cate_uuid: "beer",
            cate_name: "Beer",
            summary: {
              product_count: 2,
              total_qty: 7,
              product_price_total: 160000,
              topping_total: 10000,
              total: 170000,
              discount_item_amount: 15000,
              after_discount_item: 155000,
              discount_bill: 0,
              after_discount_bill: 155000,
              sum_servicecharge: 10850,
              sum_vate: 16585,
              grand_total: 182435
            },
            items: [
              {
                prod_uuid: "prod-1",
                product_full_name: "Tiger Beer",
                bill_count: 2,
                total_qty: 3,
                product_price_total: 90000,
                topping_total: 10000,
                total: 100000,
                discount_item_amount: 5000,
                after_discount_item: 95000,
                discount_bill: 0,
                after_discount_bill: 95000,
                service_rate: 7,
                sum_servicecharge: 6650,
                vat_rate: 10,
                sum_vate: 10165,
                grand_total: 111815
              },
              {
                prod_uuid: "prod-2",
                product_full_name: "Lao Beer",
                bill_count: 2,
                total_qty: 4,
                product_price_total: 70000,
                topping_total: 0,
                total: 70000,
                discount_item_amount: 10000,
                after_discount_item: 60000,
                discount_bill: 0,
                after_discount_bill: 60000,
                service_rate: 7,
                sum_servicecharge: 4200,
                vat_rate: 10,
                sum_vate: 6420,
                grand_total: 70620
              }
            ]
          }
        ]
      }
  ]
};

describe("normalizeCategorySalesReportResponse", () => {
  it("normalizes group_list product rows and keeps backend summary", () => {
    const normalized = normalizeCategorySalesReportResponse(response, 4, 1);

    expect(normalized.filters).toMatchObject({
      date_from: "2026-06-01",
      date_to: "2026-06-29",
      payment_method: null
    });
    expect(normalized.groups).toHaveLength(2);
    expect(normalized.groups[1]).toMatchObject({
      groupName: "Drinks",
      categories: [
        expect.objectContaining({
          cateName: "Beer",
          rows: expect.any(Array)
        })
      ]
    });
    expect(normalized.rows.map((row) => row.productName)).toEqual([
      "Unknown item",
      "Tiger Beer",
      "Lao Beer"
    ]);
    expect(normalized.rows[1]).toMatchObject({
      billCount: 2,
      cateName: "Beer",
      grandTotal: 111815,
      groupName: "Drinks",
      productName: "Tiger Beer",
      productPriceTotal: 90000,
      totalQty: 3
    });
    expect(normalized.groups[1]?.summary.bill_count).toBe(4);
    expect(normalized.groups[1]?.categories[0]?.summary.bill_count).toBe(4);
    expect(normalized.summary).toEqual(response.summary);
    expect(normalized.pagination).toEqual({ limit: 20, page: 1, total: 100, totalPages: 5 });
  });

  it("uses group count when backend pagination is group-based", () => {
    const normalized = normalizeCategorySalesReportResponse(
      {
        ...response,
        limit: 50,
        total: 127,
        totalPages: 1,
      },
      50,
      1,
    );

    expect(normalized.rows).toHaveLength(3);
    expect(normalized.pagination).toEqual({
      limit: 50,
      page: 1,
      total: 2,
      totalPages: 1,
    });
  });

  it("prefers explicit group totals and keeps ranks unique across pages", () => {
    const normalized = normalizeCategorySalesReportResponse(
      {
        ...response,
        group_total: 21,
        limit: 20,
        total: 127,
        totalPages: 2,
      },
      20,
      1,
    );
    const groups = reindexCategorySalesGroups([
      ...normalized.groups,
      ...normalized.groups,
    ]);

    expect(normalized.pagination.total).toBe(21);
    expect(groups.flatMap((group) => group.rows).map((row) => row.rank)).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
  });
});
