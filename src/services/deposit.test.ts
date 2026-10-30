import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));

vi.mock("@/lib/api", () => ({
  apiRequest: apiMocks.apiRequest,
  ServiceError: class ServiceError extends Error {}
}));

import { createDeposit, fetchDepositList, fetchDepositOrderRedemptions, reprintDepositReceipt, withdrawDeposit } from "@/services/deposit";

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
      order_uuid: "order-1",
      status: "all",
      search: "beer",
      lang: "la"
    });

    expect(apiMocks.apiRequest).toHaveBeenLastCalledWith("get", "/api/v1/posAll/deposit/list", {
      params: {
        branch_uuid: "branch-1",
        customer_uuid: "customer-1",
        order_uuid: "order-1",
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
      branch_uuid: "branch-1",
      customer_uuid: "customer-1",
      order_uuid: "order-1",
      items: [
        { pro_detail_uuid: "detail-1", deposit_qty: 1 },
        { pro_detail_uuid: "detail-2", deposit_qty: 2 }
      ],
      note: "Johnnie Walker Black + Hennessy",
      lang: "la"
    });

    expect(apiMocks.apiRequest).toHaveBeenCalledWith("post", "/api/v1/posAll/deposit/create", {
      data: {
        request_uuid: expect.stringMatching(/^[0-9a-f-]{36}$/),
        branch_uuid: "branch-1",
        customer_uuid: "customer-1",
        order_uuid: "order-1",
        items: [
          { pro_detail_uuid: "detail-1", deposit_qty: 1 },
          { pro_detail_uuid: "detail-2", deposit_qty: 2 }
        ],
        note: "Johnnie Walker Black + Hennessy",
        lang: "la"
      }
    });
  });

  it("rejects an empty items list before calling the API", () => {
    expect(() =>
      createDeposit({
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
        branch_uuid: "branch-1",
        customer_uuid: "customer-1",
        items: [{ pro_detail_uuid: "detail-1", deposit_qty: 0 }]
      })
    ).toThrow();
    expect(apiMocks.apiRequest).not.toHaveBeenCalled();
  });

  it("keeps the provided operation identity and resolved printer when creating a deposit", async () => {
    await createDeposit({
      request_uuid: "same-operation", branch_uuid: "branch-1", customer_uuid: "customer-1",
      items: [{ pro_detail_uuid: " detail-1 ", deposit_qty: 0.125 }],
      device_code: " DESKTOP-1 ", agent_id: " agent-1 ", print_mode: "windows_agent", lang: "en",
    });
    expect(apiMocks.apiRequest).toHaveBeenCalledWith("post", "/api/v1/posAll/deposit/create", {
      data: {
        request_uuid: "same-operation", branch_uuid: "branch-1", customer_uuid: "customer-1",
        items: [{ pro_detail_uuid: "detail-1", deposit_qty: 0.125 }],
        device_code: "DESKTOP-1", agent_id: "agent-1", print_mode: "windows_agent", lang: "eng",
      }
    });
  });

  it.each([NaN, Infinity, -Infinity, 0.0001, 1.2345, 100_000_000_000])(
    "rejects invalid or unsupported quantities (%s) before deposit and withdrawal writes", (quantity) => {
      expect(() => createDeposit({
        branch_uuid: "branch-1", customer_uuid: "customer-1",
        items: [{ pro_detail_uuid: "detail-1", deposit_qty: quantity }],
      })).toThrow();
      expect(() => withdrawDeposit({
        request_uuid: "request-1", deposit_uuid: "deposit-1", qty_withdrawn: quantity,
      })).toThrow();
      expect(apiMocks.apiRequest).not.toHaveBeenCalled();
    },
  );

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

  it("reprints a saved batch with a separate print operation without creating another deposit", async () => {
    await reprintDepositReceipt({
      request_uuid: "new-print-operation", kind: "deposit", deposit_request_uuid: "saved-deposit-operation",
      device_code: "DESKTOP-1", lang: "la",
    });
    expect(apiMocks.apiRequest).toHaveBeenCalledWith("post", "/api/v1/posAll/deposit/reprint", {
      data: {
        request_uuid: "new-print-operation", kind: "deposit", deposit_request_uuid: "saved-deposit-operation",
        device_code: "DESKTOP-1", lang: "la",
      }
    });
    await reprintDepositReceipt({
      request_uuid: "withdrawal-print", kind: "withdrawal", withdrawal_uuid: "saved-withdrawal", lang: "en",
    });
    expect(apiMocks.apiRequest).toHaveBeenLastCalledWith("post", "/api/v1/posAll/deposit/reprint", {
      data: {
        request_uuid: "withdrawal-print", kind: "withdrawal", withdrawal_uuid: "saved-withdrawal", lang: "eng",
      }
    });
  });

  it("requires one original receipt matching the requested reprint kind", () => {
    expect(() => reprintDepositReceipt({ request_uuid: "print-1", kind: "deposit" })).toThrow();
    expect(() => reprintDepositReceipt({
      request_uuid: "print-1", kind: "withdrawal", deposit_uuid: "deposit-1",
    })).toThrow();
    expect(() => reprintDepositReceipt({
      request_uuid: "print-1", kind: "deposit", deposit_uuid: "deposit-1", deposit_request_uuid: "batch-1",
    })).toThrow();
    expect(apiMocks.apiRequest).not.toHaveBeenCalled();
  });
});
