import { apiRequest } from "@/lib/api";
import { createCrud } from "@/services/shared/crud";
import type { ApiEntity, ApiListResponse, FetchParams } from "@/services/shared/types";
import { requiredUuid } from "@/services/shared/validators";

export interface Customer extends ApiEntity {
  customer_uuid: string;
  customer_id?: string;
  member_code?: string;
  customer_name?: string;
  customer_phone?: string;
  customer_address?: string;
  customer_status?: number | string;
  store_uuid_fk?: string;
}
export interface FetchCustomersParams extends FetchParams {}
export type CustomerListResponse = ApiListResponse<Customer>;
export interface SaveCustomerInput extends ApiEntity {
  customer_uuid?: string;
  member_code?: string;
  customer_name?: string;
  customer_phone?: string;
  customer_address?: string;
  customer_status?: number | string;
  store_uuid_fk?: string;
}

interface SaveCustomerResponse extends ApiEntity {
  data?: Customer | null;
}

const crud = createCrud<Customer>(
  {
    fetch: "/api/v1/customer/list",
    create: "/api/v1/customer/create",
    delete: "/api/v1/customer/delete"
  },
  "customer_uuid"
);

export const getCustomers = (params: FetchCustomersParams = {}) => crud.list(params);
export const saveCustomer = async (input: SaveCustomerInput) => {
  const status = input.customer_status === "" || input.customer_status === undefined || input.customer_status === null ? 1 : input.customer_status;
  const payload: SaveCustomerInput = {
    store_uuid_fk: input.store_uuid_fk,
    customer_uuid: input.customer_uuid,
    member_code: input.member_code,
    customer_name: input.customer_name,
    customer_phone: input.customer_phone,
    customer_address: input.customer_address,
    customer_status: Number(status)
  };

  const result = await apiRequest<SaveCustomerResponse>(
    "post",
    "/api/v1/customer/create",
    { data: payload },
    "Failed to save data"
  );
  const responseCustomer =
    result.data ??
    (typeof result.customer_uuid === "string" ? result : null);
  const responseUuid = responseCustomer?.customer_uuid;

  // Customer create responses are inconsistent: some return the row at the
  // top level and some return only a success message. Keep the service contract
  // stable so payment can select the row or reload it by name.
  return {
    ...payload,
    ...(responseCustomer ?? {}),
    customer_uuid:
      typeof responseUuid === "string"
        ? responseUuid.trim()
        : String(payload.customer_uuid ?? "").trim()
  } as Customer;
};
export async function deleteCustomer(customer_uuid: string) {
  await apiRequest(
    "delete",
    "/api/v1/customer/delete",
    { params: { customer_uuid: requiredUuid(customer_uuid, "customer_uuid") } },
    "Failed to delete data"
  );
}
