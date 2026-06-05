import { describe, expect, it } from "vitest";
import {
  buildCreateMainMenuPayload,
  buildCreateSubMenuPayload,
  buildMainMenuSortPayload,
  buildSubMenuSortPayload,
  normalizePermissionMainMenu,
  normalizePermissionMenuTreeResponse,
  permissionMenuBadgeValue
} from "@/services/permission-menu";

describe("permission menu service helpers", () => {
  it("normalizes main menus and nested submenus from fetch_all", () => {
    const tree = normalizePermissionMenuTreeResponse({
      total: 2,
      data: [
        {
          menu_id: "menu-2",
          menu_path: "/reports",
          menu_sort: 2,
          menu_title: "Reports",
          sub_detail: []
        },
        {
          menu_badge: 1,
          menu_icon: "settings",
          menu_id: "menu-1",
          menu_path: "/setting",
          menu_sort: 1,
          menu_status: 1,
          menu_title_eng: "Settings",
          menu_title_la: "Settings LA",
          sub_detail: [
            {
              sub_id: "sub-2",
              sub_path: "/setting/category",
              sub_sort: 2,
              sub_status: 1,
              sub_title: "Category"
            },
            {
              sub_id: "sub-1",
              sub_path: "/setting/store",
              sub_sort: 1,
              sub_title_eng: "Store",
              sub_title_la: "Store LA"
            }
          ]
        }
      ]
    });

    expect(tree.total).toBe(2);
    expect(tree.menus.map((menu) => menu.menu_id)).toEqual(["menu-1", "menu-2"]);
    expect(tree.menus[0]).toMatchObject({
      menu_badge: 1,
      menu_icon: "settings",
      menu_title: "Settings LA"
    });
    expect(tree.menus[0].sub_detail.map((submenu) => submenu.sub_id)).toEqual(["sub-1", "sub-2"]);
    expect(tree.menus[0].sub_detail[0]).toMatchObject({
      menu_id: "menu-1",
      sub_status: 1,
      sub_title: "Store LA"
    });
  });

  it("builds create main menu payload with two-language titles", () => {
    expect(
      buildCreateMainMenuPayload({
        menu_badge: "1",
        menu_icon: "fa fa-file",
        menu_path: "/report",
        menu_status: "2",
        menu_title_eng: "Report",
        menu_title_la: "Report LA"
      })
    ).toEqual({
      menu_badge: 1,
      menu_icon: "fa fa-file",
      menu_id: "",
      menu_path: "/report",
      menu_status: 2,
      menu_title_eng: "Report",
      menu_title_la: "Report LA"
    });
  });

  it("builds create submenu payload with two-language titles", () => {
    expect(
      buildCreateSubMenuPayload({
        menu_id: "menu-1",
        sub_path: "/report/sale",
        sub_status: "1",
        sub_title_eng: "Sale report",
        sub_title_la: "Sale report LA"
      })
    ).toEqual({
      menu_id: "menu-1",
      sub_id: "",
      sub_path: "/report/sale",
      sub_status: 1,
      sub_title_eng: "Sale report",
      sub_title_la: "Sale report LA"
    });
    expect(
      buildCreateSubMenuPayload({
        menu_id: "menu-1",
        sub_path: "/report/plc",
        sub_status: "2",
        sub_title_eng: "PLC report",
        sub_title_la: "PLC report LA"
      }).sub_status
    ).toBe(2);
  });

  it("keeps manually entered paths in create payloads", () => {
    expect(
      buildCreateMainMenuPayload({
        menu_path: "/",
        menu_title_eng: "Home",
        menu_title_la: "Home LA"
      }).menu_path
    ).toBe("/");
    expect(
      buildCreateMainMenuPayload({
        menu_path: "sale",
        menu_title_eng: "Sale",
        menu_title_la: "Sale LA"
      }).menu_path
    ).toBe("sale");
    expect(
      buildCreateSubMenuPayload({
        menu_id: "menu-sale",
        sub_path: "/saleorder",
        sub_title_eng: "Sale order",
        sub_title_la: "Sale order LA"
      }).sub_path
    ).toBe("/saleorder");
  });

  it("keeps ids in create payloads for backend upsert updates", () => {
    expect(
      buildCreateMainMenuPayload({
        menu_id: "menu-1",
        menu_path: "sale",
        menu_title_eng: "Sale",
        menu_title_la: "Sale LA"
      }).menu_id
    ).toBe("menu-1");
    expect(
      buildCreateSubMenuPayload({
        menu_id: "menu-1",
        sub_id: "sub-1",
        sub_path: "/saleorder",
        sub_title_eng: "Sale order",
        sub_title_la: "Sale order LA"
      }).sub_id
    ).toBe("sub-1");
  });

  it("builds sort payloads using backend items wrappers", () => {
    expect(buildMainMenuSortPayload([{ menu_id: "menu-a" }, { menu_id: "menu-b" }])).toEqual({
      items: [
        { menu_id: "menu-a", menu_sort: 1 },
        { menu_id: "menu-b", menu_sort: 2 }
      ]
    });
    expect(buildSubMenuSortPayload("menu-a", [{ sub_id: "sub-a" }, { sub_id: "sub-b" }])).toEqual({
      items: [
        { sub_id: "sub-a", sub_sort: 1 },
        { sub_id: "sub-b", sub_sort: 2 }
      ],
      menu_id: "menu-a"
    });
  });

  it("keeps badge fallback numeric and backend-compatible", () => {
    expect(permissionMenuBadgeValue(1)).toBe(1);
    expect(permissionMenuBadgeValue("1")).toBe(1);
    expect(permissionMenuBadgeValue(0)).toBe(2);
    expect(permissionMenuBadgeValue(undefined)).toBe(2);
    expect(normalizePermissionMainMenu({ menu_badge: 0 }).menu_badge).toBe(2);
  });
});
