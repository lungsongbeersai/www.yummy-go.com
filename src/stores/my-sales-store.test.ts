import { beforeEach, describe, expect, it, vi } from "vitest";
import * as posService from "@/services/pos";
import type { MySalesResponse } from "@/services/pos";
import { useMySalesStore } from "@/stores/my-sales-store";
import { resetSessionStores } from "@/stores/session-store-registry";

vi.mock("@/services/pos", () => ({ fetchMySales: vi.fn() }));

const fetchSales = vi.mocked(posService.fetchMySales);

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

function response(orderUuid: string): MySalesResponse {
  return {
    status: "success",
    data: [{
      order_uuid: orderUuid, order_invoice: orderUuid, order_date_time: "2026-11-05T12:00:00+07:00",
      table_uuid_fk: null, table_name: null, zone_name: null, order_check_bill: 1, order_status: 1,
      is_cancelled: false, payment_status: "unpaid", kitchen_status: "pending", item_count: 1, quantity: 1, total: 10000, items: [],
    }],
    pagination: { page: 1, limit: 20, total: 1, total_pages: 1 },
    summary: { order_count: 1, pending_kitchen_count: 1, sent_kitchen_count: 0, unpaid_count: 1, paid_count: 0, cancelled_count: 0 },
  };
}

describe("personal sales store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useMySalesStore.getState().reset();
  });

  it("keeps the latest filters when an earlier request finishes last", async () => {
    const older = deferred<MySalesResponse>();
    const latest = deferred<MySalesResponse>();
    fetchSales.mockReturnValueOnce(older.promise).mockReturnValueOnce(latest.promise);
    const firstLoad = useMySalesStore.getState().load({ search: "old" });
    const lastLoad = useMySalesStore.getState().load({ search: "new" });
    latest.resolve(response("latest"));
    await lastLoad;
    older.resolve(response("older"));
    await firstLoad;
    expect(useMySalesStore.getState().orders.map((order) => order.order_uuid)).toEqual(["latest"]);
    expect(useMySalesStore.getState().loading).toBe(false);
  });

  it("clears the previous scope immediately before loading another branch or user", async () => {
    fetchSales.mockResolvedValueOnce(response("old-user"));
    await useMySalesStore.getState().load({}, "old-user:old-branch");
    const pending = deferred<MySalesResponse>();
    fetchSales.mockReturnValueOnce(pending.promise);
    const load = useMySalesStore.getState().load({}, "new-user:new-branch");
    expect(useMySalesStore.getState().orders).toEqual([]);
    expect(useMySalesStore.getState().summary.order_count).toBe(0);
    pending.resolve(response("new-user"));
    await load;
    expect(useMySalesStore.getState().orders[0]?.order_uuid).toBe("new-user");
  });

  it("does not restore another user's data after logout", async () => {
    const pending = deferred<MySalesResponse>();
    fetchSales.mockReturnValueOnce(pending.promise);
    const load = useMySalesStore.getState().load({});
    resetSessionStores();
    pending.resolve(response("previous-user"));
    await load;
    expect(useMySalesStore.getState().orders).toEqual([]);
    expect(useMySalesStore.getState().queryKey).toBe("");
    expect(useMySalesStore.getState().loading).toBe(false);
  });

  it("surfaces errors and clears stale order statuses", async () => {
    fetchSales.mockResolvedValueOnce(response("old-order"));
    await useMySalesStore.getState().load({});
    fetchSales.mockRejectedValueOnce(new Error("Connection lost"));
    await expect(useMySalesStore.getState().load({})).rejects.toThrow("Connection lost");
    expect(useMySalesStore.getState().error).toBe("Connection lost");
    expect(useMySalesStore.getState().orders).toEqual([]);
    expect(useMySalesStore.getState().summary.order_count).toBe(0);
  });

  it("does not apply an error from a stale request over the latest result", async () => {
    const older = deferred<MySalesResponse>();
    fetchSales.mockReturnValueOnce(older.promise).mockResolvedValueOnce(response("current"));
    const firstLoad = useMySalesStore.getState().load({ search: "old" });
    const firstRejection = expect(firstLoad).rejects.toThrow("Old failure");
    await useMySalesStore.getState().load({ search: "new" });
    older.reject(new Error("Old failure"));
    await firstRejection;
    expect(useMySalesStore.getState().error).toBeNull();
    expect(useMySalesStore.getState().orders[0]?.order_uuid).toBe("current");
  });
});
