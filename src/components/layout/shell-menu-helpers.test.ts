import { describe, expect, it } from "vitest";
import type { MenuItem } from "@/config/menu";
import {
  activeMenuTitles,
  firstNavigablePath,
  hasActiveRoute,
  isFixedDataScreen,
  isImmersiveScreen,
  isPublicAppPath,
  menuGrantsPath,
  menuItemLabel,
  routeIsActive,
  userInitials,
} from "./shell-menu-helpers";

const items: MenuItem[] = [
  { path: "/", title: "dashboard" },
  {
    title: "sales",
    children: [
      { path: "/posAll/tables", title: "open_table_sale" },
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
    // sales_list เป็น leaf จึงไม่อยู่ในผลลัพธ์ — sidebar อ่านค่านี้เพื่อกางกลุ่มเท่านั้น
    expect(activeMenuTitles(items, "/sales/sales-list")).toEqual(["sales"]);
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
    expect(isImmersiveScreen("/posAll/tables")).toBe(true);
    expect(isImmersiveScreen("/posAll/order")).toBe(true);
    expect(isImmersiveScreen("/products")).toBe(false);
  });
});

describe("isFixedDataScreen", () => {
  it("covers listed paths, prefixes, and immersive screens", () => {
    expect(isFixedDataScreen("/products")).toBe(true);
    expect(isFixedDataScreen("/settings/category")).toBe(true);
    expect(isFixedDataScreen("/report/daily-sales")).toBe(true);
    expect(isFixedDataScreen("/posAll/order")).toBe(true);
  });

  it("leaves the dashboard scrollable", () => {
    expect(isFixedDataScreen("/")).toBe(false);
  });
});

describe("firstNavigablePath", () => {
  it("picks the first leaf path in order", () => {
    expect(firstNavigablePath(items)).toBe("/");
  });

  it("skips a disabled leaf and falls through to the next item", () => {
    const menu: MenuItem[] = [
      { path: "/report/monthly-sales", title: "monthly_sales_report", disabled: true },
      { path: "/posAll/tables", title: "open_table_sale" },
    ];
    expect(firstNavigablePath(menu)).toBe("/posAll/tables");
  });

  it("descends into a dropdown group instead of using the group's own path", () => {
    const menu: MenuItem[] = [
      {
        title: "sales",
        children: [{ path: "/sales/sales-list", title: "sales_list" }],
      },
    ];
    expect(firstNavigablePath(menu)).toBe("/sales/sales-list");
  });

  it("returns undefined when nothing is navigable", () => {
    expect(firstNavigablePath([{ title: "sales", children: [] }])).toBeUndefined();
  });
});

describe("menuGrantsPath", () => {
  it("matches a top-level item's path exactly", () => {
    expect(menuGrantsPath(items, "/")).toBe(true);
  });

  it("matches a path nested inside a dropdown group", () => {
    expect(menuGrantsPath(items, "/sales/sales-list")).toBe(true);
  });

  it("is false when the path was never granted", () => {
    expect(menuGrantsPath(items, "/settings/user")).toBe(false);
  });

  it("is false for a single-item menu that only grants Sales, not Dashboard", () => {
    const waiterMenu: MenuItem[] = [{ path: "/posAll/tables", title: "sales" }];
    expect(menuGrantsPath(waiterMenu, "/")).toBe(false);
  });
});

describe("isPublicAppPath", () => {
  it("matches the public routes outside the protected group", () => {
    for (const path of ["/home", "/login", "/policy", "/customer-display", "/posAll", "/login/extra"]) {
      expect(isPublicAppPath(path)).toBe(true);
    }
  });

  it("treats protected routes, including /posAll children, as app-shell routes", () => {
    for (const path of ["/", "/products", "/posAll/tables", "/posAll/order", "/homework"]) {
      expect(isPublicAppPath(path)).toBe(false);
    }
  });
});
