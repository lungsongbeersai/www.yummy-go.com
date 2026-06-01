import type {
  ConfirmToKitchenResponse,
  CreateOrderResponse,
  DeleteOrderItemResponse,
  FetchCartResponse,
  FetchCateProductsResponse,
  ProdItem,
  UpdateQtyResponse
} from "@/services/pos";

export interface QRScanResponse {
  status: string;
  message: string;
  lang: string;
  table_uuid: string;
  table_name: string;
  table_status: number;
  qr_enabled: boolean;
  branch_uuid_fk: string;
}

export interface PublicStatusSort {
  status_sort: number;
  status: string;
  status_name?: string;
  status_name_la?: string;
  status_name_eng?: string;
}

export interface PublicStatusSortResponse {
  status: string;
  message: string;
  lang: string;
  total: number;
  data: PublicStatusSort[];
}

export interface CustomerFetchCartParams { t: string; lang?: string }

export interface CustomerFetchCateProductsParams {
  t: string;
  lang?: string;
  cate_uuid?: string;
  search?: string;
}

export interface CustomerGetProdItemParams extends CustomerFetchCateProductsParams {
  prod_uuid: string;
  status_sort_fk?: number;
}

export interface CustomerUpdateQtyInput {
  t: string;
  order_item_uuid: string;
  change_type: "INCREASE" | "DECREASE";
  change_qty: number;
}

export interface CustomerDeleteOrderItemParams { t: string; order_it_uuid: string }

export interface CustomerConfirmKitchenInput {
  t: string;
  order_uuid: string;
  order_item_uuids?: string[];
}

export interface CustomerEmitTableStatusParams {
  t: string;
  branch_uuid_fk: string;
  table_uuid: string;
}

export interface CustomerCreateOrderTopping {
  prod_topping_uuid_fk: string;
  topping_qty: number;
}

export interface CustomerCreateOrderItem {
  prod_detail_uuid_fk: string;
  order_it_qty: number;
  order_it_status: number;
  order_it_note?: string;
  toppings?: CustomerCreateOrderTopping[];
}

export interface CustomerCreateOrderInput {
  table_uuid_fk: string;
  branch_uuid_fk: string;
  order_created_by: string;
  order_source: number;
  order_channel: number;
  order_service_rate: number;
  order_vat_rate: number;
  lang?: string;
  items: CustomerCreateOrderItem[];
}

export type CustomerFetchCartResponse = FetchCartResponse;
export type CustomerFetchCateProductsResponse = FetchCateProductsResponse;
export type CustomerGetProdItemResponse = ProdItem;
export type CustomerCreateOrderResponse = CreateOrderResponse;
export type CustomerUpdateQtyResponse = UpdateQtyResponse;
export type CustomerDeleteOrderItemResponse = DeleteOrderItemResponse;
export type CustomerConfirmKitchenResponse = ConfirmToKitchenResponse;
