import { describe, expect, it } from "vitest";
import { commercialBranches, commercialStores } from "@/stores/commercial-store/helpers";

describe("commercial branch selection boundaries", () => {
  it("keeps store choices within the backend verified scope", () => {
    expect(commercialStores({ status: "success", message: "", scope: { can_select_store: false, store_uuid: "own" }, data: [{ store_uuid: "foreign" }, { store_uuid: "own" }, { store_uuid: "own" }] })).toEqual([{ store_uuid: "own" }]);
  });

  it("restricts a branch administrator to their own branch within the selected store", () => {
    const branches = [{ branch_uuid: "own", store_uuid_fk: "store" }, { branch_uuid: "sibling", store_uuid_fk: "store" }, { branch_uuid: "foreign", store_uuid_fk: "another-store" }];
    expect(commercialBranches(branches, "store", 3, "own")).toEqual([branches[0]]);
    expect(commercialBranches(branches, "store", 2, "own")).toEqual(branches.slice(0, 2));
  });
});
