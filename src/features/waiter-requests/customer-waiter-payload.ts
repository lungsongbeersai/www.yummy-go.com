import type { SendWaiterRequest, WaiterItem } from "@/services/waiter-requests";

export const CUSTOMER_WAITER_KINDS = ["bowl", "spoon", "chopsticks"] as const;
export const MAX_CUSTOMER_WAITER_QTY = 20;
export const MAX_CUSTOMER_WAITER_MESSAGE = 500;
export type CustomerWaiterKind = (typeof CUSTOMER_WAITER_KINDS)[number];
export type CustomerWaiterPayload = Pick<SendWaiterRequest, "items" | "message">;

export interface CustomerWaiterAttempt {
  id: string;
  payloadKey: string;
}

export function buildCustomerWaiterPayload(
  quantities: Partial<Record<CustomerWaiterKind, number>>,
  note: string,
  staffMessage: string,
): CustomerWaiterPayload {
  const items: WaiterItem[] = CUSTOMER_WAITER_KINDS.flatMap((kind) => {
    const value = quantities[kind] ?? 0;
    const qty = Number.isFinite(value)
      ? Math.min(MAX_CUSTOMER_WAITER_QTY, Math.max(0, Math.trunc(value)))
      : 0;
    return qty > 0 ? [{ kind, qty }] : [];
  });
  const message = note.trim().slice(0, MAX_CUSTOMER_WAITER_MESSAGE).trim();
  return {
    items,
    // Item names never consume the customer's message budget or get repeated in staff chat.
    message: message || (items.length ? "" : staffMessage.trim().slice(0, MAX_CUSTOMER_WAITER_MESSAGE)),
  };
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
