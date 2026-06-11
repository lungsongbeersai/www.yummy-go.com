import { describe, expect, it } from "vitest";
import {
  buildSidebarPermissionMenuParams,
  normalizeSidebarPermissionMenuResponse,
  sidebarPermissionMenuItemsToMenuItems
} from "@/services/sidebar-menu";

describe("sidebar menu service helpers", () => {
  it("builds permission menu request params", () => {
    expect(
      buildSidebarPermissionMenuParams({
        companyUuid: " store-1 ",
        lang: "en",
        roleId: 1
      })
    ).toEqual({
      company_uuid_fk: "store-1",
      lang: "eng",
      role_id: 1
    });
  });

  it("normalizes selected role menus with sort, checked children, badges, and icon fallback", () => {
    const menus = normalizeSidebarPermissionMenuResponse(
      {
        roles: [
          {
            role_id: 2,
            menus: [
              {
                menu_id: "other",
                menu_path: "/other",
                menu_title: "Other",
                menu_sort: 1
              }
            ]
          },
          {
            role_id: 1,
            menus: [
              {
                menu_badge_show: true,
                menu_badge_text: " News ",
                menu_icon: "unknown-icon",
                menu_id: "settings",
                menu_is_dropdown: true,
                menu_path: "/setting",
                menu_sort: 2,
                menu_title: "Settings",
                sub_detail: [
                  {
                    checked: false,
                    sub_id: "hidden",
                    sub_path: "/setting/hidden",
                    sub_sort: 1,
                    sub_title: "Hidden"
                  },
                  {
                    checked: true,
                    sub_id: "user",
                    sub_path: "/setting/user",
                    sub_sort: 2,
                    sub_title: "User"
                  }
                ]
              },
              {
                menu_icon: "shopping-cart",
                menu_id: "sales",
                menu_path: "/sale",
                menu_sort: 1,
                menu_title: "Sales",
                menu_type: "link",
                sub_detail: []
              }
            ]
          }
        ]
      },
      1
    );

    expect(menus.map((menu) => menu.title)).toEqual(["sales", "settings"]);
    expect(menus[0]).toMatchObject({
      iconName: "mdi:cart-outline",
      label: "Sales",
      path: "/sale"
    });
    expect(menus[1]).toMatchObject({
      badgeText: "News",
      iconName: "mdi:file-document-outline",
      label: "Settings",
      path: "/setting"
    });
    expect(menus[1].children?.map((child) => child.path)).toEqual(["/setting/user"]);
  });

  it("falls back to the first role when the requested role is missing", () => {
    const menus = normalizeSidebarPermissionMenuResponse(
      {
        roles: [
          {
            role_id: 9,
            menus: [
              {
                menu_id: "first",
                menu_path: "/first",
                menu_title: "First"
              }
            ]
          }
        ]
      },
      1
    );

    expect(menus.map((menu) => menu.title)).toEqual(["first"]);
  });

  it("filters submenu visibility with sub_status and role status", () => {
    const response = {
      roles: [1, 2].map((roleId) => ({
        role_id: roleId,
        menus: [
          {
            menu_id: "setting",
            menu_is_dropdown: true,
            menu_path: "/setting",
            menu_title: "Settings",
            sub_detail: [
              {
                checked: true,
                sub_id: "manage-menu",
                sub_path: "/setting/manage-menu",
                sub_sort: 1,
                sub_status: 2,
                sub_title: "Manage Menu"
              },
              {
                checked: true,
                sub_id: "manage-access-permissions",
                sub_path: "/setting/manage-access-permissions",
                sub_sort: 2,
                sub_status: 1,
                sub_title: "Manage Access Permissions"
              },
              {
                checked: "1",
                sub_id: "users",
                sub_path: "/setting/user",
                sub_sort: 3,
                sub_status: "1",
                sub_title: "Users"
              },
              {
                checked: false,
                sub_id: "hidden",
                sub_path: "/setting/hidden",
                sub_sort: 4,
                sub_status: 1,
                sub_title: "Hidden"
              }
            ]
          }
        ]
      }))
    };

    const plcMenus = normalizeSidebarPermissionMenuResponse(response, 1);
    const staffMenus = normalizeSidebarPermissionMenuResponse(response, 2);

    expect(plcMenus[0]?.path).toBe("/setting");
    expect(plcMenus[0]?.children?.map((child) => child.path)).toEqual([
      "/setting/manage-menu",
      "/setting/manage-access-permissions",
      "/setting/user"
    ]);
    expect(staffMenus[0]?.path).toBe("/setting");
    expect(staffMenus[0]?.children?.map((child) => child.path)).toEqual([
      "/setting/manage-access-permissions",
      "/setting/user"
    ]);
  });

  it("keeps serializable menu icon names for runtime rendering", () => {
    const [sales, fallback] = sidebarPermissionMenuItemsToMenuItems([
      {
        iconName: "mdi:cart-outline",
        label: "Sales",
        path: "/sale",
        source: "permission-api",
        title: "sales"
      },
      {
        iconName: "mdi:file-document-outline",
        label: "Fallback",
        path: "/fallback",
        source: "permission-api",
        title: "fallback"
      }
    ]);

    expect(sales?.icon).toBeUndefined();
    expect(sales?.iconName).toBe("mdi:cart-outline");
    expect(fallback?.icon).toBeUndefined();
    expect(fallback?.iconName).toBe("mdi:file-document-outline");
  });
});
