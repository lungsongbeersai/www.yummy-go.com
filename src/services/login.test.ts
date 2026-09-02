import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { backendNetworkManager } from "@/stores/network-store";

const apiMocks = vi.hoisted(() => ({
  post: vi.fn()
}));

vi.mock("@/lib/api", () => ({
  publicApiClient: { post: apiMocks.post },
  ServiceError: class ServiceError extends Error {
    statusCode: number;

    constructor(message: string, statusCode = 500) {
      super(message);
      this.name = "ServiceError";
      this.statusCode = statusCode;
    }
  }
}));

import { checkLogin, restoreOnlineLogin } from "@/services/login";

function loginResponse(overrides: Record<string, unknown> = {}) {
  return {
    status: "success",
    message: "Login success",
    token: "token-1",
    login_uuid: "login-1",
    login_email: "cashier@example.com",
    login_status: 1,
    login_profile: "profile.png",
    branch_uuid: "branch-1",
    branch_name: "Branch 1",
    branch_tel: "020 5555 5555",
    branch_address: "Vientiane",
    store_uuid_fk: "store-1",
    store_logo: "store.png",
    ...overrides
  };
}

describe("login service", () => {
  beforeEach(() => {
    apiMocks.post.mockReset();
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    backendNetworkManager.resetChecking("login_test");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("maps store table status from the login response", async () => {
    apiMocks.post.mockResolvedValue({ status: 200, data: loginResponse({ store_table_status: 2 }) });

    await expect(checkLogin("cashier@example.com", "password")).resolves.toMatchObject({
      user: { store_table_status: 2 }
    });
  });

  it("defaults a legacy login response to a store with tables", async () => {
    apiMocks.post.mockResolvedValue({ status: 200, data: loginResponse() });

    await expect(checkLogin("cashier@example.com", "password")).resolves.toMatchObject({
      user: { store_table_status: 1 }
    });
  });

  it("uses the verified Local Agent credential when the device is offline", async () => {
    backendNetworkManager.reportTransportFailure("network_failure", { confirmed: true });
    backendNetworkManager.reportTransportFailure("network_failure", { confirmed: true });
    backendNetworkManager.reportTransportFailure("network_failure", { confirmed: true });
    const localPost = vi.spyOn(axios, "post").mockResolvedValue({
      data: { ok: true, data: { ...loginResponse(), offline: true } }
    });

    await expect(checkLogin("cashier@example.com", "password")).resolves.toMatchObject({
      source: "offline",
      token: "token-1",
      user: { uuid: "login-1" }
    });
    expect(apiMocks.post).not.toHaveBeenCalled();
    expect(localPost).toHaveBeenCalledWith(
      expect.stringContaining("/local/auth/login"),
      { login_email: "cashier@example.com", login_password: "password" },
      { timeout: 5000 }
    );
  });

  it("logs in through the Local Agent on the first try when the browser reports no network", async () => {
    // Cold start: no probe has run yet, so the NetworkManager is still CHECKING.
    vi.stubGlobal("navigator", { onLine: false });
    const localPost = vi.spyOn(axios, "post").mockResolvedValue({
      data: { ok: true, data: { ...loginResponse(), offline: true } }
    });

    await expect(checkLogin("cashier@example.com", "password")).resolves.toMatchObject({
      source: "offline",
    });
    expect(apiMocks.post).not.toHaveBeenCalled();
    expect(localPost).toHaveBeenCalledWith(
      expect.stringContaining("/local/auth/login"),
      { login_email: "cashier@example.com", login_password: "password" },
      { timeout: 5000 }
    );
  });

  it("does not touch the Local Agent when the browser reports it is online", async () => {
    vi.stubGlobal("navigator", { onLine: true });
    apiMocks.post.mockResolvedValue({ status: 200, data: loginResponse() });
    const localPost = vi.spyOn(axios, "post");

    await expect(checkLogin("cashier@example.com", "password")).resolves.toMatchObject({
      source: "online",
    });
    expect(localPost).not.toHaveBeenCalled();
  });

  it("does not fall back to Local Agent for an HTTP 503 response", async () => {
    apiMocks.post.mockRejectedValue({
      isAxiosError: true,
      message: "Service unavailable",
      response: { status: 503 },
    });
    const localPost = vi.spyOn(axios, "post").mockResolvedValue({
      data: { ok: true, data: { ...loginResponse(), offline: true } }
    });

    await expect(checkLogin("cashier@example.com", "password")).rejects.toMatchObject({
      response: { status: 503 },
    });
    expect(localPost).not.toHaveBeenCalled();
    expect(backendNetworkManager.isOffline()).toBe(false);
  });

  it("falls back only when a response-less failure confirms the Offline threshold", async () => {
    backendNetworkManager.reportTransportFailure("network_failure", { confirmed: true });
    backendNetworkManager.reportTransportFailure("network_failure", { confirmed: true });
    apiMocks.post.mockRejectedValue(new axios.AxiosError("Network Error", "ERR_NETWORK"));
    vi.spyOn(axios, "post").mockResolvedValue({
      data: { ok: true, data: { ...loginResponse(), offline: true } }
    });

    await expect(checkLogin("cashier@example.com", "password")).resolves.toMatchObject({
      source: "offline",
      token: "token-1",
    });
  });

  it("restores a Backend JWT through the authenticated Local Agent session", async () => {
    const localPost = vi.spyOn(axios, "post").mockResolvedValue({
      data: { ok: true, data: loginResponse({ token: "online-token" }) }
    });

    await expect(restoreOnlineLogin("local.session-token")).resolves.toMatchObject({
      source: "online",
      token: "online-token",
      user: { uuid: "login-1" },
    });
    expect(localPost).toHaveBeenCalledWith(
      expect.stringContaining("/local/auth/online"),
      { local_token: "local.session-token" },
      { timeout: 10000 },
    );
  });
});
