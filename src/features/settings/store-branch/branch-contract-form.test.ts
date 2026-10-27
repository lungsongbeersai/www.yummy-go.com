import { afterEach, describe, expect, it, vi } from "vitest";
import {
  branchContractFormError,
  branchContractFormValues,
  initialBranchContractValues
} from "./branch-contract-form";
import { buildBranchPayload } from "./store-branch-utils";

const branch = {
  branch_uuid: "branch-1",
  contract_start_on: "2026-01-31T00:00:00.000Z",
  contract_end_on: "2026-05-10T00:00:00.000Z",
  contract_package_months: 3
};
const profile = {
  address: "New address", chargePercent: "0", chargeStatus: "2",
  email: "branch@example.invalid", name: "Branch", storeUuid: "store-1",
  tel: "", vatPercent: "0", vatStatus: "1"
};

afterEach(() => vi.useRealTimers());

describe("branch contract form", () => {
  it("starts a new branch with a one-year contract on the Lao calendar date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-26T18:30:00Z"));
    expect(initialBranchContractValues(null)).toEqual({
      startOn: "2026-10-27", endOn: "2027-10-27", packageMonths: "12"
    });
  });

  it("preserves a negotiated end date while converting API timestamps for date inputs", () => {
    expect(initialBranchContractValues(branch)).toEqual({
      startOn: "2026-01-31", endOn: "2026-05-10", packageMonths: "3"
    });
    expect(initialBranchContractValues({ branch_uuid: "undated" })).toEqual({
      startOn: "", endOn: "", packageMonths: "12"
    });
  });

  it("does not resend or recalculate contract fields during an unrelated profile edit", () => {
    const payload = buildBranchPayload({
      ...profile, editing: branch, canEditContract: true,
      contract: initialBranchContractValues(branch)
    });
    expect(payload.branch_address).toBe("New address");
    expect(payload).not.toHaveProperty("contract_start_on");
    expect(payload).not.toHaveProperty("contract_end_on");
    expect(payload).not.toHaveProperty("contract_package_months");
  });

  it("omits all contract fields when the viewer cannot edit them", () => {
    const payload = buildBranchPayload({
      ...profile, editing: branch, canEditContract: false,
      contract: { startOn: "2026-02-01", endOn: "2030-02-01", packageMonths: "12" }
    });
    expect(payload).not.toHaveProperty("contract_start_on");
    expect(payload).not.toHaveProperty("contract_end_on");
    expect(payload).not.toHaveProperty("contract_package_months");
  });

  it("sends the selected package with explicit branch dates when a PLC manager changes it", () => {
    expect(buildBranchPayload({
      ...profile, editing: branch, canEditContract: true,
      contract: { startOn: "2026-01-31", endOn: "2026-07-31", packageMonths: "6" }
    })).toMatchObject({
      branch_uuid: "branch-1", contract_start_on: "2026-01-31",
      contract_end_on: "2026-07-31", contract_package_months: 6
    });
  });

  it("validates changed contracts without blocking undated legacy profile edits", () => {
    expect(branchContractFormError({ branch_uuid: "undated" }, {
      startOn: "", endOn: "", packageMonths: "12"
    }, true)).toBeNull();
    expect(branchContractFormError(branch, {
      startOn: "2026-02-30", endOn: "2026-03-31", packageMonths: "1"
    }, true)).toBe("dates");
    expect(branchContractFormError(branch, {
      startOn: "2026-02-01", endOn: "2026-01-31", packageMonths: "1"
    }, true)).toBe("range");
    expect(branchContractFormError(branch, {
      startOn: "2026-02-01", endOn: "2026-04-01", packageMonths: "2"
    }, true)).toBe("package");
  });

  it("reads the date fields without introducing browser timezone conversions", () => {
    const form = new FormData();
    form.set("contract_start_on", "2026-01-31");
    form.set("contract_end_on", "2026-02-28");
    form.set("contract_package_months", "1");
    expect(branchContractFormValues(form)).toEqual({
      startOn: "2026-01-31", endOn: "2026-02-28", packageMonths: "1"
    });
  });
});
