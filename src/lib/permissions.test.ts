import { describe, expect, it } from "vitest";
import { canManageDiscounts, canManagePayments, canManageBranchAccounts, canManageBankMaster, canManageStorePermissions, canViewSettingModule, canEditStoreBranch, canEditBranchSettingsRow, canCreateStoreBranch, canDeleteStoreBranch, ROLE_STATUS } from "./permissions";

describe("branch administrator permissions", () => {
  it("opens own-branch settings and accounts without granting merchant or bank administration", () => {
    expect(canViewSettingModule("branch", 3)).toBe(true);
    expect(canViewSettingModule("account", 3)).toBe(true);
    expect(canManageBranchAccounts(3)).toBe(true);
    expect(canViewSettingModule("store", 3)).toBe(false);
    expect(canViewSettingModule("bank", 3)).toBe(false);
    expect(canEditStoreBranch(3)).toBe(false);
    expect(canManageBankMaster(3)).toBe(false);
    expect(canManageStorePermissions(3)).toBe(false);
    expect(canCreateStoreBranch(3)).toBe(false);
    expect(canDeleteStoreBranch(3)).toBe(false);
  });

  it("limits a branch administrator to its real branch", () => {
    expect(canEditBranchSettingsRow(3, "own", "own")).toBe(true);
    expect(canEditBranchSettingsRow(3, "own", "sibling")).toBe(false);
    expect(canEditBranchSettingsRow(3, "", "sibling")).toBe(false);
    expect(canEditBranchSettingsRow(3, "own", "")).toBe(false);
    expect(canEditBranchSettingsRow(2, "own", "sibling")).toBe(true);
  });

  it("keeps store-wide permissions restricted to existing administrators", () => {
    for (const status of [1, 2]) {
      expect(canManageBankMaster(status)).toBe(true);
      expect(canManageStorePermissions(status)).toBe(true);
    }
    for (const status of [4, 5, 6, 7, null, undefined]) {
      expect(canManageBranchAccounts(status)).toBe(false);
      expect(canManageBankMaster(status)).toBe(false);
      expect(canManageStorePermissions(status)).toBe(false);
      expect(canEditBranchSettingsRow(status, "own", "own")).toBe(false);
    }
  });
});

describe("canManagePayments", () => {
  it("blocks the waiter role", () => {
    expect(canManagePayments(ROLE_STATUS.WAITER)).toBe(false);
  });

  it("allows every other role", () => {
    expect(canManagePayments(ROLE_STATUS.SUPER_ADMIN)).toBe(true);
    expect(canManagePayments(ROLE_STATUS.SALES_STAFF)).toBe(true);
  });

  it("allows a missing status — this is a deny-list for one specific role, not an allow-list", () => {
    expect(canManagePayments(null)).toBe(true);
    expect(canManagePayments(undefined)).toBe(true);
  });
});

describe("canManageDiscounts", () => {
  it("blocks the waiter role", () => {
    expect(canManageDiscounts(ROLE_STATUS.WAITER)).toBe(false);
  });

  it("allows every other role", () => {
    expect(canManageDiscounts(ROLE_STATUS.BRANCH_ADMIN)).toBe(true);
  });
});
