import { describe, expect, it } from "vitest";
import type { MenuItem } from "@/config/menu";
import {
  activeMenuTitles,
  applyOfflineLock,
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
