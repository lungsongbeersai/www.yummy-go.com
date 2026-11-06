import { describe, expect, it } from "vitest";
import type { MenuItem } from "@/config/menu";
import { internalRoute } from "@/lib/routes";
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
      { path: "/posAll/tables", title: "open_table_sale" },
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
    expect(destinationPath(menu[2])).toBe("/posAll/tables");
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

  it("does not enable a disabled group through one of its children", () => {
    expect(destinationPath({ ...menu[2], disabled: true })).toBeUndefined();
  });

  it("does not use a header child's path as the representative destination", () => {
    expect(destinationPath({ title: "sales", children: [
      { title: "header", path: "/products", is_header: true },
      { title: "sales-list", path: "/sales/sales-list" },
    ] })).toBe("/sales/sales-list");
  });
});

describe("buildNativeNavigationModel", () => {
  it("takes the first three navigable items as direct destinations", () => {
    const model = buildNativeNavigationModel(menu);
    expect(model.direct.map((entry) => entry.path)).toEqual([
      "/",
      "/posAll/tables",
      "/products",
    ]);
  });

  it("puts every remaining item under more", () => {
    const model = buildNativeNavigationModel(menu);
    // Direct groups expose all their children in their own Drawer, so More contains
    // only the remaining top-level entries in backend order.
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

  it("keeps a resolved path that duplicates an earlier direct destination, since backend pairs a shortcut link with its full dropdown on purpose", () => {
    // permission API เจอจริง: มีทั้งเมนูลิงก์ลัด "เปิดขายโต๊ะ" แยกเดี่ยว วางติดกับกลุ่ม "ขาย"
    // ที่ children ตัวแรกก็ resolve ไปที่ /posAll/tables เหมือนกัน (ผ่าน destinationPath bypass)
    // เป็นการจัดวางที่ backend ตั้งใจ ไม่ใช่ข้อมูลซ้ำโดยไม่ตั้งใจ — เคยแก้โดยข้าม path ที่ใช้ไป
    // แล้วลง more แต่นั่นไปเบียดลำดับ direct ให้ไม่ตรงกับ backend/desktop อีกที ตอนนี้ปล่อยให้
    // path ซ้ำได้ตามจริง (แก้ React key ชนกันที่จุด render ด้วย item.title แทน)
    const model = buildNativeNavigationModel([
      { path: "/", title: "dashboard" },
      { path: "/posAll/tables", title: "open_table_sale" },
      {
        path: "/sale",
        title: "sales",
        children: [
          { path: "/posAll/tables", title: "open_table_sale" },
          { path: "/sales/sales-list", title: "sales_list" },
        ],
      },
      { path: "/products", title: "menu_add_item" },
    ]);
    expect(model.direct.map((entry) => entry.path)).toEqual([
      "/",
      "/posAll/tables",
      "/posAll/tables",
    ]);
    expect(model.direct.map((entry) => entry.item.title)).toEqual([
      "dashboard",
      "open_table_sale",
      "sales",
    ]);
    expect(model.direct[2].item.children?.map((child) => child.title)).toEqual([
      "open_table_sale",
      "sales_list",
    ]);
    expect(model.more.map((item) => item.title)).toEqual([
      "menu_add_item",
    ]);
  });

  it("matches the real permission API shape end to end: shortcut + dropdown pair, then everything else in order", () => {
    // สร้างจาก response จริงของ GET /api/v1/permission/menu (role Super Admin) ที่ทำให้เกิด
    // "React key ซ้ำที่ /posAll/tables" ครั้งแรก แล้วต่อมาทำให้ลำดับใน "เพิ่มเติม" ไม่ตรงกับ
    // backend/desktop หลังแก้ครั้งก่อนแบบ dedupe-into-more — ยืนยันว่าตอนนี้ direct/more
    // เรียงตรงกับลำดับ menu_sort ของ backend ทุกตัว (ไม่มีการสลับ/เบียดตำแหน่งอีก)
    const model = buildNativeNavigationModel([
      { path: "/", title: "home-id" },
      { path: "/posAll/tables", title: "sell-shortcut-id" },
      {
        path: "/sale",
        title: "open-sale-group-id",
        children: [
          { path: "/posAll/tables", title: "open-table-sale-id" },
          { path: "/sales/sales-list", title: "sales-list-id" },
          { path: "/sales/stuck-orders", title: "stuck-orders-id" },
        ],
      },
      { path: "/order_manage", title: "order-manage-id" },
      {
        path: "/cancel",
        title: "cancel-group-id",
        children: [
          { path: "/sales/cancel-sale", title: "cancel-sale-id" },
          { path: "/sales/cancel-history", title: "cancel-history-id" },
        ],
      },
      { path: "/products", title: "products-id" },
      { path: "/stock", title: "stock-id" },
      { path: "/printers", title: "printers-id" },
      {
        path: "/report",
        title: "report-group-id",
        children: [{ path: "/report/daily-sales", title: "daily-sales-id" }],
      },
      {
        path: "/settings",
        title: "settings-group-id",
        children: [{ path: "/settings/store", title: "store-id" }],
      },
      { path: "/package", title: "package-id" },
    ]);

    expect(model.direct.map((entry) => entry.item.title)).toEqual([
      "home-id",
      "sell-shortcut-id",
      "open-sale-group-id",
    ]);
    expect(model.more.map((item) => item.title)).toEqual([
      "order-manage-id",
      "cancel-group-id",
      "products-id",
      "stock-id",
      "printers-id",
      "report-group-id",
      "settings-group-id",
      "package-id",
    ]);
  });

  it("keeps all direct-group children together instead of spilling siblings into more", () => {
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
    expect(model.direct.map((entry) => entry.path)).toEqual([
      "/",
      "/sales/open-table-sale",
      "/products",
    ]);
    expect(model.more.map((item) => item.path)).toEqual([
      "/sales/cancel-sale",
      "/printers",
    ]);
    expect(model.direct[1].item.children?.map((child) => child.path)).toEqual([
      "/sales/open-table-sale",
      "/sales/sales-list",
    ]);
  });

  it("keeps a direct group's sibling reachable in the group when the rest of the menu changes", () => {
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
    expect(model.more.map((item) => item.path)).toEqual([
      "/printers",
    ]);
    expect(model.direct[1].item.children?.[1].path).toBe("/sales/sales-list");
  });

  it("does not create an extra more row for a child already exposed by a direct group", () => {
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
      { path: "/sales/sales-list", title: "sales_list_duplicate" },
      { path: "/printers", title: "printer_management" },
    ]);
    expect(
      model.more.filter((item) => item.path === "/sales/sales-list"),
    ).toHaveLength(1);
  });

  it("projects one permitted child into a direct destination and preserves its parent identity", () => {
    const source: MenuItem = {
      title: "sales-group", label: "Sales", iconName: "ShoppingCart", path: "/sale",
      children: [{ title: "selected-sales-list", path: "/sales/sales-list" }],
    };
    const model = buildNativeNavigationModel([source]);
    expect(model.direct).toEqual([{ item: { ...source, path: "/sales/sales-list", children: undefined }, path: "/sales/sales-list" }]);
    expect(model.more).toEqual([]);
    expect(source.path).toBe("/sale");
    expect(source.children).toHaveLength(1);
  });

  it("projects a single permitted child under more after the direct slots are full", () => {
    const source: MenuItem = { title: "reports", path: "/report", children: [{ title: "daily", path: "/report/daily-sales" }] };
    const model = buildNativeNavigationModel([source], 0);
    expect(model.direct).toEqual([]);
    expect(model.more).toEqual([{ ...source, path: "/report/daily-sales", children: undefined }]);
  });

  it("preserves duplicate top-level destinations under more in backend order", () => {
    const items: MenuItem[] = [
      { title: "shortcut", path: "/posAll/tables" },
      { title: "sales-group", path: "/sale", children: [{ title: "open-sale", path: "/posAll/tables" }] },
    ];
    const model = buildNativeNavigationModel(items, 0);
    expect(model.more.map((item) => item.title)).toEqual(["shortcut", "sales-group"]);
    expect(model.more.map((item) => item.path)).toEqual(["/posAll/tables", "/posAll/tables"]);
  });

  it("keeps legacy single-child destinations compatible with shared route aliases", () => {
    const model = buildNativeNavigationModel([{ title: "sales", path: "/sale", children: [
      { title: "open-sale", path: "/sales/open-table-sale" },
      { title: "sales-list", path: "/sales/sales-list", disabled: true },
    ] }]);
    expect(model.direct[0].item.children).toBeUndefined();
    expect(internalRoute(model.direct[0].path)).toBe("/posAll/tables");
  });
});

describe("isDestinationActive", () => {
  const model = buildNativeNavigationModel(menu);
  const dashboard = model.direct[0];
  const sales = model.direct[1];

  it("matches the destination's own path", () => {
    expect(isDestinationActive(sales, "/posAll/tables")).toBe(true);
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
    expect(backFallbackPath("/posAll/order")).toBe("/posAll/tables");
    expect(backFallbackPath("/products/form")).toBe("/products");
    expect(backFallbackPath("/printers/form")).toBe("/printers");
  });

  // /posAll/tables ซ่อน side rail ของตัวเองไปแล้ว (ดู capacitor/app-shell.tsx) เลยต้องมีปุ่ม
  // Back กลับ dashboard แทนแม้จะเป็น direct destination ในเมนูก็ตาม
  it("maps the table screen back to the dashboard", () => {
    expect(backFallbackPath("/posAll/tables")).toBe("/");
  });

  it("is undefined for a normal route", () => {
    expect(backFallbackPath("/products")).toBeUndefined();
  });
});

describe("shouldShowBackButton", () => {
  const model = buildNativeNavigationModel(menu);

  it("hides back on a direct destination", () => {
    expect(shouldShowBackButton(model, "/")).toBe(false);
  });

  it("shows back on /posAll/tables despite being a direct destination", () => {
    expect(shouldShowBackButton(model, "/posAll/tables")).toBe(true);
  });

  it("shows back on a drill-in route even inside an active group", () => {
    expect(shouldShowBackButton(model, "/posAll/order")).toBe(true);
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
