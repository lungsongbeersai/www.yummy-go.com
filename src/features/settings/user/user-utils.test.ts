import { describe, expect, it } from "vitest";
import {
  branchName,
  buildBulkUserInput,
  buildUserSaveInput,
  isProtectedUser,
  parseBulkCredentialPaste,
  roleId,
  roleName,
  userActiveBadgeClass,
  userActiveLabel,
  userId,
  userInitials,
  userRoleOptions,
  userZoneUuids,
  userValue,
  validateBulkCredentials
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

  it("reads multiple zone assignments and keeps legacy single-zone rows compatible", () => {
    expect(userZoneUuids({ zone_uuid_fks: ["zone-1", "zone-2", "zone-1"] })).toEqual([
      "zone-1",
      "zone-2"
    ]);
    expect(userZoneUuids({ zone_uuid_fk: "zone-legacy" })).toEqual(["zone-legacy"]);
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
        zoneUuids: ["zone-1", "zone-2", "zone-1"]
      })
    ).toEqual({
      branch_uuid_fk: "branch-1",
      roles_id_fk: 3,
      login_email: "user@example.com",
      login_active: 2,
      login_password: "secret",
      zone_uuid_fks: ["zone-1", "zone-2"]
    });

    const editPayload = buildUserSaveInput({
        active: "1",
        branchUuid: "branch-1",
        editing: { login_uuid: "login-1" },
        email: "user@example.com",
        password: "",
        profile: null,
        selectedRoleId: "2",
        zoneUuids: []
    });

    expect(editPayload).toMatchObject({ login_uuid: "login-1" });
    expect(editPayload).not.toHaveProperty("login_password");
    expect(editPayload.zone_uuid_fks).toEqual([]);
  });

  it("validates independent email and password rows for bulk creation", () => {
    expect(
      validateBulkCredentials([
        { email: " happy10005@gmail.com ", password: " 1111 " },
        { email: "not-an-email", password: "2222" },
        { email: "HAPPY10005@gmail.com", password: "3333" },
        { email: "missing-password@gmail.com", password: "" },
        { email: "short-password@gmail.com", password: "123" },
        { email: "mick10336@gmail.com", password: "4444" },
        { email: "", password: "" }
      ])
    ).toEqual({
      duplicateEmails: ["HAPPY10005@gmail.com"],
      incompleteRows: [4],
      invalidEmails: ["not-an-email"],
      invalidPasswordRows: [5],
      valid: [
        { email: "happy10005@gmail.com", password: "1111" },
        { email: "mick10336@gmail.com", password: "4444" }
      ]
    });
    expect(validateBulkCredentials([])).toEqual({
      duplicateEmails: [],
      incompleteRows: [],
      invalidEmails: [],
      invalidPasswordRows: [],
      valid: []
    });
  });

  it("keeps five copied Excel email/password rows paired and in order", () => {
    const pasted = [
      "one@gmail.com\t1111",
      "two@gmail.com\t2222",
      "three@gmail.com\t3333",
      "four@gmail.com\t4444",
      "five@gmail.com\t5555"
    ].join("\r\n") + "\r\n";

    expect(parseBulkCredentialPaste(pasted, "email")).toEqual([
      { email: "one@gmail.com", password: "1111" },
      { email: "two@gmail.com", password: "2222" },
      { email: "three@gmail.com", password: "3333" },
      { email: "four@gmail.com", password: "4444" },
      { email: "five@gmail.com", password: "5555" }
    ]);
  });

  it("maps a copied Excel column to the field where it is pasted", () => {
    expect(parseBulkCredentialPaste("one@gmail.com\ntwo@gmail.com\nthree@gmail.com", "email")).toEqual([
      { email: "one@gmail.com" },
      { email: "two@gmail.com" },
      { email: "three@gmail.com" }
    ]);
    expect(parseBulkCredentialPaste("1111\n2222\n3333", "password")).toEqual([
      { password: "1111" },
      { password: "2222" },
      { password: "3333" }
    ]);
    expect(parseBulkCredentialPaste("one@gmail.com", "email")).toEqual([]);
  });

  it("allows existing users to keep passwords but still requires a valid email", () => {
    const result = validateBulkCredentials([
      { loginUuid: "user-1", email: "one@example.com", password: "" },
      { loginUuid: "user-2", email: "", password: "" },
      { loginUuid: "user-3", email: "bad", password: "" },
      { loginUuid: "user-4", email: "two@example.com", password: "123" }
    ]);
    expect(result.valid).toEqual([{ loginUuid: "user-1", email: "one@example.com", password: "" }]);
    expect(result.incompleteRows).toEqual([2]);
    expect(result.invalidEmails).toEqual(["bad"]);
    expect(result.invalidPasswordRows).toEqual([4]);
  });

  it("omits unchanged fields for bulk edits instead of resetting permissions or passwords", () => {
    const row = { loginUuid: "user-1", email: "one@example.com", password: "" };
    expect(buildBulkUserInput(row, { branchUuid: "branch-1", role: "keep", active: "keep", zones: null })).toEqual({
      login_uuid: "user-1", login_email: "one@example.com"
    });
    expect(buildBulkUserInput({ ...row, password: "5678" }, { branchUuid: "branch-1", role: "3", active: "2", zones: [] })).toEqual({
      login_uuid: "user-1", login_email: "one@example.com", login_password: "5678", roles_id_fk: 3, login_active: 2, zone_uuid_fks: []
    });
    expect(buildBulkUserInput({ email: "new@example.com", password: "1234" }, { branchUuid: "branch-1", role: "4", active: "1", zones: ["z1", "z2"] })).toEqual({
      branch_uuid_fk: "branch-1", login_email: "new@example.com", login_password: "1234", roles_id_fk: 4, login_active: 1, zone_uuid_fks: ["z1", "z2"]
    });
  });
});
