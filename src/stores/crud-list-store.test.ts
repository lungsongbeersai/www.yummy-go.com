import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiEntity, ApiListResponse, FetchParams } from "@/services/shared/types";
import { createCrudListStore } from "@/stores/crud-list-store";

interface TestRow extends ApiEntity {
  test_uuid: string;
}

interface TestParams extends FetchParams {
  scope?: string;
}

const listMock = vi.fn<(params?: TestParams) => Promise<ApiListResponse<TestRow>>>();
const saveMock = vi.fn<(input: TestRow) => Promise<TestRow>>(async (input) => input);
const removeMock = vi.fn<(id: string) => Promise<void>>(async () => undefined);
const testStore = createCrudListStore<TestRow, TestRow, TestParams>({
  idKey: "test_uuid",
  list: listMock,
  remove: removeMock,
  save: saveMock
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("CRUD list store request ordering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testStore.getState().reset();
  });

  it("keeps the latest query when an older response finishes last", async () => {
    const first = deferred<ApiListResponse<TestRow>>();
    const second = deferred<ApiListResponse<TestRow>>();
    const currentRows = [{ test_uuid: "current" }];
    listMock
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const firstLoad = testStore.getState().load({ search: "old" });
    const secondLoad = testStore.getState().load({ search: "current" });

    second.resolve({ data: currentRows, message: "ok", status: "success", total: 1, totalPages: 1 });
    await secondLoad;
    first.resolve({
      data: [{ test_uuid: "old" }],
      message: "ok",
      status: "success",
      total: 1,
      totalPages: 1
    });
    await firstLoad;

    expect(testStore.getState()).toMatchObject({
      rows: currentRows,
      response: {
        data: currentRows,
        message: "ok",
        status: "success",
        total: 1,
        totalPages: 1
      },
      loading: false,
      total: 1,
      totalPages: 1
    });
  });

  it("clears old-store rows and ignores their pending response after a scope reset", async () => {
    const oldRequest = deferred<ApiListResponse<TestRow>>();
    listMock.mockReturnValueOnce(oldRequest.promise);
    const pending = testStore.getState().load({ scope: "old-store" });
    testStore.getState().reset();
    expect(testStore.getState()).toMatchObject({ rows: [], hasLoaded: false, loading: false });
    oldRequest.resolve({ status: "success", message: "ok", data: [{ test_uuid: "old-store-branch" }] });
    await pending;
    expect(testStore.getState()).toMatchObject({ rows: [], total: 0, hasLoaded: false, loading: false });
  });

  it("does not let an old-store save clear the new store's pending save state", async () => {
    const old = deferred<TestRow>();
    const current = deferred<TestRow>();
    saveMock.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
    const oldSave = testStore.getState().save({ test_uuid: "old" });
    testStore.getState().reset();
    const currentSave = testStore.getState().save({ test_uuid: "current" });
    old.resolve({ test_uuid: "old" });
    await oldSave;
    expect(testStore.getState().saving).toBe(true);
    current.resolve({ test_uuid: "current" });
    await currentSave;
    expect(testStore.getState().saving).toBe(false);
  });

  it("does not apply a pending delete to rows loaded after a reset", async () => {
    const pending = deferred<void>();
    removeMock.mockReturnValueOnce(pending.promise);
    const removing = testStore.getState().remove("shared-id");
    testStore.getState().reset();
    listMock.mockResolvedValueOnce({ status: "success", message: "ok", data: [{ test_uuid: "shared-id" }] });
    await testStore.getState().load({ scope: "current-store" });
    pending.resolve();
    await removing;
    expect(testStore.getState().rows).toEqual([{ test_uuid: "shared-id" }]);
  });
});
