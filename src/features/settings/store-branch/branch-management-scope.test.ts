import { describe, expect, it } from "vitest";
import type { BranchManagementStoreOptions } from "@/services/branch";
import { BRANCH_ALL_STORES, branchManagementStores, branchManagementStoreLabel, branchManagementStoreUuid, branchManagementMutationStoreUuid } from "./branch-management-scope";

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
  it("selects the authenticated own store by default before any PLC selection", () => {
    expect(branchManagementStoreUuid(options(true), "")).toBe("own-store");
    expect(branchManagementStoreUuid(options(true), "customer-store")).toBe("customer-store");
    expect(branchManagementStoreUuid(options(true), "unknown-store")).toBe("");
  });

  it("places the own store first without disturbing other stores' order", () => {
    const source = options(true);
    source.data.reverse();
    expect(branchManagementStores(source).map((store) => store.store_uuid)).toEqual(["own-store", "customer-store"]);
    expect(source.data[0].store_uuid).toBe("customer-store");
  });

  it("allows All only for a verified PLC list scope", () => {
    expect(branchManagementStoreUuid(options(true), BRANCH_ALL_STORES)).toBe(BRANCH_ALL_STORES);
    expect(branchManagementStoreUuid(options(false), BRANCH_ALL_STORES)).toBe("own-store");
    expect(branchManagementStoreUuid(null, BRANCH_ALL_STORES)).toBe("");
  });

  it("never uses All as a mutation target and resolves edits to a known row store", () => {
    expect(branchManagementMutationStoreUuid(options(true), BRANCH_ALL_STORES)).toBe("");
    expect(branchManagementMutationStoreUuid(options(true), BRANCH_ALL_STORES, BRANCH_ALL_STORES)).toBe("");
    expect(branchManagementMutationStoreUuid(options(true), BRANCH_ALL_STORES, "customer-store")).toBe("customer-store");
    expect(branchManagementMutationStoreUuid(options(true), BRANCH_ALL_STORES, "unknown-store")).toBe("");
    expect(branchManagementMutationStoreUuid(options(true), "own-store", "customer-store")).toBe("");
    expect(branchManagementMutationStoreUuid(options(false), BRANCH_ALL_STORES, "customer-store")).toBe("");
    expect(branchManagementMutationStoreUuid(options(true), "customer-store")).toBe("customer-store");
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
