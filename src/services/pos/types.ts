import type { ApiEntity } from "@/services/shared/types";
import {
  OrderChannelEnum as OrderChannelEnumValue,
  OrderSourceEnum as OrderSourceEnumValue,
  PaymentMethod as PaymentMethodValue,
  ProductImageStatus as ProductImageStatusValue,
  ProductSortStatus as ProductSortStatusValue,
  TableStatus as TableStatusValue,
} from "@/config/pos-constants";
import type {
  OrderChannel as OrderChannelType,
  OrderSource as OrderSourceType,
  PaymentMethod as PaymentMethodType,
  ProductImageStatus as ProductImageStatusType,
  ProductSortStatus as ProductSortStatusType,
  TableStatus as TableStatusType,
} from "@/config/pos-constants";

export const ProductSortStatus = ProductSortStatusValue;
export type ProductSortStatus = ProductSortStatusType;
export const ProductImageStatus = ProductImageStatusValue;
export type ProductImageStatus = ProductImageStatusType;
export const TableStatus = TableStatusValue;
export type TableStatus = TableStatusType;
export const OrderSourceEnum = OrderSourceEnumValue;
export type OrderSource = OrderSourceType;
export const OrderChannelEnum = OrderChannelEnumValue;
export type OrderChannel = OrderChannelType;
export const PaymentMethod = PaymentMethodValue;
export type PaymentMethod = PaymentMethodType;

export interface PosTable extends ApiEntity {
  table_uuid: string;
  table_name: string;
  table_status: number;
  datetime_in?: string | null;
  number_of_seats?: number | string | null;
  customer_order_state?: boolean;
}
export interface PosZone extends ApiEntity {
  zone_uuid: string;
  zone_name: string;
  tables: PosTable[];
}
export interface PosResponse extends ApiEntity {
  status: string;
  message: string;
  data: PosZone[];
}
export interface FetchPosParams {
  branch_uuid_fk: string;
  zone_uuid?: string;
  lang?: string;
}
export interface EmitTableStatusResponse extends ApiEntity { ok?: boolean; customer_order_state?: boolean }
export interface ProdDetail extends ApiEntity {
  pro_detail_uuid: string;
  pro_detail_id?: string | number;
  pro_detail_sort?: string | number;
  size_uuid_fk?: string;
  size_name?: string;
  price?: string | number;
  pro_detail_sprice?: string | number;
  qty_stock?: number;
  pro_detail_qty_stock?: number | string;
  pro_detail_enabled?: number;
  pro_detail_status?: number;
  cut_stock?: number;
  pro_detail_cus_qtyBuy?: number;
  pro_detail_cus_qtyFree?: number;
  pro_detail_sDate?: string | null;
  pro_detail_eDate?: string | null;
  pro_detail_sTime?: string | null;
  pro_detail_eTime?: string | null;
  default_qty?: number;
}
export interface ProdTopping extends ApiEntity {
  prod_topping_uuid: string;
  topping_uuid_fk?: string;
  topping_uuid?: string;
  topping_name?: string;
  topping_name_la?: string;
  topping_name_eng?: string;
  topping_price?: string | number;
  topping_enabled?: number;
  topping_status?: number;
}
export interface ProdItem extends ApiEntity {
  prod_uuid: string;
  prod_code?: string;
  prod_name: string;
  prod_status_imge: ProductImageStatus;
  prod_image: string;
  prod_color?: string;
  prod_price?: number | string;
  type_group?: string;
  unite_name?: string;
  prod_set_price?: number | string | null;
  pro_detail_sprice?: number | string;
  details: ProdDetail[];
  toppings: ProdTopping[];
}
export interface GetProdItemParams {
  prod_uuid: string;
  lang?: string;
  cate_uuid?: string;
  search?: string;
  status_sort_fk?: ProductSortStatus;
}
export interface PosProduct extends ApiEntity {
  prod_uuid: string;
  prod_sort?: number | string;
  prod_name: string;
  prod_image: string;
  prod_status_imge: ProductImageStatus;
  prod_color?: string;
  status_sort_fk: ProductSortStatus;
  status_name?: string;
  promo_state?: string;
  promo_expired?: boolean;
  promo_msg?: string;
  prod_price?: number | string;
}
export interface CateProductItem extends PosProduct {
  pro_detail_sprice?: number | string;
  min_price?: number | string;
  max_price?: number | string;
  can_add: boolean;
  has_options: boolean;
  options_msg: string;
  sold_out_manual?: boolean;
  sold_out_msg?: string;
  stock_sold_out?: boolean;
  stock_available?: boolean;
  count_option_all: number;
  count_option_enabled: number;
  count_topping_enabled: number;
  customer_buy?: number;
  customer_free?: number;
  pro_detail_uuid?: string;
}
export interface CateWithProducts extends ApiEntity {
  cate_uuid: string;
  cate_name: string;
  cate_icon?: string;
  products: CateProductItem[];
}

export interface FetchCateProductsResponse extends ApiEntity {
  status: string;
  message: string;
  lang?: string;
  search?: string;
  branch_uuid_fk?: string;
  special_products?: CateProductItem[];
  total_special?: number;
  selected_cate_uuid?: string;
  data: CateWithProducts[];
  default_cate_uuid?: string;
  total?: number;
}
export interface FetchCateProductsParams { branch_uuid_fk: string; cate_uuid?: string; search?: string; status_sort_fk?: ProductSortStatus; lang?: string }
export interface CartToppingPayload { prod_topping_uuid_fk: string; topping_qty: number }
export interface OrderItemOption { label: string; qty: number; price?: number; type?: "size" | "topping" }
export interface OrderItem extends ApiEntity { id?: number; title?: string; price?: number; quantity?: number }
export interface OrderHistory extends ApiEntity { id: number; timestamp: string; items: OrderItem[]; subtotal: number }
export type CreateOrderTopping = CartToppingPayload;
export interface CreateOrderItem extends ApiEntity {
  prod_detail_uuid_fk: string;
  order_it_qty: number;
  order_it_status: number;
  order_it_note?: string;
  toppings?: CreateOrderTopping[];
  prod_uuid_fk?: string;
  pro_detail_uuid_fk?: string;
  qty?: number;
}
export interface CreateOrderInput extends ApiEntity {
  table_uuid?: string;
  table_uuid_fk: string;
  branch_uuid_fk: string;
  order_created_by: string;
  order_source: OrderSource;
  order_channel: OrderChannel;
  order_service_rate: number;
  order_vat_rate: number;
  login_uuid_fk?: string;
  lang?: string;
  items: CreateOrderItem[];
}
export interface CreateOrderResponse extends ApiEntity { status: string; message: string; order_uuid?: string }
export type ChangeType = "INCREASE" | "DECREASE";
export interface UpdateQtyInput { order_item_uuid: string; change_type: ChangeType; change_qty: number }
export interface UpdateQtyResponse extends ApiEntity {}
export type DiscountTypeCode = "PCT" | "AMT";
export interface ItemDiscountInput extends ApiEntity {
  order_item_uuid: string;
  order_it_discount_type: DiscountTypeCode;
  order_it_discount_value: number;
}
export interface ItemDiscountResponse extends ApiEntity {}
export interface BillDiscountInput extends ApiEntity {
  order_uuid: string;
  order_discount_type: DiscountTypeCode;
  order_discount_value: number;
}
export interface BillDiscountResponse extends ApiEntity {}
export interface CartTotals extends ApiEntity {
  total?: number;
  subtotal?: number;
  vat_rate?: number;
  order_qty?: number;
  order_total?: number;
  order_subtotal?: number;
  order_discount_amount?: number;
  order_item_discount_amount?: number;
  order_service_amount?: number;
  order_vat_amount?: number;
  order_grand_total?: number;
}
export interface CartTopping extends ApiEntity {
  prod_topping_uuid?: string;
  prod_topping_uuid_fk?: string;
  topping_name?: string;
  topping_qty?: number;
  topping_price?: number;
  topping_line_total?: number;
}
export interface CartItemDetail extends ApiEntity {
  size_name?: string;
  order_it_qty?: number;
  order_it_promo_sale_qty?: number;
  order_it_promo_free_qty?: number;
  total_receive_qty?: number;
  sale_qty?: number;
  free_qty?: number;
  unit_price?: number;
  topping_unit_total?: number;
  base_line_total?: number;
  topping_line_total?: number;
  order_it_discount_type?: string;
  order_it_discount_value?: number;
  order_it_discount_amount?: number;
  gross_total?: number;
  net_total?: number;
  order_it_note?: string;
  order_it_status?: number;
  order_it_status_text?: string;
  affects_total?: boolean;
}
export interface CartItem extends ApiEntity {
  order_item_uuid?: string;
  order_it_uuid?: string;
  prod_uuid?: string;
  prod_uuid_fk?: string;
  pro_detail_uuid?: string;
  pro_detail_uuid_fk?: string;
  prod_name?: string;
  title?: string;
  prod_image?: string;
  prod_status_imge?: number;
  qty?: number;
  total?: number;
  detail?: CartItemDetail;
  toppings?: CartTopping[];
}
export interface CartOrder extends ApiEntity {
  order_uuid: string;
  order_invoice?: string;
  table_uuid_fk?: string;
  table_name_la?: string;
  table_name_eng?: string;
  charge_status?: number;
  table_call_waiter?: number;
  branch_vat_status?: number;
  vat_name?: number;
  branch_charge_status?: number;
  charge_name?: number;
  branch_qr?: string;
  vat_enabled?: boolean;
  service_enabled?: boolean;
  order_discount_type?: string | number;
  order_discount_value?: number;
  items?: CartItem[];
  totals?: CartTotals;
  sum_detail_total?: number;
  sum_topping_total?: number;
  sum_discount_total?: number;
  sum_service_total?: number;
  sum_vat_total?: number;
  sum_grand_total?: number;
  service_charge_amount?: number;
  vat_amount?: number;
  vat_rate?: number;
  service_charge_rate?: number;
}
export interface FetchCartStatusRule extends ApiEntity {
  not_confirmed_status?: number;
  total_counts_statuses?: number[];
}
export interface FetchCartResponse extends ApiEntity {
  status: string;
  message: string;
  data?: CartOrder[] | CartOrder;
  orders?: CartOrder[] | CartOrder;
  totals?: CartTotals;
  status_rule?: FetchCartStatusRule;
}
export interface FetchCartParams { table_uuid: string; lang?: string }
export interface MoveTableItem extends ApiEntity {}
export interface MoveTableZone extends ApiEntity { zone_uuid?: string; zone_name?: string; tables?: MoveTableItem[] }
export interface FetchJoinMoveTableParams { branch_uuid_fk?: string; table_status?: number | ""; lang?: string }
export interface FetchJoinMoveTableResponse extends ApiEntity { data?: MoveTableZone[] }
export interface MoveTableInput { from_table_uuid: string; to_table_uuid: string }
export interface MoveTableResponse extends ApiEntity {}
export interface JoinTableMultiInput { from_table_uuids: string[]; to_table_uuid: string }
export interface JoinTableMergedFrom extends ApiEntity {}
export interface JoinTableMultiResponse extends ApiEntity {}
export interface TableQRNextAction extends ApiEntity {
  print_endpoint?: string;
}
export interface TableQRSummary extends ApiEntity {
  table_status?: number;
  branch_uuid_fk?: string;
  zone_uuid_fk?: string;
}
export interface TableQRResponse extends ApiEntity {
  status?: string;
  message?: string;
  lang?: string;
  table_uuid?: string;
  table_name?: string;
  qr_enabled?: boolean;
  qr_ver?: number;
  table_token?: string;
  regenerated?: boolean;
  reused_existing_qr?: boolean;
  next_action?: TableQRNextAction;
  summary?: TableQRSummary;
  qr_url?: string;
  qr_image?: string;
  image_url?: string;
  token?: string;
  qr_token?: string;
  t?: string;
  url?: string;
  public_url?: string;
  menu_url?: string;
  link?: string;
  print_endpoint?: string;
  role_code?: string;
  print_mode?: string;
  print_job?: ConfirmToKitchenPrintJob;
  pending_query?: ConfirmToKitchenPendingQuery;
  ack_template?: ConfirmToKitchenAckTemplate;
  fallback_print?: unknown;
  reason?: string | null;
}
export interface DeleteOrderItemResponse extends ApiEntity {}
export interface UpdateOrderNoteInput { order_it_uuid: string; order_it_note: string }
export interface UpdateOrderNoteResponse extends ApiEntity {}
export interface PaymentInput extends ApiEntity {
  order_uuid: string;
  table_uuid?: string;
  customer_uuid_fk?: string;
  payment_method: PaymentMethod;
  order_channel: OrderChannel;
  amount: number;
  cash_payment_amount: number;
  transfer_payment_amount: number;
  change_amount?: number;
  paid_at?: string | null;
  due_date?: string;
  note?: string;
  lang?: string;
  login_uuid_fk: string;
  device_code?: string;
  agent_id?: string;
  print_mode?: string;
}
export interface PaymentRecord extends ApiEntity {
  payment_uuid?: string;
  order_uuid_fk?: string;
  customer_uuid_fk?: string;
  payment_method?: number;
  amount?: string | number;
  cash_payment_amount?: string | number;
  transfer_payment_amount?: string | number;
  change_amount?: string | number;
  due_date?: string | null;
  payment_status?: number;
  note?: string;
  paid_at?: string;
}
export interface PaymentTotals extends ApiEntity {
  order_grand_total?: number;
  order_balance?: number;
  order_paid_total?: number;
  paid_cash?: number;
  paid_transfer?: number;
  change?: number;
}
export interface PaymentResponse extends ApiEntity {
  status?: string;
  message?: string;
  order_uuid?: string;
  order_invoice?: string;
  payment?: PaymentRecord;
  totals?: PaymentTotals;
  is_fully_paid?: boolean;
  order_check_bill_after?: number;
  order_status_after?: number;
  print_job?: ConfirmToKitchenPrintJob;
  next_action?: ConfirmToKitchenNextAction;
  pending_query?: ConfirmToKitchenPendingQuery;
  ack_template?: ConfirmToKitchenAckTemplate;
  fallback_print?: ApiEntity | null;
}
export interface SplitBillInput extends ApiEntity {
  order_uuid: string;
  table_uuid?: string;
  order_item_uuids: string[];
  document_type: "receipt" | "invoice";
  order_channel: OrderChannel;
  customer_uuid_fk: string;
  payment_method: PaymentMethod;
  amount: number;
  cash_payment_amount: number;
  transfer_payment_amount: number;
  change_amount: number;
  due_date?: string;
  note: string;
  lang: "la" | "en";
  login_uuid_fk: string;
  device_code?: string;
  agent_id?: string;
  print_mode?: string;
}
export interface SplitBillOrderSummary extends ApiEntity {}
export interface SplitBillTotals extends ApiEntity {}
export interface SplitBillPaymentSummary extends ApiEntity {}
export interface SplitBillResponseData extends ApiEntity {
  new_order?: CartOrder;
  source_order?: CartOrder;
}
export interface SplitBillResponse extends ApiEntity {
  status?: string;
  message?: string;
  new_order?: CartOrder;
  new_order_invoice?: string;
  order_invoice?: string;
  payment?: PaymentRecord;
  print_job?: ConfirmToKitchenPrintJob;
  next_action?: ConfirmToKitchenNextAction;
  pending_query?: ConfirmToKitchenPendingQuery;
  ack_template?: ConfirmToKitchenAckTemplate;
  source_order?: CartOrder;
  data?: SplitBillResponseData;
}
export interface ConfirmToKitchenInput {
  order_uuid: string;
  login_uuid_fk: string;
  order_item_uuids?: string[];
  lang?: string;
  device_code?: string;
  agent_id?: string;
  print_mode?: string;
}
export interface ConfirmSummary extends ApiEntity {}
export interface ConfirmToKitchenPrintJob extends ApiEntity {
  print_job_uuid?: string;
  job_status?: string;
  order_uuid?: string;
  requested_total?: number;
  login_uuid_fk?: string;
  agent_id?: string;
  agent_name?: string;
  device_code?: string;
  print_mode?: string;
  print_client?: string;
  print_config_uuid?: string;
  printer_name?: string;
  interface_value?: string;
  printer_type?: string;
  paper_width_mm?: number;
  job_total?: number;
  cut_mode?: string;
  jobs?: ApiEntity[];
  ack_success_payload?: ApiEntity;
  ack_failed_payload?: ApiEntity;
}
export interface ConfirmToKitchenNextAction extends ApiEntity {}
export interface ConfirmToKitchenPendingQuery {
  print_job_uuid: string;
  login_uuid_fk: string;
  device_code?: string;
  agent_id?: string;
  print_mode?: string;
}
export interface ConfirmToKitchenAckTemplate extends ApiEntity {}
export interface ConfirmPartialItem extends ApiEntity {}
export interface ConfirmToKitchenResponse extends ApiEntity {
  status: string;
  message: string;
  order_uuid?: string;
  login_uuid_fk?: string;
  agent_id?: string;
  agent_name?: string;
  device_code?: string;
  print_mode?: string;
  print_client?: string;
  print_config_uuid?: string;
  printer_name?: string;
  interface_value?: string;
  printer_type?: string;
  paper_width_mm?: number;
  job_total?: number;
  cut_mode?: string;
  jobs?: ApiEntity[];
  ack_success_payload?: ApiEntity;
  ack_failed_payload?: ApiEntity;
  print_job?: ConfirmToKitchenPrintJob;
  pending_query?: ConfirmToKitchenPendingQuery;
}
export interface ConfirmOrderItemServedInput { order_it_uuid: string }
export interface CancelOrderItemInput { order_it_uuid: string }
export interface CreateTableQRRequest extends ApiEntity {
  table_uuid: string;
  // optional: เส้นทางดู/รีเฟรช QR (loadTableQr) ไม่ต้องส่ง identity ของเครื่องพิมพ์
  login_uuid_fk?: string;
  lang?: string;
  device_code?: string;
  agent_id?: string;
  print_mode?: string;
}
export interface CreateTableQRResponse extends TableQRResponse {}
export interface PrintInvoiceRequest extends ApiEntity {
  order_uuid: string;
  login_uuid_fk: string;
  lang?: string;
  document_type?: "invoice";
  device_code?: string;
  agent_id?: string;
  print_mode?: string;
}
export interface PrintInvoiceResponse extends ApiEntity {
  status?: string;
  message?: string;
  order_uuid?: string;
  order_invoice?: string;
  print_job?: ConfirmToKitchenPrintJob;
  next_action?: ConfirmToKitchenNextAction;
  pending_query?: ConfirmToKitchenPendingQuery;
  ack_template?: ConfirmToKitchenAckTemplate;
  totals?: PaymentTotals;
  fallback_print?: ApiEntity | null;
}
export interface ReprintReceiptRequest {
  order_uuid: string;
  login_uuid_fk: string;
  lang?: string;
  device_code?: string;
  agent_id?: string;
  print_mode?: string;
}
export interface ReprintReceiptPrintJob {
  print_job_uuid?: string;
}
export interface ReprintReceiptResponse {
  print_job?: ReprintReceiptPrintJob | null;
}
