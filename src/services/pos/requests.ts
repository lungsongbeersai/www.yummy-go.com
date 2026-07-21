import { apiRequest } from "@/lib/api";
import { toApiLanguage } from "@/lib/language";
import { normalizeFetchCateProductsResponse } from "@/services/pos/normalizers";
import { requiredItems, requiredText } from "@/services/shared/validators";
import type {
  BillDiscountInput,
  BillDiscountResponse,
  CancelOrderItemInput,
  CartOrder,
  ConfirmOrderItemServedInput,
  ConfirmToKitchenInput,
  ConfirmToKitchenResponse,
  CreateOrderInput,
  CreateOrderResponse,
  CreateTableQRRequest,
  CreateTableQRResponse,
  DeleteOrderItemResponse,
  FetchCartParams,
  FetchCartResponse,
  FetchCateProductsParams,
  FetchCateProductsResponse,
  FetchJoinMoveTableParams,
  FetchJoinMoveTableResponse,
  FetchPosParams,
  GetProdItemParams,
  ItemDiscountInput,
  ItemDiscountResponse,
  JoinTableMultiInput,
  JoinTableMultiResponse,
  MoveTableInput,
  MoveTableResponse,
  OrderHistory,
  OrderItem,
  PaymentInput,
  PaymentResponse,
  PosResponse,
  PrintInvoiceRequest,
  PrintInvoiceResponse,
  ProdItem,
  ReprintReceiptRequest,
  ReprintReceiptResponse,
  SplitBillInput,
  SplitBillResponse,
  UpdateOrderNoteInput,
  UpdateOrderNoteResponse,
  UpdateQtyInput,
  UpdateQtyResponse
} from "@/services/pos/types";

export async function getPosTables(params: FetchPosParams) {
  requiredText(params.branch_uuid_fk, "branch_uuid_fk");
  return apiRequest<PosResponse>("get", "/api/v1/pos/fetch_table", {
    params: { ...params, lang: toApiLanguage(params.lang) }
  });
}

export async function fetchCateProducts(params: FetchCateProductsParams) {
  requiredText(params.branch_uuid_fk, "branch_uuid_fk");
  const response = await apiRequest<FetchCateProductsResponse>("get", "/api/v1/pos/fetch_cate_products", {
    params: { ...params, lang: toApiLanguage(params.lang), search: params.search ?? "" }
  });
  return normalizeFetchCateProductsResponse(response);
}

export async function getProdItem(params: GetProdItemParams) {
  const result = await apiRequest<{ data: ProdItem }>("post", "/api/v1/pos/get_prod_item", {
    data: { prod_uuid: params.prod_uuid, lang: toApiLanguage(params.lang) }
  });
  return result.data;
}

export function createOrder(input: CreateOrderInput) {
  requiredItems(input.items);
  return apiRequest<CreateOrderResponse>("post", "/api/v1/pos/create_order", { data: input });
}

export const updateOrderItemQty = (input: UpdateQtyInput) =>
  apiRequest<UpdateQtyResponse>("patch", "/api/v1/pos/order_item/update_qty", { data: input });

export const applyItemDiscount = (input: ItemDiscountInput) =>
  apiRequest<ItemDiscountResponse>("patch", "/api/v1/pos/item_discount", { data: input });

export const applyBillDiscount = (input: BillDiscountInput) =>
  apiRequest<BillDiscountResponse>("patch", "/api/v1/pos/bill_discount", { data: input });

export const fetchCart = (params: FetchCartParams) =>
  apiRequest<FetchCartResponse>("get", "/api/v1/pos/fetch_cart", {
    params: { ...params, lang: toApiLanguage(params.lang) }
  });

export const deleteOrderItem = (order_item_uuid: string) =>
  apiRequest<DeleteOrderItemResponse>("delete", "/api/v1/pos/delete_order_item", {
    params: { order_it_uuid: order_item_uuid }
  });

export const fetchJoinMoveTables = (params: FetchJoinMoveTableParams) =>
  apiRequest<FetchJoinMoveTableResponse>("get", "/api/v1/pos/fetch_join_move_table", {
    params: { ...params, lang: toApiLanguage(params.lang) }
  });

export const moveTable = (input: MoveTableInput) =>
  apiRequest<MoveTableResponse>("post", "/api/v1/pos/move_table", { data: input });

export const joinTableMulti = (input: JoinTableMultiInput) =>
  apiRequest<JoinTableMultiResponse>("post", "/api/v1/pos/join_table_multi", { data: input });

export const confirmToKitchen = (input: ConfirmToKitchenInput) =>
  apiRequest<ConfirmToKitchenResponse>("patch", "/api/v1/pos/confirm_to_kitchen", {
    data: {
      order_uuid: input.order_uuid,
      login_uuid_fk: input.login_uuid_fk,
      lang: toApiLanguage(input.lang),
      device_code: input.device_code,
      agent_id: input.agent_id,
      print_mode: input.print_mode,
      ...(input.order_item_uuids?.length ? { order_item_uuids: input.order_item_uuids } : {})
    }
  });

export const confirmOrderItemServed = (input: ConfirmOrderItemServedInput) =>
  apiRequest<{ status: string; message: string }>("patch", "/api/v1/pos/confirm_order_item_served", {
    data: input
  });

export const cancelOrderItem = (input: CancelOrderItemInput) =>
  apiRequest<{ status: string; message: string }>("patch", "/api/v1/pos/cancel_order_item", { data: input });

export const updateOrderNote = (input: UpdateOrderNoteInput) =>
  apiRequest<UpdateOrderNoteResponse>("patch", "/api/v1/pos/update_note", { data: input });

export const createPayment = (input: PaymentInput) =>
  apiRequest<PaymentResponse>("post", "/api/v1/pos/payment", {
    data: { ...input, lang: toApiLanguage(input.lang) }
  });

export const splitBill = (input: SplitBillInput) =>
  apiRequest<SplitBillResponse>("post", "/api/v1/pos/split_bill", { data: input });

export const createTableQR = (params: CreateTableQRRequest) =>
  apiRequest<CreateTableQRResponse>("get", "/api/v1/pos/admin/create_table_qr", {
    params: {
      table_uuid: params.table_uuid,
      lang: toApiLanguage(params.lang),
      login_uuid_fk: params.login_uuid_fk,
      device_code: params.device_code,
      agent_id: params.agent_id,
      print_mode: params.print_mode
    }
  });

export const printInvoice = (params: PrintInvoiceRequest) =>
  apiRequest<PrintInvoiceResponse>("post", "/api/v1/pos/print_invoice", {
    data: {
      login_uuid_fk: params.login_uuid_fk,
      order_uuid: params.order_uuid,
      lang: toApiLanguage(params.lang),
      document_type: params.document_type ?? "invoice",
      device_code: params.device_code,
      agent_id: params.agent_id,
      print_mode: params.print_mode
    }
  });

export const reprintReceipt = (params: ReprintReceiptRequest) =>
  apiRequest<ReprintReceiptResponse>("post", "/api/v1/pos/reprint_receipt", {
    data: {
      order_uuid: params.order_uuid,
      login_uuid_fk: params.login_uuid_fk,
      lang: toApiLanguage(params.lang),
      device_code: params.device_code,
      agent_id: params.agent_id,
      print_mode: params.print_mode
    }
  });

export function cartOrdersToHistory(orders: CartOrder[]): OrderHistory[] {
  return orders.map((order, index) => ({
    id: index + 1,
    timestamp: String(order.created_at ?? new Date().toISOString()),
    items: (order.items ?? []) as OrderItem[],
    subtotal: Number(order.totals?.subtotal ?? order.totals?.total ?? 0)
  }));
}
