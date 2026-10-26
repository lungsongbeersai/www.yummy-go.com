import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCrud, listParams, saveEntity } from "@/services/shared/crud";

const mocks = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("@/lib/api", () => ({ apiRequest: mocks.request, ServiceError: class extends Error {} }));

beforeEach(() => {
  mocks.request.mockReset();
  mocks.request.mockResolvedValue({ data: { uuid: "saved-row" } });
});

describe("listParams", () => {
  it("applies stable defaults", () => {
    expect(listParams()).toEqual({
      search: "",
      page: 1,
      orderBy: "ASC",
      lang: "la",
      limit: 20
    });
  });

  it("normalizes All limit for generic CRUD endpoints", () => {
    expect(listParams({ limit: "All", search: "tea" })).toMatchObject({
      search: "tea",
      limit: "all"
    });
  });

  it("preserves extra params without overwriting normalized keys", () => {
    expect(listParams({ page: 3, branch_uuid_fk: "b1", limit: null })).toEqual({
      search: "",
      page: 3,
      orderBy: "ASC",
      lang: "la",
      branch_uuid_fk: "b1"
    });
  });
});

describe("CRUD save request budgets", () => {
  it("preserves the existing request shape when no options are supplied", async () => {
    const crud = createCrud<{ uuid: string }>({ create: "/fixture/create" }, "uuid");
    await expect(crud.save({ name: "Existing caller" })).resolves.toEqual({ uuid: "saved-row" });
    expect(mocks.request).toHaveBeenCalledWith("post", "/fixture/create", { data: { name: "Existing caller" } }, "Failed to save data");
  });

  it("forwards an explicit timeout and cancellation signal without changing the saved data", async () => {
    const crud = createCrud<{ uuid: string }>({ create: "/fixture/create" }, "uuid");
    const controller = new AbortController();
    const payload = { name: "Catalog copy" };
    await crud.save(payload, { timeout: 90_000, signal: controller.signal });
    expect(mocks.request).toHaveBeenCalledWith("post", "/fixture/create", {
      data: payload, timeout: 90_000, signal: controller.signal,
    }, "Failed to save data");
    expect(payload).toEqual({ name: "Catalog copy" });
  });

  it("keeps multipart conversion and custom failure messages with an explicit budget", async () => {
    await saveEntity("/fixture/upload", { name: "Catalog photo" }, "Copy failed", true, { timeout: 90_000 });
    const options = mocks.request.mock.calls[0][2];
    expect(options.data).toBeInstanceOf(FormData);
    expect(options.data.get("name")).toBe("Catalog photo");
    expect(options.timeout).toBe(90_000);
    expect(mocks.request.mock.calls[0][3]).toBe("Copy failed");
  });

  it("returns cancellation and transport failures without retrying the mutation", async () => {
    const failure = new Error("Request cancelled");
    mocks.request.mockRejectedValue(failure);
    const crud = createCrud<{ uuid: string }>({ create: "/fixture/create" }, "uuid");
    await expect(crud.save({ name: "Branch" }, { timeout: 90_000 })).rejects.toBe(failure);
    expect(mocks.request).toHaveBeenCalledTimes(1);
  });
});
