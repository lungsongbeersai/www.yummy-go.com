import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProductImageStatus, type CartOrder, type CateProductItem, type ProdItem } from "@/services/pos";
import * as publicPosService from "@/services/public-pos";
import type { CustomerFetchCateProductsResponse, QRScanResponse } from "@/services/public-pos";
import { usePublicPosStore } from "@/stores/public-pos-store";

vi.mock("@/lib/socket", () => ({
  emitTableAlert: vi.fn()
}));

vi.mock("@/services/public-pos", () => ({
  customerConfirmKitchen: vi.fn(),
  customerCreateOrder: vi.fn(),
  customerDeleteOrderItem: vi.fn(),
  customerEmitTableStatus: vi.fn(),
  customerFetchCateProducts: vi.fn(),
  customerGetProdItem: vi.fn(),
  customerUpdateOrderNote: vi.fn(),
  customerUpdateQty: vi.fn(),
  fetchCustomerCart: vi.fn(),
  scanTableQR: vi.fn()
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, reject, resolve };
}

function product(prodUuid: string): ProdItem {
  return {
    prodUuid,
    prodName: prodUuid,
    prodStatusImge: ProductImageStatus.IMAGE,
    prodImage: "",
    details: [],
    toppings: []
  };
}

function scan(token: string, lang: string): QRScanResponse {
  return {
    status: "success",
    message: "",
    lang,
    table_uuid: `${token}-table`,
    table_name: `${token} table`,
    table_status: 1,
    qr_enabled: true,
    branch_uuid_fk: `${token}-branch`
  };
}

const fetchCustomerCartMock = vi.mocked(publicPosService.fetchCustomerCart);
const getProductItemMock = vi.mocked(publicPosService.customerGetProdItem);
const updateQtyMock = vi.mocked(publicPosService.customerUpdateQty);
const fetchCatalogMock = vi.mocked(publicPosService.customerFetchCateProducts);

function catalogProduct(name: string): CateProductItem {
  return {
    prodUuid: name, prodName: name, prodImage: "", prodStatusImge: ProductImageStatus.IMAGE,
    statusSortFk: 1, canAdd: true, hasOptions: false, optionsMsg: "",
    countOptionAll: 1, countOptionEnabled: 1, countToppingEnabled: 0
  };
}

function catalog(generation: string, selected = "a", categories = ["a", "b"]): CustomerFetchCateProductsResponse {
  return {
    status: "success", message: "", selectedCateUuid: selected, defaultCateUuid: "a",
    categories: categories.map((cateUuid) => ({
      cateUuid, cateName: `${generation}-${cateUuid}`,
      products: cateUuid === selected ? [catalogProduct(`${generation}-${cateUuid}`)] : []
    }))
  };
}

describe("public POS session isolation", () => {
  beforeEach(() => {
    usePublicPosStore.getState().reset();
    vi.clearAllMocks();
  });

  it("ignores an older cart response after the language changes", async () => {
    const oldRequest = deferred<
      Awaited<ReturnType<typeof publicPosService.fetchCustomerCart>>
    >();
    const currentRequest = deferred<
      Awaited<ReturnType<typeof publicPosService.fetchCustomerCart>>
    >();
    fetchCustomerCartMock
      .mockReturnValueOnce(oldRequest.promise)
      .mockReturnValueOnce(currentRequest.promise);

    const oldLoad = usePublicPosStore
      .getState()
      .loadCart({ t: "table-token", lang: "en" });
    usePublicPosStore.setState({
      scan: scan("table-token", "eng"),
      tableName: "old table",
      cart: [{ order_uuid: "visible-old-order" }],
      selectedProduct: product("visible-old-product")
    });
    const currentLoad = usePublicPosStore
      .getState()
      .loadCart({ t: "table-token", lang: "la" });
    expect(usePublicPosStore.getState()).toMatchObject({
      scan: null,
      tableName: "",
      cart: [],
      selectedProduct: null,
      loadingCart: true
    });
    const currentCart: CartOrder = { order_uuid: "current-order" };
    currentRequest.resolve({
      status: "success",
      message: "",
      data: [currentCart]
    });
    await currentLoad;

    const oldCart: CartOrder = { order_uuid: "old-order" };
    oldRequest.resolve({
      status: "success",
      message: "",
      data: [oldCart]
    });

    await expect(oldLoad).resolves.toEqual([oldCart]);
    expect(usePublicPosStore.getState()).toMatchObject({
      cart: [currentCart],
      cartHydrated: true,
      loadingCart: false,
      token: "table-token"
    });
  });

  it("keeps the latest cart response within the same session", async () => {
    const oldRequest = deferred<
      Awaited<ReturnType<typeof publicPosService.fetchCustomerCart>>
    >();
    const currentRequest = deferred<
      Awaited<ReturnType<typeof publicPosService.fetchCustomerCart>>
    >();
    fetchCustomerCartMock
      .mockReturnValueOnce(oldRequest.promise)
      .mockReturnValueOnce(currentRequest.promise);

    const oldLoad = usePublicPosStore
      .getState()
      .loadCart({ t: "table-token", lang: "la" });
    const currentLoad = usePublicPosStore
      .getState()
      .loadCart({ t: "table-token", lang: "la" });
    const currentCart: CartOrder = { order_uuid: "current-order" };
    currentRequest.resolve({
      status: "success",
      message: "",
      data: [currentCart]
    });
    await currentLoad;

    oldRequest.resolve({
      status: "success",
      message: "",
      data: [{ order_uuid: "old-order" }]
    });
    await oldLoad;

    expect(usePublicPosStore.getState()).toMatchObject({
      cart: [currentCart],
      loadingCart: false
    });
  });

  it("clears visible data as soon as setToken changes sessions", () => {
    usePublicPosStore.getState().setToken("old-token");
    usePublicPosStore.setState({
      scan: scan("old-token", "la"),
      tableName: "old table",
      cart: [{ order_uuid: "old-order" }],
      selectedProduct: product("old-product"),
      categoryTabs: [
        { cateUuid: "old-category", cateName: "Old category" }
      ],
      selectedCateUuid: "old-category"
    });

    usePublicPosStore.getState().setToken("current-token");

    expect(usePublicPosStore.getState()).toMatchObject({
      token: "current-token",
      scan: null,
      tableName: "",
      cart: [],
      selectedProduct: null,
      categoryTabs: [],
      selectedCateUuid: ""
    });
  });

  it("does not start an old mutation cart refresh after reset", async () => {
    const pendingMutation = deferred<
      Awaited<ReturnType<typeof publicPosService.customerUpdateQty>>
    >();
    updateQtyMock.mockReturnValueOnce(pendingMutation.promise);
    usePublicPosStore.getState().setToken("old-token");

    const mutation = usePublicPosStore.getState().updateQty({
      t: "old-token",
      order_item_uuid: "item-1",
      change_type: "INCREASE",
      change_qty: 1
    });
    usePublicPosStore.getState().reset();
    usePublicPosStore.getState().setToken("current-token");
    pendingMutation.resolve({ status: "success" });

    await expect(mutation).resolves.toEqual({ status: "success" });
    expect(fetchCustomerCartMock).not.toHaveBeenCalled();
    expect(usePublicPosStore.getState()).toMatchObject({
      token: "current-token",
      saving: false,
      error: null
    });
  });

  it("keeps a new product request tracked when an old request settles", async () => {
    const oldRequest = deferred<
      Awaited<ReturnType<typeof publicPosService.customerGetProdItem>>
    >();
    const currentRequest = deferred<
      Awaited<ReturnType<typeof publicPosService.customerGetProdItem>>
    >();
    getProductItemMock
      .mockReturnValueOnce(oldRequest.promise)
      .mockReturnValueOnce(currentRequest.promise);
    const params = { token: "table-token", lang: "la", prodUuid: "product-1" };

    const oldLoad = usePublicPosStore.getState().loadProductItem(params);
    usePublicPosStore.getState().reset();
    const currentLoad = usePublicPosStore.getState().loadProductItem(params);
    oldRequest.resolve(product("old-product"));
    await oldLoad;

    const duplicateLoad = usePublicPosStore.getState().loadProductItem(params);
    expect(getProductItemMock).toHaveBeenCalledTimes(2);
    currentRequest.resolve(product("current-product"));

    await Promise.all([currentLoad, duplicateLoad]);
    expect(usePublicPosStore.getState()).toMatchObject({
      selectedProduct: product("current-product"),
      loadingItem: false,
      token: "table-token"
    });
  });

  it("keeps the latest selected product within the same session", async () => {
    const oldRequest = deferred<
      Awaited<ReturnType<typeof publicPosService.customerGetProdItem>>
    >();
    const currentRequest = deferred<
      Awaited<ReturnType<typeof publicPosService.customerGetProdItem>>
    >();
    getProductItemMock
      .mockReturnValueOnce(oldRequest.promise)
      .mockReturnValueOnce(currentRequest.promise);

    const oldLoad = usePublicPosStore.getState().loadProductItem({
      token: "table-token",
      lang: "la",
      prodUuid: "old-product"
    });
    const currentLoad = usePublicPosStore.getState().loadProductItem({
      token: "table-token",
      lang: "la",
      prodUuid: "current-product"
    });
    currentRequest.resolve(product("current-product"));
    await currentLoad;
    oldRequest.resolve(product("old-product"));
    await oldLoad;

    expect(usePublicPosStore.getState()).toMatchObject({
      selectedProduct: product("current-product"),
      loadingItem: false
    });
  });
});

describe("public menu soft refresh", () => {
  const params = { token: "table-token", lang: "la", search: "" };
  beforeEach(() => {
    usePublicPosStore.getState().reset();
    vi.resetAllMocks();
  });

  async function seed(categories = ["a", "b"]) {
    fetchCatalogMock.mockResolvedValueOnce(catalog("old", "a", categories));
    await usePublicPosStore.getState().loadMenuProducts(params);
    usePublicPosStore.setState({ cart: [{ order_uuid: "saved-order" }], cartHydrated: true });
  }

  it("starts a real GET despite a warm TTL cache, preserves visible state and swaps fresh loaded categories together", async () => {
    await seed();
    fetchCatalogMock.mockResolvedValueOnce(catalog("old", "b"));
    await usePublicPosStore.getState().loadNormalCategoryProducts({ ...params, cateUuid: "b" });
    usePublicPosStore.getState().setSelectedCateUuid("b");
    const before = usePublicPosStore.getState();
    const base = deferred<CustomerFetchCateProductsResponse>();
    const category = deferred<CustomerFetchCateProductsResponse>();
    fetchCatalogMock.mockClear();
    fetchCatalogMock.mockReturnValueOnce(base.promise).mockReturnValueOnce(category.promise);
    const refresh = usePublicPosStore.getState().refreshMenuProducts(params);
    const duplicate = usePublicPosStore.getState().refreshMenuProducts(params);
    expect(duplicate).toBe(refresh);
    expect(fetchCatalogMock).toHaveBeenCalledTimes(1);
    expect(usePublicPosStore.getState()).toMatchObject({ refreshingMenu: true, loadingMenu: false, selectedCateUuid: "b" });
    expect(usePublicPosStore.getState().menuByKind).toBe(before.menuByKind);
    expect(usePublicPosStore.getState().cart).toBe(before.cart);
    base.resolve(catalog("new"));
    await vi.waitFor(() => expect(fetchCatalogMock).toHaveBeenCalledTimes(2));
    expect(usePublicPosStore.getState().menuByKind).toBe(before.menuByKind);
    await usePublicPosStore.getState().loadNormalCategoryProducts({ ...params, cateUuid: "c" });
    expect(fetchCatalogMock).toHaveBeenCalledTimes(2);
    category.resolve(catalog("new", "b"));
    await refresh;
    const after = usePublicPosStore.getState();
    expect(after).toMatchObject({ refreshingMenu: false, loadingMenu: false, selectedCateUuid: "b", error: null });
    expect(after.menuByKind.normal.categories.map((item) => item.products[0]?.prodName)).toEqual(["new-a", "new-b"]);
    expect(after.menuByKind.normal.loadedCateUuids).toEqual(["a", "b"]);
    expect(after.cart).toBe(before.cart);
    expect(fetchCustomerCartMock).not.toHaveBeenCalled();
  });

  it("does not invalidate a cart response running in parallel", async () => {
    await seed();
    const cart = deferred<Awaited<ReturnType<typeof publicPosService.fetchCustomerCart>>>();
    fetchCustomerCartMock.mockReturnValueOnce(cart.promise);
    const cartLoad = usePublicPosStore.getState().loadCart({ t: params.token, lang: params.lang });
    fetchCatalogMock.mockResolvedValueOnce(catalog("new"));
    await usePublicPosStore.getState().refreshMenuProducts(params);
    cart.resolve({ status: "success", message: "", orders: [{ order_uuid: "fresh-cart" }] });
    await cartLoad;
    expect(usePublicPosStore.getState()).toMatchObject({ cart: [{ order_uuid: "fresh-cart" }], loadingCart: false, cartHydrated: true });
  });

  it("keeps the previous catalog and cart when any required refreshed category fails", async () => {
    await seed();
    fetchCatalogMock.mockResolvedValueOnce(catalog("old", "b"));
    await usePublicPosStore.getState().loadNormalCategoryProducts({ ...params, cateUuid: "b" });
    const before = usePublicPosStore.getState();
    fetchCatalogMock.mockResolvedValueOnce(catalog("new")).mockRejectedValueOnce(new Error("Category unavailable"));
    await expect(usePublicPosStore.getState().refreshMenuProducts(params)).rejects.toThrow("Category unavailable");
    const after = usePublicPosStore.getState();
    expect(after).toMatchObject({ refreshingMenu: false, loadingMenu: false, error: "Category unavailable" });
    expect(after.menuByKind.normal.categories).toBe(before.menuByKind.normal.categories);
    expect(after.menuByKind.normal.error).toBe("Category unavailable");
    expect(after.cart).toBe(before.cart);
  });

  it.each(["success", "failure"] as const)("discards pre-refresh category %s instead of overwriting fresh products or errors", async (outcome) => {
    await seed();
    const oldCategory = deferred<CustomerFetchCateProductsResponse>();
    fetchCatalogMock.mockReturnValueOnce(oldCategory.promise);
    const oldLoad = usePublicPosStore.getState().loadNormalCategoryProducts({ ...params, cateUuid: "b" });
    fetchCatalogMock.mockResolvedValueOnce(catalog("new")).mockResolvedValueOnce(catalog("new", "b"));
    await usePublicPosStore.getState().refreshMenuProducts(params);
    if (outcome === "success") oldCategory.resolve(catalog("stale", "b"));
    else oldCategory.reject(new Error("Stale category failure"));
    await oldLoad;
    expect(usePublicPosStore.getState().menuByKind.normal.categories[1].products[0].prodName).toBe("new-b");
    expect(usePublicPosStore.getState().menuByKind.normal.loadingCateUuids).toEqual([]);
    expect(usePublicPosStore.getState().error).toBeNull();
  });

  it.each(["success", "failure"] as const)("does not let a pre-refresh base %s overwrite the refreshed catalog for the same query", async (outcome) => {
    const initial = deferred<CustomerFetchCateProductsResponse>();
    fetchCatalogMock.mockReturnValueOnce(initial.promise);
    const oldLoad = usePublicPosStore.getState().loadMenuProducts(params);
    fetchCatalogMock.mockResolvedValueOnce(catalog("fresh"));
    await usePublicPosStore.getState().refreshMenuProducts(params);
    if (outcome === "success") initial.resolve(catalog("stale"));
    else initial.reject(new Error("Stale base failure"));
    await oldLoad;
    expect(usePublicPosStore.getState().menuByKind.normal.categories[0].products[0].prodName).toBe("fresh-a");
    expect(usePublicPosStore.getState()).toMatchObject({ refreshingMenu: false, loadingMenu: false, error: null });
  });

  it.each(["success", "failure"] as const)("discards an old refresh %s after switching QR or language", async (outcome) => {
    await seed();
    const oldRequest = deferred<CustomerFetchCateProductsResponse>();
    fetchCatalogMock.mockReturnValueOnce(oldRequest.promise);
    const oldRefresh = usePublicPosStore.getState().refreshMenuProducts(params);
    fetchCatalogMock.mockResolvedValueOnce(catalog("current"));
    await usePublicPosStore.getState().loadMenuProducts({ token: "new-table", lang: "en" });
    const current = usePublicPosStore.getState().menuByKind;
    if (outcome === "success") oldRequest.resolve(catalog("stale"));
    else oldRequest.reject(new Error("Old table error"));
    await oldRefresh;
    expect(usePublicPosStore.getState().menuByKind).toBe(current);
    expect(usePublicPosStore.getState()).toMatchObject({ token: "new-table", cart: [], refreshingMenu: false, loadingMenu: false, error: null });
  });

  it("does not restore a category removed from the authoritative refreshed catalog", async () => {
    await seed();
    fetchCatalogMock.mockResolvedValueOnce(catalog("old", "b"));
    await usePublicPosStore.getState().loadNormalCategoryProducts({ ...params, cateUuid: "b" });
    usePublicPosStore.getState().setSelectedCateUuid("b");
    fetchCatalogMock.mockResolvedValueOnce(catalog("new", "a", ["a"]));
    await usePublicPosStore.getState().refreshMenuProducts(params);
    expect(usePublicPosStore.getState()).toMatchObject({ selectedCateUuid: "a", categoryTabs: [{ cateUuid: "a", cateName: "new-a" }] });
    expect(usePublicPosStore.getState().menuByKind.normal.loadedCateUuids).toEqual(["a"]);
  });

  it("refreshes loaded categories with at most three concurrent requests", async () => {
    const categoryIds = ["a", "b", "c", "d", "e"];
    await seed(categoryIds);
    const old = usePublicPosStore.getState();
    usePublicPosStore.setState({ menuByKind: { ...old.menuByKind, normal: { ...old.menuByKind.normal, loadedCateUuids: categoryIds } } });
    const pending = new Map(categoryIds.slice(1).map((id) => [id, deferred<CustomerFetchCateProductsResponse>()]));
    let active = 0;
    let peak = 0;
    fetchCatalogMock.mockImplementation((request) => {
      if (!request.cateUuid) return Promise.resolve(catalog("new", "a", categoryIds));
      active++;
      peak = Math.max(peak, active);
      return pending.get(request.cateUuid)!.promise.finally(() => { active--; });
    });
    const refresh = usePublicPosStore.getState().refreshMenuProducts(params);
    await vi.waitFor(() => expect(active).toBe(3));
    pending.get("b")!.resolve(catalog("new", "b", categoryIds));
    await vi.waitFor(() => expect(fetchCatalogMock).toHaveBeenCalledWith(expect.objectContaining({ cateUuid: "e" })));
    for (const id of ["c", "d", "e"]) pending.get(id)!.resolve(catalog("new", id, categoryIds));
    await refresh;
    expect(peak).toBe(3);
    expect(usePublicPosStore.getState().menuByKind.normal.loadedCateUuids).toEqual(categoryIds);
  });
});
