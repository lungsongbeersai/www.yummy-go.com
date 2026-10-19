import { describe, expect, it } from "vitest";
import type { Product } from "@/services/product";
import {
  buildProductMenu,
  estimateMenuProductHeight,
  isDefaultMenuVariant,
  paginateProductCatalog,
  paginateProductMenu,
  paginateProductMenuColumns,
  type MenuCategory,
  type MenuProduct,
  type ProductMenuPage,
} from "./product-menu-utils";
import {
  DEFAULT_MENU_CATALOG_ROWS,
  DEFAULT_MENU_TEMPLATE_ID,
  getMenuTemplate,
  MENU_CATALOG_ROW_OPTIONS,
  MENU_CATALOG_TEMPLATES,
  normalizeMenuCatalogRows,
} from "./product-menu-templates";

const labels = { uncategorized: "Other", regular: "Regular", contactPrice: "Ask for price" };

function product(id: string, overrides: Partial<Product> = {}): Product {
  return {
    prod_uuid: id,
    prod_name_eng: `Dish ${id}`,
    cate_uuid_fk: "food",
    cate_name_eng: "Food",
    details: [{ pro_detail_uuid: `${id}-regular`, size_name_eng: "Regular", pro_detail_sprice: 25000 }],
    ...overrides,
  };
}

function flatten(pages: ProductMenuPage[]): MenuProduct[] {
  return pages.flatMap((page) => page.sections.flatMap((category) => category.items));
}

function expectFits(pages: ProductMenuPage[], pageHeight: number, header = 54, gap = 12): void {
  for (const page of pages) {
    const height = page.sections.reduce((sum, category, index) => {
      let rowsHeight = 0;
      for (let itemIndex = 0; itemIndex < category.items.length; itemIndex += 2) {
        rowsHeight += Math.max(...category.items.slice(itemIndex, itemIndex + 2).map(estimateMenuProductHeight));
        if (itemIndex > 0) rowsHeight += gap;
      }
      return sum + (index ? 20 : 0) + header + rowsHeight;
    }, 0);
    expect(height).toBeLessThanOrEqual(pageHeight);
    for (const category of page.sections) expect(category.items.length).toBeGreaterThan(0);
  }
}

describe("printed product menu", () => {
  it("uses the resolved storage photo URL before the raw edit key", () => {
    const categories = buildProductMenu([
      product("resolved", { prod_image: "https://media.example.com/products/photo.jpg", prod_image_raw: "legacy-photo.jpg" }),
      product("legacy", { prod_image: "", prod_image_raw: "legacy-only.jpg" }),
      product("color", { prod_image: "#008060", prod_image_raw: "#008060" }),
    ], "en", labels);
    expect(categories[0].items.map((item) => item.imageFilename)).toEqual([
      "https://media.example.com/products/photo.jpg", "legacy-only.jpg", "",
    ]);
  });

  it("lays out a short category as one section with continuous dish numbers in reading order", () => {
    const categories = buildProductMenu(Array.from({ length: 6 }, (_, index) => product(`dish-${index}`)), "en", labels);
    const before = JSON.stringify(categories);
    const productHeights = Object.fromEntries(categories[0].items.map((item) => [item.id, 60]));
    const pages = paginateProductMenu(categories, { columnHeight: 600, productHeights });
    expect(pages).toHaveLength(1);
    expect(pages[0].sections).toHaveLength(1);
    expect(pages[0].sections[0].continued).toBe(false);
    expect(flatten(pages).map((item) => item.number)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(flatten(pages).map((item) => item.id)).toEqual(categories[0].items.map((item) => item.id));
    expect(JSON.stringify(categories)).toBe(before);
  });

  it("keeps consecutive categories as separate full-width sections without continuation markers", () => {
    const categories = buildProductMenu([
      product("a"), product("b"),
      product("c", { cate_uuid_fk: "drinks", cate_name_eng: "Drinks" }),
      product("d", { cate_uuid_fk: "drinks", cate_name_eng: "Drinks" }),
    ], "en", labels);
    const pages = paginateProductMenu(categories, { columnHeight: 600, productHeights: { a: 100, b: 100, c: 100, d: 100 } });
    expect(pages[0].sections.map((category) => category.name)).toEqual(["Food", "Drinks"]);
    expect(pages[0].sections.every((section) => !section.continued)).toBe(true);
    expect(flatten(pages).map((item) => item.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("uses localized names and category UUIDs without merging identically named categories", () => {
    const input = [
      product("rice", { prod_name_la: "ເຂົ້າຜັດ", prod_name_eng: "Fried rice", cate_uuid_fk: "one", cate_name_la: "ອາຫານ" }),
      product("soup", { cate_uuid_fk: "two" }),
      product("noodles", { cate_uuid_fk: "one", cate_name_eng: "Translated food" }),
    ];
    const categories = buildProductMenu(input, "en", labels);
    expect(categories).toHaveLength(2);
    expect(categories[0].items.map((item) => item.id)).toEqual(["rice", "noodles"]);
    expect(categories[0].items[0]).toMatchObject({ name: "Fried rice", secondaryName: "ເຂົ້າຜັດ" });
    expect(buildProductMenu(input, "lo-LA", labels)[0].items[0].name).toBe("ເຂົ້າຜັດ");
  });

  it("numbers dishes in the final grouped order when source categories are interleaved", () => {
    const categories = buildProductMenu([
      product("a"),
      product("drink", { cate_uuid_fk: "drinks", cate_name_eng: "Drinks" }),
      product("b"),
    ], "en", labels);
    expect(categories.flatMap((category) => category.items).map(({ id, number }) => [id, number])).toEqual([
      ["a", 1], ["b", 2], ["drink", 3],
    ]);
  });

  it("suppresses duplicate or incorrectly scripted alternate names while keeping real translations", () => {
    const categories = buildProductMenu([
      product("duplicate", { prod_name_la: "ເຂົ້າ ຜັດ", prod_name_eng: "ເຂົ້າຜັດ" }),
      product("wrong-script", { prod_name_la: "ເຂົ້າຜັດ", prod_name_eng: "ເຂົ້າຜັດພິເສດ" }),
      product("translation", { prod_name_la: "ເຂົ້າຜັດ", prod_name_eng: "Fried rice" }),
    ], "lo", labels);
    expect(categories[0].items.map((item) => item.secondaryName)).toEqual(["", "", "Fried rice"]);
    expect(buildProductMenu([product("same", { prod_name_eng: "FRIED RICE", prod_name_la: "Fried  rice" })], "en", labels)[0].items[0].secondaryName).toBe("");
    expect(buildProductMenu([product("true", { prod_name_eng: "Fried rice", prod_name_la: "ເຂົ້າຜັດ" })], "en", labels)[0].items[0].secondaryName).toBe("ເຂົ້າຜັດ");
  });

  it("recognizes generic variants without hiding meaningful sizes or units", () => {
    expect(["Regular", " STANDARD ", "ທົ່ວໄປ", "ทั่วไป", "ปกติ", ""].every(isDefaultMenuVariant)).toBe(true);
    expect(["Small", "Large", "Bottle", "ນ້ອຍ", "ໃຫຍ່", "ຈານ"].some(isDefaultMenuVariant)).toBe(false);
  });

  it("groups legacy name-only categories and missing categories consistently", () => {
    const categories = buildProductMenu([
      product("a", { cate_uuid_fk: "", cate_name_eng: " Drinks " }),
      product("b", { cate_uuid_fk: undefined, cate_name_eng: "Drinks" }),
      product("c", { cate_uuid_fk: undefined, cate_name_eng: "" }),
      product("d", { cate_uuid_fk: undefined, cate_name_eng: "" }),
    ], "en", labels);
    expect(categories.map((category) => [category.name, category.items.length])).toEqual([["Drinks", 2], ["Other", 2]]);
  });

  it("preserves every enabled size in configured order and does not confuse timing mode with enable status", () => {
    const [category] = buildProductMenu([product("rice", {
      details: [
        { pro_detail_uuid: "large", pro_detail_sort: 2, size_name: "Large", pro_detail_sprice: 45000, pro_detail_enabled: "1", pro_detail_status: 2 },
        { pro_detail_uuid: "disabled", pro_detail_sort: 1, size_name: "Hidden", pro_detail_sprice: 1, pro_detail_enabled: "2" },
        { pro_detail_uuid: "small", pro_detail_sort: 1, size_name: "Small", pro_detail_sprice: 25000, pro_detail_status: 1 },
        { pro_detail_uuid: "unsorted", size_name: "Family", pro_detail_sprice: 85000 },
      ],
    })], "en", labels);
    expect(category.items[0].prices.map(({ label, amount }) => [label, amount])).toEqual([
      ["Small", 25000], ["Large", 45000], ["Family", 85000],
    ]);
  });

  it("keeps zero and decimal prices, parses formatted amounts, and marks unknown prices explicitly", () => {
    const [category] = buildProductMenu([product("rice", {
      prod_price: 999,
      details: [
        { pro_detail_sprice: 0 },
        { pro_detail_sprice: "25,000.5" },
        { pro_detail_sprice: "" },
        { pro_detail_sprice: "invalid" },
        { pro_detail_sprice: -10 },
        { pro_detail_sprice: "2,50" },
      ],
    })], "en", labels);
    const prices = category.items[0].prices;
    expect(prices.map((entry) => entry.amount)).toEqual([0, 25000.5, null, null, null, null]);
    expect(prices[0].priceText).toBe("0 ₭");
    expect(prices[1].priceText).toContain("5");
    expect(prices.slice(2).every((entry) => entry.priceText === labels.contactPrice)).toBe(true);
  });

  it("prints one set price and preserves enabled set option names without child sale prices", () => {
    const [category] = buildProductMenu([product("set", {
      status_sort_fk: "2",
      prod_set_price: 0,
      details: [
        { size_name_eng: "Tea + sandwich", pro_detail_sprice: 999 },
        { size_name_eng: "Coffee + sandwich", pro_detail_sprice: 998 },
        { size_name_eng: "Hidden option", pro_detail_enabled: 2 },
      ],
    })], "en", labels);
    expect(category.items[0].type).toBe("set");
    expect(category.items[0].prices).toHaveLength(1);
    expect(category.items[0].prices[0].amount).toBe(0);
    expect(category.items[0].options).toEqual(["Tea + sandwich", "Coffee + sandwich"]);
  });

  it("separates mandatory set items from exact-count choices in configured dish order", () => {
    const [category] = buildProductMenu([product("set", {
      status_sort_fk: 2,
      prod_set_price: 89000,
      set_choice_groups: [{ set_choice_group_uuid: "drink", group_name_eng: "Drink", max_select: 1 }],
      details: [
        { size_name_eng: "Rice" },
        { size_name_eng: "Soup" },
        { size_name_eng: "Tea", set_choice_group_uuid_fks: ["drink"] },
        { size_name_eng: "Coffee", set_choice_group_uuid_fks: ["drink"] },
        { size_name_eng: "Fruit" },
        { size_name_eng: "Hidden", pro_detail_enabled: 2 },
      ],
    })], "en", labels);
    expect(category.items[0].options).toEqual([
      "Included: Rice, Soup", "Drink · Choose 1: Tea, Coffee", "Included: Fruit",
    ]);
    expect(category.items[0].prices.map((price) => price.amount)).toEqual([89000]);
  });

  it("keeps multiple group memberships and dangling set references without losing names", () => {
    const [category] = buildProductMenu([product("set", {
      status_sort_fk: 2,
      set_choice_groups: [
        { set_choice_group_uuid: "sides", group_name_eng: "Sides", max_select: 2, group_sort: 2 },
        { set_choice_group_uuid: "protein", group_name_eng: "Protein", max_select: 1, group_sort: 1 },
        { set_choice_group_uuid: "empty", group_name_eng: "Empty", max_select: 1 },
      ],
      details: [
        { size_name_eng: "Rice", set_choice_group_uuid_fks: ["deleted"] },
        { size_name_eng: "Chicken", set_choice_group_uuid_fks: ["sides", "protein", "deleted"] },
        { size_name_eng: "Pork", set_choice_group_uuid_fks: ["protein"] },
        { size_name_eng: "Vegetables", set_choice_group_uuid_fks: ["sides"] },
      ],
    })], "en", labels);
    expect(category.items[0].options).toEqual([
      "Included: Rice", "Protein · Choose 1: Chicken, Pork", "Sides · Choose 2: Chicken, Vegetables",
    ]);
  });

  it("defaults invalid set choice limits to one and accepts localized choice labels", () => {
    const [category] = buildProductMenu([product("set", {
      status_sort_fk: 2,
      set_choice_groups: [
        { set_choice_group_uuid: "zero", group_name_la: "ເຄື່ອງດື່ມ", max_select: 0 },
        { set_choice_group_uuid: "missing", group_name_la: "ຂອງຫວານ" },
        { set_choice_group_uuid: "negative", group_name_la: "ເຄື່ອງຄຽງ", max_select: -2 },
      ],
      details: [
        { size_name_la: "ເຂົ້າ" },
        { size_name_la: "ຊາ", set_choice_group_uuid_fks: ["zero"] },
        { size_name_la: "ໝາກໄມ້", set_choice_group_uuid_fks: ["missing"] },
        { size_name_la: "ຜັກ", set_choice_group_uuid_fks: ["negative"] },
      ],
    })], "lo", { ...labels, included: "ລວມ", chooseCount: (count) => `ເລືອກ ${count}` });
    expect(category.items[0].options).toEqual([
      "ລວມ: ເຂົ້າ", "ເຄື່ອງດື່ມ · ເລືອກ 1: ຊາ", "ຂອງຫວານ · ເລືອກ 1: ໝາກໄມ້", "ເຄື່ອງຄຽງ · ເລືອກ 1: ຜັກ",
    ]);
  });

  it("excludes promotions and products without enabled sellable details while preserving source objects", () => {
    const input = [
      product("missing", { details: undefined, prod_price: 1000 }),
      product("disabled", { details: [{ pro_detail_enabled: 2, pro_detail_sprice: 5000 }] }),
      product("expired", { status_sort_fk: 3, details: [{ pro_detail_sprice: 100, pro_detail_eDate: "2020-01-01" }] }),
      product("future-promo", { status_sort_fk: "3", details: [{ pro_detail_sprice: 100, pro_detail_sDate: "2099-01-01" }] }),
      product("second", { prod_sort: 2 }),
      product("first", { prod_sort: 1 }),
    ];
    const before = JSON.stringify(input);
    expect(buildProductMenu(input, "en", labels)[0].items.map((item) => item.id)).toEqual(["first", "second"]);
    expect(JSON.stringify(input)).toBe(before);
  });
});

describe("A4 product menu pagination", () => {
  it("repeats continued category headings on following pages and retains every dish in row order", () => {
    const categories = buildProductMenu(Array.from({ length: 39 }, (_, index) => product(String(index))), "en", labels);
    const pages = paginateProductMenu(categories);
    expect(pages.length).toBeGreaterThan(1);
    expect(pages[0].sections[0].continued).toBe(false);
    expect(pages[1].sections[0].continued).toBe(true);
    expect(flatten(pages).map((item) => item.id)).toEqual(categories[0].items.map((item) => item.id));
    expectFits(pages, 900);
    expect(paginateProductMenu([])).toEqual([]);
  });

  it("honors measured pair heights and marks a new category as new after a page break", () => {
    const categories = buildProductMenu([
      product("a"), product("b"), product("c", { cate_uuid_fk: "drinks", cate_name_eng: "Drinks" }),
    ], "en", labels);
    const pages = paginateProductMenu(categories, {
      columnHeight: 300,
      categoryHeaderHeight: 40,
      itemGap: 10,
      productHeights: { a: 200, b: 120, c: 100 },
      categoryHeights: { [categories[1].id]: 60 },
    });
    expect(pages).toHaveLength(2);
    expect(pages[0].sections[0].items.map((item) => item.id)).toEqual(["a", "b"]);
    expect(pages[1].sections[0]).toMatchObject({ name: "Drinks", continued: false });
    expect(pages[1].sections[0].items.map((item) => item.id)).toEqual(["c"]);
  });

  it("uses the tallest card in each paired row and adds the row gap only between rows", () => {
    const categories = buildProductMenu([product("a"), product("b"), product("c"), product("d")], "en", labels);
    const productHeights = { a: 100, b: 30, c: 40, d: 70 };
    const exact = paginateProductMenu(categories, { columnHeight: 236, productHeights });
    expect(exact).toHaveLength(1);
    const smaller = paginateProductMenu(categories, { columnHeight: 235, productHeights });
    expect(smaller).toHaveLength(2);
    expect(smaller[0].sections[0].items.map((item) => item.id)).toEqual(["a", "b"]);
    expect(smaller[1].sections[0].items.map((item) => item.id)).toEqual(["c", "d"]);
  });

  it("moves a whole category onto a fresh page when it fits there instead of splitting it", () => {
    const categories = buildProductMenu([
      product("a"), product("b"),
      ...["c", "d", "e", "f"].map((id) => product(id, { cate_uuid_fk: "drinks", cate_name_eng: "Drinks" })),
    ], "en", labels);
    const productHeights = Object.fromEntries(categories.flatMap((category) => category.items).map((item) => [item.id, 100]));
    const pages = paginateProductMenu(categories, { columnHeight: 350, productHeights });
    expect(pages).toHaveLength(2);
    expect(pages[0].sections.map((section) => section.name)).toEqual(["Food"]);
    expect(pages[1].sections.map((section) => section.name)).toEqual(["Drinks"]);
    expect(pages[1].sections[0].items.map((item) => item.id)).toEqual(["c", "d", "e", "f"]);
    expect(pages[1].sections[0].continued).toBe(false);
  });

  it("uses a half-empty page for at least two rows of a long category and repeats its heading", () => {
    const categories = buildProductMenu([
      product("a"), product("b"),
      ...["c", "d", "e", "f", "g", "h"].map((id) => product(id, { cate_uuid_fk: "drinks", cate_name_eng: "Drinks" })),
    ], "en", labels);
    const productHeights = Object.fromEntries(categories.flatMap((category) => category.items).map((item) => [item.id, 100]));
    const pages = paginateProductMenu(categories, { columnHeight: 500, productHeights });
    expect(pages).toHaveLength(2);
    expect(pages[0].sections.map((section) => section.name)).toEqual(["Food", "Drinks"]);
    expect(pages[0].sections[1].items.map((item) => item.id)).toEqual(["c", "d", "e", "f"]);
    expect(pages[1].sections[0]).toMatchObject({ name: "Drinks", continued: true });
    expect(flatten(pages).map((item) => item.id)).toEqual(["a", "b", "c", "d", "e", "f", "g", "h"]);
  });

  it("continues a product with many sizes without losing prices, dish numbers or page space", () => {
    const categories = buildProductMenu([product("sizes", {
      details: Array.from({ length: 90 }, (_, index) => ({
        pro_detail_uuid: `size-${index}`,
        size_name_eng: `Size ${index}`,
        pro_detail_sprice: index * 1000,
      })),
    })], "en", labels);
    const source = JSON.stringify(categories);
    const pages = paginateProductMenu(categories, { columnHeight: 400 });
    const parts = flatten(pages);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts[0].continued).toBeFalsy();
    expect(parts.slice(1).every((item) => item.continued && item.originalId === "sizes")).toBe(true);
    expect(parts.every((item) => item.number === 1)).toBe(true);
    expect(parts.flatMap((item) => item.prices.map((price) => price.amount))).toEqual(categories[0].items[0].prices.map((price) => price.amount));
    expectFits(pages, 400);
    expect(JSON.stringify(categories)).toBe(source);
  });

  it("preserves exceptionally long names, size labels, and set options as complete continuation text", () => {
    const longName = "ອາຫານພິເສດ".repeat(80);
    const longPriceLabel = "Very detailed size information ".repeat(60);
    const longOption = "Included choice of side dish\n".repeat(80);
    const categories: MenuCategory[] = buildProductMenu([product("long", {
      prod_name_eng: longName,
      details: [{ size_name_eng: longPriceLabel, pro_detail_sprice: 30000 }],
    })], "en", labels);
    categories[0].items[0].options = [longOption];
    const pages = paginateProductMenu(categories, { columnHeight: 500 });
    const parts = flatten(pages);
    expect(parts.map((item) => item.name).join("")).toContain(longName);
    expect(parts.flatMap((item) => item.prices.map((entry) => entry.label)).join("")).toBe(longPriceLabel.trim());
    expect(parts.flatMap((item) => item.options).join("")).toBe(longOption);
    expectFits(pages, 500);
  });
});

describe("category-separated menu catalogs", () => {
  it("offers the selected menu designs whose grids default to four rows", () => {
    expect(MENU_CATALOG_TEMPLATES.map((template) => template.id)).toEqual([
      "bistro",
      "garden", "sunny", "classic", "midnight", "market", "cafe",
      "editorial", "promo", "directory", "featured",
    ]);
    expect(MENU_CATALOG_TEMPLATES.every((template) => template.rows === 4)).toBe(true);
    expect(MENU_CATALOG_TEMPLATES.map((template) => template.columns)).toEqual([2, 3, 3, 2, 2, 4, 3, 1, 6, 3, 3]);
    expect(MENU_CATALOG_TEMPLATES.map((template) => template.layout)).toEqual([
      "bistro", "catalog", "catalog", "catalog", "catalog", "catalog", "catalog", "editorial", "catalog", "directory", "catalog",
    ]);
    expect(getMenuTemplate().id).toBe(DEFAULT_MENU_TEMPLATE_ID);
    expect(getMenuTemplate("unknown").id).toBe(DEFAULT_MENU_TEMPLATE_ID);
    expect(getMenuTemplate("midnight").id).toBe("midnight");
  });

  it("accepts four, five, or six rows and falls back to four for invalid input", () => {
    expect(MENU_CATALOG_ROW_OPTIONS).toEqual([4, 5, 6]);
    expect(DEFAULT_MENU_CATALOG_ROWS).toBe(4);
    expect(MENU_CATALOG_ROW_OPTIONS.map(normalizeMenuCatalogRows)).toEqual([4, 5, 6]);
    for (const invalid of [undefined, null, 0, 3, 7, -4, 4.5, Number.NaN, Infinity, "5", true, {}]) {
      expect(normalizeMenuCatalogRows(invalid)).toBe(4);
    }
  });

  it("honors every row and column choice while retaining all dishes in order", () => {
    const categories = buildProductMenu(Array.from({ length: 39 }, (_, index) => product(String(index))), "en", labels);
    for (const columns of [2, 3, 4, 6] as const) {
      for (const rows of MENU_CATALOG_ROW_OPTIONS) {
        const pages = paginateProductCatalog(categories, { columns, rows });
        expect(pages).toHaveLength(Math.ceil(39 / (columns * rows)));
        expect(pages[0].sections[0].items).toHaveLength(columns * rows);
        expect(pages.every((page) => page.sections.length === 1 && page.sections[0].items.length <= columns * rows)).toBe(true);
        expect(flatten(pages).map((item) => item.id)).toEqual(categories[0].items.map((item) => item.id));
        expect(pages[0].sections[0].continued).toBe(false);
        expect(pages.slice(1).every((page) => page.sections[0].continued)).toBe(true);
      }
    }
    expect(paginateProductCatalog(categories, { columns: 2 })).toEqual(paginateProductCatalog(categories, { columns: 2, rows: 4 }));
  });

  it("starts categories on separate pages, continues overflowing categories, and ignores empty categories", () => {
    const categories = buildProductMenu([
      product("a"), product("b"),
      product("c", { cate_uuid_fk: "drinks", cate_name_eng: "Drinks" }),
    ], "en", labels);
    categories.splice(1, 0, { id: "empty", name: "Empty", items: [] });
    const pages = paginateProductCatalog(categories);
    expect(pages).toHaveLength(2);
    expect(pages.map((page) => page.sections.map((section) => section.name))).toEqual([["Food"], ["Drinks"]]);
    expect(pages.every((page) => !page.sections[0].continued)).toBe(true);
    expect(flatten(pages).map(({ number }) => number)).toEqual([1, 2, 3]);
    expect(paginateProductCatalog([])).toEqual([]);

    const crossing = buildProductMenu([
      ...Array.from({ length: 5 }, (_, index) => product(`food-${index}`)),
      ...Array.from({ length: 9 }, (_, index) => product(`drink-${index}`, { cate_uuid_fk: "drinks", cate_name_eng: "Drinks" })),
    ], "en", labels);
    const packed = paginateProductCatalog(crossing, { columns: 2 });
    expect(packed.map((page) => page.sections.map((section) => [section.name, section.items.length, section.continued])))
      .toEqual([[["Food", 5, false]], [["Drinks", 8, false]], [["Drinks", 1, true]]]);
    expect(flatten(packed).map(({ number }) => number)).toEqual(Array.from({ length: 14 }, (_, index) => index + 1));
    for (const rows of MENU_CATALOG_ROW_OPTIONS) {
      const separate = paginateProductCatalog(crossing, { columns: 2, rows });
      expect(separate.every((page) => page.sections.length === 1)).toBe(true);
      expect(separate[0].sections[0].items.map((item) => item.id)).toEqual(crossing[0].items.map((item) => item.id));
      expect(separate[1].sections[0]).toMatchObject({ id: crossing[1].id, continued: false });
    }
  });

  it("continues ninety sizes across cards and pages without dropping or changing prices", () => {
    const categories = buildProductMenu([product("sizes", {
      details: Array.from({ length: 90 }, (_, index) => ({
        pro_detail_uuid: `size-${index}`,
        size_name_eng: `Size ${index}`,
        pro_detail_sprice: index * 1000,
      })),
    }), product("next")], "en", labels);
    const source = JSON.stringify(categories);
    const pages = paginateProductCatalog(categories, { columns: 2, cardHeight: 160 });
    const fragments = flatten(pages).filter((item) => item.originalId === "sizes");
    expect(pages.length).toBeGreaterThan(1);
    expect(fragments.every((item) => item.number === 1 && estimateMenuProductHeight(item) <= 160)).toBe(true);
    expect(fragments[0].continued).toBeFalsy();
    expect(fragments.slice(1).every((item) => item.continued)).toBe(true);
    expect(fragments.flatMap((item) => item.prices.map(({ label, amount }) => [label, amount])))
      .toEqual(categories[0].items[0].prices.map(({ label, amount }) => [label, amount]));
    expect(flatten(pages).at(-1)).toMatchObject({ id: "next", number: 2 });
    expect(JSON.stringify(categories)).toBe(source);
  });

  it("reserves repeated photo space and uses actual measured text heights when splitting", () => {
    const categories = buildProductMenu([product("sizes", {
      details: Array.from({ length: 12 }, (_, index) => ({ size_name_eng: `Size ${index}`, pro_detail_sprice: index })),
    })], "en", labels);
    const options = { columns: 3 as const, cardHeight: 280, productFixedHeight: 70 };
    const fallback = flatten(paginateProductCatalog(categories, options));
    const measured = flatten(paginateProductCatalog(categories, { ...options, productHeights: { sizes: 500 } }));
    expect(measured.length).toBeGreaterThan(fallback.length);
    const scale = (500 - 70) / estimateMenuProductHeight(categories[0].items[0]);
    expect(measured.every((item) => estimateMenuProductHeight(item) * scale + 70 <= 280)).toBe(true);
    expect(measured.flatMap((item) => item.prices.map((price) => price.amount))).toEqual(
      categories[0].items[0].prices.map((price) => price.amount),
    );
    const extreme = flatten(paginateProductCatalog(categories, {
      cardHeight: 205,
      productFixedHeight: 105,
      productHeights: { sizes: 5000 },
    }));
    expect(extreme.length).toBeGreaterThan(measured.length);
    expect(extreme.every((item) => estimateMenuProductHeight(item) <= 100)).toBe(true);
    expect(extreme.flatMap((item) => item.prices.map((price) => price.amount))).toEqual(
      categories[0].items[0].prices.map((price) => price.amount),
    );
  });

  it("keeps ordinary dish titles whole on catalog price continuations", () => {
    const name = "Herb grilled chicken with seasonal vegetables 4";
    const categories = buildProductMenu([product("chicken", {
      prod_name_eng: name,
      details: Array.from({ length: 12 }, (_, index) => ({
        pro_detail_uuid: `size-${index}`, size_name_eng: `Size ${index}`, pro_detail_sprice: index * 1000,
      })),
    })], "en", labels);
    const options = { columns: 2 as const, cardHeight: 230, productFixedHeight: 70 };
    const initial = flatten(paginateProductCatalog(categories, options));
    expect(initial.length).toBeGreaterThan(1);
    expect(initial.every((item) => item.name === name && item.prices.length > 0)).toBe(true);

    const remeasured: MenuCategory[] = [{ ...categories[0], items: initial }];
    const productHeights = Object.fromEntries(initial.map((item) => [item.id, estimateMenuProductHeight(item) * 1.1 + 70]));
    const fragments = flatten(paginateProductCatalog(remeasured, { ...options, productHeights }));
    expect(fragments.every((item) => item.name === name && item.prices.length > 0 && item.originalId === "chicken")).toBe(true);
    expect(new Set(fragments.map((item) => item.id)).size).toBe(fragments.length);
    expect(fragments.flatMap((item) => item.prices.map(({ label, amount }) => [label, amount])))
      .toEqual(categories[0].items[0].prices.map(({ label, amount }) => [label, amount]));
  });

  it("lets actual measurements preserve a full ordinary title in dense catalog rows", () => {
    const name = "Herb grilled chicken with seasonal vegetables 4";
    const categories = buildProductMenu([product("chicken", {
      prod_name_eng: name,
      details: Array.from({ length: 12 }, (_, index) => ({
        pro_detail_uuid: `size-${index}`, size_name_eng: `Size ${index}`, pro_detail_sprice: index * 1000,
      })),
    })], "en", labels);
    const options = { columns: 2 as const, rows: 5 as const, cardHeight: 160, productFixedHeight: 60 };
    const initial = flatten(paginateProductCatalog(categories, options));
    expect(initial.length).toBeGreaterThan(1);
    expect(initial.every((item) => item.name === name && item.originalId === "chicken")).toBe(true);
    const measuredCategories = [{ ...categories[0], items: initial }];
    const productHeights = Object.fromEntries(initial.map((item) => [item.id, 148]));
    const measured = flatten(paginateProductCatalog(measuredCategories, { ...options, productHeights }));
    expect(measured.map((item) => item.id)).toEqual(initial.map((item) => item.id));
    expect(measured.every((item) => item.name === name)).toBe(true);
    expect(measured.flatMap((item) => item.prices.map(({ label, amount }) => [label, amount])))
      .toEqual(categories[0].items[0].prices.map(({ label, amount }) => [label, amount]));
  });

  it("uses measured compact text to keep a price with a bilingual title instead of a title-only card", () => {
    const categories = buildProductMenu([product("rice", {
      prod_name_eng: "Prawn fried rice 1",
      prod_name_la: "ເຂົ້າຜັດກຸ້ງ",
      details: [
        { pro_detail_uuid: "regular", size_name_eng: "Regular", pro_detail_sprice: 25000 },
        { pro_detail_uuid: "large", size_name_eng: "Large", pro_detail_sprice: 35000 },
        { pro_detail_uuid: "family", size_name_eng: "Family", pro_detail_sprice: 55000 },
      ],
    })], "en", labels);
    const options = { columns: 2 as const, rows: 6 as const, cardHeight: 120, productFixedHeight: 40 };
    const fragments = flatten(paginateProductCatalog(categories, { ...options, productHeights: { rice: 140 } }));
    expect(fragments).toHaveLength(2);
    expect(fragments.every((item) => item.name === "Prawn fried rice 1" && item.prices.length > 0)).toBe(true);
    expect(fragments[0].secondaryName).toBe("ເຂົ້າຜັດກຸ້ງ");
    expect(fragments.flatMap((item) => item.prices.map(({ label, amount }) => [label, amount])))
      .toEqual([["Regular", 25000], ["Large", 35000], ["Family", 55000]]);
    const measured = flatten(paginateProductCatalog([{ ...categories[0], items: fragments }], {
      ...options,
      productHeights: { [fragments[0].id]: 108, [fragments[1].id]: 111 },
    }));
    expect(measured.map((item) => item.id)).toEqual(fragments.map((item) => item.id));
  });

  it("converges to safe fallback fragments for exceptionally long titles at six rows", () => {
    const name = "ອາຫານພິເສດ".repeat(40);
    const categories = buildProductMenu([product("long", {
      prod_name_eng: name,
      details: Array.from({ length: 12 }, (_, index) => ({
        pro_detail_uuid: `size-${index}`, size_name_eng: `Size ${index}`, pro_detail_sprice: index * 1000,
      })),
    })], "en", labels);
    const options = { columns: 4 as const, rows: 6 as const, cardHeight: 130, productFixedHeight: 30 };
    let fragments = flatten(paginateProductCatalog(categories, options));
    let fits = false;
    for (let pass = 0; pass < 6; pass += 1) {
      const productHeights = Object.fromEntries(fragments.map((item) => [item.id, estimateMenuProductHeight(item) + 30]));
      if (Object.values(productHeights).every((height) => height <= 130)) {
        fits = true;
        break;
      }
      fragments = flatten(paginateProductCatalog([{ ...categories[0], items: fragments }], { ...options, productHeights }));
    }
    expect(fits).toBe(true);
    expect(fragments.every((item) => item.number === 1 && item.originalId === "long")).toBe(true);
    expect(fragments.map((item) => item.name).join("")).toContain(name);
    expect(fragments.flatMap((item) => item.prices.map(({ label, amount }) => [label, amount])))
      .toEqual(categories[0].items[0].prices.map(({ label, amount }) => [label, amount]));
    expect(new Set(fragments.map((item) => item.id)).size).toBe(fragments.length);
    expect(fragments.length).toBeLessThan(100);
  });

  it("keeps set options complete and stable numbering when measured continuations need another split", () => {
    const categories = buildProductMenu([product("set", { status_sort_fk: 2, prod_set_price: 89000 })], "en", labels);
    categories[0].items[0].options = Array.from({ length: 35 }, (_, index) => `Included option ${index}`);
    const initial = flatten(paginateProductCatalog(categories, { cardHeight: 210 }));
    const remeasured: MenuCategory[] = [{ ...categories[0], items: initial }];
    const productHeights = Object.fromEntries(initial.map((item) => [item.id, estimateMenuProductHeight(item) * 1.4]));
    const finalPages = paginateProductCatalog(remeasured, { cardHeight: 210, productHeights });
    const fragments = flatten(finalPages);
    expect(fragments.every((item) => item.number === 1 && item.originalId === "set")).toBe(true);
    expect(fragments.flatMap((item) => item.options)).toEqual(categories[0].items[0].options);
    expect(fragments.flatMap((item) => item.prices.map((price) => price.amount))).toEqual([89000]);
    expect(new Set(fragments.map((item) => item.id)).size).toBe(fragments.length);
  });
});

describe("text menu column pagination", () => {
  it("uses both measured capacities for a bistro's uneven two-column layout", () => {
    const categories = buildProductMenu(Array.from({ length: 10 }, (_, index) => product(String(index))), "en", labels);
    const options = {
      columns: 2 as const,
      columnHeight: 230,
      columnHeights: [360, 230],
      categoryHeaderHeight: 30,
      itemGap: 6,
      productHeights: Object.fromEntries(categories[0].items.map((item) => [item.id, 60])),
    };
    const pages = paginateProductMenuColumns(categories, options);
    expect(pages).toHaveLength(2);
    expect(pages[0].sections.map((section) => [section.column, section.items.length, section.continued]))
      .toEqual([[0, 5, false], [1, 3, true]]);
    expect(pages[1].sections.map((section) => [section.column, section.items.length])).toEqual([[0, 2]]);
    expect(flatten(pages).map((item) => item.number)).toEqual(Array.from({ length: 10 }, (_, index) => index + 1));
    expect(paginateProductMenuColumns(categories, { ...options, columnHeights: [360] })).toEqual(pages);
    expect(paginateProductMenuColumns(categories, { ...options, columnHeights: [Number.NaN, 0] }))
      .toEqual(paginateProductMenuColumns(categories, { ...options, columnHeights: undefined }));
  });

  it("continues a category beneath a shorter bistro hero column without orphan headings", () => {
    const categories = buildProductMenu([
      ...["a", "b", "c"].map((id) => product(id)),
      ...["d", "e", "f"].map((id) => product(id, { cate_uuid_fk: "drinks", cate_name_eng: "Drinks" })),
    ], "en", labels);
    const pages = paginateProductMenuColumns(categories, {
      columns: 2,
      columnHeights: [360, 230],
      categoryHeights: { [categories[0].id]: 30, [categories[1].id]: 40 },
      productHeights: Object.fromEntries(["a", "b", "c", "d", "e", "f"].map((id) => [id, 60])),
      categoryGap: 12,
      itemGap: 6,
    });
    expect(pages).toHaveLength(2);
    expect(pages[0].sections.map((section) => [section.name, section.column, section.items.length, section.continued]))
      .toEqual([["Food", 0, 3, false], ["Drinks", 1, 2, false]]);
    expect(pages[1].sections[0]).toMatchObject({ name: "Drinks", column: 0, continued: true });
    expect(flatten(pages).map((item) => item.id)).toEqual(["a", "b", "c", "d", "e", "f"]);
  });

  it("splits oversized bistro records to fit the shorter column while preserving ninety prices", () => {
    const categories = buildProductMenu([product("sizes", {
      details: Array.from({ length: 90 }, (_, index) => ({
        pro_detail_uuid: `size-${index}`, size_name_eng: `Size ${index}`, pro_detail_sprice: index * 1000,
      })),
    })], "en", labels);
    const capacities = [500, 220];
    const pages = paginateProductMenuColumns(categories, { columns: 2, columnHeights: capacities, categoryHeaderHeight: 40 });
    const fragments = flatten(pages);
    expect(pages.length).toBeGreaterThan(1);
    expect(fragments.every((item) => item.number === 1 && item.originalId === "sizes")).toBe(true);
    expect(fragments.flatMap((item) => item.prices.map(({ label, amount }) => [label, amount])))
      .toEqual(categories[0].items[0].prices.map(({ label, amount }) => [label, amount]));
    for (const page of pages) for (const column of [0, 1]) {
      const sections = page.sections.filter((section) => section.column === column);
      const height = sections.reduce((sum, section, index) => sum + (index ? 12 : 0) + 40
        + section.items.reduce((items, item) => items + estimateMenuProductHeight(item), 0)
        + Math.max(0, section.items.length - 1) * 6, 0);
      expect(height).toBeLessThanOrEqual(capacities[column]);
    }
  });

  it("keeps a short new category whole in the next column instead of leaving one item behind", () => {
    const categories = buildProductMenu([
      ...["a", "b", "c"].map((id) => product(id)),
      ...["d", "e", "f"].map((id) => product(id, { cate_uuid_fk: "drinks", cate_name_eng: "Drinks" })),
    ], "en", labels);
    const pages = paginateProductMenuColumns(categories, {
      columns: 2,
      columnHeights: [360, 230],
      categoryHeaderHeight: 30,
      productHeights: { a: 60, b: 60, c: 60, d: 40, e: 40, f: 40 },
      categoryGap: 12,
      itemGap: 6,
    });
    expect(pages).toHaveLength(1);
    expect(pages[0].sections.map((section) => [section.name, section.column, section.items.length, section.continued]))
      .toEqual([["Food", 0, 3, false], ["Drinks", 1, 3, false]]);
    expect(flatten(pages).map((item) => item.id)).toEqual(["a", "b", "c", "d", "e", "f"]);
  });

  it("starts a long category with at least two items when a fresh column can fit them", () => {
    const categories = buildProductMenu([
      product("a"), product("b"),
      ...Array.from({ length: 9 }, (_, index) => product(`drink-${index}`, { cate_uuid_fk: "drinks", cate_name_eng: "Drinks" })),
    ], "en", labels);
    const pages = paginateProductMenuColumns(categories, {
      columns: 3,
      columnHeight: 300,
      categoryHeaderHeight: 40,
      productHeights: { a: 65, b: 65, ...Object.fromEntries(categories[1].items.map((item) => [item.id, 60])) },
      categoryGap: 12,
      itemGap: 6,
    });
    expect(pages[0].sections.map((section) => [section.name, section.column, section.items.length, section.continued]))
      .toEqual([["Food", 0, 2, false], ["Drinks", 1, 4, false], ["Drinks", 2, 4, true]]);
    expect(pages[1].sections[0]).toMatchObject({ name: "Drinks", column: 0, continued: true });
    expect(flatten(pages).map((item) => item.number)).toEqual(Array.from({ length: 11 }, (_, index) => index + 1));
  });

  it("allows one oversized continuation per column when no column can fit two", () => {
    const categories = buildProductMenu([product("a"), product("sizes", {
      cate_uuid_fk: "drinks",
      cate_name_eng: "Drinks",
      details: Array.from({ length: 90 }, (_, index) => ({
        pro_detail_uuid: `size-${index}`, size_name_eng: `Size ${index}`, pro_detail_sprice: index * 1000,
      })),
    })], "en", labels);
    const pages = paginateProductMenuColumns(categories, {
      columns: 2,
      columnHeight: 300,
      categoryHeaderHeight: 40,
      productHeights: { a: 100 },
    });
    const sections = pages.flatMap((page) => page.sections).filter((section) => section.id === categories[1].id);
    expect(sections.length).toBeGreaterThan(1);
    expect(sections.every((section) => section.items.length === 1 && estimateMenuProductHeight(section.items[0]) + 40 <= 300)).toBe(true);
    expect(sections[0]).toMatchObject({ column: 1, continued: false });
    expect(sections.slice(1).every((section) => section.continued)).toBe(true);
    expect(flatten(pages).filter((item) => item.originalId === "sizes").flatMap((item) => item.prices.map(({ label, amount }) => [label, amount])))
      .toEqual(categories[1].items[0].prices.map(({ label, amount }) => [label, amount]));
  });

  it("fills three measured columns in order and repeats continued category headings", () => {
    const categories = buildProductMenu(Array.from({ length: 7 }, (_, index) => product(String(index))), "en", labels);
    const pages = paginateProductMenuColumns(categories, {
      columns: 3,
      columnHeight: 250,
      categoryHeaderHeight: 40,
      itemGap: 10,
      productHeights: Object.fromEntries(categories[0].items.map((item) => [item.id, 80])),
    });
    expect(pages).toHaveLength(2);
    expect(pages[0].sections.map((section) => [section.column, section.items.length, section.continued]))
      .toEqual([[0, 2, false], [1, 2, true], [2, 2, true]]);
    expect(pages[1].sections[0]).toMatchObject({ column: 0, continued: true });
    expect(flatten(pages).map((item) => item.number)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("shares a page between categories while keeping each heading with its first item", () => {
    const categories = buildProductMenu([
      product("a"), product("b"),
      product("c", { cate_uuid_fk: "drinks", cate_name_eng: "Drinks" }),
      product("d", { cate_uuid_fk: "drinks", cate_name_eng: "Drinks" }),
    ], "en", labels);
    const options = {
      columns: 1 as const,
      columnHeight: 400,
      categoryHeights: { [categories[0].id]: 30, [categories[1].id]: 50 },
      productHeights: { a: 50, b: 50, c: 50, d: 50 },
      categoryGap: 12,
      itemGap: 6,
    };
    const pages = paginateProductMenuColumns(categories, options);
    expect(pages).toHaveLength(1);
    expect(pages[0].sections.map((section) => [section.name, section.column, section.continued]))
      .toEqual([["Food", 0, false], ["Drinks", 0, false]]);
    const smaller = paginateProductMenuColumns(categories, { ...options, columnHeight: 200 });
    expect(smaller).toHaveLength(2);
    expect(smaller[0].sections).toHaveLength(1);
    expect(smaller[1].sections[0]).toMatchObject({ name: "Drinks", continued: false });
    expect(smaller.every((page) => page.sections.every((section) => section.items.length > 0))).toBe(true);
    expect(paginateProductMenuColumns([])).toEqual([]);
  });

  it("limits editorial gallery photos by unique actual image IDs rather than missing image filenames", () => {
    const categories = buildProductMenu([
      ...["a", "b", "c"].map((id) => product(id, { prod_image: `${id}.jpg` })),
      ...["d", "e", "f", "g"].map((id) => product(id, { cate_uuid_fk: "drinks", cate_name_eng: "Drinks", prod_image: `${id}.jpg` })),
    ], "en", labels);
    const pages = paginateProductMenuColumns(categories, {
      columns: 1,
      columnHeight: 1000,
      categoryHeaderHeight: 30,
      maxPhotosPerPage: 2,
      images: { a: "actual-a", c: "actual-c", e: "actual-e", g: "actual-g" },
      productHeights: Object.fromEntries(["a", "b", "c", "d", "e", "f", "g"].map((id) => [id, 40])),
    });
    expect(pages.map((page) => flatten([page]).map((item) => item.id))).toEqual([["a", "b", "c", "d"], ["e", "f", "g"]]);
    expect(pages[1].sections[0]).toMatchObject({ name: "Drinks", continued: true });
    expect(flatten(pages).map((item) => item.number)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("counts repeated price continuations of one photographed dish as one gallery slot", () => {
    const categories = buildProductMenu([product("a"), product("b")], "en", labels);
    const original = categories[0].items[0];
    categories[0].items.splice(0, 1, ...Array.from({ length: 3 }, (_, index) => ({
      ...original,
      id: `a::part:${index + 1}`,
      originalId: "a",
      continued: index > 0,
    })));
    const pages = paginateProductMenuColumns(categories, {
      columns: 1,
      columnHeight: 1000,
      maxPhotosPerPage: 1,
      images: { a: "actual-a", b: "actual-b" },
    });
    expect(pages).toHaveLength(2);
    expect(pages[0].sections[0].items).toHaveLength(3);
    expect(pages[1].sections[0].items.map((item) => item.id)).toEqual(["b"]);
  });

  it("preserves ninety prices and set option text across measured oversized continuations", () => {
    const categories = buildProductMenu([product("sizes", {
      details: Array.from({ length: 90 }, (_, index) => ({
        pro_detail_uuid: `size-${index}`, size_name_eng: `Size ${index}`, pro_detail_sprice: index * 1000,
      })),
    })], "en", labels);
    categories[0].items[0].options = Array.from({ length: 25 }, (_, index) => `Included option ${index}`);
    const before = JSON.stringify(categories);
    const pages = paginateProductMenuColumns(categories, { columns: 3, columnHeight: 350, categoryHeaderHeight: 40 });
    expect(pages.length).toBeGreaterThan(1);
    const fragments = flatten(pages);
    expect(fragments.every((item) => item.number === 1 && item.originalId === "sizes")).toBe(true);
    expect(fragments.flatMap((item) => item.prices.map(({ label, amount }) => [label, amount])))
      .toEqual(categories[0].items[0].prices.map(({ label, amount }) => [label, amount]));
    expect(fragments.flatMap((item) => item.options)).toEqual(categories[0].items[0].options);
    for (const page of pages) {
      for (const column of [0, 1, 2]) {
        const sections = page.sections.filter((section) => section.column === column);
        const height = sections.reduce((sum, section, index) => sum + (index ? 12 : 0) + 40
          + section.items.reduce((items, item) => items + estimateMenuProductHeight(item), 0)
          + Math.max(0, section.items.length - 1) * 6, 0);
        expect(height).toBeLessThanOrEqual(350);
      }
    }
    expect(JSON.stringify(categories)).toBe(before);
  });
});
