import type { ApiEntity } from "@/services/shared/types";
import {
  OrderChannelEnum as OrderChannelEnumValue,
  OrderItemStatus as OrderItemStatusValue,
  OrderSourceEnum as OrderSourceEnumValue,
  PaymentMethod as PaymentMethodValue,
  ProductImageStatus as ProductImageStatusValue,
  ProductSortStatus as ProductSortStatusValue,
  TableStatus as TableStatusValue,
} from "@/config/pos-constants";
import type {
  OrderChannel as OrderChannelType,
  OrderItemStatus as OrderItemStatusType,
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
export const OrderItemStatus = OrderItemStatusValue;
export type OrderItemStatus = OrderItemStatusType;
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
export interface ProdDetail {
  proDetailUuid: string;
  proDetailId?: string | number;
  proDetailSort?: string | number;
  sizeUuidFk?: string;
  sizeName?: string;
  price?: string | number;
  proDetailSprice?: string | number;
  qtyStock?: number;
  proDetailQtyStock?: number | string;
  proDetailEnabled?: number;
  proDetailStatus?: number;
  cutStock?: number;
  proDetailCusQtyBuy?: number;
  proDetailCusQtyFree?: number;
  proDetailSDate?: string | null;
  proDetailEDate?: string | null;
  proDetailSTime?: string | null;
  proDetailETime?: string | null;
  defaultQty?: number;
}
export interface ProdTopping {
  prodToppingUuid: string;
  toppingUuidFk?: string;
  toppingUuid?: string;
  toppingName?: string;
  toppingNameLa?: string;
  toppingNameEng?: string;
  toppingPrice?: string | number;
  toppingEnabled?: number;
  toppingStatus?: number;
}
export interface ProdItem {
  prodUuid: string;
  prodCode?: string;
  prodName: string;
  prodStatusImge: ProductImageStatus;
  prodImage: string;
  prodColor?: string;
  prodPrice?: number | string;
  typeGroup?: string;
  uniteName?: string;
  prodSetPrice?: number | string | null;
  proDetailSprice?: number | string;
  statusSortFk?: ProductSortStatus;
  details: ProdDetail[];
  toppings: ProdTopping[];
}
export interface GetProdItemParams {
  prodUuid: string;
  lang?: string;
  cateUuid?: string;
  search?: string;
  statusSortFk?: ProductSortStatus;
}
export interface PosProduct {
  prodUuid: string;
  prodCode?: string;
  prodSort?: number | string;
  prodName: string;
  prodImage: string;
  prodStatusImge: ProductImageStatus;
  prodColor?: string;
  statusSortFk: ProductSortStatus;
  statusName?: string;
  promoState?: string;
  promoExpired?: boolean;
  promoMsg?: string;
  prodPrice?: number | string;
  typeGroup?: string;
  uniteName?: string;
  prodSetPrice?: number | string | null;
}
export interface CateProductItem extends PosProduct {
  proDetailSprice?: number | string;
  minPrice?: number | string;
  maxPrice?: number | string;
  canAdd: boolean;
  hasOptions: boolean;
  optionsMsg: string;
  soldOutManual?: boolean;
  soldOutMsg?: string;
  stockSoldOut?: boolean;
  stockAvailable?: boolean;
  countOptionAll: number;
  countOptionEnabled: number;
  countToppingEnabled: number;
  customerBuy?: number;
  customerFree?: number;
  proDetailUuid?: string;
}
export interface CateWithProducts {
  cateUuid: string;
  cateName: string;
  cateIcon?: string;
  products: CateProductItem[];
}

export interface FetchCateProductsResponse {
  status: string;
  message: string;
  lang?: string;
  search?: string;
  branchUuidFk?: string;
  specialProducts?: CateProductItem[];
  totalSpecial?: number;
  selectedCateUuid?: string;
  categories: CateWithProducts[];
  defaultCateUuid?: string;
  total?: number;
}
export interface FetchCateProductsParams { branchUuidFk: string; cateUuid?: string; search?: string; statusSortFk?: ProductSortStatus; lang?: string }
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
  table_uuid_fk?: string;
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
export interface InitOrderWithoutTableInput extends ApiEntity {
  branch_uuid_fk: string;
  order_source: OrderSource;
  order_channel: OrderChannel;
}
// ร้านไม่มีโต๊ะ (store_table_status === 2): backend ผูก "บิลที่เปิดค้างอยู่" กับ
// login token ของแคชเชียร์เอง — เรียกตอนเข้าหน้าออเดอร์เพื่อสร้างบิลใหม่ (created)
// หรือดึงบิลเดิมที่ยังไม่จ่ายเงินกลับมาต่อ (resumed) แทนการ persist order_uuid ฝั่ง client
export interface InitOrderWithoutTableResponse extends ApiEntity {
  status: string;
  message: string;
  created: boolean;
  resumed: boolean;
  mode: string;
  order_uuid: string;
  order_invoice?: string;
  branch_uuid_fk?: string;
  table_uuid_fk?: string | null;
  order_created_by?: string;
  order_status?: number;
  order_check_bill?: number;
  order_qty?: number;
  order_total?: number;
  order_grand_total?: number;
  order_paid_total?: number;
  order_balance?: number;
  store_uuid_fk?: string;
  store_table_status?: number;
  use_table?: boolean;
  show_table?: boolean;
}
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
// ร้านมีโต๊ะ query ด้วย table_uuid; ร้านไม่มีโต๊ะ (store_table_status === 2)
// query ด้วย order_uuid ของบิลปัจจุบัน + branch_uuid_fk แทน
export type FetchCartParams =
  | { table_uuid: string; lang?: string }
  | { order_uuid: string; branch_uuid_fk: string; lang?: string };
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
  payment_currency?: "LAK" | "THB" | "USD";
  foreign_paid?: string | number;
  foreign_cash_paid?: string | number;
  foreign_transfer_paid?: string | number;
  settle_exact?: boolean;
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
  payment_currency?: "LAK" | "THB" | "USD";
  exchange_rate?: string | number;
  foreign_paid?: string | number;
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
  payment_currency?: "LAK" | "THB" | "USD";
  foreign_paid?: string | number;
  foreign_cash_paid?: string | number;
  foreign_transfer_paid?: string | number;
  settle_exact?: boolean;
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
// device_code/agent_id/print_mode/cancel_reason เป็น optional เพราะ endpoint เดียวกันนี้
// ถูกเรียกจากตะกร้า POS แบบเดิม (order_it_uuid อย่างเดียว ไม่มี field พวกนี้) ด้วย
export interface CancelOrderItemInput {
  order_it_uuid: string;
  // ต้องมีให้ resolvePosPrinterContext() หา printer ก่อนพิมพ์ใบเสร็จยกเลิกได้ — เป็น optional
  // เพราะ pos-order-queue-store เรียก endpoint นี้ตรง ๆ (resolve printer เองแยกต่างหากอยู่แล้ว)
  login_uuid_fk?: string;
  device_code?: string;
  agent_id?: string;
  print_mode?: string;
  cancel_reason?: string;
  lang?: string;
}
// print_job/pending_query เหมือน ConfirmToKitchenResponse — แต่พิมพ์ผ่าน executeInvoicePrintJobs
// (ack:false) ไม่ใช่ executeKitchenPrintJobs (ack:true) เพราะ cancel_order_item เปลี่ยนสถานะ
// order item เสร็จสิ้นไปแล้วที่ตัว PATCH เอง ใบเสร็จยกเลิกที่พิมพ์ตามมาเป็นแค่เอกสารพิสูจน์
// ไม่ใช่ trigger เปลี่ยนสถานะเพิ่มเติมแบบใบสั่งครัว
export interface CancelOrderItemResponse extends ApiEntity {
  status: string;
  message: string;
  print_job?: ConfirmToKitchenPrintJob;
  pending_query?: ConfirmToKitchenPendingQuery;
}

export interface ConfirmOrderItemsServedInput {
  order_item_uuids: string[];
  lang?: string;
}

// ยืนยันจาก response จริงของ backend (2026-08-24) — endpoint นี้ตอบ envelope มาตรฐาน
// { status: "success" | "error" } ไม่ใช่ status ตัวเลขแบบที่เอกสารเก่าระบุไว้ และคืนข้อมูล
// "ทุก section" กลับมาพร้อมกันเสมอ (ไม่ filter ตาม query `status` — query แค่กำหนดว่า section
// ไหนตั้ง selected: true) แต่ละ order รวม item ไว้เป็น items[] ซ้อนอยู่ข้างใน ไม่ใช่ item
// รายตัวแบบ flat ต้อง flatten เอาเองฝั่ง frontend (ดู order-queue-normalizers.ts)
export interface OrderQueueItem {
  order_item_uuid: string;
  order_item_status: number;
  product_name: string;
  // อาจเป็น URL รูปสินค้า หรือ hex color (เช่น "#10B981") เมื่อสินค้าไม่มีรูป — ดูตัวอย่างการ
  // แยกสองแบบนี้ใน pos/table-selection/cart-items.tsx (cartItemMedia)
  product_image: string;
  qty: number;
  note: string;
  kitchen_print_queued: boolean;
  can_send_to_kitchen: boolean;
  can_confirm_served: boolean;
}
// ร้านไม่มีโต๊ะ (store_table_status === 2) ทำให้ order.table เป็น null ได้
export interface OrderQueueOrderTable {
  table_uuid: string;
  table_name: string;
  table_status: number;
}
export interface OrderQueueOrder {
  order_uuid: string;
  invoice: string;
  table: OrderQueueOrderTable | null;
  items: OrderQueueItem[];
}
export interface OrderQueueSection {
  key: string;
  title: string;
  status: number;
  total: number;
  selected: boolean;
  // มีแค่ section ที่ selected: true (ตรงกับ query `status`) เท่านั้นที่ orders[] จะมีข้อมูลจริง
  // — section อื่นได้ total ที่ถูกต้อง (ใช้ทำ badge ได้) แต่ orders เป็น [] เสมอแม้ total > 0
  // ดังนั้นต้อง fetch ใหม่ทุกครั้งที่สลับ tab จะเอา orders มา flatten ไม่ได้จาก response เก่า
  orders: OrderQueueOrder[];
}
export interface FetchOrderQueueParams {
  branch_uuid_fk: string;
  status: number;
  lang?: string;
}
export interface FetchOrderQueueResponse {
  status: string;
  message: string;
  selected: string;
  sections: OrderQueueSection[];
}
// แถวที่ flatten แล้ว — รวม context ระดับ order (table_name/invoice) เข้ากับ item แต่ละตัว
// เพราะหน้า order-queue ต้องการโครงสร้าง flat หนึ่งแถวต่อหนึ่ง order_item (แต่ยัง group กลับ
// เป็นก้อนต่อออเดอร์ได้ตาม order_uuid — ดู groupOrderQueueRows ใน order-queue-view.ts)
export interface OrderQueueRow extends ApiEntity {
  order_item_uuid: string;
  order_uuid: string;
  order_invoice: string;
  table_name: string | null;
  order_item_status: number;
  product_name: string;
  product_image: string;
  qty: number;
  note: string;
  kitchen_print_queued: boolean;
  can_send_to_kitchen: boolean;
  can_confirm_served: boolean;
}
export interface SendToKitchenInput {
  order_item_uuids: string[];
  device_code?: string;
  agent_id?: string;
  print_mode?: string;
  lang?: string;
}
export interface SendToKitchenResponse extends ApiEntity {
  status: string;
  message: string;
  login_uuid_fk?: string;
  print_job?: ConfirmToKitchenPrintJob;
  pending_query?: ConfirmToKitchenPendingQuery;
}
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
