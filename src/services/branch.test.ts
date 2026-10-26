import { beforeEach, describe, expect, it, vi } from "vitest";
import { getBranchManagementStoreOptions, getBranches, saveBranch } from "@/services/branch";

const mocks = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("@/lib/api", () => ({ apiRequest: mocks.request, ServiceError: class extends Error {} }));

beforeEach(() => {
  mocks.request.mockReset();
  mocks.request.mockResolvedValue({ data: { branch_uuid: "new-branch" } });
});

describe("branch management scope requests", () => {
  it("loads store choices from the authenticated branch management endpoint", async () => {
    const result = { status: "success", data: [{ store_uuid: "customer-store" }], scope: { can_select_store: true, store_uuid: "plc-store" } };
    mocks.request.mockResolvedValue(result);
    await expect(getBranchManagementStoreOptions()).resolves.toEqual(result);
    expect(mocks.request).toHaveBeenCalledWith("get", "/api/v1/branch/store_options");
  });

  it.each([undefined, { store_uuid: "own-store" }, { can_select_store: true, store_uuid: "" }])("rejects missing or incomplete authority metadata: %j", async (scope) => {
    mocks.request.mockResolvedValue({ data: [{ store_uuid: "other-store" }], scope });
    await expect(getBranchManagementStoreOptions()).rejects.toThrow("Unable to determine branch management access");
  });

  it("sends the selected customer store when loading branches", async () => {
    mocks.request.mockResolvedValue({ data: [] });
    await getBranches({ store_uuid_fk: "customer-store", page: 2 });
    expect(mocks.request).toHaveBeenCalledWith("get", "/api/v1/branch/fetch_limit", {
      params: expect.objectContaining({ store_uuid_fk: "customer-store", page: 2 })
    });
  });

  it("keeps the PLC all-store scope on the paginated management list", async () => {
    mocks.request.mockResolvedValue({ data: [] });
    await getBranches({ store_uuid_fk: "all", page: 2, limit: 20, search: "Customer" });
    expect(mocks.request).toHaveBeenCalledWith("get", "/api/v1/branch/fetch_limit", {
      params: expect.objectContaining({ store_uuid_fk: "all", page: 2, limit: 20, search: "Customer" })
    });
  });

  it("keeps the chosen store in a new branch payload", async () => {
    await saveBranch({ store_uuid_fk: "customer-store", branch_name: "New customer branch" });
    expect(mocks.request.mock.calls[0][2].data.store_uuid_fk).toBe("customer-store");
  });
});

describe("branch catalog source payload", () => {
  it("sends the selected source only when creating a new branch", async () => {
    await expect(saveBranch({ branch_name: "Second branch", source_branch_uuid: " source-branch " })).resolves.toEqual({ branch_uuid: "new-branch" });
    expect(mocks.request).toHaveBeenCalledWith("post", "/api/v1/branch/create", {
      data: expect.objectContaining({ branch_uuid: "", source_branch_uuid: "source-branch" }),
      timeout: 90_000,
    }, "Failed to save data");
  });

  it("drops a stale source selection while updating an existing branch", async () => {
    await saveBranch({ branch_uuid: "existing-branch", source_branch_uuid: "source-branch" });
    const payload = mocks.request.mock.calls[0][2].data;
    expect(payload.branch_uuid).toBe("existing-branch");
    expect(payload).not.toHaveProperty("source_branch_uuid");
    expect(mocks.request.mock.calls[0][2]).not.toHaveProperty("timeout");
  });

  it("omits an empty source so the backend can choose the first existing branch", async () => {
    await saveBranch({ source_branch_uuid: "  " });
    expect(mocks.request.mock.calls[0][2].data).not.toHaveProperty("source_branch_uuid");
  });

  it("propagates a failed copy without reporting a successful branch creation", async () => {
    const failure = new Error("Photo copy failed");
    mocks.request.mockRejectedValue(failure);
    await expect(saveBranch({ source_branch_uuid: "source-branch" })).rejects.toBe(failure);
    expect(mocks.request).toHaveBeenCalledTimes(1);
  });
});
