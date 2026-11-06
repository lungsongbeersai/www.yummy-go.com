import { describe, expect, it } from "vitest";
import { ShoppingCart } from "lucide-react";
import type { MenuItem } from "@/config/menu";
import { internalRoute } from "@/lib/routes";
import { mobileMenuItem } from "./mobile-menu";

const openSale: MenuItem = { path: "/posAll/tables", title: "open-sale", label: "Open sale" };
const saleList: MenuItem = { path: "/sales/sales-list", title: "sale-list", label: "Sales list" };

function group(children: MenuItem[]): MenuItem {
  return {
    title: "sales-group",
    label: "Sales",
    path: "/sale",
    icon: ShoppingCart,
    iconName: "ShoppingCart",
    badgeText: "New",
    source: "permission-api",
    children,
  };
}

describe("mobileMenuItem", () => {
  it("turns one usable child into a direct link while preserving the group's identity and presentation", () => {
    const parent = group([openSale]);
    expect(mobileMenuItem(parent)).toEqual({ ...parent, path: openSale.path, children: undefined });
  });

  it("links directly to the selected sales-list child instead of the group's nonexistent page", () => {
    expect(mobileMenuItem(group([saleList])).path).toBe("/sales/sales-list");
  });

  it("keeps two usable children as a group", () => {
    const parent = group([openSale, saleList]);
    expect(mobileMenuItem(parent)).toBe(parent);
  });

  it("ignores disabled, header and pathless siblings when counting usable children", () => {
    const parent = group([
      { ...saleList, disabled: true },
      { title: "header", path: "/products", is_header: true },
      { title: "pathless" },
      { title: "empty-path", path: "" },
      openSale,
    ]);
    expect(mobileMenuItem(parent)).toEqual({ ...parent, path: openSale.path, children: undefined });
  });

  it("does not turn a disabled parent into an enabled link", () => {
    const parent = { ...group([openSale]), disabled: true };
    expect(mobileMenuItem(parent)).toBe(parent);
  });

  it("keeps a header parent unchanged", () => {
    const parent = { ...group([openSale]), is_header: true };
    expect(mobileMenuItem(parent)).toBe(parent);
  });

  it("keeps a group with no usable destination unchanged", () => {
    const parent = group([{ ...openSale, disabled: true }, { title: "pathless" }]);
    expect(mobileMenuItem(parent)).toBe(parent);
  });

  it("keeps nested groups intact instead of bypassing their choices", () => {
    const parent = group([{ title: "nested", path: "/nested", children: [openSale] }]);
    expect(mobileMenuItem(parent)).toBe(parent);
  });

  it("keeps a nested sibling intact even when only one other leaf is usable", () => {
    const parent = group([openSale, { title: "nested", disabled: true, children: [saleList] }]);
    expect(mobileMenuItem(parent)).toBe(parent);
  });

  it("treats an empty child list as a leaf when that child has a destination", () => {
    const parent = group([{ ...openSale, children: [] }]);
    expect(mobileMenuItem(parent).children).toBeUndefined();
    expect(mobileMenuItem(parent).path).toBe(openSale.path);
  });

  it.each<MenuItem>([openSale, { title: "empty-group", children: [] }, { title: "pathless" }])(
    "keeps existing leaves and empty groups unchanged: $title",
    (item) => expect(mobileMenuItem(item)).toBe(item),
  );

  it("retains legacy destinations for the shared internalRoute alias handling", () => {
    const projected = mobileMenuItem(group([{ ...openSale, path: "/sales/open-table-sale" }]));
    expect(projected.path).toBe("/sales/open-table-sale");
    expect(internalRoute(projected.path ?? "")).toBe("/posAll/tables");
  });

  it("does not mutate the original tree shared with desktop and breadcrumbs", () => {
    const child = Object.freeze({ ...openSale });
    const children = [child];
    Object.freeze(children);
    const parent = Object.freeze(group(children));
    const projected = mobileMenuItem(parent);

    expect(projected).not.toBe(parent);
    expect(parent.path).toBe("/sale");
    expect(parent.children).toBe(children);
    expect(parent.children?.[0]).toBe(child);
    expect(child.path).toBe("/posAll/tables");
  });
});
