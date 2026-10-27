import { afterEach, describe, expect, it, vi } from "vitest";
import {
  branchContractPackageMonths, canEditBranchContract, canViewBranchContractPackage,
  contractEndOn, contractToday,
} from "./branch-contract";

afterEach(() => { vi.useRealTimers(); });

describe("branch contract calendar", () => {
  it.each([
    ["2026-01-31", 1, "2026-02-28"],
    ["2028-01-31", 1, "2028-02-29"],
    ["2026-01-31", 3, "2026-04-30"],
    ["2026-08-31", 6, "2027-02-28"],
    ["2028-02-29", 12, "2029-02-28"],
    ["2026-10-27", 12, "2027-10-27"],
  ] as const)("renews %s by %i calendar months", (start, months, expected) => {
    expect(contractEndOn(start, months)).toBe(expected);
  });

  it.each(["2026-02-29", "2026-04-31", "2026-13-01", "2026-00-01", "2026-01-00", "0000-01-01", "2026-1-1", "2026-01-01T00:00:00Z", ""])(
    "rejects an invalid contract date %s", (start) => { expect(contractEndOn(start, 1)).toBe(""); },
  );

  it("uses the Lao date when UTC is still on the previous day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-26T18:30:00Z"));
    expect(contractToday()).toBe("2026-10-27");
  });
});

describe("PLC contract visibility and editing", () => {
  it("uses the viewer's PLC classification separately from the login role", () => {
    expect(canViewBranchContractPackage({ store_status: 1, status: 3 })).toBe(true);
    expect(canEditBranchContract({ store_status: 1, status: 1 })).toBe(true);
    expect(canEditBranchContract({ store_status: "1", status: "2" })).toBe(true);
    expect(canEditBranchContract({ store_status: 1, status: 3 })).toBe(false);
    expect(canEditBranchContract({ store_status: 1, status: 4 })).toBe(false);
  });

  it.each([undefined, null, 0, 2, 3, "plc", true])("hides contracts from classification %s", (store_status) => {
    expect(canViewBranchContractPackage({ store_status, status: 1 })).toBe(false);
    expect(canEditBranchContract({ store_status, status: 1 })).toBe(false);
  });

  it("accepts only the four supported package durations", () => {
    for (const months of [1, 3, 6, 12]) expect(branchContractPackageMonths(String(months))).toBe(months);
    for (const value of [null, undefined, "", " ", true, [1], 0, 2, 24, 1.5, "monthly"]) {
      expect(branchContractPackageMonths(value)).toBeNull();
    }
  });
});
