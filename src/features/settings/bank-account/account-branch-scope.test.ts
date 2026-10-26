import { describe, expect, it } from "vitest";
import { accountBelongsToBranch, accountBranchOptions, accountBranchUuid } from "./account-branch-scope";

const branches = [{ branch_uuid: "sibling" }, { branch_uuid: "own" }];

describe("receiving account branch scope", () => {
  it("shows only the branch administrator's own branch even when a sibling appears first", () => {
    expect(accountBranchOptions(branches, 3, "own")).toEqual([{ branch_uuid: "own" }]);
    expect(accountBranchUuid(3, "own", "sibling")).toBe("own");
  });

  it("never falls back to another branch when the authenticated branch is missing", () => {
    expect(accountBranchOptions(branches, 3, "")).toEqual([]);
    expect(accountBranchUuid(3, "", "sibling")).toBe("");
  });

  it("preserves merchant administrators' existing selection", () => {
    for (const role of [1, 2]) {
      expect(accountBranchOptions(branches, role, "own")).toEqual(branches);
      expect(accountBranchUuid(role, "own", "sibling")).toBe("sibling");
    }
  });

  it("does not grant account management to staff roles", () => {
    for (const role of [4, 5, 6, 7, undefined]) {
      expect(accountBranchOptions(branches, role, "own")).toEqual([]);
      expect(accountBranchUuid(role, "own", "own")).toBe("");
    }
  });

  it("rejects a stale account from another branch", () => {
    expect(accountBelongsToBranch("own", "own")).toBe(true);
    expect(accountBelongsToBranch("sibling", "own")).toBe(false);
    expect(accountBelongsToBranch("", "")).toBe(false);
  });
});
