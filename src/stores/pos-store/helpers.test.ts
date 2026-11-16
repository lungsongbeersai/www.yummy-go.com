import { describe, expect, it } from "vitest";
import { ProductSortStatus, type CateWithProducts } from "@/services/pos";
import {
  preferredPosMenuStatus,
  type PosMenuBySort,
} from "./helpers";

function categoryWithProducts(
  statusSortFk: ProductSortStatus,
  count: number,
): CateWithProducts {
  return {
    cateUuid: "category-1",
    cateName: "Menu category",
    products: Array.from({ length: count }, (_, index) => ({
      prodUuid: `product-${statusSortFk}-${index}`,
      prodName: `Product ${index}`,
      prodImage: "",
      prodStatusImge: 1,
      statusSortFk,
      canAdd: true,
      hasOptions: false,
      optionsMsg: "",
      countOptionAll: 1,
      countOptionEnabled: 1,
      countToppingEnabled: 0,
    })),
  };
}

function menu(normal: number, set: number, promotion: number): PosMenuBySort {
  return {
    [ProductSortStatus.NORMAL]: [categoryWithProducts(ProductSortStatus.NORMAL, normal)],
    [ProductSortStatus.SET]: [categoryWithProducts(ProductSortStatus.SET, set)],
    [ProductSortStatus.PROMOTION]: [categoryWithProducts(ProductSortStatus.PROMOTION, promotion)],
  };
}

describe("preferredPosMenuStatus", () => {
  it("opens SET when one normal item shares a category with eight sets", () => {
    expect(preferredPosMenuStatus(menu(1, 8, 0), ProductSortStatus.NORMAL))
      .toBe(ProductSortStatus.SET);
  });

  it("opens normal products when they outnumber the current SET tab", () => {
    expect(preferredPosMenuStatus(menu(6, 2, 1), ProductSortStatus.SET))
      .toBe(ProductSortStatus.NORMAL);
  });

  it("opens promotions when they are the largest group", () => {
    expect(preferredPosMenuStatus(menu(2, 1, 5), ProductSortStatus.NORMAL))
      .toBe(ProductSortStatus.PROMOTION);
  });

  it("keeps the active tab when it ties for the greatest count", () => {
    expect(preferredPosMenuStatus(menu(4, 4, 1), ProductSortStatus.SET))
      .toBe(ProductSortStatus.SET);
    expect(preferredPosMenuStatus(menu(4, 4, 4), ProductSortStatus.PROMOTION))
      .toBe(ProductSortStatus.PROMOTION);
  });

  it("uses normal before SET when both tie above the active tab", () => {
    expect(preferredPosMenuStatus(menu(4, 4, 1), ProductSortStatus.PROMOTION))
      .toBe(ProductSortStatus.NORMAL);
  });

  it("uses SET before promotion when both tie above the active tab", () => {
    expect(preferredPosMenuStatus(menu(1, 4, 4), ProductSortStatus.NORMAL))
      .toBe(ProductSortStatus.SET);
  });

  it("keeps the active tab when all groups are empty", () => {
    expect(preferredPosMenuStatus(menu(0, 0, 0), ProductSortStatus.SET))
      .toBe(ProductSortStatus.SET);
  });

  it("counts products across every category in a group", () => {
    const categories = menu(3, 2, 0);
    categories[ProductSortStatus.SET].push(categoryWithProducts(ProductSortStatus.SET, 2));

    expect(preferredPosMenuStatus(categories, ProductSortStatus.NORMAL))
      .toBe(ProductSortStatus.SET);
  });
});
