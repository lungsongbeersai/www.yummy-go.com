"use client";

import {
  deleteCustomer,
  getCustomers,
  saveCustomer,
  type Customer,
  type FetchCustomersParams,
  type SaveCustomerInput
} from "@/services/customer";
import { createCrudListStore } from "@/stores/crud-list-store";

export const useCustomerStore = createCrudListStore<
  Customer,
  SaveCustomerInput,
  FetchCustomersParams
>({
  idKey: "customer_uuid",
  list: getCustomers,
  save: saveCustomer,
  remove: deleteCustomer
});
