import { describe, expect, it } from "vitest";
import { firstNavigablePath, menuGrantsPath } from "@/components/layout/shell-menu-helpers";
import type { MenuItem } from "@/config/menu";
import type { AuthUser } from "@/stores/auth-store";
import { canUseCommercial, commercialMenuItems, commercialSessionIdentity, isCommercialPath } from "./commercial-permissions";

const actor: AuthUser = { uuid: "operator", email: "operator@example.test", status: 1, store_status: 1, profile: "", branch_uuid: "plc-branch", branch_name: "PLC", branch_tel: "", branch_address: "", store_uuid: "plc-store", store_name: "PLC", store_logo: "", store_table_status: 1 };
const menus: MenuItem[] = [
  { title: "commercial", path: "/commercial", children: [{ title: "new", path: "/commercial/new" }] },
  { title: "settings", children: [{ title: "commercial-edit", path: "/commercial/document/edit" }, { title: "store", path: "/settings/store" }] },
  { title: "other", path: "/commercial-report" },
];

describe("commercial actor permissions", () => {
  it.each([1, 2, 3])("allows PLC role %s without granting any menu by itself", status => {
    expect(canUseCommercial({ ...actor, status })).toBe(true);
    expect(menuGrantsPath(commercialMenuItems([], { ...actor, status }), "/commercial")).toBe(false);
    expect(commercialMenuItems(menus, { ...actor, status })).toBe(menus);
  });

  it.each([undefined, 0, 2, 3, 99])("denies non-PLC or unverified classification %s even for role1 with a cached grant", store_status => {
    const user = { ...actor, store_status };
    expect(canUseCommercial(user)).toBe(false);
    const visible = commercialMenuItems(menus, user);
    expect(menuGrantsPath(visible, "/commercial")).toBe(false);
    expect(visible).toEqual([{ title: "settings", children: [{ title: "store", path: "/settings/store" }] }, { title: "other", path: "/commercial-report" }]);
    expect(firstNavigablePath(visible)).toBe("/settings/store");
    expect(menus[0].children).toHaveLength(1);
  });

  it.each([0, 4, 5, 6, 7])("denies PLC role %s", status => {
    expect(canUseCommercial({ ...actor, status })).toBe(false);
  });

  it("uses the authenticated actor independently of a selected normal or demo customer", () => {
    for (const selectedCustomer of [{ store_status: 2 }, { store_status: 3 }]) {
      expect(canUseCommercial(actor)).toBe(true);
      expect(commercialMenuItems(menus, actor)).toBe(menus);
      expect(canUseCommercial({ ...actor, ...selectedCustomer })).toBe(false);
    }
    expect(canUseCommercial(null)).toBe(false);
    expect(commercialMenuItems([{ title: "only-commercial", children: [menus[0]] }], null)).toEqual([]);
  });

  it.each(["/commercial", "/commercial/", "/commercial/new?type=receipt", "/commercial/a/edit#details"])("recognizes exact commercial subtree %s", path => {
    expect(isCommercialPath(path)).toBe(true);
  });

  it.each([undefined, "/", "/commercial-report", "/settings/store"])("preserves unrelated route %s", path => {
    expect(isCommercialPath(path)).toBe(false);
  });

  it("changes private export identity for permission scopes but not display metadata", () => {
    const original = commercialSessionIdentity(actor, "token");
    for (const updates of [{ store_status: 2 }, { status: 3 }, { branch_uuid: "other" }, { store_uuid: "other" }, { uuid: "other" }]) {
      expect(commercialSessionIdentity({ ...actor, ...updates }, "token")).not.toBe(original);
    }
    expect(commercialSessionIdentity(actor, "new-token")).not.toBe(original);
    expect(commercialSessionIdentity({ ...actor, name: "New display name", store_name: "Renamed PLC", contract_days_remaining: 4 }, "token")).toBe(original);
  });
});
