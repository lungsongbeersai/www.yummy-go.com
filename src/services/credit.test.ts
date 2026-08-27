import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));

vi.mock("@/lib/api", () => ({
  apiRequest: apiMocks.apiRequest,
  ServiceError: class ServiceError extends Error {}
}));

import { fetchCreditData, fetchCreditPaymentSelection, payCredit } from "@/services/credit";

describe("credit service", () => {
  beforeEach(() => {
    apiMocks.apiRequest.mockReset();
    apiMocks.apiRequest.mockResolvedValue({ status: "success", message: "success" });
  });

  it("loads the customer selector before loading a customer's bills", async () => {
    await fetchCreditData({ branch_uuid: "branch-1", lang: "en" });
    expect(apiMocks.apiRequest).toHaveBeenCalledWith("get", "/api/v1/posAll/credit/payment-selection", {
      params: { branch_uuid: "branch-1", lang: "eng" }
    });

    await fetchCreditData({
      branch_uuid: "branch-1",
      customer_uuid: "customer-1",
      lang: "la"
    });
    expect(apiMocks.apiRequest).toHaveBeenLastCalledWith("get", "/api/v1/posAll/credit/payment-selection", {
      params: {
        branch_uuid: "branch-1",
        customer_uuid: "customer-1",
        bill_status: "open",
        lang: "la",
        limit: 100,
        page: 1
      }
    });
  });

  it("requests one or multiple bill details with the selected customer", async () => {
    await fetchCreditPaymentSelection({
      branch_uuid: "branch-1",
      customer_uuid: "customer-1",
      bill_uuids: ["payment-1"],
      lang: "la"
    });

    expect(apiMocks.apiRequest).toHaveBeenLastCalledWith("get", "/api/v1/posAll/credit/payment-selection", {
      params: {
        branch_uuid: "branch-1",
        customer_uuid: "customer-1",
        payment_type: "single",
        bill_uuids: "payment-1",
        lang: "la"
      }
    });

    await fetchCreditPaymentSelection({
      branch_uuid: "branch-1",
      customer_uuid: "customer-1",
      bill_uuids: ["payment-1", "payment-2"],
      lang: "en"
    });

    expect(apiMocks.apiRequest).toHaveBeenCalledWith("get", "/api/v1/posAll/credit/payment-selection", {
      params: {
        branch_uuid: "branch-1",
        customer_uuid: "customer-1",
        payment_type: "multiple",
        bill_uuids: "payment-1,payment-2",
        lang: "eng"
      }
    });
  });

  it("sends the selected bill's full outstanding amount", async () => {
    await payCredit({
      request_uuid: "request-1",
      branch_uuid: "branch-1",
      customer_uuid: "customer-1",
      payment_type: "single",
      payment_method: 1,
      cash_payment_amount: 4_000_000,
      transfer_payment_amount: 0,
      change_amount: 0,
      items: [{ payment_uuid: "payment-1", pay_amount: 4_000_000 }],
      lang: "la"
    });

    expect(apiMocks.apiRequest).toHaveBeenCalledWith("post", "/api/v1/posAll/credit/payment", {
      data: {
        request_uuid: "request-1",
        branch_uuid: "branch-1",
        customer_uuid: "customer-1",
        payment_type: "single",
        payment_method: 1,
        cash_payment_amount: 4_000_000,
        transfer_payment_amount: 0,
        change_amount: 0,
        items: [{ payment_uuid: "payment-1", pay_amount: 4_000_000 }],
        lang: "la"
      }
    });
  });
});
