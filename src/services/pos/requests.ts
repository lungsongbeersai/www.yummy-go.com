import { apiRequest } from "@/lib/api";
import { langParam } from "@/services/shared/request-helpers";
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
  SplitBillInput,
  SplitBillResponse,
  TableQRResponse,
  UpdateOrderNoteInput,
  UpdateOrderNoteResponse,
  UpdateQtyInput,
  UpdateQtyResponse
} from "@/services/pos/types";

export async function getPosTables(params: FetchPosParams) {
  requiredText(params.branch_uuid_fk, "branch_uuid_fk");
  return apiRequest<PosResponse>("get", "/api/v1/pos/fetch_table", {
    params: { ...params, lang: langParam(params.lang) }
  });
}

export async function fetchCateProducts(params: FetchCateProductsParams) {
  requiredText(params.branch_uuid_fk, "branch_uuid_fk");
  return apiRequest<FetchCateProductsResponse>("get", "/api/v1/pos/fetch_cate_products", {
    params: { ...params, lang: langParam(params.lang), search: params.search ?? "" }
  });
}

export async function getProdItem(params: GetProdItemParams) {
  const result = await apiRequest<{ data: ProdItem }>("post", "/api/v1/pos/get_prod_item", {
    data: { prod_uuid: params.prod_uuid, lang: langParam(params.lang) }
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
    params: { ...params, lang: langParam(params.lang) }
  });

export const deleteOrderItem = (order_item_uuid: string) =>
  apiRequest<DeleteOrderItemResponse>("delete", "/api/v1/pos/delete_order_item", {
    params: { order_it_uuid: order_item_uuid }
  });

export const fetchJoinMoveTables = (params: FetchJoinMoveTableParams) =>
  apiRequest<FetchJoinMoveTableResponse>("get", "/api/v1/pos/fetch_join_move_table", {
    params: { ...params, lang: langParam(params.lang) }
  });

export const moveTable = (input: MoveTableInput) =>
  apiRequest<MoveTableResponse>("post", "/api/v1/pos/move_table", { data: input });

export const joinTableMulti = (input: JoinTableMultiInput) =>
  apiRequest<JoinTableMultiResponse>("post", "/api/v1/pos/join_table_multi", { data: input });

export const getTableQR = (table_uuid: string) =>
  apiRequest<TableQRResponse>("get", "/api/v1/pos/admin/create_table_qr", {
    params: { table_uuid, lang: langParam() }
  });

export const confirmToKitchen = (input: ConfirmToKitchenInput) =>
  apiRequest<ConfirmToKitchenResponse>("patch", "/api/v1/pos/confirm_to_kitchen", { data: input });

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
    data: { ...input, lang: langParam(input.lang) }
  });

export const splitBill = (input: SplitBillInput) =>
  apiRequest<SplitBillResponse>("post", "/api/v1/pos/split_bill", { data: input });

export const createTableQR = (params: CreateTableQRRequest) =>
  apiRequest<CreateTableQRResponse>("get", "/api/v1/pos/admin/create_table_qr", {
    params: {
      table_uuid: params.table_uuid,
      lang: langParam(params.lang),
      login_uuid_fk: params.login_uuid_fk
    }
  });

export const printInvoice = (params: PrintInvoiceRequest) =>
  apiRequest<PrintInvoiceResponse>("post", "/api/v1/pos/print_invoice", {
    data: { ...params, lang: langParam(params.lang) }
  });

export function cartOrdersToHistory(orders: CartOrder[]): OrderHistory[] {
  return orders.map((order, index) => ({
    id: index + 1,
    timestamp: String(order.created_at ?? new Date().toISOString()),
    items: (order.items ?? []) as OrderItem[],
    subtotal: Number(order.totals?.subtotal ?? order.totals?.total ?? 0)
  }));
}
