import { expect, it, vi } from "vitest";
import { publicApiRequest, apiRequest } from "@/lib/api";
import {
  sendCustomerWaiterRequest,
  updateStaffWaiterRequest,
} from "./waiter-requests";
vi.mock("@/lib/api", () => ({
  publicApiRequest: vi.fn().mockResolvedValue({ data: {} }),
  apiRequest: vi.fn().mockResolvedValue({ data: {} }),
}));
it("puts the public QR token in the POST URL because the transport ignores POST params", async () => {
  const input = { client_request_uuid: "id", items: [], message: "help" };
  await sendCustomerWaiterRequest("token+&?", input);
  expect(publicApiRequest).toHaveBeenCalledWith(
    "post",
    "/api/v1/posAll/customer/waiter_requests?t=token%2B%26%3F",
    { data: input }
  );
});
it("uses the authenticated API when staff complete a request", async () => {
  await updateStaffWaiterRequest("request", 2);
  expect(apiRequest).toHaveBeenCalledWith(
    "patch",
    "/api/v1/posAll/waiter_requests/request",
    { data: { status: 2 } }
  );
});
