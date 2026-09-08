import { describe, expect, it } from "vitest";
import { canManageDiscounts, canManagePayments, ROLE_STATUS } from "./permissions";

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
