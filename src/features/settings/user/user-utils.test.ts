import { describe, expect, it } from "vitest";
import {
  branchName,
  buildUserSaveInput,
  isProtectedUser,
  parseBulkEmails,
  roleId,
  roleName,
  userActiveBadgeClass,
  userActiveLabel,
  userId,
  userInitials,
  userRoleOptions,
  userValue
} from "@/features/settings/user/user-utils";
import type { Role, User } from "@/services/user";

describe("user settings utils", () => {
  it("reads values with fallbacks", () => {
    expect(userValue({ name: "Alice" }, "name")).toBe("Alice");
    expect(userValue({ name: "" }, "name", "-")).toBe("-");
    expect(userId({ login_uuid: "login-1" })).toBe("login-1");
    expect(branchName({ branch_name_la: "Main branch" })).toBe("Main branch");
  });

  it("resolves role ids and labels across API shapes", () => {
    expect(roleId({ roles_id_fk: 2 } as User)).toBe("2");
    expect(roleId({ roles_id: 3 } as Role)).toBe("3");
    expect(roleId({ role_id: 4 } as Role)).toBe("4");
    expect(roleName({ roles_name_eng: "Manager" } as Role)).toBe("Manager");
    expect(roleName({} as Role)).toBe("-");
  });

  it("detects protected users from both backend spellings", () => {
    expect(isProtectedUser({ login_uuid: "1", btn_disabled: "1" })).toBe(true);
    expect(isProtectedUser({ login_uuid: "1", btn_disible: "yes" })).toBe(true);
    expect(isProtectedUser({ login_uuid: "1", btn_disabled: "null" })).toBe(false);
    expect(isProtectedUser({ login_uuid: "1" })).toBe(false);
  });

  it("formats initials and active state labels", () => {
    expect(userInitials("admin@example.com")).toBe("AD");
    expect(userInitials("")).toBe("U");
    expect(userActiveLabel("1", "Active", "Inactive")).toBe("Active");
    expect(userActiveLabel("2", "Active", "Inactive")).toBe("Inactive");
    expect(userActiveBadgeClass("1")).toContain("text-primary");
    expect(userActiveBadgeClass("2")).toContain("text-muted-foreground");
  });

  it("keeps an editing role visible when it is missing from role options", () => {
    const options = [{ roles_id: 1, roles_name: "Owner" }];
    expect(userRoleOptions({ login_uuid: "u1", roles_id_fk: 2, roles_name: "Cashier" }, options)).toEqual([
      { roles_id_fk: "2", roles_name: "Cashier" },
      options[0]
    ]);
    expect(userRoleOptions({ login_uuid: "u1", roles_id_fk: 1 }, options)).toBe(options);
  });

  it("builds create and edit payloads", () => {
    expect(
      buildUserSaveInput({
        active: "2",
        branchUuid: "branch-1",
        editing: null,
        email: " user@example.com ",
        password: " secret ",
        profile: null,
        selectedRoleId: "3",
        zoneUuid: "zone-1"
      })
    ).toEqual({
      branch_uuid_fk: "branch-1",
      roles_id_fk: 3,
      login_email: "user@example.com",
      login_active: 2,
      login_password: "secret",
      zone_uuid_fk: "zone-1"
    });

    const editPayload = buildUserSaveInput({
        active: "1",
        branchUuid: "branch-1",
        editing: { login_uuid: "login-1" },
        email: "user@example.com",
        password: "",
        profile: null,
        selectedRoleId: "2",
        zoneUuid: ""
    });

    expect(editPayload).toMatchObject({ login_uuid: "login-1" });
    expect(editPayload).not.toHaveProperty("login_password");
    expect(editPayload.zone_uuid_fk).toBe("");
  });

  it("parses bulk-pasted emails into valid/invalid/duplicate buckets", () => {
    expect(
      parseBulkEmails("happy10005@gmail.com\nnot-an-email\nHAPPY10005@gmail.com\n\nmick10336@gmail.com")
    ).toEqual({
      duplicates: ["HAPPY10005@gmail.com"],
      invalidLines: ["not-an-email"],
      valid: ["happy10005@gmail.com", "mick10336@gmail.com"]
    });
    expect(parseBulkEmails("")).toEqual({ duplicates: [], invalidLines: [], valid: [] });
  });
});
