import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));

vi.mock("@/lib/api", () => ({
  apiRequest: apiMocks.apiRequest,
  ServiceError: class ServiceError extends Error {}
}));

import { createDeposit, fetchDepositList, fetchDepositOrderRedemptions, withdrawDeposit } from "@/services/deposit";

describe("deposit service", () => {
  beforeEach(() => {
    apiMocks.apiRequest.mockReset();
    apiMocks.apiRequest.mockResolvedValue({ status: "success", message: "success" });
  });

  it("lists deposits scoped to a branch with the active status default", async () => {
    await fetchDepositList({ branch_uuid: "branch-1", lang: "en" });

    expect(apiMocks.apiRequest).toHaveBeenCalledWith("get", "/api/v1/posAll/deposit/list", {
      params: {
        branch_uuid: "branch-1",
        status: "active",
        search: "",
        page: 1,
        limit: 20,
        lang: "eng"
      }
    });

    await fetchDepositList({
      branch_uuid: "branch-1",
      customer_uuid: "customer-1",
      status: "all",
      search: "beer",
      lang: "la"
    });

    expect(apiMocks.apiRequest).toHaveBeenLastCalledWith("get", "/api/v1/posAll/deposit/list", {
      params: {
        branch_uuid: "branch-1",
        customer_uuid: "customer-1",
        status: "all",
        search: "beer",
        page: 1,
        limit: 20,
        lang: "la"
      }
    });
  });

  it("creates a deposit with one or more items in a single request", async () => {
    await createDeposit({
      request_uuid: "request-1",
      branch_uuid: "branch-1",
      customer_uuid: "customer-1",
      items: [
        { pro_detail_uuid: "detail-1", deposit_qty: 1 },
        { pro_detail_uuid: "detail-2", deposit_qty: 2 }
      ],
      expire_date: "2026-12-31",
      note: "Johnnie Walker Black + Hennessy",
      lang: "la"
    });

    expect(apiMocks.apiRequest).toHaveBeenCalledWith("post", "/api/v1/posAll/deposit/create", {
      data: {
        request_uuid: "request-1",
        branch_uuid: "branch-1",
        customer_uuid: "customer-1",
        items: [
          { pro_detail_uuid: "detail-1", deposit_qty: 1 },
          { pro_detail_uuid: "detail-2", deposit_qty: 2 }
        ],
        expire_date: "2026-12-31",
        note: "Johnnie Walker Black + Hennessy",
        lang: "la"
      }
    });
  });

  it("rejects an empty items list before calling the API", () => {
    expect(() =>
      createDeposit({
        request_uuid: "request-1",
        branch_uuid: "branch-1",
        customer_uuid: "customer-1",
        items: []
      })
    ).toThrow();
    expect(apiMocks.apiRequest).not.toHaveBeenCalled();
  });

  it("rejects a non-positive deposit_qty in any item before calling the API", () => {
    expect(() =>
      createDeposit({
        request_uuid: "request-1",
        branch_uuid: "branch-1",
        customer_uuid: "customer-1",
        items: [{ pro_detail_uuid: "detail-1", deposit_qty: 0 }]
      })
    ).toThrow();
    expect(apiMocks.apiRequest).not.toHaveBeenCalled();
  });

  it("withdraws a quantity from a deposit", async () => {
    await withdrawDeposit({
      request_uuid: "request-2",
      deposit_uuid: "deposit-1",
      order_uuid: "order-1",
      qty_withdrawn: 0.5,
      lang: "la"
    });

    expect(apiMocks.apiRequest).toHaveBeenCalledWith("post", "/api/v1/posAll/deposit/withdraw", {
      data: {
        request_uuid: "request-2",
        deposit_uuid: "deposit-1",
        order_uuid: "order-1",
        qty_withdrawn: 0.5,
        lang: "la"
      }
    });
  });

  it("fetches a bill's deposit redemptions", async () => {
    await fetchDepositOrderRedemptions("order-1", "en");

    expect(apiMocks.apiRequest).toHaveBeenCalledWith("get", "/api/v1/posAll/deposit/order-redemptions", {
      params: { order_uuid: "order-1", lang: "eng" }
    });
  });
});
