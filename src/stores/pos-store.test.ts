import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolvePrinterDeviceIdentity } from "@/services/printer";
import {
  confirmToKitchen,
  fetchCart,
  fetchCateProducts,
  getPosTables,
  reprintReceipt,
  splitBill,
  ProductSortStatus,
  type CateWithProducts,
  type ConfirmToKitchenResponse,
  type FetchCartResponse,
  type PosZone,
  type ReprintReceiptResponse,
  type SplitBillResponse
} from "@/services/pos";
import { usePosStore } from "@/stores/pos-store";
import { usePrinterStore } from "@/stores/printer-store";
import { resetSessionStores } from "@/stores/session-store-registry";

vi.mock("@/services/printer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/printer")>();
  return {
    ...actual,
    resolvePrinterDeviceIdentity: vi.fn()
  };
});

vi.mock("@/services/pos", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/pos")>();
  return {
    ...actual,
    confirmToKitchen: vi.fn(),
    fetchCart: vi.fn(),
    fetchCateProducts: vi.fn(),
    getPosTables: vi.fn(),
    reprintReceipt: vi.fn(),
    splitBill: vi.fn()
  };
});

const confirmToKitchenMock = vi.mocked(confirmToKitchen);
const fetchCartMock = vi.mocked(fetchCart);
const fetchCateProductsMock = vi.mocked(fetchCateProducts);
const getPosTablesMock = vi.mocked(getPosTables);
const reprintReceiptMock = vi.mocked(reprintReceipt);
const splitBillMock = vi.mocked(splitBill);
const resolvePrinterDeviceIdentityMock = vi.mocked(resolvePrinterDeviceIdentity);
const originalExecuteKitchen = usePrinterStore.getState().executeKitchen;
const originalLoadProductCategories =
  usePosStore.getState().loadProductCategories;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function zone(zoneUuid: string): PosZone {
  return {
    zone_uuid: zoneUuid,
    zone_name: zoneUuid,
    tables: []
  };
}

function category(cateUuid: string): CateWithProducts {
  return {
    cateUuid,
    cateName: cateUuid,
    products: []
  };
}

describe("POS store session follow-up requests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePrinterStore.setState({ executeKitchen: originalExecuteKitchen });
    usePosStore.getState().reset();
    usePrinterStore.getState().reset();
  });

  it("does not confirm an order after printer resolution crosses a session boundary", async () => {
    const context = deferred<Awaited<ReturnType<typeof resolvePrinterDeviceIdentity>>>();
    resolvePrinterDeviceIdentityMock.mockReturnValueOnce(context.promise);

    const confirm = usePosStore.getState().confirmKitchen({
      order_uuid: "order-1",
      login_uuid_fk: "login-1"
    });
    resetSessionStores();
    context.resolve({
      ok: true,
      agent: {
        agent_id: "agent-1",
        agent_name: "Agent",
        device_code: "device-1",
        platform: "win32",
      },
    });

    await expect(confirm).rejects.toThrow("Session changed while the request was in progress");
    expect(confirmToKitchenMock).not.toHaveBeenCalled();
  });

  it("does not execute a kitchen print returned to a previous session", async () => {
    const response = deferred<ConfirmToKitchenResponse>();
    const executeKitchenMock = vi.fn().mockResolvedValue({
      failedCount: 0,
      successCount: 1,
      total: 1
    });
    resolvePrinterDeviceIdentityMock.mockResolvedValueOnce({
      ok: true,
      agent: {
        agent_id: "agent-1",
        agent_name: "Agent",
        device_code: "device-1",
        platform: "win32",
      },
    });
    confirmToKitchenMock.mockReturnValueOnce(response.promise);
    usePrinterStore.setState({ executeKitchen: executeKitchenMock });

    const confirm = usePosStore.getState().confirmKitchen({
      order_uuid: "order-1",
      login_uuid_fk: "login-1"
    });
    await vi.waitFor(() => expect(confirmToKitchenMock).toHaveBeenCalledOnce());
    resetSessionStores();
    const result: ConfirmToKitchenResponse = {
      message: "ok",
      pending_query: {
        print_job_uuid: "job-1",
        login_uuid_fk: "login-1"
      },
      status: "success"
    };
    response.resolve(result);

    await expect(confirm).resolves.toEqual(result);
    expect(executeKitchenMock).not.toHaveBeenCalled();
  });

  it("builds a reprint pending query from the local printer context", async () => {
    resolvePrinterDeviceIdentityMock.mockResolvedValueOnce({
      ok: true,
      agent: {
        agent_id: "local-agent",
        agent_name: "Local",
        device_code: "local-device",
        platform: "win32",
      },
    });
    reprintReceiptMock.mockResolvedValueOnce({
      print_job: { print_job_uuid: " job-1 " },
      pending_query: {
        print_job_uuid: "ignored-job",
        login_uuid_fk: "ignored-login",
        device_code: "ignored-device",
        agent_id: "ignored-agent",
        print_mode: "ignored-mode"
      }
    } as ReprintReceiptResponse & {
      pending_query: {
        print_job_uuid: string;
        login_uuid_fk: string;
        device_code: string;
        agent_id: string;
        print_mode: string;
      };
    });

    const result = await usePosStore.getState().reprintReceipt({
      order_uuid: "order-1",
      login_uuid_fk: "login-1",
      lang: "la"
    });

    expect(reprintReceiptMock).toHaveBeenCalledWith({
      order_uuid: "order-1",
      login_uuid_fk: "login-1",
      lang: "la",
      device_code: "local-device",
      agent_id: "local-agent",
      print_mode: "windows_agent"
    });
    expect(result).toEqual({
      print_job_uuid: "job-1",
      login_uuid_fk: "login-1",
      device_code: "local-device",
      agent_id: "local-agent",
      print_mode: "windows_agent"
    });
  });

  it("returns null when the reprint response has no usable job UUID", async () => {
    resolvePrinterDeviceIdentityMock.mockResolvedValueOnce({
      ok: true,
      agent: {
        agent_id: "agent-1",
        agent_name: "Agent",
        device_code: "device-1",
        platform: "win32",
      },
    });
    reprintReceiptMock.mockResolvedValueOnce({
      print_job: { print_job_uuid: "   " }
    });

    await expect(usePosStore.getState().reprintReceipt({
      order_uuid: "order-1",
      login_uuid_fk: "login-1"
    })).resolves.toBeNull();
  });

  it("adds local printer context to split invoice requests", async () => {
    resolvePrinterDeviceIdentityMock.mockResolvedValueOnce({
      ok: true,
      agent: {
        agent_id: "include-f8e4f9",
        agent_name: "InClude",
        device_code: "INCLUDE",
        platform: "win32",
      },
    });
    const response: SplitBillResponse = {
      print_job: { print_job_uuid: "job-1" },
      status: "success"
    };
    splitBillMock.mockResolvedValueOnce(response);

    const input = {
      order_uuid: "532f836f-d580-4244-b2fa-615526292b73",
      order_item_uuids: [{ "221aa39e-a6b7-4fcb-be26-dc0255bc10d2": 2 }],
      document_type: "invoice" as const,
      order_channel: 1 as const,
      customer_uuid_fk: "95eed663-1bad-4b2d-99c8-07676be13e94",
      payment_method: 1 as const,
      amount: 63840,
      cash_payment_amount: 63840,
      transfer_payment_amount: 0,
      change_amount: 0,
      note: "split bill cash payment",
      lang: "la" as const,
      login_uuid_fk: "fc445438-e617-471c-9af3-262ae747932f"
    };

    await expect(usePosStore.getState().splitBill(input)).resolves.toEqual(response);
    expect(splitBillMock).toHaveBeenCalledWith({
      ...input,
      device_code: "INCLUDE",
      agent_id: "include-f8e4f9",
      print_mode: "windows_agent"
    });
  });

  it("does not request a reprint after printer resolution crosses a session boundary", async () => {
    const context = deferred<Awaited<ReturnType<typeof resolvePrinterDeviceIdentity>>>();
    resolvePrinterDeviceIdentityMock.mockReturnValueOnce(context.promise);

    const reprint = usePosStore.getState().reprintReceipt({
      order_uuid: "order-1",
      login_uuid_fk: "login-1"
    });
    resetSessionStores();
    context.resolve({
      ok: true,
      agent: {
        agent_id: "agent-1",
        agent_name: "Agent",
        device_code: "device-1",
        platform: "win32",
      },
    });

    await expect(reprint).rejects.toThrow("Session changed while the request was in progress");
    expect(reprintReceiptMock).not.toHaveBeenCalled();
  });

  it("rejects a reprint response returned to a previous session", async () => {
    const response = deferred<ReprintReceiptResponse>();
    resolvePrinterDeviceIdentityMock.mockResolvedValueOnce({
      ok: true,
      agent: {
        agent_id: "agent-1",
        agent_name: "Agent",
        device_code: "device-1",
        platform: "win32",
      },
    });
    reprintReceiptMock.mockReturnValueOnce(response.promise);

    const reprint = usePosStore.getState().reprintReceipt({
      order_uuid: "order-1",
      login_uuid_fk: "login-1"
    });
    await vi.waitFor(() => expect(reprintReceiptMock).toHaveBeenCalledOnce());
    resetSessionStores();
    response.resolve({ print_job: { print_job_uuid: "job-1" } });

    await expect(reprint).rejects.toThrow("Session changed while the request was in progress");
  });
});

describe("POS store menu and table browse state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchCateProductsMock.mockReset();
    getPosTablesMock.mockReset();
    usePosStore.setState({
      loadProductCategories: originalLoadProductCategories,
    });
    usePosStore.getState().reset();
  });

  it("initializes and resets menu and full-zone option state", () => {
    expect(usePosStore.getState()).toMatchObject({
      activeSort: ProductSortStatus.NORMAL,
      categories: [],
      loadingMenu: false,
      menuBySort: {
        [ProductSortStatus.NORMAL]: [],
        [ProductSortStatus.SET]: [],
        [ProductSortStatus.PROMOTION]: []
      },
      selectedCateUuid: "",
      submittedSearch: "",
      zoneOptions: []
    });

    usePosStore.setState({
      activeSort: ProductSortStatus.SET,
      categories: [category("category-1")],
      loadingMenu: true,
      selectedCateUuid: "category-1",
      submittedSearch: "tea",
      zoneOptions: [zone("zone-1")]
    });
    usePosStore.getState().reset();

    expect(usePosStore.getState()).toMatchObject({
      activeSort: ProductSortStatus.NORMAL,
      categories: [],
      loadingMenu: false,
      selectedCateUuid: "",
      submittedSearch: "",
      zoneOptions: []
    });
  });

  it("keeps full zone options while filtered loads replace only visible zones", async () => {
    const fullZones = [zone("zone-1"), zone("zone-2")];
    const filteredZones = [zone("zone-2")];
    getPosTablesMock
      .mockResolvedValueOnce({ status: "success", message: "ok", data: fullZones })
      .mockResolvedValueOnce({ status: "success", message: "ok", data: filteredZones });

    await usePosStore.getState().loadTables({
      branch_uuid_fk: "branch-1",
      lang: "en"
    });
    expect(usePosStore.getState()).toMatchObject({
      zones: fullZones,
      zoneOptions: fullZones
    });

    await usePosStore.getState().loadTables({
      branch_uuid_fk: "branch-1",
      zone_uuid: "zone-2",
      lang: "en"
    });
    expect(usePosStore.getState()).toMatchObject({
      zones: filteredZones,
      zoneOptions: fullZones
    });
  });

  it("updates full zone options only for unfiltered refreshes", async () => {
    const originalOptions = [zone("zone-original")];
    const filteredZones = [zone("zone-filtered")];
    const refreshedFullZones = [zone("zone-full")];
    usePosStore.setState({ zoneOptions: originalOptions });
    getPosTablesMock
      .mockResolvedValueOnce({ status: "success", message: "ok", data: filteredZones })
      .mockResolvedValueOnce({ status: "success", message: "ok", data: refreshedFullZones });

    await usePosStore.getState().refreshTables({
      branch_uuid_fk: "branch-1",
      zone_uuid: "zone-filtered",
      lang: "en"
    });
    expect(usePosStore.getState()).toMatchObject({
      zones: filteredZones,
      zoneOptions: originalOptions
    });

    await usePosStore.getState().refreshTables({
      branch_uuid_fk: "branch-1",
      lang: "en"
    });
    expect(usePosStore.getState()).toMatchObject({
      zones: refreshedFullZones,
      zoneOptions: refreshedFullZones
    });
  });

  it("patches the customer order flag in both zones and zoneOptions", () => {
    const table = { table_uuid: "table-1", table_name: "T1", table_status: 2, customer_order_state: false };
    const zoneWithTable = { ...zone("zone-1"), tables: [table] };
    usePosStore.setState({ zones: [zoneWithTable], zoneOptions: [zoneWithTable] });

    usePosStore.getState().updateTableCustomerOrderState("table-1", true);

    expect(usePosStore.getState().zones[0]?.tables[0]).toMatchObject({ customer_order_state: true });
    expect(usePosStore.getState().zoneOptions[0]?.tables[0]).toMatchObject({ customer_order_state: true });
  });

  it("drops full-zone results returned after a session reset", async () => {
    const response = deferred<Awaited<ReturnType<typeof getPosTables>>>();
    getPosTablesMock.mockReturnValueOnce(response.promise);

    const load = usePosStore.getState().loadTables({
      branch_uuid_fk: "branch-1",
      lang: "en"
    });
    resetSessionStores();
    response.resolve({
      status: "success",
      message: "ok",
      data: [zone("stale-zone")]
    });

    await expect(load).resolves.toEqual([zone("stale-zone")]);
    expect(usePosStore.getState()).toMatchObject({
      zones: [],
      zoneOptions: []
    });
  });

  it("loads catalog and sorted menu groups into store-owned state", async () => {
    const catalog = [category("category-1"), category("category-2")];
    const normalMenu = [category("normal")];
    const setMenu = [category("set")];
    const promotionMenu = [category("promotion")];
    fetchCateProductsMock
      .mockResolvedValueOnce({
        status: "success",
        message: "ok",
        categories: catalog,
        defaultCateUuid: "category-2"
      })
      .mockResolvedValueOnce({ status: "success", message: "ok", categories: normalMenu })
      .mockResolvedValueOnce({ status: "success", message: "ok", categories: setMenu })
      .mockResolvedValueOnce({ status: "success", message: "ok", categories: promotionMenu });

    await usePosStore.getState().loadMenu({
      branchUuid: "branch-1",
      language: "en",
      refreshCategories: true
    });

    expect(usePosStore.getState()).toMatchObject({
      activeSort: ProductSortStatus.NORMAL,
      categories: catalog,
      loadingMenu: false,
      menuBySort: {
        [ProductSortStatus.NORMAL]: normalMenu,
        [ProductSortStatus.SET]: setMenu,
        [ProductSortStatus.PROMOTION]: promotionMenu
      },
      selectedCateUuid: "category-2",
      submittedSearch: ""
    });
    expect(fetchCateProductsMock).toHaveBeenNthCalledWith(2, {
      branchUuidFk: "branch-1",
      cateUuid: "category-2",
      lang: "en",
      search: "",
      statusSortFk: ProductSortStatus.NORMAL
    });
  });

  it("delegates menu requests through the store action and clears loading on rejection", async () => {
    const loadError = new Error("menu failed");
    const loadProductCategories = vi.fn().mockRejectedValue(loadError);
    fetchCateProductsMock.mockRejectedValue(loadError);
    usePosStore.setState({ loadProductCategories });

    await expect(
      usePosStore.getState().loadMenu({
        branchUuid: "branch-1",
        language: "en",
        refreshCategories: true
      })
    ).rejects.toThrow("menu failed");

    expect(loadProductCategories).toHaveBeenCalledOnce();
    expect(usePosStore.getState()).toMatchObject({
      error: "menu failed",
      loadingMenu: false
    });
  });

  it("resets route-local menu fields without clearing table state", () => {
    const store = usePosStore.getState();

    const retainedZones = [zone("zone-1")];
    usePosStore.setState({
      activeSort: ProductSortStatus.SET,
      categories: [category("category-1")],
      loadingMenu: true,
      menuBySort: {
        [ProductSortStatus.NORMAL]: [category("normal")],
        [ProductSortStatus.SET]: [category("set")],
        [ProductSortStatus.PROMOTION]: [category("promotion")],
      },
      selectedCateUuid: "category-1",
      submittedSearch: "tea",
      tableName: "Table 1",
      tableUuid: "table-1",
      zones: retainedZones,
    });

    store.resetMenu();

    expect(usePosStore.getState()).toMatchObject({
      activeSort: ProductSortStatus.NORMAL,
      categories: [],
      loadingMenu: false,
      menuBySort: {
        [ProductSortStatus.NORMAL]: [],
        [ProductSortStatus.SET]: [],
        [ProductSortStatus.PROMOTION]: [],
      },
      selectedCateUuid: "",
      submittedSearch: "",
      tableName: "Table 1",
      tableUuid: "table-1",
      zones: retainedZones,
    });
  });

  it("does not repopulate menu state when a route-local request finishes after reset", async () => {
    const store = usePosStore.getState();

    const catalogResponse =
      deferred<Awaited<ReturnType<typeof fetchCateProducts>>>();
    fetchCateProductsMock
      .mockReturnValueOnce(catalogResponse.promise)
      .mockResolvedValue({
        status: "success",
        message: "ok",
        categories: [category("stale-menu")],
      });

    const load = store.loadMenu({
      branchUuid: "branch-1",
      language: "en",
      refreshCategories: true,
    });
    await vi.waitFor(() =>
      expect(fetchCateProductsMock).toHaveBeenCalledOnce(),
    );

    store.resetMenu();
    catalogResponse.resolve({
      status: "success",
      message: "ok",
      categories: [category("category-1")],
      defaultCateUuid: "category-1",
    });
    await load;

    expect(usePosStore.getState()).toMatchObject({
      activeSort: ProductSortStatus.NORMAL,
      categories: [],
      loadingMenu: false,
      menuBySort: {
        [ProductSortStatus.NORMAL]: [],
        [ProductSortStatus.SET]: [],
        [ProductSortStatus.PROMOTION]: [],
      },
      selectedCateUuid: "",
      submittedSearch: "",
    });
  });
});

describe("POS store cart requests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePosStore.getState().reset();
  });

  it("keeps the result of the most recently issued loadCart call when an older request resolves later", async () => {
    const store = usePosStore.getState();

    const staleResponse = deferred<FetchCartResponse>();
    fetchCartMock.mockReturnValueOnce(staleResponse.promise).mockResolvedValueOnce({
      status: "success",
      message: "ok",
      orders: [{ order_uuid: "order-fresh" }],
    });

    const staleLoad = store.loadCart({ table_uuid: "table-1" });
    await vi.waitFor(() => expect(fetchCartMock).toHaveBeenCalledOnce());

    const freshLoad = store.loadCart({ table_uuid: "table-1" });
    await freshLoad;

    // request เก่าเพิ่งมาถึงตอนนี้ (mock ตอบทีหลังของจริง) — ต้องไม่ทับผลของ request ใหม่กว่า
    staleResponse.resolve({
      status: "success",
      message: "ok",
      orders: [{ order_uuid: "order-stale" }],
    });
    await staleLoad;

    expect(usePosStore.getState().cart).toEqual([{ order_uuid: "order-fresh" }]);
  });
});
