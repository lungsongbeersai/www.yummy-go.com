import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeLoginEmail } from "@/lib/login-email";

const apiMocks = vi.hoisted(() => ({ post: vi.fn() }));

vi.mock("@/lib/api", () => ({
  publicApiClient: { post: apiMocks.post },
  ServiceError: class ServiceError extends Error {
    constructor(message: string, public statusCode = 500) {
      super(message);
      this.name = "ServiceError";
    }
  },
}));

import { checkLogin } from "@/services/login";

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
    ...overrides,
  };
}

describe("online-only login service", () => {
  beforeEach(() => {
    apiMocks.post.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("maps the online response and store table status", async () => {
    apiMocks.post.mockResolvedValue({
      status: 200,
      data: loginResponse({
        store_table_status: 2,
        zone_uuid_fk: "zone-1",
        zone_uuid_fks: ["zone-1", "zone-2"],
        zones: [
          { zone_uuid: "zone-1", zone_name: "VIP" },
          { zone_uuid: "zone-2", zone_name: "KTV" }
        ],
        zone_name: "VIP"
      })
    });
    await expect(checkLogin("cashier@example.com", "password")).resolves.toMatchObject({
      source: "online",
      user: {
        store_table_status: 2,
        zone_uuid: "zone-1",
        zone_uuids: ["zone-1", "zone-2"],
        zone_name: "VIP"
      },
    });
  });

  it("normalizes hidden characters, full-width symbols, and an accidental dot before @", async () => {
    expect(normalizeLoginEmail(" \u200b55174733.＠gmail。com\u00a0")).toBe("55174733@gmail.com");

    apiMocks.post.mockResolvedValue({ status: 200, data: loginResponse() });
    await checkLogin(" \u200b55174733.＠gmail。com\u00a0", "0000");

    expect(apiMocks.post).toHaveBeenCalledWith(
      "/api/v1/login/check_login",
      { login_email: "55174733@gmail.com", login_password: "0000" },
      { timeout: 8000 }
    );
  });

  it("defaults a legacy response to a store with tables", async () => {
    apiMocks.post.mockResolvedValue({ status: 200, data: loginResponse() });
    await expect(checkLogin("cashier@example.com", "password")).resolves.toMatchObject({
      source: "online",
      user: { store_table_status: 1 },
    });
  });

  it("still calls Backend when the browser reports no network", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    apiMocks.post.mockRejectedValue(new axios.AxiosError("Network Error", "ERR_NETWORK"));

    await expect(checkLogin("cashier@example.com", "password")).rejects.toMatchObject({
      code: "ERR_NETWORK",
    });
    expect(apiMocks.post).toHaveBeenCalledOnce();
  });
});
