import { describe, expect, it } from "vitest";
import type { MenuItem } from "@/config/menu";
import {
  backFallbackPath,
  buildNativeNavigationModel,
  destinationPath,
  isDestinationActive,
  resolveAndroidBackAction,
  shouldShowBackButton,
} from "./native-navigation-model";

const menu: MenuItem[] = [
  { is_header: true, title: "manage" },
  { path: "/", title: "dashboard" },
  {
    path: "/sale",
    title: "sales",
    children: [
      { path: "/pos/tables", title: "open_table_sale" },
      { path: "/sales/sales-list", title: "sales_list" },
    ],
  },
  { path: "/products", title: "menu_add_item" },
  { path: "/stock", title: "stock_quantity" },
  { path: "/printers", title: "printer_management" },
];

describe("destinationPath", () => {
  it("uses a leaf item's own path", () => {
    expect(destinationPath({ path: "/products", title: "products" })).toBe(
      "/products",
    );
  });

  it("uses the first enabled child for a group", () => {
    expect(destinationPath(menu[2])).toBe("/pos/tables");
  });

  it("skips a disabled first child", () => {
    expect(
      destinationPath({
        title: "reports",
        children: [
          { path: "/report/monthly-sales", title: "monthly", disabled: true },
          { path: "/report/daily-sales", title: "daily" },
        ],
      }),
    ).toBe("/report/daily-sales");
  });

  it("is undefined for a disabled leaf", () => {
    expect(
      destinationPath({ path: "/stock", title: "stock", disabled: true }),
    ).toBeUndefined();
  });
});

describe("buildNativeNavigationModel", () => {
  it("takes the first three navigable items as direct destinations", () => {
    const model = buildNativeNavigationModel(menu);
    expect(model.direct.map((entry) => entry.path)).toEqual([
      "/",
      "/pos/tables",
      "/products",
    ]);
  });

  it("puts every remaining item under more", () => {
    const model = buildNativeNavigationModel(menu);
    expect(model.more.map((item) => item.title)).toEqual([
      "stock_quantity",
      "printer_management",
    ]);
  });

  it("drops header rows entirely", () => {
    const model = buildNativeNavigationModel(menu);
    expect(model.direct.some((entry) => entry.item.is_header)).toBe(false);
    expect(model.more.some((item) => item.is_header)).toBe(false);
  });

  it("sends an unresolvable item to more instead of wasting a direct slot", () => {
    const model = buildNativeNavigationModel([
      { path: "/stock", title: "stock", disabled: true },
      { path: "/", title: "dashboard" },
    ]);
    expect(model.direct.map((entry) => entry.path)).toEqual(["/"]);
    expect(model.more.map((item) => item.title)).toEqual(["stock"]);
  });

  it("produces no more entries when the menu is short", () => {
    const model = buildNativeNavigationModel([{ path: "/", title: "dash" }]);
    expect(model.more).toEqual([]);
  });

  it("injects sales-list into more right after cancel-sale, since the sale dropdown bypasses it entirely", () => {
    const model = buildNativeNavigationModel([
      { path: "/", title: "dashboard" },
      {
        path: "/sale",
        title: "sales",
        children: [
          { path: "/sales/open-table-sale", title: "open_table_sale" },
          { path: "/sales/sales-list", title: "sales_list" },
        ],
      },
      { path: "/products", title: "menu_add_item" },
      { path: "/sales/cancel-sale", title: "cancel_sale" },
      { path: "/printers", title: "printer_management" },
    ]);
    // "/sale" ยิงไป /sales/open-table-sale โดยตรง (destinationPath) กิน direct slot
    // ที่ 2 ไปแล้ว — /sales/sales-list เลยไม่มีทางเข้าถึงทั้งจาก direct และ more เดิม
    expect(model.direct.map((entry) => entry.path)).toEqual([
      "/",
      "/sales/open-table-sale",
      "/products",
    ]);
    expect(model.more.map((item) => item.path)).toEqual([
      "/sales/cancel-sale",
      "/sales/sales-list",
      "/printers",
    ]);
  });

  it("injects sales-list after the /cancel group when cancel-sale is nested in its children, matching the real permission API shape", () => {
    // เมนูจริงจาก permission API มีกลุ่ม "/cancel" แยกต่างหาก ไม่ใช่ /sales/cancel-sale
    // แบบ flat top-level แบบเทสด้านบน — cancel-sale เป็นลูกอยู่ใน children ของกลุ่มนี้
    const model = buildNativeNavigationModel([
      { path: "/", title: "dashboard" },
      {
        path: "/sale",
        title: "sales",
        children: [
          { path: "/sales/open-table-sale", title: "open_table_sale" },
          { path: "/sales/sales-list", title: "sales_list" },
        ],
      },
      { path: "/products", title: "menu_add_item" },
      {
        path: "/cancel",
        title: "cancel_sale_group",
        children: [
          { path: "/sales/cancel-sale", title: "cancel_sale" },
          { path: "/sales/cancel-history", title: "cancel_history" },
        ],
      },
      { path: "/printers", title: "printer_management" },
    ]);
    expect(model.more.map((item) => item.path)).toEqual([
      "/cancel",
      "/sales/sales-list",
      "/printers",
    ]);
  });

  it("does not inject sales-list when cancel-sale isn't in the menu at all", () => {
    const model = buildNativeNavigationModel([
      { path: "/", title: "dashboard" },
      {
        path: "/sale",
        title: "sales",
        children: [
          { path: "/sales/open-table-sale", title: "open_table_sale" },
          { path: "/sales/sales-list", title: "sales_list" },
        ],
      },
      { path: "/products", title: "menu_add_item" },
      { path: "/printers", title: "printer_management" },
    ]);
    expect(model.more.some((item) => item.path === "/sales/sales-list")).toBe(
      false,
    );
  });

  it("does not double-inject sales-list when it's already reachable on its own", () => {
    const model = buildNativeNavigationModel([
      { path: "/", title: "dashboard" },
      { path: "/products", title: "menu_add_item" },
      { path: "/sales/cancel-sale", title: "cancel_sale" },
      { path: "/sales/sales-list", title: "sales_list" },
    ]);
    expect(
      model.more.filter((item) => item.path === "/sales/sales-list"),
    ).toHaveLength(1);
  });
});

describe("isDestinationActive", () => {
  const model = buildNativeNavigationModel(menu);
  const dashboard = model.direct[0];
  const sales = model.direct[1];

  it("matches the destination's own path", () => {
    expect(isDestinationActive(sales, "/pos/tables")).toBe(true);
  });

  it("stays active on a sibling child of the same group", () => {
    expect(isDestinationActive(sales, "/sales/sales-list")).toBe(true);
  });

  it("matches a pathname that hits only the group's own path", () => {
    expect(isDestinationActive(sales, "/sale")).toBe(true);
  });

  it("does not treat the dashboard as a prefix of everything", () => {
    expect(isDestinationActive(dashboard, "/")).toBe(true);
    expect(isDestinationActive(dashboard, "/products")).toBe(false);
  });
});

describe("backFallbackPath", () => {
  it("maps every drill-in route to its parent", () => {
    expect(backFallbackPath("/pos/order")).toBe("/pos/tables");
    expect(backFallbackPath("/products/form")).toBe("/products");
    expect(backFallbackPath("/printers/form")).toBe("/printers");
  });

  it("is undefined for a normal route", () => {
    expect(backFallbackPath("/products")).toBeUndefined();
  });
});

describe("shouldShowBackButton", () => {
  const model = buildNativeNavigationModel(menu);

  it("hides back on a direct destination", () => {
    expect(shouldShowBackButton(model, "/")).toBe(false);
    expect(shouldShowBackButton(model, "/pos/tables")).toBe(false);
  });

  it("shows back on a drill-in route even inside an active group", () => {
    expect(shouldShowBackButton(model, "/pos/order")).toBe(true);
  });

  it("shows back on a route that only lives under more", () => {
    expect(shouldShowBackButton(model, "/printers")).toBe(true);
  });
});

describe("resolveAndroidBackAction", () => {
  const model = buildNativeNavigationModel(menu);

  it("prefers the deterministic parent over history", () => {
    expect(
      resolveAndroidBackAction({
        canGoBack: true,
        model,
        pathname: "/products/form",
      }),
    ).toEqual({ path: "/products", type: "navigate" });
  });

  it("minimizes at a direct destination instead of leaving the app", () => {
    expect(
      resolveAndroidBackAction({
        canGoBack: true,
        model,
        pathname: "/",
      }),
    ).toEqual({ type: "minimize" });
  });

  it("uses history for a more route that has one", () => {
    expect(
      resolveAndroidBackAction({
        canGoBack: true,
        model,
        pathname: "/printers",
      }),
    ).toEqual({ type: "history-back" });
  });

  it("minimizes on a deep link with no history to pop", () => {
    expect(
      resolveAndroidBackAction({
        canGoBack: false,
        model,
        pathname: "/printers",
      }),
    ).toEqual({ type: "minimize" });
  });
});
