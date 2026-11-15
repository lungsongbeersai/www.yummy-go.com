import axios, { type InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { shouldLogoutForUnauthorized, unauthorizedLoginPath } from "@/lib/unauthorized-session";
import { apiClient, apiRequest } from "@/lib/api";
import { useAuthStore, type AuthUser } from "@/stores/auth-store";

describe("shouldLogoutForUnauthorized", () => {
  it("logs out when the rejected request belongs to the active session", () => {
    expect(
      shouldLogoutForUnauthorized({
        currentToken: "current-token",
        isLoggedIn: true,
        requestToken: "current-token",
        status: 401,
      }),
    ).toBe(true);
  });

  it.each([
    { requestToken: "old-token", status: 401 },
    { requestToken: null, status: 401 },
    { requestToken: "current-token", status: 403 },
  ])("keeps the active session for an unrelated response", (input) => {
    expect(
      shouldLogoutForUnauthorized({
        currentToken: "current-token",
        isLoggedIn: true,
        ...input,
      }),
    ).toBe(false);
  });

  it("does nothing when there is no active login", () => {
    expect(
      shouldLogoutForUnauthorized({
        currentToken: "current-token",
        isLoggedIn: false,
        requestToken: "current-token",
        status: 401,
      }),
    ).toBe(false);
  });
});

describe("unauthorizedLoginPath", () => {
  it("preserves only the canonical report handoff and its complete query through one encoded redirect", () => {
    const search = "?employee=synthetic-employee&branch=synthetic-branch&date=2026-11-15&scope=current&search=green%20tea";
    const path = unauthorizedLoginPath("/my_work/report", search);
    expect(path).toBe(`/login?redirect=${encodeURIComponent(`/my_work/report${search}`)}`);
    expect(new URLSearchParams(path.split("?")[1]).get("redirect")).toBe(`/my_work/report${search}`);
    expect(unauthorizedLoginPath("/my_work/report")).toBe("/login?redirect=%2Fmy_work%2Freport");
  });

  it("preserves valid encoded Lao text and a literal hash within a query value, without a URL fragment", () => {
    const search = `?search=${encodeURIComponent("ລາຍງານ #1")}`;
    expect(unauthorizedLoginPath("/my_work/report", search)).toBe(`/login?redirect=${encodeURIComponent(`/my_work/report${search}`)}`);
  });

  it.each([
    ["another protected page", "/posAll/tables", "?search=synthetic"],
    ["legacy orders page", "/my_orders", ""],
    ["report child", "/my_work/report/child", ""],
    ["report trailing slash", "/my_work/report/", ""],
    ["encoded report pathname", "/my_work/%72eport", ""],
    ["external origin", "https://outside.invalid/my_work/report", ""],
    ["protocol relative origin", "//outside.invalid/my_work/report", ""],
    ["relative pathname", "my_work/report", ""],
    ["pathname fragment", "/my_work/report#section", ""],
    ["search fragment", "/my_work/report", "?scope=current#section"],
    ["external string as search", "/my_work/report", "https://outside.invalid"],
    ["missing question mark", "/my_work/report", "scope=current"],
    ["raw backslash", "/my_work/report", "?search=\\outside"],
    ["encoded backslash", "/my_work/report", "?search=%5Coutside"],
    ["raw control", "/my_work/report", "?search=one\ntwo"],
    ["encoded control", "/my_work/report", "?search=one%0Atwo"],
    ["encoded DEL", "/my_work/report", "?search=one%7Ftwo"],
    ["format control", "/my_work/report", "?search=one\u202Etwo"],
    ["encoded format control", "/my_work/report", "?search=one%E2%80%AEtwo"],
    ["malformed percent encoding", "/my_work/report", "?search=%ZZ"],
  ])("keeps the old login default for %s", (_name, pathname, search) => {
    expect(unauthorizedLoginPath(pathname, search)).toBe("/login");
  });

  it("retains login defaults without a browser pathname", () => {
    expect(unauthorizedLoginPath()).toBe("/login");
  });
});

const syntheticUser: AuthUser = {
  uuid: "synthetic-employee", email: "synthetic@example.test", status: 4, profile: "",
  branch_uuid: "synthetic-branch", branch_name: "Synthetic branch", branch_tel: "", branch_address: "",
  store_uuid: "synthetic-store", store_uuid_fk: "synthetic-store", store_name: "Synthetic store", store_logo: "", store_table_status: 1,
};
const originalAdapter = apiClient.defaults.adapter;

describe("current-session report HTTP401 interception", () => {
  beforeEach(() => { useAuthStore.getState().login("synthetic-session", syntheticUser); });
  afterEach(() => {
    useAuthStore.getState().logout(); apiClient.defaults.adapter = originalAdapter;
    vi.restoreAllMocks(); vi.unstubAllGlobals();
  });

  it("logs out the expired report session while preserving only its internal report query", async () => {
    const search = "?employee=synthetic-employee&branch=synthetic-branch&date=2026-11-15&scope=current";
    const assign = vi.fn();
    vi.stubGlobal("window", { location: { pathname: "/my_work/report", search, hash: "#ignored", assign } });
    apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
      throw new axios.AxiosError("Synthetic expired session", "ERR_BAD_REQUEST", config, undefined,
        { status: 401, statusText: "Unauthorized", data: { message: "Session expired" }, headers: {}, config });
    };
    await expect(apiRequest("get", "/api/v1/posAll/my_work/report")).rejects.toMatchObject({ statusCode: 401 });
    expect(useAuthStore.getState().isLoggedIn).toBe(false);
    expect(assign).toHaveBeenCalledExactlyOnceWith(`/login?redirect=${encodeURIComponent(`/my_work/report${search}`)}`);
    expect(assign.mock.calls[0][0]).not.toContain("ignored");
  });

  it("keeps branch-contract renewal precedence on the report handoff route", async () => {
    const assign = vi.fn();
    vi.stubGlobal("window", { location: { pathname: "/my_work/report", search: "?scope=current", assign } });
    const payload = { status: "error", auth: false, code: "BRANCH_CONTRACT_EXPIRED", message: "Synthetic expiry",
      branch_uuid: "70000000-0000-4000-8000-000000000001", contract_end_on: "2026-10-01", contract_days_remaining: -28 };
    apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
      throw new axios.AxiosError("Synthetic branch expiry", "ERR_BAD_REQUEST", config, undefined,
        { status: 401, statusText: "Unauthorized", data: payload, headers: {}, config });
    };
    await expect(apiRequest("get", "/api/v1/posAll/my_work/report")).rejects.toMatchObject({ statusCode: 401 });
    expect(assign).toHaveBeenCalledExactlyOnceWith("/subscription-expired");
  });
});
