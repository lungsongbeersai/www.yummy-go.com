import { apiRequest, publicApiRequest, ServiceError } from "@/lib/api";
export type WaiterRequestType = "staff" | "bill";
export type WaiterItemKind = "bowl" | "spoon" | "chopsticks" | "staff";
export interface WaiterItem {
  kind: WaiterItemKind;
  qty: number;
}
export interface WaiterRequest {
  request_uuid: string;
  table_uuid: string;
  branch_uuid: string;
  table_name_la?: string;
  table_name_eng?: string;
  // Older responses omit this field; consumers treat them as staff requests.
  request_type?: WaiterRequestType;
  items: WaiterItem[];
  message: string;
  status: 0 | 1 | 2;
  created_at: string;
}
interface Response<T> {
  data: T;
}
interface CustomerWaiterResponse extends Response<WaiterRequest[]> {
  capabilities?: unknown;
}
export interface CustomerWaiterState {
  requests: WaiterRequest[];
  billRequestsEnabled: boolean;
}
export interface SendWaiterRequest {
  client_request_uuid: string;
  // The backend defaults legacy callers to staff when this is omitted.
  request_type?: WaiterRequestType;
  items: WaiterItem[];
  message: string;
}
export async function fetchCustomerWaiterState(token: string): Promise<CustomerWaiterState> {
  const response = await publicApiRequest<CustomerWaiterResponse>(
    "get",
    "/api/v1/posAll/customer/waiter_requests",
    { params: { t: token } }
  );
  const capabilities = response.capabilities;
  return {
    requests: response.data,
    // Older servers accept unknown POST fields as plain staff calls.
    billRequestsEnabled: typeof capabilities === "object" && capabilities !== null &&
      !Array.isArray(capabilities) && "bill_requests" in capabilities && capabilities.bill_requests === true,
  };
}
export async function fetchCustomerWaiterRequests(token: string) {
  return (await fetchCustomerWaiterState(token)).requests;
}
export async function sendCustomerWaiterRequest(
  token: string,
  input: SendWaiterRequest
) {
  const response = await publicApiRequest<Response<WaiterRequest>>(
    "post",
    `/api/v1/posAll/customer/waiter_requests?t=${encodeURIComponent(token)}`,
    { data: input }
  );
  if (input.request_type === "bill" && response.data?.request_type !== "bill") {
    throw new ServiceError("Bill requests are not supported by this server. Please call staff.", 409, undefined, response);
  }
  return response.data;
}
export async function fetchStaffWaiterRequests() {
  return (
    await apiRequest<Response<WaiterRequest[]>>(
      "get",
      "/api/v1/posAll/waiter_requests"
    )
  ).data;
}
export async function updateStaffWaiterRequest(id: string, status: 1 | 2) {
  return (
    await apiRequest<Response<WaiterRequest>>(
      "patch",
      `/api/v1/posAll/waiter_requests/${encodeURIComponent(id)}`,
      { data: { status } }
    )
  ).data;
}
