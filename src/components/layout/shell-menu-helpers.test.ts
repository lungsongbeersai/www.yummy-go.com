import { describe, expect, it } from "vitest";
import type { MenuItem } from "@/config/menu";
import {
  activeMenuTitles,
  applyOfflineLock,
  firstNavigablePath,
  hasActiveRoute,
  isFixedDataScreen,
  isImmersiveScreen,
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

describe("applyOfflineLock", () => {
  const menu: MenuItem[] = [
    { path: "/pos/tables", title: "open_table_sale" },
    { path: "/pos/order", title: "order" },
    {
      title: "sales",
      children: [
        { path: "/sales/sales-list", title: "sales_list" },
        { path: "/sales/cancel-sale", title: "cancel_sale" },
      ],
    },
    { path: "/settings/user", title: "user_management" },
    { path: "/settings/topping", title: "topping" },
  ];

  it("returns items unchanged while online", () => {
    const result = applyOfflineLock(menu, false, false);
    expect(result.every((item) => !item.offlineLocked)).toBe(true);
  });

  it("locks only paths outside the essential allowlist, recursively", () => {
    const [openTable, order, sales, users, topping] = applyOfflineLock(menu, true, false);
    expect(openTable.offlineLocked).toBe(false);
    expect(order.offlineLocked).toBe(false);
    expect(sales.children?.[0].offlineLocked).toBe(false);
    expect(sales.children?.[1].offlineLocked).toBe(true);
    // Master data the Agent projects locally stays reachable, read-only.
    expect(users.offlineLocked).toBe(false);
    // Settings with no local projection stay locked.
    expect(topping.offlineLocked).toBe(true);
  });

  it("leaves the order-taking flow reachable on Android, unlike table move/join/split", () => {
    const [openTable, order] = applyOfflineLock(menu, true, true);
    // Both stage offline now — write-fallback.ts synthesizes a response from
    // the Dexie outbox instead of needing a Local Agent Android doesn't have.
    expect(openTable.offlineLocked).toBe(false);
    expect(order.offlineLocked).toBe(false);
  });
});

describe("firstNavigablePath", () => {
  it("picks the first leaf path in order", () => {
    expect(firstNavigablePath(items)).toBe("/");
  });

  it("skips a disabled leaf and falls through to the next item", () => {
    const menu: MenuItem[] = [
      { path: "/report/monthly-sales", title: "monthly_sales_report", disabled: true },
      { path: "/pos/tables", title: "open_table_sale" },
    ];
    expect(firstNavigablePath(menu)).toBe("/pos/tables");
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
    const waiterMenu: MenuItem[] = [{ path: "/pos/tables", title: "sales" }];
    expect(menuGrantsPath(waiterMenu, "/")).toBe(false);
  });
});
