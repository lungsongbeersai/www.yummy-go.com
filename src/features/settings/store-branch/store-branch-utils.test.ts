import { describe, expect, it } from "vitest";
import {
  VAT_EXCLUDED,
  VAT_EXEMPT,
  VAT_INCLUDED,
  branchChargeSummary,
  branchVatStatusValue,
  branchVatSummary,
  buildBranchPayload,
  buildStorePayload,
  isStoreActive,
  isStorePlc,
  missingBranchField,
  missingStoreField,
  storeAuthUserUpdate,
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
        status: "1",
        tableStatus: "1"
      })
    ).toEqual({
      store_name_la: "ຮ້ານ",
      store_name_eng: "PLC",
      store_email: "plc@example.com",
      store_status: 1,
      store_active: 1,
      store_table_status: 1
    });

    expect(
      buildStorePayload({
        active: "2",
        editing: { store_uuid: "store-1", store_name: "Old" },
        email: "store@example.com",
        nameEng: "",
        nameLa: "Store",
        status: "2",
        tableStatus: "2"
      })
    ).toEqual({
      store_uuid: "store-1",
      store_name_la: "Store",
      store_name_eng: "",
      store_email: "store@example.com",
      store_status: 2,
      store_active: 2,
      store_table_status: 2
    });
  });

  it("defaults missing store table status to has tables", () => {
    expect(
      buildStorePayload({
        active: "1",
        editing: null,
        email: "store@example.com",
        nameEng: "Store",
        nameLa: "Store",
        status: "2",
        tableStatus: ""
      })
    ).toMatchObject({ store_table_status: 1 });
  });

  it("defaults invalid store table status to has tables", () => {
    for (const tableStatus of ["0", "3", "invalid"]) {
      expect(
        buildStorePayload({
          active: "1",
          editing: null,
          email: "store@example.com",
          nameEng: "Store",
          nameLa: "Store",
          status: "2",
          tableStatus
        })
      ).toMatchObject({ store_table_status: 1 });
    }
  });

  it("builds active store auth updates with table status", () => {
    expect(
      storeAuthUserUpdate({
        store_logo: "logo.jpg",
        store_name_la: "Store LA",
        store_table_status: 2
      })
    ).toEqual({
      store_logo: "logo.jpg",
      store_name: "Store LA",
      store_table_status: 2
    });

    expect(
      storeAuthUserUpdate({
        store_logo: "logo.jpg",
        store_name: "Store",
        store_table_status: 3
      })
    ).toMatchObject({ store_table_status: 1 });
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
        chargePercent: "1,234.50",
        chargeStatus: "2",
        editing: { branch_uuid: "branch-1", branch_name: "Old" },
        email: "",
        name: "Branch",
        storeUuid: "store-1",
        tel: "",
        vatPercent: "7,500.25",
        vatStatus: "2"
      })
    ).toMatchObject({
      branch_uuid: "branch-1",
      vat_name: 7500.25,
      charge_name: 1234.5
    });
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

  it("keeps the three VAT types apart", () => {
    expect(branchVatStatusValue("2")).toBe(VAT_INCLUDED);
    expect(branchVatStatusValue("3")).toBe(VAT_EXCLUDED);
    expect(branchVatStatusValue("9")).toBe(VAT_EXEMPT);
    expect(branchVatStatusValue(undefined)).toBe(VAT_EXEMPT);

    expect(branchVatSummary({ vat_status: VAT_EXEMPT, vat_name: 0 })).toMatchObject({
      active: false,
      status: VAT_EXEMPT
    });
    expect(branchVatSummary({ vat_status: VAT_INCLUDED, vat_name: 10 })).toMatchObject({
      active: true,
      status: VAT_INCLUDED
    });
    expect(branchVatSummary({ vat_status: VAT_EXCLUDED, vat_name: 10 })).toMatchObject({
      active: true,
      status: VAT_EXCLUDED
    });
  });

  it("sends the selected VAT type to the branch API", () => {
    const branchPayload = {
      address: "",
      chargePercent: "0",
      chargeStatus: "2",
      editing: null,
      email: "branch@example.com",
      name: "T01",
      storeUuid: "store-1",
      tel: ""
    };

    expect(
      buildBranchPayload({ ...branchPayload, vatPercent: "10", vatStatus: "2" })
    ).toMatchObject({ vat_status: VAT_INCLUDED, vat_name: 10 });
    expect(
      buildBranchPayload({ ...branchPayload, vatPercent: "10", vatStatus: "3" })
    ).toMatchObject({ vat_status: VAT_EXCLUDED, vat_name: 10 });
    expect(
      buildBranchPayload({ ...branchPayload, vatPercent: "0", vatStatus: "1" })
    ).toMatchObject({ vat_status: VAT_EXEMPT, vat_name: 0 });
  });
});
