import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveBranch } from "@/services/branch";

const mocks = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("@/lib/api", () => ({ apiRequest: mocks.request, ServiceError: class extends Error {} }));

beforeEach(() => {
  mocks.request.mockReset();
  mocks.request.mockResolvedValue({ data: { branch_uuid: "new-branch" } });
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
