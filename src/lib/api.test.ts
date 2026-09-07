import axios from "axios";
import { Capacitor } from "@capacitor/core";
import * as offlineSync from "@/services/offline-sync";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient, apiRequest } from "@/lib/api";
import { BACKEND_NETWORK_STATE } from "@/lib/network-state";
import { requestLocalFallback, resetLocalSyncConfiguration, runLocalSyncNow, shouldKeepLocalOrderOwnership } from "@/services/offline-sync";
import { getBrowserSyncQueueSummary } from "@/services/offline-db";
import { useAuthStore, type AuthUser } from "@/stores/auth-store";
import { backendNetworkManager } from "@/stores/network-store";

vi.mock("@/services/offline-db", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/services/offline-db")>(),
  getBrowserSyncQueueSummary: vi.fn(),
}));

const user: AuthUser = {
  uuid: "login-reconnect", email: "cashier@example.test", status: 1, profile: "",
  store_uuid: "store-reconnect", store_uuid_fk: "store-reconnect", store_name: "Test",
  store_logo: "", store_table_status: 1, branch_uuid: "branch-reconnect",
  branch_name: "Test", branch_tel: "", branch_address: "",
};
const emptyQueue = { staged: 0, pending: 0, processing: 0, failed: 0, blocked: 0, synced: 0 };
const cartPath = "/api/v1/posAll/fetch_cart";

function status(pending = 0, blocked = 0, branch = user.branch_uuid) {
  return { data: { ok: true, data: {
    configured: true, bootstrap_complete: true, connection_state: "ONLINE",
    store_uuid: user.store_uuid, branch_uuid: branch, actor_login_uuid: user.uuid,
    pending: { pending, processing: 0, failed: 0, blocked },
  } } };
}

describe("POS ownership across desktop reconnect", () => {
  beforeEach(() => {
    const storage = new Map<string, string>();
    vi.stubGlobal("navigator", { onLine: true });
    vi.stubGlobal("window", {
      location: { origin: "https://pos.example.test" },
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
      },
    });
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.mocked(getBrowserSyncQueueSummary).mockResolvedValue({ ...emptyQueue });
    resetLocalSyncConfiguration();
    useAuthStore.getState().login("online-token", user);
    backendNetworkManager.reportReachable(200);
    vi.spyOn(axios, "post").mockResolvedValue({ data: { ok: true, data: { status: "success", source: "local" } } });
  });

  afterEach(() => {
    useAuthStore.getState().logout();
    resetLocalSyncConfiguration();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("keeps the cart local while events remain, then hands it back after acknowledgement", async () => {
    const get = vi.spyOn(axios, "get").mockResolvedValue(status(2));
    const online = vi.spyOn(apiClient, "get").mockResolvedValue({ status: 200, data: { status: "success", source: "online" } });
    await expect(apiRequest("get", cartPath)).resolves.toMatchObject({ source: "local" });
    expect(online).not.toHaveBeenCalled();
    expect(backendNetworkManager.getSnapshot().state).toBe(BACKEND_NETWORK_STATE.ONLINE);
    expect(useAuthStore.getState().offlineSession).toBe(false);
    expect(axios.post).toHaveBeenCalledWith(expect.stringContaining("/local/api"),
      expect.objectContaining({ scope: { storeUuid: user.store_uuid, branchUuid: user.branch_uuid, actorLoginUuid: user.uuid } }),
      expect.anything());

    get.mockResolvedValue(status());
    await runLocalSyncNow();
    await expect(apiRequest("get", cartPath)).resolves.toMatchObject({ source: "online" });
    expect(online).toHaveBeenCalledOnce();
  });

  it("does not send a payment ahead of the locally owned bill", async () => {
    vi.spyOn(axios, "get").mockResolvedValue(status(1));
    const online = vi.spyOn(apiClient, "post");
    await apiRequest("post", "/api/v1/posAll/payment", { data: { order_uuid: "order-1", amount: 40000 } });
    expect(online).not.toHaveBeenCalled();
    expect(axios.post).toHaveBeenCalledWith(expect.stringContaining("/local/api"),
      expect.objectContaining({ data: expect.objectContaining({ local_agent_print: true, order_uuid: "order-1" }) }),
      expect.anything());
  });

  it("remembers local ownership over reload when the Agent becomes unavailable", async () => {
    const get = vi.spyOn(axios, "get").mockResolvedValue(status(1));
    const online = vi.spyOn(apiClient, "get");
    await apiRequest("get", cartPath);
    resetLocalSyncConfiguration();
    get.mockRejectedValue(new Error("Agent unavailable"));
    vi.mocked(axios.post).mockRejectedValue(new Error("Agent unavailable"));
    await expect(apiRequest("get", cartPath)).rejects.toMatchObject({ statusCode: 503 });
    expect(online).not.toHaveBeenCalled();
  });

  it("retains local ownership for a blocked event requiring review", async () => {
    vi.spyOn(axios, "get").mockResolvedValue(status(0, 1));
    const online = vi.spyOn(apiClient, "get");
    await expect(apiRequest("get", cartPath)).resolves.toMatchObject({ source: "local" });
    expect(online).not.toHaveBeenCalled();
  });

  it("keeps staged browser writes local even before the Agent acknowledges them", async () => {
    vi.spyOn(axios, "get").mockResolvedValue(status());
    vi.mocked(getBrowserSyncQueueSummary).mockResolvedValue({ ...emptyQueue, staged: 1 });
    const online = vi.spyOn(apiClient, "get");
    await expect(apiRequest("get", cartPath)).resolves.toMatchObject({ source: "local" });
    expect(online).not.toHaveBeenCalled();
  });

  it("does not let another branch's queue take ownership of this branch", async () => {
    vi.spyOn(axios, "get").mockResolvedValue(status(8, 0, "other-branch"));
    vi.spyOn(apiClient, "get").mockResolvedValue({ status: 200, data: { status: "success", source: "online" } });
    await expect(apiRequest("get", cartPath)).resolves.toMatchObject({ source: "online" });
  });

  it("cannot hand off during a local write, without holding another branch's requests", async () => {
    const localScope = { storeUuid: user.store_uuid || "", branchUuid: user.branch_uuid, actorLoginUuid: user.uuid };
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    vi.mocked(axios.post).mockImplementation(async () => {
      await gate;
      return { data: { ok: true, data: { status: "success" } } };
    });
    const get = vi.spyOn(axios, "get").mockResolvedValue(status());
    const write = requestLocalFallback("post", "/api/v1/posAll/payment", { data: { order_uuid: "order-1" } },
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", localScope);
    await expect(shouldKeepLocalOrderOwnership(localScope)).resolves.toBe(true);
    resetLocalSyncConfiguration();
    get.mockResolvedValue(status(0, 0, "other-branch"));
    await expect(shouldKeepLocalOrderOwnership({ ...localScope, branchUuid: "other-branch" })).resolves.toBe(false);
    release();
    await write;
  });

  it("does not turn an Agent outage or a backend business error into an offline mutation", async () => {
    vi.spyOn(axios, "get").mockRejectedValue(new Error("No Agent"));
    vi.spyOn(apiClient, "post").mockRejectedValue({ isAxiosError: true, response: { status: 409, data: { message: "Bill already paid" } } });
    await expect(apiRequest("post", "/api/v1/posAll/payment", { data: { order_uuid: "order-1" } }))
      .rejects.toThrow("Bill already paid");
    expect(vi.mocked(axios.post).mock.calls.some(([url]) => String(url).endsWith("/local/api"))).toBe(false);
    expect(backendNetworkManager.getSnapshot().state).toBe(BACKEND_NETWORK_STATE.ONLINE);
  });
});

describe.each(["android", "ios"])("Capacitor %s uses Dexie, never localhost Agent", (platform) => {
  beforeEach(() => {
    const storage = new Map<string, string>();
    vi.stubGlobal("navigator", { onLine: true, userAgent: "" });
    vi.stubGlobal("window", { location: { origin: "https://pos.example.test" }, localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    } });
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
    vi.spyOn(Capacitor, "getPlatform").mockReturnValue(platform);
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.mocked(getBrowserSyncQueueSummary).mockResolvedValue({ ...emptyQueue });
    useAuthStore.getState().login("native-token", user);
    backendNetworkManager.reportReachable(200);
    vi.spyOn(axios, "get");
    vi.spyOn(axios, "post");
  });
  afterEach(() => { useAuthStore.getState().logout(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it("serves a confirmed-offline read immediately even when native navigator says online", async () => {
    backendNetworkManager.reportTransportFailure("test", { confirmed: true, failureThreshold: 1 });
    const online = vi.spyOn(apiClient, "get");
    vi.spyOn(offlineSync, "readBrowserOfflineCache").mockResolvedValue({ status: "success", source: "dexie" });
    await expect(apiRequest("get", cartPath)).resolves.toMatchObject({ source: "dexie" });
    expect(online).not.toHaveBeenCalled();
    expect(axios.get).not.toHaveBeenCalled();
    expect(axios.post).not.toHaveBeenCalled();
  });

  it("holds reads in Dexie during reconnect and releases them only after all acknowledgements", async () => {
    const online = vi.spyOn(apiClient, "get").mockResolvedValue({ status: 200, data: { status: "success", source: "online" } });
    vi.spyOn(offlineSync, "readBrowserOfflineCache").mockResolvedValue({ status: "success", source: "dexie" });
    vi.mocked(getBrowserSyncQueueSummary).mockResolvedValue({ ...emptyQueue, pending: 1 });
    await expect(apiRequest("get", cartPath)).resolves.toMatchObject({ source: "dexie" });
    expect(online).not.toHaveBeenCalled();
    expect(backendNetworkManager.getSnapshot().state).toBe(BACKEND_NETWORK_STATE.ONLINE);
    vi.mocked(getBrowserSyncQueueSummary).mockResolvedValue({ ...emptyQueue });
    await expect(apiRequest("get", cartPath)).resolves.toMatchObject({ source: "online" });
    expect(axios.get).not.toHaveBeenCalled();
    expect(axios.post).not.toHaveBeenCalled();
  });

  it("never falls through to Backend when the local bill is blocked or its cache is missing", async () => {
    const online = vi.spyOn(apiClient, "get");
    vi.mocked(getBrowserSyncQueueSummary).mockResolvedValue({ ...emptyQueue, blocked: 1 });
    vi.spyOn(offlineSync, "readBrowserOfflineCache").mockResolvedValue(null);
    await expect(apiRequest("get", cartPath)).rejects.toMatchObject({ statusCode: 503 });
    expect(online).not.toHaveBeenCalled();
  });

  it("does not send an unsupported split ahead of a pending local create", async () => {
    vi.mocked(getBrowserSyncQueueSummary).mockResolvedValue({ ...emptyQueue, staged: 1 });
    const online = vi.spyOn(apiClient, "post");
    await expect(apiRequest("post", "/api/v1/posAll/split_bill", { data: { order_uuid: "order-1" } }))
      .rejects.toMatchObject({ statusCode: 503 });
    expect(online).not.toHaveBeenCalled();
  });

  it("does not manufacture an offline write after an HTTP business rejection", async () => {
    vi.spyOn(apiClient, "post").mockRejectedValue({ isAxiosError: true, response: { status: 409, data: { message: "Bill already paid" } } });
    const local = vi.spyOn(offlineSync, "requestBrowserWriteFallback");
    await expect(apiRequest("post", "/api/v1/posAll/payment", { data: { order_uuid: "order-1" } })).rejects.toThrow("Bill already paid");
    expect(local).not.toHaveBeenCalled();
    expect(axios.post).not.toHaveBeenCalled();
  });

  it("never sends native login credentials to the Agent cache", async () => {
    await expect(offlineSync.prepareOfflineSession({
      token: "native-token", actorLoginUuid: user.uuid, storeUuid: user.store_uuid || "", branchUuid: user.branch_uuid,
      loginEmail: "cashier@example.test", loginPassword: "test-only",
      loginResponse: { loginEmail: "cashier@example.test", loginStatus: 1, loginProfile: "", branchName: "Test", branchTel: "", branchAddress: "", storeName: "Test", storeLogo: "", storeTableStatus: 1 },
    })).resolves.toBe(false);
    expect(axios.post).not.toHaveBeenCalled();
  });
});
