export const ORDER_AUDIT_ACTIONS = ["CREATE", "DISCOUNT", "PRICE", "QUANTITY", "CANCEL", "DELETE", "MOVE", "PAYMENT", "UPDATE"] as const;
export type OrderAuditAction = typeof ORDER_AUDIT_ACTIONS[number];
