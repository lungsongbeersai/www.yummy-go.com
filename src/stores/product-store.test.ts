import { beforeEach, describe, expect, it, vi } from "vitest";
import { getProducts, type Product } from "@/services/product";
import { useProductStore } from "@/stores/product-store";
import { resetSessionStores } from "@/stores/session-store-registry";

vi.mock("@/services/product", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/product")>();
  return { ...actual, getProducts: vi.fn() };
});

const getProductsMock = vi.mocked(getProducts);
type ProductResult = Awaited<ReturnType<typeof getProducts>>;
const params = { branch_uuid_fk: "branch-1", cate_uuid_fk: "food-sets", lang: "la" };

function result(total: number, prodUuid = "first-product"): ProductResult {
  return { status: "success", message: "ok", total, totalPages: total, data: total ? [{ prod_uuid: prodUuid }] : [] };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

function mockTotals(normal: number, set: number, promotion = 0) {
  getProductsMock.mockImplementation(async ({ status_sort_fk } = {}) =>
    result(status_sort_fk === 2 ? set : status_sort_fk === 3 ? promotion : normal));
}

describe("product category status resolution", () => {
  beforeEach(() => {
    getProductsMock.mockReset();
    useProductStore.getState().reset();
  });

  it("resolves eight sets beside one normal product without replacing list rows or totals", async () => {
    const existing: Product[] = [{ prod_uuid: "visible-product" }];
    useProductStore.setState({ rows: existing, total: 40, totalPages: 2 });
    mockTotals(1, 8);

    await expect(useProductStore.getState().resolveCategoryStatus(params, "1")).resolves.toBe("2");
    expect(useProductStore.getState()).toMatchObject({ rows: existing, total: 40, totalPages: 2, loading: false, error: null });
    expect(useProductStore.getState().rows).toBe(existing);
  });

  it("uses full API totals rather than the single returned row or its details", async () => {
    mockTotals(21, 30, 20);
    await expect(useProductStore.getState().resolveCategoryStatus(params, "1")).resolves.toBe("2");
  });

  it("makes three bounded queries independent of the visible search, page and limit", async () => {
    mockTotals(1, 8);
    await useProductStore.getState().resolveCategoryStatus({
      ...params, page: 12, limit: "All", search: "heineken", status_sort_fk: 1, orderBy: "DESC",
    }, "1");

    expect(getProductsMock).toHaveBeenCalledTimes(3);
    for (const status_sort_fk of [1, 2, 3]) {
      expect(getProductsMock).toHaveBeenCalledWith({ ...params, status_sort_fk, page: 1, limit: 1, search: "" });
    }
  });

  it("preserves the current type for equal totals and empty categories", async () => {
    mockTotals(8, 8, 1);
    await expect(useProductStore.getState().resolveCategoryStatus(params, "2")).resolves.toBe("2");
    mockTotals(0, 0);
    await expect(useProductStore.getState().resolveCategoryStatus(params, "3")).resolves.toBe("3");
  });

  it("returns null for an old category response after a newer category resolved", async () => {
    const old = Array.from({ length: 3 }, () => deferred<ProductResult>());
    for (const response of old) getProductsMock.mockReturnValueOnce(response.promise);
    const previous = useProductStore.getState().resolveCategoryStatus(params, "1");
    mockTotals(20, 1);
    await expect(useProductStore.getState().resolveCategoryStatus({ ...params, cate_uuid_fk: "new-normal" }, "2")).resolves.toBe("1");

    old[0].resolve(result(1)); old[1].resolve(result(8)); old[2].resolve(result(0));
    await expect(previous).resolves.toBeNull();
    expect(useProductStore.getState()).toMatchObject({ loading: false, error: null });
  });

  it("does not clear a newer list request's loading state when an old probe finishes", async () => {
    const old = Array.from({ length: 3 }, () => deferred<ProductResult>());
    for (const response of old) getProductsMock.mockReturnValueOnce(response.promise);
    const previous = useProductStore.getState().resolveCategoryStatus(params, "1");
    const listResponse = deferred<ProductResult>();
    getProductsMock.mockReturnValueOnce(listResponse.promise);
    const list = useProductStore.getState().load({ ...params, status_sort_fk: 1 });
    for (const response of old) response.resolve(result(8));
    await expect(previous).resolves.toBeNull();
    expect(useProductStore.getState().loading).toBe(true);
    listResponse.resolve(result(1, "current-list"));
    await list;
    expect(useProductStore.getState().rows[0].prod_uuid).toBe("current-list");
  });

  it.each(["store", "session"])("discards a pending probe after a %s reset", async (reset) => {
    const responses = Array.from({ length: 3 }, () => deferred<ProductResult>());
    for (const response of responses) getProductsMock.mockReturnValueOnce(response.promise);
    const pending = useProductStore.getState().resolveCategoryStatus(params, "1");
    if (reset === "session") resetSessionStores();
    else useProductStore.getState().reset();
    for (const response of responses) response.resolve(result(8));
    await expect(pending).resolves.toBeNull();
    expect(useProductStore.getState()).toMatchObject({ rows: [], total: 0, loading: false, error: null });
  });

  it("surfaces a current API failure without publishing partial counts", async () => {
    const failure = new Error("Unable to load category totals");
    getProductsMock.mockRejectedValue(failure);
    await expect(useProductStore.getState().resolveCategoryStatus(params, "1")).rejects.toThrow(failure.message);
    expect(useProductStore.getState()).toMatchObject({ loading: false, error: failure.message, rows: [], total: 0 });
  });

  it("discards an old probe failure after a newer list is visible", async () => {
    const old = Array.from({ length: 3 }, () => deferred<ProductResult>());
    for (const response of old) getProductsMock.mockReturnValueOnce(response.promise);
    const pending = useProductStore.getState().resolveCategoryStatus(params, "1");
    getProductsMock.mockResolvedValueOnce(result(1, "current-list"));
    await useProductStore.getState().load(params);
    old[0].reject(new Error("Stale failure")); old[1].resolve(result(8)); old[2].resolve(result(0));
    await expect(pending).resolves.toBeNull();
    expect(useProductStore.getState()).toMatchObject({ error: null, loading: false, rows: [{ prod_uuid: "current-list" }] });
  });

  it("keeps the existing default load query and pagination behavior", async () => {
    getProductsMock.mockResolvedValueOnce({ ...result(40), totalPages: 2 });
    const query = { ...params, page: 2, limit: 20, search: "tea", status_sort_fk: 1 };
    await useProductStore.getState().load(query);
    expect(getProductsMock).toHaveBeenCalledOnce();
    expect(getProductsMock).toHaveBeenCalledWith({ ...query, orderBy: "ASC" });
    expect(useProductStore.getState()).toMatchObject({ total: 40, totalPages: 2, loading: false });
  });

  it("does not query without both a branch and category", async () => {
    await expect(useProductStore.getState().resolveCategoryStatus({}, "1")).resolves.toBeNull();
    await expect(useProductStore.getState().resolveCategoryStatus({ branch_uuid_fk: "branch-1" }, "1")).resolves.toBeNull();
    expect(getProductsMock).not.toHaveBeenCalled();
  });
});
