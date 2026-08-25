import { describe, expect, it } from "vitest";
import type { MenuItem } from "@/config/menu";
import {
  activeMenuTitles,
  hasActiveRoute,
  isFixedDataScreen,
  isImmersiveScreen,
  menuItemLabel,
  routeIsActive,
  userInitials,
} from "./shell-menu-helpers";

const items: MenuItem[] = [
  { path: "/", title: "dashboard" },
  {
    title: "sales",
    children: [
      { path: "/pos/tables", title: "open_table_sale" },
      { path: "/sales/sales-list", title: "sales_list" },
    ],
  },
];

describe("routeIsActive", () => {
  it("matches the root route exactly and never as a prefix", () => {
    expect(routeIsActive("/", "/")).toBe(true);
    expect(routeIsActive("/products", "/")).toBe(false);
  });

  it("matches a route and its descendants", () => {
    expect(routeIsActive("/products", "/products")).toBe(true);
    expect(routeIsActive("/products/form", "/products")).toBe(true);
    expect(routeIsActive("/productions", "/products")).toBe(false);
  });

  it("is false without a path", () => {
    expect(routeIsActive("/products")).toBe(false);
  });
});

describe("hasActiveRoute", () => {
  it("is true when a child route is active", () => {
    expect(hasActiveRoute(items[1], "/sales/sales-list")).toBe(true);
  });

  it("is false when no descendant matches", () => {
    expect(hasActiveRoute(items[1], "/products")).toBe(false);
  });
});

describe("activeMenuTitles", () => {
  it("returns only groups that wrap the active route", () => {
    expect(activeMenuTitles(items, "/sales/sales-list")).toEqual([
      "sales",
      "sales_list",
    ]);
  });

  it("returns nothing when the active route sits outside every group", () => {
    expect(activeMenuTitles(items, "/products")).toEqual([]);
  });
});

describe("menuItemLabel", () => {
  const t = (key: string) => `t:${key}`;

  it("prefers the API-provided label", () => {
    expect(menuItemLabel({ label: "ຂາຍ", title: "sales" }, t)).toBe("ຂາຍ");
  });

  it("falls back to the namespaced translation key", () => {
    expect(menuItemLabel({ label: "", title: "sales" }, t)).toBe("t:nav.sales");
  });
});

describe("userInitials", () => {
  it("builds two initials from the store name", () => {
    expect(userInitials({ store_name: "Yummy Go" } as never)).toBe("YG");
  });

  it("falls back to YG without a user", () => {
    expect(userInitials(null)).toBe("YG");
  });
});

describe("isImmersiveScreen", () => {
  it("covers both protected POS screens only", () => {
    expect(isImmersiveScreen("/pos/tables")).toBe(true);
    expect(isImmersiveScreen("/pos/order")).toBe(true);
    expect(isImmersiveScreen("/products")).toBe(false);
  });
});

describe("isFixedDataScreen", () => {
  it("covers listed paths, prefixes, and immersive screens", () => {
    expect(isFixedDataScreen("/products")).toBe(true);
    expect(isFixedDataScreen("/settings/category")).toBe(true);
    expect(isFixedDataScreen("/report/daily-sales")).toBe(true);
    expect(isFixedDataScreen("/pos/order")).toBe(true);
  });

  it("leaves the dashboard scrollable", () => {
    expect(isFixedDataScreen("/")).toBe(false);
  });
});
