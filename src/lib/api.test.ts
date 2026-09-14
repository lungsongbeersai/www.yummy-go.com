import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient, apiRequest } from "@/lib/api";
import { useAuthStore, type AuthUser } from "@/stores/auth-store";
import { backendNetworkManager } from "@/stores/network-store";

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
    backendNetworkManager.resetChecking("api_test");
    useAuthStore.getState().login("online-token", user);
  });

  afterEach(() => {
    useAuthStore.getState().logout();
    vi.restoreAllMocks();
  });

  it("always sends a POS write to Backend even after an offline verdict", async () => {
    backendNetworkManager.reportTransportFailure("network", { confirmed: true });
    backendNetworkManager.reportTransportFailure("network", { confirmed: true });
    backendNetworkManager.reportTransportFailure("network", { confirmed: true });
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
    expect(useAuthStore.getState().offlineSession).toBe(false);
  });

  it("never turns a transport failure into a queued local success", async () => {
    vi.spyOn(apiClient, "post").mockRejectedValue(
      new axios.AxiosError("Network Error", "ERR_NETWORK"),
    );

    await expect(apiRequest("post", "/api/v1/posAll/payment", { data: { order_uuid: "order-1" } }))
      .rejects.toMatchObject({ name: "ServiceError", statusCode: 0 });
    expect(useAuthStore.getState().offlineSession).toBe(false);
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
