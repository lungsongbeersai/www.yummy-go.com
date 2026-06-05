import { describe, expect, it } from "vitest";
import {
  branchChargeSummary,
  branchVatSummary,
  buildBranchPayload,
  buildStorePayload,
  isStoreActive,
  isStorePlc,
  missingBranchField,
  missingStoreField,
  storeBranchName
} from "@/features/settings/store-branch/store-branch-utils";

describe("store branch utils", () => {
  it("builds create and edit store payloads", () => {
    expect(
      buildStorePayload({
        active: "1",
        editing: null,
        email: " plc@example.com ",
        nameEng: "PLC",
        nameLa: " ຮ້ານ ",
        status: "1"
      })
    ).toEqual({
      store_name_la: "ຮ້ານ",
      store_name_eng: "PLC",
      store_email: "plc@example.com",
      store_status: 1,
      store_active: 1
    });

    expect(
      buildStorePayload({
        active: "2",
        editing: { store_uuid: "store-1", store_name: "Old" },
        email: "store@example.com",
        nameEng: "",
        nameLa: "Store",
        status: "2"
      })
    ).toEqual({
      store_uuid: "store-1",
      store_name_la: "Store",
      store_name_eng: "",
      store_email: "store@example.com",
      store_status: 2,
      store_active: 2
    });
  });

  it("builds create and edit branch payloads", () => {
    expect(
      buildBranchPayload({
        address: " Road 1 ",
        chargePercent: "10",
        chargeStatus: "1",
        editing: null,
        email: "branch@example.com",
        name: " T01 ",
        storeUuid: "store-1",
        tel: "020",
        vatPercent: "7",
        vatStatus: "1"
      })
    ).toEqual({
      branch_uuid: "",
      branch_name: "T01",
      branch_tel: "020",
      branch_email: "branch@example.com",
      branch_address: "Road 1",
      store_uuid_fk: "store-1",
      vat_status: 1,
      vat_name: 7,
      charge_status: 1,
      charge_name: 10
    });

    expect(
      buildBranchPayload({
        address: "",
        chargePercent: "",
        chargeStatus: "2",
        editing: { branch_uuid: "branch-1", branch_name: "Old" },
        email: "",
        name: "Branch",
        storeUuid: "store-1",
        tel: "",
        vatPercent: "",
        vatStatus: "2"
      }).branch_uuid
    ).toBe("branch-1");
  });

  it("detects missing required fields", () => {
    expect(missingStoreField({ email: "store@example.com", nameLa: "" })).toBe("name");
    expect(missingStoreField({ email: "", nameLa: "Store" })).toBe("email");
    expect(missingStoreField({ email: "store@example.com", nameLa: "Store" })).toBeNull();
    expect(missingBranchField({ name: "Branch", storeUuid: "" })).toBe("store");
    expect(missingBranchField({ name: "", storeUuid: "store-1" })).toBe("name");
    expect(missingBranchField({ name: "Branch", storeUuid: "store-1" })).toBeNull();
  });

  it("maps display and status fallbacks", () => {
    expect(storeBranchName({ store_name_la: "LA", store_name_eng: "EN" }, "store")).toBe("LA");
    expect(storeBranchName({ branch_name_eng: "EN" }, "branch")).toBe("EN");
    expect(isStorePlc({ store_status: 1 })).toBe(true);
    expect(isStoreActive({ store_active: 2 })).toBe(false);
    expect(branchVatSummary({ vat_status: 1, vat_name: 7 }).percentLabel).toBe("7%");
    expect(branchChargeSummary({ charge_status: 1, charge_name: 2.5 }).percentLabel).toBe("2.5%");
  });
});
