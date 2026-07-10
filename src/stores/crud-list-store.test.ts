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
const testStore = createCrudListStore<TestRow, TestRow, TestParams>({
  idKey: "test_uuid",
  list: listMock,
  remove: vi.fn(async () => undefined),
  save: vi.fn(async (input) => input)
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
      loading: false,
      total: 1,
      totalPages: 1
    });
  });
});
