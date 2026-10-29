import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeLoginEmail } from "@/lib/login-email";

const apiMocks = vi.hoisted(() => ({ post: vi.fn(), request: vi.fn() }));

vi.mock("@/lib/api", () => ({
  apiRequest: apiMocks.request,
  publicApiClient: { post: apiMocks.post },
  ServiceError: class ServiceError extends Error {
    constructor(message: string, public statusCode = 500, public originalError?: unknown, public payload?: unknown) {
      super(message);
      this.name = "ServiceError";
    }
  },
}));

import { checkLogin, validateLoginSession } from "@/services/login";

function loginResponse(overrides: Record<string, unknown> = {}) {
  return {
    status: "success",
    message: "Login success",
    token: "token-1",
    login_uuid: "login-1",
    login_email: "cashier@example.com",
    login_name: "Noy",
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
    apiMocks.request.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("maps the online response and store table status", async () => {
    apiMocks.post.mockResolvedValue({
      status: 200,
      data: loginResponse({
        store_status: 1,
        contract_end_on: "2027-01-12",
        contract_days_remaining: 77,
        lak_rounding_version: 2,
        store_table_status: 2,
        deportment_uuid_fk: "deportment-1",
        deportment_name: "Service",
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
        store_status: 1,
        contract_end_on: "2027-01-12",
        contract_days_remaining: 77,
        name: "Noy",
        deportment_uuid: "deportment-1",
        deportment_name: "Service",
        store_table_status: 2,
        lak_rounding_version: 2,
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
      user: { store_status: 2, store_table_status: 1, lak_rounding_version: 1 },
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

  it.each([1, 2, 3])("retains the signed-in branch contract for store classification %i and ordinary employee roles", async (store_status) => {
    apiMocks.post.mockResolvedValue({ status: 200, data: loginResponse({
      store_status, login_status: 4, contract_end_on: "2027-01-12", contract_days_remaining: 77,
    }) });
    const result = await checkLogin("cashier@example.com", "password");
    expect(result.user).toMatchObject({ status: 4, store_status, contract_end_on: "2027-01-12", contract_days_remaining: 77 });
  });

  it("keeps an undated contract unknown rather than manufacturing an expiry", async () => {
    apiMocks.post.mockResolvedValue({ status: 200, data: loginResponse({ store_status: 2 }) });
    const result = await checkLogin("cashier@example.com", "password");
    expect(result.user).toMatchObject({ contract_end_on: null, contract_days_remaining: null });
  });

  it("preserves authenticated expiry metadata when the login endpoint rejects with HTTP401", async () => {
    const payload = { status: "error", auth: false, code: "BRANCH_CONTRACT_EXPIRED", message: "Renew your branch contract",
      branch_uuid: "70000000-0000-4000-8000-000000000001", contract_end_on: "2026-10-01", contract_days_remaining: -28 };
    const original = new axios.AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, undefined,
      { status: 401, statusText: "Unauthorized", data: payload, headers: {}, config: { headers: new axios.AxiosHeaders() } });
    apiMocks.post.mockRejectedValue(original);

    await expect(checkLogin("cashier@example.com", "password")).rejects.toMatchObject({
      name: "ServiceError", statusCode: 401, message: payload.message, payload, originalError: original,
    });
  });

  it("keeps a legacy business-error envelope intact without creating a login session", async () => {
    const payload = { status: "error", code: "BRANCH_CONTRACT_EXPIRED", message: "Renew your branch contract" };
    apiMocks.post.mockResolvedValue({ status: 200, data: payload });
    await expect(checkLogin("cashier@example.com", "password")).rejects.toMatchObject({
      name: "ServiceError", statusCode: 401, payload,
    });
  });

  it("does not classify ordinary invalid credentials as an expired contract", async () => {
    const payload = { status: "error", message: "Invalid email or password" };
    apiMocks.post.mockRejectedValue(new axios.AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, undefined,
      { status: 401, statusText: "Unauthorized", data: payload, headers: {}, config: { headers: new axios.AxiosHeaders() } }));
    await expect(checkLogin("cashier@example.com", "password")).rejects.toMatchObject({
      name: "ServiceError", statusCode: 401, payload,
    });
  });

  it("validates a restored session with the authenticated endpoint", async () => {
    const session = {
      uuid: "login-1",
      login_email: "cashier@example.com",
      login_name: "Noy",
      branch_uuid: "branch-1",
      store_uuid_fk: "store-1",
      login_status: 1,
      store_status: 1,
    };
    apiMocks.request.mockResolvedValue(session);

    await expect(validateLoginSession()).resolves.toEqual(session);
    expect(apiMocks.request).toHaveBeenCalledWith(
      "post",
      "/api/v1/access-data",
      undefined,
      "Unable to validate session",
    );
  });
});
