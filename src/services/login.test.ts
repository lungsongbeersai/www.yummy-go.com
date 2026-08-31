import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("maps store table status from the login response", async () => {
    apiMocks.post.mockResolvedValue({ data: loginResponse({ store_table_status: 2 }) });

    await expect(checkLogin("cashier@example.com", "password")).resolves.toMatchObject({
      user: { store_table_status: 2 }
    });
  });

  it("defaults a legacy login response to a store with tables", async () => {
    apiMocks.post.mockResolvedValue({ data: loginResponse() });

    await expect(checkLogin("cashier@example.com", "password")).resolves.toMatchObject({
      user: { store_table_status: 1 }
    });
  });

  it("uses the verified Local Agent credential when the device is offline", async () => {
    vi.stubGlobal("navigator", { onLine: false });
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

  it("falls back to Local Agent when the Backend gateway is unavailable", async () => {
    vi.stubGlobal("navigator", { onLine: true });
    apiMocks.post.mockRejectedValue({
      isAxiosError: true,
      message: "Service unavailable",
      response: { status: 503 },
    });
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
