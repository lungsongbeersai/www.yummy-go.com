import type { ApiEntity, ApiListResponse, FetchParams } from "@/services/shared/types";

export interface ProductTopping extends ApiEntity {
  prod_topping_uuid?: string;
  topping_uuid?: string;
  topping_uuid_fk?: string;
  topping_price?: number | string;
  topping_status?: number | string;
  topping_name?: string;
  topping_name_la?: string;
  topping_name_eng?: string;
}

export interface ProductDetail extends ApiEntity {
  detail_uuid?: string;
  pro_detail_id?: string;
  pro_detail_uuid?: string;
  prod_detail_uuid?: string;
  product_detail_uuid?: string;
  prod_uuid_fk?: string;
  size_uuid_fk?: string;
  size_name?: string;
  size_name_la?: string;
  size_name_eng?: string;
  pro_detail_bprice?: number | string;
  pro_detail_sprice?: number | string;
  pro_detail_qty_stock?: number | string;
  qty_stock?: number;
  pro_detail_cus_qtyBuy?: number | string;
  pro_detail_cus_qtyFree?: number | string;
  pro_detail_status?: number | string;
  pro_detail_sDate?: string | null;
  pro_detail_eDate?: string | null;
  pro_detail_sTime?: string | null;
  pro_detail_eTime?: string | null;
  pro_detail_stock?: number | string;
  pro_detail_setqty_cut_stock?: number | string;
  pro_detail_enabled?: number | string;
  pro_detail_enabled_text?: string;
}

export interface ProductDetailFormInput extends ApiEntity {}

export interface Product extends ApiEntity {
  prod_uuid: string;
  prod_name?: string;
  prod_name_la?: string;
  prod_name_eng?: string;
  prod_code?: string;
  prod_price?: number | string;
  prod_order_point?: number | string;
  prod_notification?: number | string;
  status_sort_fk?: number | string;
  status_name?: string;
  prod_set_price?: number | string | null;
  prod_status_imge?: number | string;
  prod_topping_status?: number | string;
  prod_image?: string;
  prod_image_raw?: string;
  branch_uuid_fk?: string;
  branch_name?: string;
  cate_uuid_fk?: string;
  cate_name?: string;
  cate_name_la?: string;
  cate_name_eng?: string;
  unite_uuid_fk?: string;
  unite_name?: string;
  unite_name_la?: string;
  unite_name_eng?: string;
  details?: ProductDetail[];
  toppings?: ProductTopping[];
}

export type ProductResponse = ApiListResponse<Product>;

export interface SaveProductDetailInput extends ApiEntity {
  pro_detail_uuid?: string;
  size_uuid_fk: string;
  pro_detail_bprice: number;
  pro_detail_sprice?: number;
  pro_detail_qty_stock: number;
  pro_detail_stock: number;
  pro_detail_enabled?: number | string;
  pro_detail_status?: number;
  pro_detail_cus_qtyBuy?: number;
  pro_detail_cus_qtyFree?: number;
  pro_detail_sDate?: string;
  pro_detail_eDate?: string;
  pro_detail_sTime?: string | null;
  pro_detail_eTime?: string | null;
}

export interface SaveProductToppingInput extends ApiEntity {
  topping_uuid_fk: string;
  topping_price: number;
}

export interface SaveProductInput extends ApiEntity {
  prod_uuid?: string;
  cate_uuid_fk?: string;
  unite_uuid_fk?: string;
  prod_code?: string;
  prod_name_la?: string;
  prod_name_eng?: string;
  prod_order_point?: number;
  prod_notification?: number;
  status_sort_fk?: number;
  prod_set_price?: number | null;
  prod_status_imge?: number;
  prod_image?: File | string;
  branch_uuid_fk?: string;
  details?: SaveProductDetailInput[];
  prod_topping_status?: number;
  toppings?: SaveProductToppingInput[];
}

export interface ProductEnabledPatch {
  pro_detail_uuid: string;
  pro_detail_enabled: number;
}

export interface ProductStockModePatch {
  pro_detail_uuid: string;
  pro_detail_stock: number;
}

export interface ProductNotificationPatch {
  prod_uuid: string;
  prod_notification: number;
}

export interface ProductStatusFieldsPatch {
  notification?: ProductNotificationPatch;
  enabled?: ProductEnabledPatch[];
  stockModes?: ProductStockModePatch[];
}

export interface UpdateProductNotificationResponse extends ApiEntity {
  prod_uuid?: string;
  prod_notification?: number | string;
  data?: ProductNotificationPatch;
}

export interface UpdateProductStockModeResponse extends ApiEntity {
  detail_uuid?: string;
  pro_detail_id?: string;
  pro_detail_uuid?: string;
  prod_detail_uuid?: string;
  product_detail_uuid?: string;
  pro_detail_stock?: number | string;
  data?: ProductStockModePatch;
}

export interface UpdateProductEnabledResponse extends ApiEntity {
  detail_uuid?: string;
  pro_detail_id?: string;
  pro_detail_uuid?: string;
  prod_detail_uuid?: string;
  product_detail_uuid?: string;
  pro_detail_enabled?: number | string;
  data?: ProductEnabledPatch;
}

export interface ProductFormInput extends ApiEntity {}

export interface FetchProductsParams extends FetchParams {
  branch_uuid_fk?: string;
  cate_uuid_fk?: string;
  status_sort_fk?: number;
}

export interface StatusSort extends ApiEntity {
  status_sort: number;
  status_name?: string;
}

export interface SizeOption extends ApiEntity {
  size_uuid: string;
  size_name?: string;
}
