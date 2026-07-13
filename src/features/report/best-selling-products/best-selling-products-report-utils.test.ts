import { describe, expect, it } from "vitest";
import {
  BEST_SELLING_PRODUCTS_SORT_OPTIONS,
  isBestSellingProductsSortBy
} from "@/config/report-filters";
import {
  bestSellingGroupedSection,
  bestSellingGroupMetricConfigs,
  bestSellingFileBaseName,
  bestSellingProductMetricConfigs,
  bestSellingSummaryConfigs,
  bestSellingSortLabel,
  bestSellingSortOptions,
  exportSummaryRows,
  groupParam
} from "./best-selling-products-report-utils";
import type { BestSellingProductsFilters } from "./best-selling-products-report-types";
import type { BestSellingProductGroup, BestSellingProductItem } from "@/stores/report-store";

const t = (key: string) => key;

describe("best selling products report sort helpers", () => {
  it("keeps the API sort options in one contract", () => {
    expect(BEST_SELLING_PRODUCTS_SORT_OPTIONS).toEqual([
      "qty",
      "total",
      "date_asc",
      "date_desc"
    ]);
  });

  it("validates all supported sort_by values", () => {
    expect(isBestSellingProductsSortBy("qty")).toBe(true);
    expect(isBestSellingProductsSortBy("total")).toBe(true);
    expect(isBestSellingProductsSortBy("date_asc")).toBe(true);
    expect(isBestSellingProductsSortBy("date_desc")).toBe(true);
    expect(isBestSellingProductsSortBy("date")).toBe(false);
    expect(isBestSellingProductsSortBy("ASC")).toBe(false);
  });

  it("builds labels from the sort_by value", () => {
    expect(bestSellingSortLabel("date_asc", t)).toBe("report.bestSelling.sortOptions.date_asc");
    expect(bestSellingSortOptions(t)).toEqual([
      { label: "report.bestSelling.sortOptions.qty", value: "qty" },
      { label: "report.bestSelling.sortOptions.total", value: "total" },
      { label: "report.bestSelling.sortOptions.date_asc", value: "date_asc" },
      { label: "report.bestSelling.sortOptions.date_desc", value: "date_desc" }
    ]);
  });

  it("keeps all group filter because the API expects group_uuid_fk=all", () => {
    expect(groupParam("all")).toBe("all");
    expect(groupParam("group-1")).toBe("group-1");
    expect(groupParam("")).toBe("all");
  });

  it("uses date sort values in export filenames", () => {
    const filters: BestSellingProductsFilters = {
      branchUuid: "branch-1",
      dateFrom: "2026-01-01",
      dateTo: "2026-06-02",
      groupUuid: "all",
      limit: 20,
      sortBy: "date_desc"
    };

    expect(bestSellingFileBaseName(filters)).toBe(
      "best-selling-products-date_desc-2026-01-01-to-2026-06-02"
    );
  });

  it("defines the full API metric set for summary, groups, and products", () => {
    expect(bestSellingSummaryConfigs(t).map((metric) => metric.keys[0])).toEqual([
      "qty",
      "subtotal",
      "item_discount",
      "bill_discount_share",
      "charge",
      "vat",
      "final_total"
    ]);
    expect(bestSellingGroupMetricConfigs(t).map((metric) => metric.key)).toEqual([
      "qty",
      "subtotal",
      "item_discount",
      "bill_discount_share",
      "charge",
      "vat",
      "final_total"
    ]);
    expect(bestSellingProductMetricConfigs(t).map((metric) => metric.key)).toEqual([
      "sale_price",
      "qty",
      "subtotal",
      "item_discount",
      "bill_discount_share",
      "charge",
      "vat",
      "final_total"
    ]);
  });

  it("exports full summary, group, and product financial details", () => {
    const item: BestSellingProductItem = {
      billDiscountShare: 0,
      categoryName: "Beer",
      charge: 2799.76,
      finalTotal: 47075.39,
      groupId: "group-1",
      groupName: "Drinks",
      id: "item-1",
      itemDiscount: 0,
      productCode: "PRD-MPOUE39V",
      productName: "Product 5 - Medium",
      qty: 6,
      rank: 42,
      salePrice: 6666,
      subtotal: 39996,
      vat: 4279.63
    };
    const group: BestSellingProductGroup = {
      billDiscountShare: 0,
      charge: 51660.01,
      finalTotal: 868622,
      id: "group-1",
      itemDiscount: 0,
      items: [item],
      name: "Drinks",
      productCount: 1,
      qtyTotal: 21,
      subtotal: 737996,
      vat: 78966
    };
    const summary = {
      bill_discount_share: 0,
      charge: 57820,
      final_total: 972198,
      item_discount: 0,
      qty: 24,
      subtotal: 825996,
      vat: 88382
    };

    expect(exportSummaryRows(bestSellingSummaryConfigs(t), summary, t)).toEqual([
      { "report.bestSelling.export.metric": "report.bestSelling.columns.qty", "report.bestSelling.export.value": 24 },
      { "report.bestSelling.export.metric": "report.bestSelling.columns.subtotal", "report.bestSelling.export.value": 825996 },
      { "report.bestSelling.export.metric": "report.bestSelling.columns.itemDiscount", "report.bestSelling.export.value": 0 },
      { "report.bestSelling.export.metric": "report.bestSelling.columns.billDiscountShare", "report.bestSelling.export.value": 0 },
      { "report.bestSelling.export.metric": "report.bestSelling.columns.charge", "report.bestSelling.export.value": 57820 },
      { "report.bestSelling.export.metric": "report.bestSelling.columns.vat", "report.bestSelling.export.value": 88382 },
      { "report.bestSelling.export.metric": "report.bestSelling.columns.finalTotal", "report.bestSelling.export.value": 972198 }
    ]);
    const section = bestSellingGroupedSection([group], summary, t);
    const [header, groupRow, productRow, totalRow] = section.grid.rows;

    expect(section.grid.columnCount).toBe(12);
    expect(header.cells.map((cell) => cell.value)).toEqual([
      "report.bestSelling.columns.rank",
      "report.bestSelling.columns.product",
      "report.bestSelling.columns.productCode",
      "report.bestSelling.columns.category",
      "report.bestSelling.columns.salePrice",
      "report.bestSelling.columns.qty",
      "report.bestSelling.columns.subtotal",
      "report.bestSelling.columns.itemDiscount",
      "report.bestSelling.columns.billDiscountShare",
      "report.bestSelling.columns.charge",
      "report.bestSelling.columns.vat",
      "report.bestSelling.columns.finalTotal"
    ]);

    // แถวกลุ่ม: ชื่อกลุ่ม merge 4 คอลัมน์ + ยอดรวมกลุ่มในคอลัมน์ metric (เว้นราคาขาย)
    expect(groupRow.cells[0].colSpan).toBe(4);
    expect(groupRow.cells[0].value).toContain("Drinks");
    expect(groupRow.cells[1].value).toBe("");
    expect(groupRow.cells[2].value).toBe(21);
    expect(groupRow.cells.at(-1)?.value).toBe(868622);
    expect(groupRow.style?.bold).toBe(true);

    // แถวสินค้า: อันดับนับใหม่ภายในกลุ่ม
    expect(productRow.cells.map((cell) => cell.value)).toEqual([
      1,
      "Product 5 - Medium",
      "PRD-MPOUE39V",
      "Beer",
      6666,
      6,
      39996,
      0,
      0,
      2799.76,
      4279.63,
      47075.39
    ]);

    // แถวยอดรวมทั้งรายงานจาก summary ปิดท้ายตาราง
    expect(totalRow.cells[0].value).toBe("report.summary");
    expect(totalRow.cells[2].value).toBe(24);
    expect(totalRow.cells.at(-1)?.value).toBe(972198);
    expect(totalRow.style?.bold).toBe(true);
  });
});
