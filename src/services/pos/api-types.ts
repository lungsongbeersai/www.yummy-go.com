import type {
  ProductImageStatus,
  ProductSortStatus,
} from "@/config/pos-constants";
import type { ApiEntity } from "@/services/shared/types";

export interface ApiProdDetail extends ApiEntity {
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

export interface ApiProdTopping extends ApiEntity {
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

export interface ApiProdItem extends ApiEntity {
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
  prod_topping_max_select?: number | string;
  // ไม่ใช่ทุก endpoint ที่ส่ง status_sort_fk มากับ prod item เดี่ยว (ต่างจาก
  // ApiPosProduct ที่มาจาก listing) — staff POS ใช้ optionalNumber(...) ??
  // activeSort คุมค่า fallback เองอยู่แล้ว เห็น src/features/pos/order-customer/product-classification.ts
  status_sort_fk?: ProductSortStatus;
  // backend อาจไม่ส่ง array เหล่านี้มาเลยในบาง response — mapper ต้อง guard
  details?: ApiProdDetail[];
  toppings?: ApiProdTopping[];
}

export interface ApiPosProduct extends ApiEntity {
  prod_uuid: string;
  prod_code?: string;
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
  type_group?: string;
  unite_name?: string;
  prod_set_price?: number | string | null;
}

export interface ApiCateProductItem extends ApiPosProduct {
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

export interface ApiCateWithProducts extends ApiEntity {
  cate_uuid: string;
  cate_name: string;
  cate_icon?: string;
  products?: ApiCateProductItem[];
}

export interface ApiFetchCateProductsResponse extends ApiEntity {
  status: string;
  message: string;
  lang?: string;
  search?: string;
  branch_uuid_fk?: string;
  special_products?: ApiCateProductItem[];
  total_special?: number;
  selected_cate_uuid?: string;
  data?: ApiCateWithProducts[];
  default_cate_uuid?: string;
  total?: number;
}

export interface ApiProdItemResponse extends ApiEntity {
  data: ApiProdItem;
}
