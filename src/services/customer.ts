import { createCrud } from "@/services/shared/crud";
import type { ApiEntity, ApiListResponse, FetchParams } from "@/services/shared/types";

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

const crud = createCrud<Customer>(
  {
    fetch: "/api/v1/customer/list",
    create: "/api/v1/customer/create",
    delete: "/api/v1/customer/delete"
  },
  "customer_uuid"
);

export const getCustomers = (params: FetchCustomersParams = {}) => crud.list(params);
export const saveCustomer = (input: SaveCustomerInput) => {
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

  return crud.save(payload);
};
export const deleteCustomer = (customer_uuid: string) => crud.delete(customer_uuid);
