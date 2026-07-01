import type { Customer, SaveCustomerInput } from "@/services/customer";
import type { ApiEntity } from "@/services/shared/types";

export function customerValue(row: ApiEntity | null | undefined, key: string, fallback = "") {
  const raw = row?.[key];
  if (raw === null || raw === undefined || raw === "") return fallback;
  return String(raw);
}

export function customerId(row: Customer | null | undefined) {
  return customerValue(row, "customer_uuid");
}

export function customerName(row: Customer | null | undefined) {
  return customerValue(row, "customer_name", "-");
}

export function customerMemberCode(row: Customer | null | undefined) {
  return customerValue(row, "member_code");
}

export function customerPhone(row: Customer | null | undefined) {
  return customerValue(row, "customer_phone", "-");
}

export function customerAddress(row: Customer | null | undefined) {
  return customerValue(row, "customer_address", "-");
}

export function customerStatus(row: Customer | null | undefined) {
  return customerValue(row, "customer_status", "1");
}

export function customerFormInput(formData: FormData, storeUuid: string, editing: Customer | null): SaveCustomerInput {
  const input: SaveCustomerInput = {
    store_uuid_fk: storeUuid,
    member_code: String(formData.get("member_code") ?? "").trim(),
    customer_name: String(formData.get("customer_name") ?? "").trim(),
    customer_phone: String(formData.get("customer_phone") ?? "").trim(),
    customer_address: String(formData.get("customer_address") ?? "").trim(),
    customer_status: Number(formData.get("customer_status") ?? 1)
  };
  const id = customerId(editing);
  if (id) input.customer_uuid = id;
  return input;
}
