import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchBillingCycles,
  fetchPackageMethods,
  fetchPackagePage,
  fetchPackagePlanGroups,
  reorderBillingCycles,
  savePackage,
  type BillingCycle,
  type PackagePageResult,
  type SavePackageInput,
} from "@/services/package";
import { usePackageStore, type PackageQuery } from "@/stores/package-store";

vi.mock("@/services/package", () => ({
  createPackagePlan: vi.fn(),
  fetchBillingCycles: vi.fn(),
  fetchPackageMethods: vi.fn(),
  fetchPackagePage: vi.fn(),
  fetchPackagePlanGroups: vi.fn(),
  reorderBillingCycles: vi.fn(),
  reorderPackageDetails: vi.fn(),
  reorderPackagePlans: vi.fn(),
  savePackage: vi.fn(),
}));

const fetchBillingCyclesMock = vi.mocked(fetchBillingCycles);
const fetchPackageMethodsMock = vi.mocked(fetchPackageMethods);
const fetchPackagePageMock = vi.mocked(fetchPackagePage);
const fetchPackagePlanGroupsMock = vi.mocked(fetchPackagePlanGroups);
const reorderBillingCyclesMock = vi.mocked(reorderBillingCycles);
const savePackageMock = vi.mocked(savePackage);

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, reject, resolve };
}

function pageResult(total: number): PackagePageResult {
  return {
    page: 1,
    limit: 10,
    total,
    totalPages: 1,
    totalBillingCycles: 0,
    totalPackageMethods: 0,
    groups: [],
  };
}

const queryA: PackageQuery = {
  language: "la",
  search: "old",
  page: 1,
  limit: 10,
};
const queryB: PackageQuery = {
  language: "la",
  search: "current",
  page: 1,
  limit: 10,
};

const saveInput: SavePackageInput = {
  planId: "plan-1",
  nameLa: "Package",
  nameEn: "Package",
  price: 100,
  status: 1,
  details: [{ nameLa: "Detail", nameEn: "Detail", status: 1 }],
};

describe("package store request ownership", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    usePackageStore.getState().reset();
    fetchBillingCyclesMock.mockResolvedValue([]);
    fetchPackageMethodsMock.mockResolvedValue([]);
    fetchPackagePlanGroupsMock.mockResolvedValue([]);
  });

  it("does not let an older catalog package error replace the latest package result", async () => {
    const oldPage = deferred<PackagePageResult>();
    const currentPage = deferred<PackagePageResult>();
    fetchPackagePageMock
      .mockReturnValueOnce(oldPage.promise)
      .mockReturnValueOnce(currentPage.promise);

    const oldLoad = usePackageStore.getState().loadCatalog(queryA);
    const currentLoad = usePackageStore.getState().loadPackages(queryB);

    currentPage.resolve(pageResult(2));
    await currentLoad;
    oldPage.reject(new Error("old request failed"));
    await expect(oldLoad).rejects.toThrow("old request failed");

    expect(usePackageStore.getState()).toMatchObject({
      error: null,
      loading: false,
      refreshing: false,
      total: 2,
    });
  });

  it("commits current catalog references when its package query is superseded", async () => {
    const cycles = deferred<BillingCycle[]>();
    const oldPage = deferred<PackagePageResult>();
    const currentPage = deferred<PackagePageResult>();
    const currentCycles: BillingCycle[] = [
      { id: "monthly", name: "Monthly", months: 1, status: 1, sortOrder: 1 },
    ];
    fetchBillingCyclesMock.mockReturnValueOnce(cycles.promise);
    fetchPackagePageMock
      .mockReturnValueOnce(oldPage.promise)
      .mockReturnValueOnce(currentPage.promise);

    const oldLoad = usePackageStore.getState().loadCatalog(queryA);
    const currentLoad = usePackageStore.getState().loadPackages(queryB);

    currentPage.resolve(pageResult(2));
    await currentLoad;
    cycles.resolve(currentCycles);
    oldPage.resolve(pageResult(1));
    await oldLoad;

    expect(usePackageStore.getState().billingCycles).toBe(currentCycles);
    expect(usePackageStore.getState()).toMatchObject({
      error: null,
      total: 2,
    });
  });

  it("commits a current catalog reference error when its package query is superseded", async () => {
    const cycles = deferred<BillingCycle[]>();
    const oldPage = deferred<PackagePageResult>();
    const currentPage = deferred<PackagePageResult>();
    fetchBillingCyclesMock.mockReturnValueOnce(cycles.promise);
    fetchPackagePageMock
      .mockReturnValueOnce(oldPage.promise)
      .mockReturnValueOnce(currentPage.promise);

    const oldLoad = usePackageStore.getState().loadCatalog(queryA);
    const currentLoad = usePackageStore.getState().loadPackages(queryB);

    currentPage.resolve(pageResult(2));
    await currentLoad;
    oldPage.resolve(pageResult(1));
    cycles.reject(new Error("catalog failed"));
    await expect(oldLoad).rejects.toThrow("catalog failed");

    expect(usePackageStore.getState()).toMatchObject({
      error: "catalog failed",
      total: 2,
    });
  });

  it("keeps the foreground busy flag while an older foreground load is still active", async () => {
    const foregroundPage = deferred<PackagePageResult>();
    const backgroundPage = deferred<PackagePageResult>();
    fetchPackagePageMock
      .mockReturnValueOnce(foregroundPage.promise)
      .mockReturnValueOnce(backgroundPage.promise);
    usePackageStore.setState({ hasLoaded: true });

    const foregroundLoad = usePackageStore.getState().loadPackages(queryA);
    const backgroundLoad = usePackageStore
      .getState()
      .loadPackages(queryB, { background: true });

    backgroundPage.resolve(pageResult(2));
    await backgroundLoad;

    expect(usePackageStore.getState()).toMatchObject({
      loading: true,
      refreshing: false,
      total: 2,
    });

    foregroundPage.resolve(pageResult(1));
    await foregroundLoad;
    expect(usePackageStore.getState()).toMatchObject({
      loading: false,
      refreshing: false,
      total: 2,
    });
  });

  it("serializes reorder writes and rolls back only the active operation", async () => {
    const write = deferred<void>();
    const previousCycles: BillingCycle[] = [
      { id: "monthly", name: "Monthly", months: 1, status: 1, sortOrder: 1 },
      { id: "annual", name: "Annual", months: 12, status: 1, sortOrder: 2 },
    ];
    reorderBillingCyclesMock.mockReturnValueOnce(write.promise);
    usePackageStore.setState({ billingCycles: previousCycles });

    const firstSort = usePackageStore
      .getState()
      .sortCycles([...previousCycles].reverse(), queryA);
    const secondSort = usePackageStore
      .getState()
      .sortCycles(previousCycles, queryA);

    await expect(secondSort).rejects.toMatchObject({ statusCode: 409 });
    expect(reorderBillingCyclesMock).toHaveBeenCalledTimes(1);
    expect(usePackageStore.getState()).toMatchObject({
      sortingScope: "cycles",
    });
    expect(
      usePackageStore.getState().billingCycles.map((cycle) => cycle.id)
    ).toEqual(["annual", "monthly"]);

    write.reject(new Error("reorder failed"));
    await expect(firstSort).rejects.toThrow("reorder failed");
    expect(usePackageStore.getState().billingCycles).toBe(previousCycles);
    expect(usePackageStore.getState().sortingScope).toBeNull();
  });

  it("does not refresh a stale mutation query over the latest user query", async () => {
    const write = deferred<void>();
    fetchPackagePageMock
      .mockResolvedValueOnce(pageResult(1))
      .mockResolvedValueOnce(pageResult(2))
      .mockResolvedValueOnce(pageResult(1));
    savePackageMock.mockReturnValueOnce(write.promise);

    await usePackageStore.getState().loadPackages(queryA);
    const save = usePackageStore.getState().save(saveInput, queryA);
    await usePackageStore.getState().loadPackages(queryB);

    write.resolve();
    await save;

    expect(fetchPackagePageMock).toHaveBeenCalledTimes(2);
    expect(usePackageStore.getState().total).toBe(2);
  });

  it("resolves a successful write when its best-effort refresh fails", async () => {
    fetchPackagePageMock
      .mockResolvedValueOnce(pageResult(1))
      .mockRejectedValueOnce(new Error("refresh failed"));
    savePackageMock.mockResolvedValueOnce();

    await usePackageStore.getState().loadPackages(queryA);

    await expect(
      usePackageStore.getState().save(saveInput, queryA)
    ).resolves.toBeUndefined();
    expect(usePackageStore.getState()).toMatchObject({
      error: "refresh failed",
      saving: false,
      total: 1,
    });
  });
});
