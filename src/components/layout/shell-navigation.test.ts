import { describe, expect, it } from "vitest";
import type { MenuItem } from "@/config/menu";
import {
  deriveShellDestinations,
  filterMenu,
  reportMenuItems,
  resolveBreadcrumbs,
  routeIsActive,
  shellRouteIsActive,
  shellRouteMode,
} from "@/components/layout/shell-navigation";

const menuFixture: MenuItem[] = [
  { path: "/", title: "dashboard" },
  {
    title: "sales",
    children: [{ path: "/pos/tables", title: "open_table_sale" }],
  },
  {
    path: "/report",
    title: "report_menu",
    children: [
      { path: "/report/daily-sales", title: "daily_sales_report" },
      { disabled: true, path: "/report/monthly-sales", title: "monthly_sales_report" },
    ],
  },
  { is_header: true, title: "manage" },
];

describe("shell navigation", () => {
  it("removes menu items that the current role cannot access while retaining allowed descendants", () => {
    const items = filterMenu(
      [
        { path: "/dashboard", title: "dashboard" },
        { allowedStatus: [1], path: "/admin", title: "admin" },
        {
          title: "settings",
          children: [
            { allowedStatus: [2], path: "/settings/store", title: "store" },
            { path: "/settings/table", title: "table" },
          ],
        },
      ],
      2,
    );

    expect(items).toEqual([
      { path: "/dashboard", title: "dashboard" },
      {
        title: "settings",
        children: [
          { allowedStatus: [2], path: "/settings/store", title: "store" },
          { path: "/settings/table", title: "table" },
        ],
      },
    ]);
  });

  it("matches root exactly and section routes by path segment", () => {
    expect(routeIsActive("/", "/")).toBe(true);
    expect(routeIsActive("/products", "/")).toBe(false);
    expect(routeIsActive("/report/daily-sales", "/report")).toBe(true);
    expect(routeIsActive("/reporting", "/report")).toBe(false);
    expect(shellRouteIsActive("tables", "/pos/order")).toBe(false);
    expect(shellRouteIsActive("reports", "/report/daily-sales")).toBe(true);
  });

  it("does not turn permission API group paths into breadcrumb links", () => {
    const trail = resolveBreadcrumbs(
      [{
        path: "/report",
        title: "report_menu",
        children: [{ path: "/report/daily-sales", title: "daily_sales_report" }],
      }],
      "/report/daily-sales",
    );

    expect(trail).toEqual([
      { disabled: undefined, label: undefined, path: undefined, title: "report_menu" },
      {
        disabled: undefined,
        label: undefined,
        path: "/report/daily-sales",
        title: "daily_sales_report",
      },
    ]);
  });

  it("uses the existing fixed-content paths and keeps protected POS pages in the POS workspace", () => {
    expect(shellRouteMode("/products")).toEqual({
      fixedContent: true,
      mobileBackHref: null,
      posWorkspace: false,
    });
    expect(shellRouteMode("/report/daily-sales")).toEqual({
      fixedContent: true,
      mobileBackHref: null,
      posWorkspace: false,
    });
    expect(shellRouteMode("/pos/tables")).toEqual({
      fixedContent: true,
      mobileBackHref: null,
      posWorkspace: true,
    });
    expect(shellRouteMode("/pos/order")).toEqual({
      fixedContent: true,
      mobileBackHref: "/pos/tables",
      posWorkspace: true,
    });
    expect(shellRouteMode("/profile")).toEqual({
      fixedContent: false,
      mobileBackHref: null,
      posWorkspace: false,
    });
  });

  it("extracts report children in their original order, including disabled reports", () => {
    expect(reportMenuItems(menuFixture)).toEqual([
      { path: "/report/daily-sales", title: "daily_sales_report" },
      { disabled: true, path: "/report/monthly-sales", title: "monthly_sales_report" },
    ]);
  });

  it("keeps the POS destination distinct from Tables and resumes the current table", () => {
    const destinations = deriveShellDestinations({
      items: menuFixture,
      pathname: "/pos/order",
      tableName: "A 01",
      tableUuid: "table-1",
    });

    expect(destinations.map((item) => item.id)).toEqual([
      "dashboard",
      "tables",
      "pos",
      "reports",
      "more",
    ]);
    expect(destinations.find((item) => item.id === "tables")?.active).toBe(false);
    expect(destinations.find((item) => item.id === "pos")).toMatchObject({
      active: true,
      enabled: true,
      href: "/pos/order?table_uuid=table-1&table_name=A+01",
    });
  });

  it("falls back to the table selection route when there is no current table", () => {
    const pos = deriveShellDestinations({
      items: menuFixture,
      pathname: "/pos/tables",
      tableName: "",
      tableUuid: "",
    }).find((item) => item.id === "pos");

    expect(pos).toMatchObject({
      active: false,
      enabled: true,
      href: "/pos/tables",
    });
  });
});
