import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { CateProductItem, CateWithProducts } from "@/services/pos";
import { PUBLIC_MENU_KIND } from "@/stores/public-pos-store";
import { ProductCategorySection } from "./public-product-category-section";
import { StatusRailSection } from "./public-status-rail-section";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) =>
      key === "pos.itemCount" ? `${options?.count ?? 0} ລາຍການ` : key
  }),
  initReactI18next: { type: "3rdParty", init: () => {} }
}));

vi.mock("next/dynamic", async () => {
  const React = await import("react");
  return {
    default: () =>
      function DynamicStub() {
        return React.createElement("span", { "aria-hidden": true });
      }
  };
});

vi.mock("./public-product-card", async () => {
  const React = await import("react");
  return {
    ProductCard: () => React.createElement("article", null)
  };
});

vi.mock("./public-pos-skeletons", async () => {
  const React = await import("react");
  return {
    CategoryCompactLoading: () => React.createElement("div", null),
    CategoryDeferredPlaceholder: () => React.createElement("div", null),
    RailSkeleton: () => React.createElement("div", null)
  };
});

vi.mock("./horizontal-scroll-arrows", async () => {
  const React = await import("react");
  return {
    HorizontalScrollArrows: () => React.createElement("div", null)
  };
});

function product(index: number): CateProductItem {
  return {
    prodUuid: `prod-${index}`,
    prodName: `Product ${index}`,
    prodImage: "",
    prodStatusImge: 1,
    statusSortFk: 1,
    canAdd: true,
    hasOptions: false,
    optionsMsg: "",
    countOptionAll: 0,
    countOptionEnabled: 0,
    countToppingEnabled: 0
  };
}

function products(count: number) {
  return Array.from({ length: count }, (_, index) => product(index + 1));
}

describe("public menu section headings", () => {
  it("does not render item counts for featured menu sections", () => {
    const html = renderToStaticMarkup(
      createElement(StatusRailSection, {
        title: "Promotions",
        products: products(4).map((item) => ({
          product: item,
          cateUuid: "promo",
          statusKind: PUBLIC_MENU_KIND.PROMOTION
        })),
        visibleCount: 0,
        loading: true,
        lang: "la",
        loadingProductUuid: "",
        onProductClick: vi.fn(),
        onRevealMore: vi.fn()
      })
    );

    expect(html).not.toContain("4 ລາຍການ");
  });

  it("does not render item counts for product category sections", () => {
    const category: CateWithProducts = {
      cateUuid: "cate-1",
      cateName: "Drinks",
      products: products(5)
    };
    const html = renderToStaticMarkup(
      createElement(ProductCategorySection, {
        category,
        products: [],
        totalProducts: 5,
        loaded: true,
        loading: false,
        jumping: false,
        collapsed: true,
        lang: "la",
        statusKind: PUBLIC_MENU_KIND.NORMAL,
        loadingProductUuid: "",
        layoutMode: "grid",
        onEnsureLoad: vi.fn(),
        onProductClick: vi.fn(),
        onRevealMore: vi.fn(),
        onToggleCollapse: vi.fn(),
        refCallback: vi.fn()
      })
    );

    expect(html).not.toContain("5 ລາຍການ");
  });
});
