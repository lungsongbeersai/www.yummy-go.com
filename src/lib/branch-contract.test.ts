import { afterEach, describe, expect, it, vi } from "vitest";
import {
  branchContractPackageMonths, canEditBranchContract, canViewBranchContractPackage,
  contractEndOn, contractToday,
  contractDateLabel, currentBranchContractStatus,
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

describe("current branch navbar contract", () => {
  const ownBranch = { store_status: 1, branch_uuid: "logged-in-branch", contract_end_on: "2027-01-12" };
  it.each([
    [77, "normal"], [31, "normal"], [30, "warning"], [1, "warning"], [0, "warning"], [-1, "expired"],
  ] as const)("classifies %i remaining days as %s", (daysRemaining, tone) => {
    expect(currentBranchContractStatus({ ...ownBranch, contract_days_remaining: daysRemaining }))
      .toEqual({ endOn: "2027-01-12", daysRemaining, tone });
  });

  it.each([1, 2, 3, "1", "2", "3"])("shows the signed-in branch expiry for store classification %s and all employee roles", (store_status) => {
    for (const status of [1, 2, 3, 4, 5]) {
      expect(currentBranchContractStatus({ ...ownBranch, store_status, status, contract_days_remaining: 12 }))
        .toEqual({ endOn: "2027-01-12", daysRemaining: 12, tone: "warning" });
    }
  });

  it("requires an authenticated branch and valid date/count metadata", () => {
    const branch = { ...ownBranch, contract_days_remaining: 12 };
    for (const user of [null, { ...branch, branch_uuid: "" }, { ...branch, branch_uuid: "  " },
      { ...branch, contract_end_on: "2026-02-30" }, { ...branch, contract_days_remaining: null },
      { ...branch, contract_days_remaining: NaN }, { ...branch, contract_days_remaining: 1.5 }]) {
      expect(currentBranchContractStatus(user)).toBeNull();
    }
  });

  it("shows an undated branch honestly without fabricating remaining days or an expiry", () => {
    for (const store_status of [1, 2, 3]) {
      for (const contract_end_on of [null, undefined]) {
        expect(currentBranchContractStatus({ ...ownBranch, store_status, contract_end_on, contract_days_remaining: null }))
          .toEqual({ endOn: null, daysRemaining: null, tone: "unknown" });
      }
    }
    expect(currentBranchContractStatus({ branch_uuid: "signed-in-branch" }))
      .toEqual({ endOn: null, daysRemaining: null, tone: "unknown" });
  });

  it("formats a contract date without moving it to the previous day in western timezones", () => {
    const timezone = process.env.TZ;
    process.env.TZ = "America/Los_Angeles";
    try {
      expect(contractDateLabel("2027-01-12", "en")).toBe("Jan 12, 2027");
      expect(contractDateLabel("2026-02-30", "en")).toBe("");
    } finally {
      if (timezone === undefined) delete process.env.TZ;
      else process.env.TZ = timezone;
    }
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
