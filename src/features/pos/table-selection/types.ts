import type { CartItem, DiscountTypeCode } from "@/services/pos";

export type TableStatusFilter = "all" | "free" | "busy" | "update";
export type CartTab = "new" | "history";
export type CartItemAction = "delete" | "cancel";
export type TableActionMode = "move" | "join";

export interface CartItemActionTarget {
  action: CartItemAction;
  item: CartItem;
}

export interface DiscountDraft {
  type: DiscountTypeCode;
  value: string;
}

export interface ConfirmAllProgress {
  completed: number;
  detail: string;
  label: string;
  total: number;
}

export interface TableActionTable {
  customerOrderState: boolean;
  seats: number | null;
  status: "free" | "busy";
  uuid: string;
  name: string;
  zoneName: string;
}

export interface NormalizedTableActionZone {
  uuid: string;
  name: string;
  tables: TableActionTable[];
}
