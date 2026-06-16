import { describe, expect, it } from "vitest";
import type { CategorySalesReportResponse } from "@/services/report";
import { normalizeCategorySalesReportResponse } from "./category-sales-normalizers";

const response: CategorySalesReportResponse = {
  status: "success",
  report_key: "category_sales",
  report_name: "Sales report by category",
  lang: "la",
  page: 1,
  limit: 10,
  total: 4,
  totalPages: 1,
  date_from: "2026-05-01",
  date_to: "2026-06-28",
  branch_uuid_fk: "branch-1",
  payment_method: "all",
  search: "",
  orderBy: "DESC",
  data: [
    {
      sort_order: 1,
      group_uuid_fk: "group-drinks",
      group_name: "Drinks",
      details: [
        {
          sort_order: 1,
          rank: 1,
          cate_uuid: "beer",
          cate_name: "Beer",
          category_bill_count: 36,
          items_count: 135,
          qty_total: 287,
          amount: 17430000,
          topping_total: 55000,
          item_discount: 181760,
          discount_bill: 393419.54,
          discount_total: 575179.54,
          service_charge: 1176968.08,
          vat: 1803179.78,
          total: 19834968.32,
          sale_percent: 87.73
        }
      ],
      summary: {
        categories_count: 1,
        category_bill_count: 36,
        items_count: 135,
        qty_total: 287,
        amount: 17430000,
        topping_total: 55000,
        item_discount: 181760,
        discount_bill: 393419.54,
        discount_total: 575179.54,
        service_charge: 1176968.08,
        vat: 1803179.78,
        total: 19834968.32
      }
    },
    {
      sort_order: 2,
      group_uuid_fk: null,
      group_name: "No group",
      details: [
        {
          sort_order: 2,
          rank: 2,
          cate_uuid: null,
          cate_name: "No category",
          category_bill_count: 7,
          items_count: 8,
          qty_total: 17,
          amount: 1034066,
          topping_total: 174000,
          item_discount: 32500,
          discount_bill: 61599.99,
          discount_total: 94099.99,
          service_charge: 65797.73,
          vat: 100576.43,
          total: 1106340.18,
          sale_percent: 4.89
        }
      ],
      summary: {
        categories_count: 1,
        category_bill_count: 7,
        items_count: 8,
        qty_total: 17,
        amount: 1034066,
        topping_total: 174000,
        item_discount: 32500,
        discount_bill: 61599.99,
        discount_total: 94099.99,
        service_charge: 65797.73,
        vat: 100576.43,
        total: 1106340.18
      }
    }
  ]
};

describe("normalizeCategorySalesReportResponse", () => {
  it("keeps grouped category rows and derives summary from API group summaries", () => {
    const normalized = normalizeCategorySalesReportResponse(response, 10, 1);

    expect(normalized.reportName).toBe("Sales report by category");
    expect(normalized.filters).toMatchObject({
      branch_uuid_fk: "branch-1",
      date_from: "2026-05-01",
      date_to: "2026-06-28",
      orderBy: "DESC",
      payment_method: "all"
    });
    expect(normalized.groups).toHaveLength(2);
    expect(normalized.rows.map((row) => row.rank)).toEqual([1, 2]);
    expect(normalized.rows[0]).toMatchObject({
      amount: 17430000,
      billCount: 36,
      cateName: "Beer",
      groupName: "Drinks",
      salePercent: 87.73,
      total: 19834968.32
    });
    expect(normalized.summary).toMatchObject({
      categories_count: 2,
      category_bill_count: 43,
      qty_total: 304,
      total: 20941308.5
    });
    expect(normalized.pagination).toEqual({ limit: 10, page: 1, total: 4, totalPages: 1 });
  });
});
