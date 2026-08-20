export const ProductSortStatus = { NORMAL: 1, SET: 2, PROMOTION: 3 } as const;
export type ProductSortStatus =
  (typeof ProductSortStatus)[keyof typeof ProductSortStatus];

export const ProductImageStatus = { IMAGE: 1, COLOR: 2 } as const;
export type ProductImageStatus =
  (typeof ProductImageStatus)[keyof typeof ProductImageStatus];

export const TableStatus = { NEW_ORDER: 0, AVAILABLE: 1, OCCUPIED: 2, AWAITING_PAYMENT: 3 } as const;
export type TableStatus = (typeof TableStatus)[keyof typeof TableStatus];

export const OrderSourceEnum = { POS: 1, QR: 2, ONLINE: 3 } as const;
export type OrderSource =
  (typeof OrderSourceEnum)[keyof typeof OrderSourceEnum];

export const OrderChannelEnum = { DINE_IN: 1, TAKEAWAY: 2, DELIVERY: 3 } as const;
export type OrderChannel =
  (typeof OrderChannelEnum)[keyof typeof OrderChannelEnum];

export const PaymentMethod = {
  CASH: 1,
  TRANSFER: 2,
  CASH_TRANSFER: 3,
  ARREARS: 4,
} as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

// สถานะของ order_item ใน customer_order_queue — ORDERED (0) ไม่มีหน้าใช้งานตอนนี้
// (ยังไม่มี API เปลี่ยนสถานะ 0→1) แต่ยังคงนิยามไว้ให้ครบตาม backend
export const OrderItemStatus = {
  ORDERED: 0,
  WAITING_CONFIRM: 1,
  SENT_TO_KITCHEN: 2,
  SERVED: 4,
  CANCELLED: 9,
} as const;
export type OrderItemStatus = (typeof OrderItemStatus)[keyof typeof OrderItemStatus];
