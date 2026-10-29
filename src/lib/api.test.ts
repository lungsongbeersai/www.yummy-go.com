import axios, { type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient, apiRequest, publicApiClient, publicApiRequest } from "@/lib/api";
import { useAuthStore, type AuthUser } from "@/stores/auth-store";
import { useProductStore } from "@/stores/product-store";

const user: AuthUser = {
  uuid: "cashier-1",
  email: "cashier@example.test",
  status: 1,
  profile: "",
  branch_uuid: "branch-1",
  branch_name: "Branch",
  branch_tel: "",
  branch_address: "",
  store_uuid: "store-1",
  store_uuid_fk: "store-1",
  store_name: "Store",
  store_logo: "",
  store_table_status: 1,
};

const authenticatedAdapter = apiClient.defaults.adapter;
const unauthenticatedAdapter = publicApiClient.defaults.adapter;
const expiryPayload = { status: "error", auth: false, code: "BRANCH_CONTRACT_EXPIRED", message: "Renew your branch contract",
  branch_uuid: "70000000-0000-4000-8000-000000000001", contract_end_on: "2026-10-01", contract_days_remaining: -28 };

function httpError(config: InternalAxiosRequestConfig, data: unknown, status = 401) {
  return new axios.AxiosError("Request rejected", "ERR_BAD_REQUEST", config, undefined,
    { status, statusText: "Rejected", data, headers: {}, config });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

describe("online-only API transport", () => {
  beforeEach(() => {
    useAuthStore.getState().login("online-token", user);
  });

  afterEach(() => {
    useAuthStore.getState().logout();
    apiClient.defaults.adapter = authenticatedAdapter;
    publicApiClient.defaults.adapter = unauthenticatedAdapter;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("always sends a POS write directly to Backend", async () => {
    const data = { items: [{ prod_detail_uuid_fk: "detail-1", order_it_qty: 1 }] };
    const post = vi.spyOn(apiClient, "post").mockResolvedValue({
      status: 200,
      data: { status: "success", order_uuid: "order-online" },
    });

    await expect(apiRequest("post", "/api/v1/posAll/create_order", { data }))
      .resolves.toMatchObject({ order_uuid: "order-online" });
    expect(post).toHaveBeenCalledWith(
      "/api/v1/posAll/create_order",
      data,
      { headers: undefined },
    );
    expect(data).not.toHaveProperty("sync_event_uuid");
  });

  it.each(["get", "post", "put", "patch", "delete"] as const)(
    "forwards request timeout and cancellation for %s without changing client defaults",
    async (method) => {
      const request = vi.spyOn(apiClient, method).mockResolvedValue({
        status: 200,
        data: { status: "success" },
      });
      const controller = new AbortController();
      await apiRequest(method, "/api/v1/printer/jobs/pending", {
        timeout: 750,
        signal: controller.signal,
      });

      const configIndex = method === "get" || method === "delete" ? 1 : 2;
      expect(request.mock.calls[0][configIndex]).toEqual(expect.objectContaining({
        timeout: 750,
        signal: controller.signal,
      }));
      expect(apiClient.defaults.timeout).toBe(30000);
    },
  );

  it("supports a bounded public request without changing its client defaults", async () => {
    const get = vi.spyOn(publicApiClient, "get").mockResolvedValue({
      status: 200,
      data: { status: "success" },
    });
    const controller = new AbortController();
    await publicApiRequest("get", "/status", { timeout: 500, signal: controller.signal });

    expect(get).toHaveBeenCalledWith("/status", expect.objectContaining({
      timeout: 500,
      signal: controller.signal,
    }));
    expect(publicApiClient.defaults.timeout).toBe(30000);
  });

  it("never turns a transport failure into a queued local success", async () => {
    vi.spyOn(apiClient, "post").mockRejectedValue(
      new axios.AxiosError("Network Error", "ERR_NETWORK"),
    );

    await expect(apiRequest("post", "/api/v1/posAll/payment", { data: { order_uuid: "order-1" } }))
      .rejects.toMatchObject({ name: "ServiceError", statusCode: 0 });
  });

  it("keeps the complete business-error payload", async () => {
    vi.spyOn(apiClient, "post").mockResolvedValue({
      status: 200,
      data: { status: "error", message: "Stock changed", code: 409, current_qty: 0 },
    });

    await expect(apiRequest("post", "/api/v1/posAll/create_order"))
      .rejects.toEqual(expect.objectContaining({
        message: "Stock changed",
        statusCode: 409,
        payload: expect.objectContaining({ current_qty: 0 }),
      }));
  });

  it("expires the current authenticated session and routes to renewal after the backend expiry rejection", async () => {
    const assign = vi.fn();
    vi.stubGlobal("window", { location: { assign } });
    apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => { throw httpError(config, expiryPayload); };

    await expect(apiRequest("post", "/api/v1/access-data")).rejects.toMatchObject({ statusCode: 401, payload: expiryPayload });
    expect(useAuthStore.getState()).toMatchObject({ token: null, user: null, isLoggedIn: false,
      contractExpiry: { branchUuid: expiryPayload.branch_uuid, endOn: expiryPayload.contract_end_on, daysRemaining: -28 } });
    expect(assign).toHaveBeenCalledExactlyOnceWith("/subscription-expired");
  });

  it("keeps the ordinary authentication redirect for a non-contract HTTP401", async () => {
    const assign = vi.fn();
    vi.stubGlobal("window", { location: { assign } });
    apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
      throw httpError(config, { code: "ACCOUNT_INACTIVE", message: "Account inactive" });
    };
    await expect(apiRequest("get", "/api/v1/posAll/fetch_table")).rejects.toMatchObject({ statusCode: 401 });
    expect(useAuthStore.getState()).toMatchObject({ token: null, user: null, isLoggedIn: false, contractExpiry: null });
    expect(assign).toHaveBeenCalledExactlyOnceWith("/login");
  });

  it("does not expire a newer login when an earlier token's request fails late", async () => {
    const assign = vi.fn();
    vi.stubGlobal("window", { location: { assign } });
    const received = deferred<InternalAxiosRequestConfig>();
    const pending = deferred<AxiosResponse<unknown>>();
    apiClient.defaults.adapter = (config: InternalAxiosRequestConfig) => { received.resolve(config); return pending.promise; };
    const request = apiRequest("get", "/api/v1/posAll/fetch_table");
    const rejected = expect(request).rejects.toMatchObject({ statusCode: 401 });
    const config = await received.promise;
    expect(config.headers.get("x-access-token")).toBe("online-token");
    useAuthStore.getState().login("new-token", { ...user, uuid: "new-user" });
    pending.reject(httpError(config, expiryPayload));
    await rejected;
    expect(useAuthStore.getState()).toMatchObject({ token: "new-token", isLoggedIn: true, contractExpiry: null });
    expect(assign).not.toHaveBeenCalled();
  });

  it.each([
    ["contract expiry", expiryPayload],
    ["ordinary unauthorized", { code: "ACCOUNT_INACTIVE", message: "Account inactive" }],
  ] as const)("preserves a new session reusing the same JWT when an old %s response arrives", async (_kind, payload) => {
    const assign = vi.fn();
    vi.stubGlobal("window", { location: { assign } });
    useAuthStore.getState().login("same-token", user);
    const received = deferred<InternalAxiosRequestConfig>();
    const pending = deferred<AxiosResponse<unknown>>();
    apiClient.defaults.adapter = (config: InternalAxiosRequestConfig) => { received.resolve(config); return pending.promise; };
    const request = apiRequest("get", "/api/v1/posAll/fetch_table");
    const rejected = expect(request).rejects.toMatchObject({ statusCode: 401 });
    const config = await received.promise;
    expect(config.headers.get("x-access-token")).toBe("same-token");

    useAuthStore.getState().logout();
    useAuthStore.getState().login("same-token", { ...user, uuid: "new-user" });
    useProductStore.setState({ search: "new session products" });
    pending.reject(httpError(config, payload));
    await rejected;

    expect(useAuthStore.getState()).toMatchObject({ token: "same-token", isLoggedIn: true, contractExpiry: null,
      user: { uuid: "new-user" } });
    expect(useProductStore.getState().search).toBe("new session products");
    expect(assign).not.toHaveBeenCalled();
  });

  it("does not revoke an active session for a public login rejection", async () => {
    const assign = vi.fn();
    vi.stubGlobal("window", { location: { assign } });
    publicApiClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => { throw httpError(config, expiryPayload); };
    await expect(publicApiRequest("post", "/api/v1/login/check_login")).rejects.toMatchObject({ statusCode: 401, payload: expiryPayload });
    expect(useAuthStore.getState()).toMatchObject({ token: "online-token", isLoggedIn: true, contractExpiry: null });
    expect(assign).not.toHaveBeenCalled();
  });

  it("does not mark an authorization failure or transport failure as contract expiry", async () => {
    const assign = vi.fn();
    vi.stubGlobal("window", { location: { assign } });
    apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => { throw httpError(config, expiryPayload, 403); };
    await expect(apiRequest("get", "/api/v1/posAll/fetch_table")).rejects.toMatchObject({ statusCode: 403 });
    apiClient.defaults.adapter = async () => { throw new axios.AxiosError("Network Error", "ERR_NETWORK"); };
    await expect(apiRequest("get", "/api/v1/posAll/fetch_table")).rejects.toMatchObject({ statusCode: 0 });
    expect(useAuthStore.getState()).toMatchObject({ token: "online-token", isLoggedIn: true, contractExpiry: null });
    expect(assign).not.toHaveBeenCalled();
  });
});
