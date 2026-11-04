import type { SendWaiterRequest, WaiterItem, WaiterRequest, WaiterRequestType } from "@/services/waiter-requests";

export const CUSTOMER_WAITER_KINDS = ["bowl", "spoon", "chopsticks"] as const;
export const MAX_CUSTOMER_WAITER_QTY = 20;
export const MAX_CUSTOMER_WAITER_MESSAGE = 500;
export type CustomerWaiterKind = (typeof CUSTOMER_WAITER_KINDS)[number];
export type CustomerWaiterPayload = Pick<SendWaiterRequest, "items" | "message"> & {
  request_type: WaiterRequestType;
};

export interface CustomerWaiterAttempt {
  id: string;
  payloadKey: string;
}

export function buildCustomerWaiterPayload(
  quantities: Partial<Record<CustomerWaiterKind, number>>,
  note: string,
  defaultMessage: string,
  requestType: WaiterRequestType = "staff",
): CustomerWaiterPayload {
  // Switching from assistance to a bill must not carry hidden item quantities.
  const items: WaiterItem[] = requestType === "bill" ? [] : CUSTOMER_WAITER_KINDS.flatMap((kind) => {
    const value = quantities[kind] ?? 0;
    const qty = Number.isFinite(value)
      ? Math.min(MAX_CUSTOMER_WAITER_QTY, Math.max(0, Math.trunc(value)))
      : 0;
    return qty > 0 ? [{ kind, qty }] : [];
  });
  const message = note.trim().slice(0, MAX_CUSTOMER_WAITER_MESSAGE).trim();
  return {
    request_type: requestType,
    items,
    // Item names never consume the customer's message budget or get repeated in staff chat.
    message: message || (items.length ? "" : defaultMessage.trim().slice(0, MAX_CUSTOMER_WAITER_MESSAGE)),
  };
}

export function findPendingBillRequest(requests: readonly WaiterRequest[]): WaiterRequest | undefined {
  // Legacy calls and customer prose mentioning a bill are still staff requests.
  return requests.find((request) => request.request_type === "bill" && (request.status === 0 || request.status === 1));
}

export function resolveCustomerWaiterAttempt(
  payload: CustomerWaiterPayload,
  previous: CustomerWaiterAttempt | null,
  createId: () => string,
): CustomerWaiterAttempt {
  const payloadKey = JSON.stringify(payload);
  // A translated default message can change without an input event; it needs a new UUID too.
  return previous?.payloadKey === payloadKey ? previous : { id: createId(), payloadKey };
}
