import { describe, expect, it } from "vitest";
import {
  buildStorePermissionSavePayload,
  checkedSubmenuIds,
  normalizeStorePermissionTree,
  storePermissionCheckedValue
} from "@/services/permissions/access";

const MANAGE_MENU_SUB_ID = "d01dcd72-6da2-495b-a56f-54a58bcec6f8";

describe("store permissions service helpers", () => {
  it("normalizes checked values from backend variants", () => {
    expect(storePermissionCheckedValue(true)).toBe(true);
    expect(storePermissionCheckedValue(1)).toBe(true);
    expect(storePermissionCheckedValue("1")).toBe(true);
    expect(storePermissionCheckedValue("true")).toBe(true);
    expect(storePermissionCheckedValue("  TRUE ")).toBe(true);
    expect(storePermissionCheckedValue("0")).toBe(false);
    expect(storePermissionCheckedValue(undefined)).toBe(false);
  });

  it("keeps checked manage menu submenu ids after normalizing a tree", () => {
    const tree = normalizeStorePermissionTree({
      roles: [
        {
          role_id: 1,
          role_name: "Super Admin",
          menus: [
            {
              menu_id: "setting",
              menu_title: "Setting",
              sub_detail: [
                {
                  checked: "1",
                  sub_id: MANAGE_MENU_SUB_ID,
                  sub_path: "/setting/manage-menu",
                  sub_title: "Manage Menu"
                },
                {
                  checked: "0",
                  sub_id: "hidden-sub",
                  sub_path: "/setting/hidden",
                  sub_title: "Hidden"
                },
                {
                  checked: 1,
                  sub_id: "access-sub",
                  sub_path: "/setting/manage-access-permissions",
                  sub_title: "Manage Access Permissions"
                }
              ]
            }
          ]
        }
      ]
    });

    expect(checkedSubmenuIds(tree).sort()).toEqual([MANAGE_MENU_SUB_ID, "access-sub"].sort());
  });

  it.each([1, 2, 3, 6])("filters PLC-only submenus for target role %s", (roleId) => {
    const tree = normalizeStorePermissionTree({ roles: [{ role_id: roleId, menus: [
      { menu_id: "settings", sub_detail: [
        { sub_id: "public", checked: true, sub_status: 1 },
        { sub_id: "plc", checked: true, sub_status: 2 },
        { sub_id: "legacy", checked: false },
      ] },
      { menu_id: "plc-only-group", sub_detail: [{ sub_id: "plc-only", checked: true, sub_status: 2 }] },
    ] }] });
    expect(tree.roles[0].menus.map((menu) => menu.menu_id)).toEqual(
      roleId === 1 ? ["settings", "plc-only-group"] : ["settings"]
    );
    expect(tree.roles[0].menus.find((menu) => menu.menu_id === "settings")?.sub_detail.map((submenu) => submenu.sub_id)).toEqual(
      roleId === 1 ? ["public", "plc", "legacy"] : ["public", "legacy"]
    );
    expect(checkedSubmenuIds(tree).sort()).toEqual(roleId === 1 ? ["plc", "plc-only", "public"] : ["public"]);
  });

  it("builds save payload with manage menu submenu id in sub_id_list", () => {
    expect(
      buildStorePermissionSavePayload({
        company_uuid_fk: " store-1 ",
        role_id: 1,
        sub_id_list: [MANAGE_MENU_SUB_ID, ""]
      })
    ).toEqual({
      company_uuid_fk: "store-1",
      role_id: 1,
      sub_id_list: [MANAGE_MENU_SUB_ID]
    });
  });
});
