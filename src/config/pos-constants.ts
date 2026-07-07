export const ProductSortStatus = { NORMAL: 1, SET: 2, PROMOTION: 3 } as const;
export type ProductSortStatus =
  (typeof ProductSortStatus)[keyof typeof ProductSortStatus];

export const ProductImageStatus = { IMAGE: 1, COLOR: 2 } as const;
export type ProductImageStatus =
  (typeof ProductImageStatus)[keyof typeof ProductImageStatus];

export const TableStatus = { AVAILABLE: 1, OCCUPIED: 2 } as const;
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
