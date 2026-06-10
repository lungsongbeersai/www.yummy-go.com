import { describe, expect, it } from "vitest";
import {
  buildStorePermissionSavePayload,
  checkedSubmenuIds,
  normalizeStorePermissionTree,
  storePermissionCheckedValue
} from "@/services/store-permissions";

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
