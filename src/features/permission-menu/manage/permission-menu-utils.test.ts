import { describe, expect, it } from "vitest";
import type { PermissionMainMenu } from "@/services/permission-menu";
import {
  badgeLabel,
  filterPermissionMenus,
  menuBadgeText,
  movePermissionItem,
  resolveSelectedPermissionMenuId
} from "./permission-menu-utils";

function menu(
  menu_id: string,
  menu_title: string,
  menu_path: string,
  sub_detail: PermissionMainMenu["sub_detail"] = [],
  menu_badge_text = ""
): PermissionMainMenu {
  return {
    menu_badge: 2,
    menu_badge_text,
    menu_icon: "file-text",
    menu_id,
    menu_path,
    menu_sort: 1,
    menu_status: 1,
    menu_title,
    menu_title_eng: menu_title,
    menu_title_la: menu_title,
    sub_detail
  };
}

const menus: PermissionMainMenu[] = [
  menu("main-1", "Home", "/", []),
  menu("main-2", "Sale", "/sale", [
    {
      menu_id: "main-2",
      sub_id: "sub-1",
      sub_path: "/saleorder",
      sub_sort: 1,
      sub_status: 1,
      sub_title: "Order",
      sub_title_eng: "Order",
      sub_title_la: "Order"
    }
  ]),
  menu("main-3", "Report", "/report", [], "News")
];

const t = (key: string, options?: Record<string, unknown>) =>
  key === "permissionMenu.badgeTextValue" ? `Badge: ${String(options?.text ?? "")}` : key;

describe("permission menu utils", () => {
  it("preserves selected menu id when it still exists", () => {
    expect(resolveSelectedPermissionMenuId(menus, "main-2")).toBe("main-2");
  });

  it("falls back to first menu when selected menu is missing", () => {
    expect(resolveSelectedPermissionMenuId(menus, "deleted")).toBe("main-1");
  });

  it("returns an empty selection when there are no menus", () => {
    expect(resolveSelectedPermissionMenuId([], "main-1")).toBe("");
  });

  it("moves items up and down", () => {
    expect(movePermissionItem(menus, "main-2", "up", (item) => item.menu_id).map((item) => item.menu_id))
      .toEqual(["main-2", "main-1", "main-3"]);
    expect(movePermissionItem(menus, "main-2", "down", (item) => item.menu_id).map((item) => item.menu_id))
      .toEqual(["main-1", "main-3", "main-2"]);
  });

  it("keeps item order for invalid moves", () => {
    expect(movePermissionItem(menus, "main-1", "up", (item) => item.menu_id)).toBe(menus);
    expect(movePermissionItem(menus, "missing", "down", (item) => item.menu_id)).toBe(menus);
  });

  it("filters by menu and submenu content", () => {
    expect(filterPermissionMenus(menus, "sale").map((item) => item.menu_id)).toEqual(["main-2"]);
    expect(filterPermissionMenus(menus, "saleorder").map((item) => item.menu_id)).toEqual(["main-2"]);
    expect(filterPermissionMenus(menus, "news").map((item) => item.menu_id)).toEqual(["main-3"]);
    expect(filterPermissionMenus(menus, "  ").map((item) => item.menu_id)).toEqual([
      "main-1",
      "main-2",
      "main-3"
    ]);
  });

  it("uses badge text when the badge is visible", () => {
    expect(badgeLabel(1, t, "News")).toBe("Badge: News");
    expect(badgeLabel(1, t, "")).toBe("permissionMenu.badgeShow");
    expect(badgeLabel(2, t, "News")).toBe("permissionMenu.badgeHide");
  });

  it("returns only visible menu badge text", () => {
    expect(menuBadgeText(1, " News ")).toBe("News");
    expect(menuBadgeText(2, "News")).toBe("");
    expect(menuBadgeText(1, "   ")).toBe("");
  });
});
