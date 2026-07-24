import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProductImageStatus, type CartOrder, type ProdItem } from "@/services/pos";
import * as publicPosService from "@/services/public-pos";
import type { QRScanResponse } from "@/services/public-pos";
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
