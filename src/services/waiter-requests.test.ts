import { beforeEach, expect, it, vi } from "vitest";
import { publicApiRequest, apiRequest } from "@/lib/api";
import {
  fetchCustomerWaiterRequests,
  fetchCustomerWaiterState,
  sendCustomerWaiterRequest,
  updateStaffWaiterRequest,
  type SendWaiterRequest,
  type WaiterRequest,
} from "./waiter-requests";
vi.mock("@/lib/api", () => ({
  publicApiRequest: vi.fn().mockResolvedValue({ data: {} }),
  apiRequest: vi.fn().mockResolvedValue({ data: {} }),
  ServiceError: class ServiceError extends Error {
    constructor(message: string, public statusCode = 500) {
      super(message);
      this.name = "ServiceError";
    }
  },
}));
beforeEach(() => vi.clearAllMocks());
it("enables bill requests only after the public server advertises the capability", async () => {
  const requests: WaiterRequest[] = [];
  vi.mocked(publicApiRequest).mockResolvedValueOnce({ data: requests, capabilities: { bill_requests: true } });
  expect(await fetchCustomerWaiterState("table-token")).toEqual({ requests, billRequestsEnabled: true });
  expect(publicApiRequest).toHaveBeenCalledWith(
    "get",
    "/api/v1/posAll/customer/waiter_requests",
    { params: { t: "table-token" } }
  );
});
it.each([undefined, null, "true", true, 1, [], [{ bill_requests: true }], {}, { bill_requests: false }, { bill_requests: 1 }, { bill_requests: "true" }])(
  "keeps bill requests disabled for absent or malformed capabilities: %j",
  async (capabilities) => {
    vi.mocked(publicApiRequest).mockResolvedValueOnce({ data: [], capabilities });
    expect(await fetchCustomerWaiterState("table-token")).toEqual({ requests: [], billRequestsEnabled: false });
  }
);
it("keeps the legacy array fetch usable without bill capabilities", async () => {
  const requests: WaiterRequest[] = [{
    request_uuid: "legacy-request", table_uuid: "table", branch_uuid: "branch",
    items: [], message: "Come to the table", status: 0, created_at: "2026-11-05T12:00:00Z",
  }];
  vi.mocked(publicApiRequest).mockResolvedValueOnce({ data: requests });
  expect(await fetchCustomerWaiterRequests("table-token")).toBe(requests);
});
it("puts the public QR token in the POST URL because the transport ignores POST params", async () => {
  const input = { client_request_uuid: "id", items: [], message: "help" };
  await sendCustomerWaiterRequest("token+&?", input);
  expect(publicApiRequest).toHaveBeenCalledWith(
    "post",
    "/api/v1/posAll/customer/waiter_requests?t=token%2B%26%3F",
    { data: input }
  );
});
it("sends the bill request type without converting it into an item or payment action", async () => {
  const input: SendWaiterRequest = {
    client_request_uuid: "bill-attempt",
    request_type: "bill",
    items: [],
    message: "Please bring the bill",
  };
  const response: WaiterRequest = {
    request_uuid: "bill-request",
    table_uuid: "table",
    branch_uuid: "branch",
    request_type: "bill",
    items: [],
    message: input.message,
    status: 0,
    created_at: "2026-11-05T12:00:00Z",
  };
  vi.mocked(publicApiRequest).mockResolvedValueOnce({ data: response });
  expect(await sendCustomerWaiterRequest("table-token", input)).toEqual(response);
  expect(publicApiRequest).toHaveBeenCalledWith(
    "post",
    "/api/v1/posAll/customer/waiter_requests?t=table-token",
    { data: input }
  );
  expect(apiRequest).not.toHaveBeenCalled();
});
it.each([undefined, null, {}, { request_type: "staff" }])(
  "rejects a bill response without an explicit bill acknowledgement: %j",
  async (data) => {
    vi.mocked(publicApiRequest).mockResolvedValueOnce({ data });
    await expect(sendCustomerWaiterRequest("table-token", {
      client_request_uuid: "bill-attempt", request_type: "bill", items: [], message: "Please bring the bill",
    })).rejects.toMatchObject({ name: "ServiceError", statusCode: 409 });
  }
);
it("still accepts a legacy staff response with no request type", async () => {
  const response = { request_uuid: "staff-request", items: [], message: "Come to the table", status: 0 };
  vi.mocked(publicApiRequest).mockResolvedValueOnce({ data: response });
  expect(await sendCustomerWaiterRequest("table-token", {
    client_request_uuid: "staff-attempt", request_type: "staff", items: [], message: "Come to the table",
  })).toBe(response);
});
it("uses the authenticated API when staff complete a request", async () => {
  await updateStaffWaiterRequest("request", 2);
  expect(apiRequest).toHaveBeenCalledWith(
    "patch",
    "/api/v1/posAll/waiter_requests/request",
    { data: { status: 2 } }
  );
});
