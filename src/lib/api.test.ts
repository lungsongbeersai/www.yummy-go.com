import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient, apiRequest, publicApiClient, publicApiRequest } from "@/lib/api";
import { useAuthStore, type AuthUser } from "@/stores/auth-store";

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

describe("online-only API transport", () => {
  beforeEach(() => {
    useAuthStore.getState().login("online-token", user);
  });

  afterEach(() => {
    useAuthStore.getState().logout();
    vi.restoreAllMocks();
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
});
