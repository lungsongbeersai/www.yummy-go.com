import { describe, expect, it } from "vitest";
import type { Category } from "@/services/category";
import type { Product, ProductDetail, StatusSort } from "@/services/product";
import {
  binaryFlag,
  categoryName,
  categoryOptionName,
  categoryUuid,
  detailLabel,
  detailStockSummary,
  detailStockQty,
  firstText,
  productColor,
  productDetails,
  productImageSrc,
  productName,
  productOrderPoint,
  productPriceLabel,
  shortDate,
  shortTime,
  statusSortLabel,
  statusSortValue,
  totalStockQty,
  unitName
} from "./product-list-utils";

function product(overrides: Partial<Product> = {}): Product {
  return {
    prod_uuid: "prod-1",
    prod_name_la: "ຊື່ລາວ",
    prod_name_eng: "English name",
    cate_name_la: "ໝວດລາວ",
    cate_name_eng: "English category",
    unite_name_la: "ອັນ",
    unite_name_eng: "Piece",
    details: [],
    ...overrides
  } as Product;
}

function detail(overrides: Partial<ProductDetail> = {}): ProductDetail {
  return {
    pro_detail_uuid: "detail-1",
    size_name_la: "ນ້ອຍ",
    size_name_eng: "Small",
    pro_detail_sprice: "12000",
    pro_detail_qty_stock: "5",
    pro_detail_stock: "1",
    ...overrides
  } as ProductDetail;
}

describe("product list utils", () => {
  it("chooses localized product, category, unit, and category option names", () => {
    const row = product();
    const category = {
      cate_uuid: "cat-1",
      cate_name_la: "ອາຫານ",
      cate_name_eng: "Food"
    } as Category;

    expect(productName(row, "lo")).toBe("ຊື່ລາວ");
    expect(productName(row, "en")).toBe("English name");
    expect(categoryName(row, "lo")).toBe("ໝວດລາວ");
    expect(categoryName(row, "en")).toBe("English category");
    expect(unitName(row, "lo")).toBe("ອັນ");
    expect(unitName(row, "en")).toBe("Piece");
    expect(categoryOptionName(category, "lo")).toBe("ອາຫານ");
    expect(categoryOptionName(category, "en")).toBe("Food");
  });

  it("keeps first non-empty text and falls back when values are missing", () => {
    expect(firstText({ a: "", b: "0", c: "later" }, ["a", "b", "c"], "-")).toBe("0");
    expect(firstText(null, ["a"], "-")).toBe("-");
    expect(productName(product({ prod_name_la: "", prod_name_eng: "" }), "lo")).toBe("-");
  });

  it("normalizes binary flags and category uuids", () => {
    expect(binaryFlag("1")).toBe("1");
    expect(binaryFlag("0", "1")).toBe("2");
    expect(categoryUuid({ cate_uuid_fk: "cat-fk" } as unknown as Category)).toBe("cat-fk");
  });

  it("filters product details to rows with explicit or UUID-shaped detail ids", () => {
    const uuid = "123e4567-e89b-12d3-a456-426614174000";
    const validById = detail({ pro_detail_uuid: "", pro_detail_id: uuid });
    const invalid = detail({ pro_detail_uuid: "", pro_detail_id: "123" });

    expect(productDetails(product({ details: [detail(), validById, invalid] }))).toHaveLength(2);
  });

  it("builds detail labels from language-specific size names", () => {
    expect(detailLabel(detail(), 0, "lo")).toBe("ນ້ອຍ");
    expect(detailLabel(detail(), 0, "en")).toBe("Small");
    expect(detailLabel(detail({ size_name_la: "", size_name_eng: "" }), 2, "lo")).toBe("#3");
  });

  it("builds image and color presentation values", () => {
    expect(productColor(product({ prod_image: "#10b981" }))).toBe("#10b981");
    expect(productColor(product({ prod_image: "bad", prod_image_raw: "#fff" }))).toBe("#fff");
    expect(productColor(product({ prod_image: "not-a-color" }))).toBe("");
    expect(productImageSrc(product({ prod_image: "image.png" }))).toContain("image.png");
    expect(productImageSrc(product({ prod_image: "#10b981", prod_image_raw: "fallback.png" }))).toContain("fallback.png");
  });

  it("formats price labels for set products and detail price ranges", () => {
    expect(productPriceLabel(product({ status_sort_fk: "2", prod_set_price: "50000" }))).toBe("50.000 ₭");
    expect(productPriceLabel(product({ details: [detail({ pro_detail_sprice: "12000" }), detail({ pro_detail_uuid: "detail-2", pro_detail_sprice: "15000" })] }))).toBe("12.000 ₭ - 15.000 ₭");
    expect(productPriceLabel(product({ details: [detail({ pro_detail_sprice: "0" })] }))).toBe("-");
  });

  it("summarizes stock quantities, order point, and stock mode state", () => {
    const details = [detail(), detail({ pro_detail_uuid: "detail-2", pro_detail_qty_stock: "7", pro_detail_stock: "2" })];

    expect(totalStockQty(product({ details }))).toBe(12);
    expect(productOrderPoint(product({ prod_order_point: "4" }))).toBe(4);
    expect(detailStockQty(details[1])).toBe(7);
    expect(detailStockSummary(details)).toBe("mixed");
    expect(detailStockSummary([detail({ pro_detail_stock: "2" })])).toBe("noDeduct");
    expect(detailStockSummary([])).toBe("deduct");
  });

  it("normalizes status sort values and labels", () => {
    const fallbackTabs = [
      { value: "1", label: "General" },
      { value: "2", label: "Food set" }
    ];
    const status = {
      status_sort_fk: "2",
      status_name_la: "ເຊັດ",
      status_name_eng: "Set"
    } as unknown as StatusSort;

    expect(statusSortValue(status, 1)).toBe("2");
    expect(statusSortLabel(status, "lo", fallbackTabs, "2")).toBe("ເຊັດ");
    expect(statusSortLabel(status, "en", fallbackTabs, "2")).toBe("Set");
  });

  it("shortens dates and times for table display", () => {
    expect(shortDate("2026-06-09T08:30:00.000Z")).toBe("2026-06-09");
    expect(shortDate("")).toBe("-");
    expect(shortTime("08:30:59")).toBe("08:30");
    expect(shortTime(null)).toBe("-");
  });
});

