export interface SimulatorBranch {
  branch_uuid: string;
  branch_name: string;
  store_uuid: string;
  store_name?: string;
  use_tables?: boolean;
  vat_rate?: number;
  vat_status?: number;
  service_rate?: number;
  rounding_version?: number;
  currencies?: SimulatorCurrency[];
  payment_methods?: string[];
  deposit_expire_days?: number;
}

export interface SimulatorCurrency {
  code: string;
  rate: number;
}

export interface SimulatorTopping {
  topping_uuid: string;
  name: string;
  price: number;
}

export interface SimulatorOption {
  option_uuid: string;
  name: string;
}

export interface SimulatorProduct {
  product_uuid: string;
  detail_uuid: string;
  name: string;
  category_uuid: string;
  category_name: string;
  price: number;
  stock: number;
  public_visible?: boolean;
  customer_visible?: boolean;
  stock_factor?: number;
  promotion_active?: boolean;
  promotion?: { pro_detail_cus_qtyBuy: number; pro_detail_cus_qtyFree: number };
  track_stock: boolean;
  toppings: SimulatorTopping[];
  options: SimulatorOption[];
  supported: boolean;
  unsupported_reason?: string;
  topping_limit?: number;
  option_limit?: number;
}

export interface SimulatorTable {
  table_uuid: string;
  name: string;
  zone_uuid: string;
  zone_name: string;
  seats: number;
  charge_status: number;
  status: number;
  order_uuid: string | null;
  guests: number;
}

export interface SimulatorPermissions {
  operate: boolean;
  confirm: boolean;
  pay: boolean;
  discount: boolean;
  cancel: boolean;
  transfer: boolean;
  split: boolean;
}

export interface SimulatorTotals {
  subtotal: number;
  item_discount: number;
  bill_discount: number;
  service: number;
  vat: number;
  total: number;
  paid: number;
  balance: number;
}

export interface SimulatorItem {
  item_uuid: string;
  detail_uuid: string;
  name: string;
  quantity: number;
  promo_sale_qty?: number;
  promo_free_qty?: number;
  receive_quantity?: number;
  unit_price: number;
  status: number;
  note: string;
  toppings: Array<{ topping_uuid: string; quantity: number; name?: string; price?: number }>;
  options: string[];
  discount_type: number;
  discount_value: number;
}

export interface SimulatorPayment {
  payment_uuid: string;
  method: string;
  amount: number;
  currency: string;
  change?: number;
  amount_lak?: number;
  change_lak?: number;
  exchange_rate?: number;
  at?: string;
}

export interface SimulatorOrder {
  order_uuid: string;
  table_uuid: string | null;
  customer_name: string;
  customer_uuid?: string;
  guests: number;
  status: "open" | "paid" | "merged";
  items: SimulatorItem[];
  discount_type: number;
  discount_value: number;
  totals: SimulatorTotals;
  payments: SimulatorPayment[];
  created_at: string;
  receipt?: { receipt_number: string; at: string; simulated: boolean; redemptions?: SimulatorWithdrawal[] };
  redemptions?: SimulatorWithdrawal[];
}

export interface SimulatorKitchenJob {
  job_uuid: string;
  order_uuid: string;
  item_uuids: string[];
  table_name: string;
  status: "preparing" | "ready" | "served";
  print_status: "success" | "failed" | "not_required";
  printer_names: string[];
  attempts: number;
}

export interface SimulatorCustomer {
  customer_uuid: string;
  name: string;
  table_uuid: string | null;
  order_uuid: string | null;
  state: string;
  progress: number;
}

export interface SimulatorSession {
  session_uuid: string;
  branch_uuid: string;
  store_uuid: string;
  name: string;
  version: number;
  status: "running" | "paused";
  mode: "manual" | "auto";
  tick: number;
  config: SimulatorBranch;
  catalog: SimulatorProduct[];
  tables: SimulatorTable[];
  orders: SimulatorOrder[];
  kitchen: SimulatorKitchenJob[];
  customers: SimulatorCustomer[];
  activity: Array<{ event_uuid: string; at: string; type: string; message: string }>;
  sales: { total: number; bills: number; guests: number };
  saved_at?: string;
  permissions?: SimulatorPermissions;
  inventory?: Record<string, number>;
  profiles?: SimulatorProfile[];
  deposits?: SimulatorDeposit[];
  deposit_withdrawals?: SimulatorWithdrawal[];
  visits?: SimulatorVisit[];
  active_visit_uuid?: string | null;
}

export interface SimulatorVisit {
  visit_uuid: string;
  table_uuid: string;
  order_uuid: string;
  version: number;
  token: string;
  code: string;
  enabled: boolean;
  created_at: string;
  last_scanned_at: string | null;
  scan_count: number;
  simulated: true;
  revoked_at?: string;
  revoked_reason?: string;
}

export interface SimulatorProfile {
  customer_uuid: string;
  name: string;
  phone: string;
  member_code?: string;
  created_at: string;
}

export interface SimulatorWithdrawal {
  withdrawal_uuid: string;
  deposit_uuid: string;
  customer_name: string;
  product_name: string;
  order_uuid: string | null;
  quantity: number;
  qty_before: number;
  qty_after: number;
  at: string;
  note: string;
  chargeable: false;
  amount: 0;
}

export interface SimulatorDeposit {
  deposit_uuid: string;
  deposit_no: string;
  customer_uuid: string;
  customer_name: string;
  detail_uuid: string;
  product_name: string;
  order_uuid: string | null;
  deposit_qty: number;
  remaining_qty: number;
  deposit_date: string;
  expire_date: string;
  status: "ACTIVE" | "WITHDRAWN" | "EXPIRED";
  note: string;
  withdrawals: SimulatorWithdrawal[];
}

export interface SimulatorBootstrap {
  branches: SimulatorBranch[];
  branch: SimulatorBranch;
  actor: { login_uuid: string; name: string; role_id: number };
  catalog: SimulatorProduct[];
  tables: SimulatorTable[];
  permissions: SimulatorPermissions;
}

export interface SimulatorSessionSummary {
  session_uuid: string;
  name: string;
  status: string;
  version: number;
  saved_at?: string;
  updated_at?: string;
}

export type SimulatorActionType =
  | "start" | "pause" | "resume" | "reset" | "save" | "restore" | "mode" | "tick"
  | "open_table" | "guests" | "add_item" | "edit_item" | "cancel_item" | "confirm"
  | "kitchen_ready" | "serve" | "printer_fail" | "printer_retry" | "transfer" | "merge"
  | "split" | "discount" | "pay" | "cleanup" | "request_bill" | "assign_customer" | "customer_create" | "customer_update" | "deposit_create" | "deposit_withdraw" | "visit_create" | "visit_revoke" | "visit_scan" | "visit_add_item" | "visit_edit_item" | "visit_delete_item" | "visit_submit";

export interface SimulatorAction {
  operation_uuid: string;
  expected_version: number;
  type: SimulatorActionType;
  payload: Record<string, unknown>;
}
