import { describe, expect, it } from "vitest";
import type { BranchManagementStoreOptions } from "@/services/branch";
import { branchManagementStores, branchManagementStoreLabel, branchManagementStoreUuid } from "./branch-management-scope";

function options(canSelectStore: boolean): BranchManagementStoreOptions {
  return {
    status: "success",
    message: "ok",
    scope: { can_select_store: canSelectStore, store_uuid: "own-store" },
    data: [
      { store_uuid: "own-store", store_name_la: "ຮ້ານຂອງຕົນ", store_name_eng: "Own store" },
      { store_uuid: "customer-store", store_name_la: "ຮ້ານລູກຄ້າ", store_name_eng: "Customer store" }
    ]
  };
}

describe("branch management store selection", () => {
  it("requires an explicit store selection for PLC management", () => {
    expect(branchManagementStoreUuid(options(true), "")).toBe("");
    expect(branchManagementStoreUuid(options(true), "customer-store")).toBe("customer-store");
    expect(branchManagementStoreUuid(options(true), "unknown-store")).toBe("");
  });

  it("fixes non-PLC scope to the user's own store even with a foreign selection", () => {
    expect(branchManagementStoreUuid(options(false), "customer-store")).toBe("own-store");
    expect(branchManagementStores(options(false)).map((store) => store.store_uuid)).toEqual(["own-store"]);
  });

  it("does not load a scope before the backend supplies live authority", () => {
    expect(branchManagementStores(null)).toEqual([]);
    expect(branchManagementStoreUuid(null, "customer-store")).toBe("");
  });

  it("invalidates a selection removed by a refreshed permission response", () => {
    const next = options(true);
    next.data = next.data.filter((store) => store.store_uuid !== "customer-store");
    expect(branchManagementStoreUuid(next, "customer-store")).toBe("");
  });

  it("removes missing and duplicate store UUIDs", () => {
    const next = options(true);
    next.data.push({ store_uuid: "" }, next.data[0]);
    expect(branchManagementStores(next)).toHaveLength(2);
  });

  it("shows localized names with an available name or UUID as fallback", () => {
    expect(branchManagementStoreLabel(options(true).data[1], "la")).toBe("ຮ້ານລູກຄ້າ");
    expect(branchManagementStoreLabel(options(true).data[1], "en-US")).toBe("Customer store");
    expect(branchManagementStoreLabel({ store_uuid: "store", store_name_la: "ຮ້ານ" }, "en")).toBe("ຮ້ານ");
    expect(branchManagementStoreLabel({ store_uuid: "store" }, "la")).toBe("store");
  });
});
