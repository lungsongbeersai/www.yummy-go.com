import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BranchManagementStoreOptions } from "@/services/branch";

const mocks = vi.hoisted(() => ({ loadBranchManagementStores: vi.fn(), loadBranchOptions: vi.fn() }));
vi.mock("@/services/branch", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/services/branch")>(),
  getBranchManagementStoreOptions: mocks.loadBranchManagementStores,
  getBranchOptions: mocks.loadBranchOptions
}));

import { getStoreUuid } from "@/services/branch";
import { useReferenceStore } from "@/stores/reference-store";

function response(storeUuid: string): BranchManagementStoreOptions {
  return { status: "success", message: "ok", data: [{ store_uuid: storeUuid }], scope: { can_select_store: true, store_uuid: "plc-store" } };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe("branch management reference scope", () => {
  beforeEach(() => {
    mocks.loadBranchManagementStores.mockReset();
    mocks.loadBranchOptions.mockReset();
    useReferenceStore.getState().reset();
  });

  afterEach(() => useReferenceStore.getState().reset());

  it("loads management choices without changing the cashier's active store", async () => {
    useReferenceStore.getState().setActiveStore("cashier-store");
    mocks.loadBranchManagementStores.mockResolvedValue(response("customer-store"));
    await useReferenceStore.getState().loadBranchManagementStores();
    expect(getStoreUuid()).toBe("cashier-store");
    expect(useReferenceStore.getState()).toMatchObject({
      storeUuid: "cashier-store",
      branchManagementStores: response("customer-store"),
      loadingKeys: { branchManagementStores: false }
    });
  });

  it("keeps customer catalog sources separate from the cashier's branch choices", async () => {
    useReferenceStore.getState().setActiveStore("cashier-store");
    const cashierBranches = [{ branch_uuid: "cashier-branch", store_uuid_fk: "cashier-store" }];
    const customerBranches = [{ branch_uuid: "customer-branch", store_uuid_fk: "customer-store" }];
    mocks.loadBranchOptions.mockResolvedValueOnce(cashierBranches).mockResolvedValueOnce(customerBranches);
    await useReferenceStore.getState().loadBranches("cashier-store");
    await expect(useReferenceStore.getState().loadBranchCatalogSources("customer-store")).resolves.toEqual(customerBranches);
    expect(useReferenceStore.getState().options).toMatchObject({ branches: cashierBranches, branchCatalogSources: customerBranches });
    expect(getStoreUuid()).toBe("cashier-store");
    expect(mocks.loadBranchOptions).toHaveBeenLastCalledWith("customer-store");
  });

  it("keeps newer authority when an older request resolves last", async () => {
    const old = deferred<BranchManagementStoreOptions>();
    const current = deferred<BranchManagementStoreOptions>();
    mocks.loadBranchManagementStores.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
    const oldLoad = useReferenceStore.getState().loadBranchManagementStores();
    const newLoad = useReferenceStore.getState().loadBranchManagementStores();
    current.resolve(response("current-store"));
    await newLoad;
    old.resolve(response("old-store"));
    await oldLoad;
    expect(useReferenceStore.getState().branchManagementStores).toEqual(response("current-store"));
  });

  it("does not restore another session's authority after a reset", async () => {
    const pending = deferred<BranchManagementStoreOptions>();
    mocks.loadBranchManagementStores.mockReturnValueOnce(pending.promise);
    const loading = useReferenceStore.getState().loadBranchManagementStores();
    useReferenceStore.getState().reset();
    pending.resolve(response("previous-session-store"));
    await loading;
    expect(useReferenceStore.getState()).toMatchObject({ branchManagementStores: null, loadingKeys: {} });
  });

  it("clears old choices and exposes a failed authority load", async () => {
    mocks.loadBranchManagementStores.mockResolvedValueOnce(response("customer-store"));
    await useReferenceStore.getState().loadBranchManagementStores();
    mocks.loadBranchManagementStores.mockRejectedValueOnce(new Error("Session scope unavailable"));
    await expect(useReferenceStore.getState().loadBranchManagementStores()).rejects.toThrow("Session scope unavailable");
    expect(useReferenceStore.getState()).toMatchObject({
      branchManagementStores: null,
      error: "Session scope unavailable",
      loadingKeys: { branchManagementStores: false }
    });
  });
});
