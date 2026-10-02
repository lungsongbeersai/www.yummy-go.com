import { apiRequest, publicApiRequest } from "@/lib/api";
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
  items: WaiterItem[];
  message: string;
  status: 0 | 1 | 2;
  created_at: string;
}
interface Response<T> {
  data: T;
}
export interface SendWaiterRequest {
  client_request_uuid: string;
  items: WaiterItem[];
  message: string;
}
export async function fetchCustomerWaiterRequests(token: string) {
  return (
    await publicApiRequest<Response<WaiterRequest[]>>(
      "get",
      "/api/v1/posAll/customer/waiter_requests",
      { params: { t: token } }
    )
  ).data;
}
export async function sendCustomerWaiterRequest(
  token: string,
  input: SendWaiterRequest
) {
  return (
    await publicApiRequest<Response<WaiterRequest>>(
      "post",
      `/api/v1/posAll/customer/waiter_requests?t=${encodeURIComponent(token)}`,
      { data: input }
    )
  ).data;
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
