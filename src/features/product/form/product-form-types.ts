import type { Product, SizeOption } from "@/services/product";
import type { Size } from "@/services/size";

export type StatusSortFk = "1" | "2" | "3";
export type BinaryFlag = "1" | "2";
export type DetailStockSummary = "deduct" | "noDeduct" | "mixed";

export type SizeSelectOption =
  | Size
  | SizeOption
  | NonNullable<Product["details"]>[number];

export interface DetailRow {
  id: string;
  pro_detail_uuid: string;
  size_uuid_fk: string;
  pro_detail_bprice: string;
  pro_detail_sprice: string;
  pro_detail_qty_stock: string;
  pro_detail_stock: BinaryFlag;
  pro_detail_enabled: BinaryFlag;
  pro_detail_status: BinaryFlag;
  pro_detail_cus_qtyBuy: string;
  pro_detail_cus_qtyFree: string;
  pro_detail_sDate: string;
  pro_detail_eDate: string;
  pro_detail_sTime: string;
  pro_detail_eTime: string;
}

export interface ToppingSelection {
  topping_uuid_fk: string;
  topping_price: string;
}

export interface RequiredProductFormState {
  prodNameLa: string;
  cateUuidFk: string;
  uniteUuidFk: string;
  details: DetailRow[];
  statusSortFk: StatusSortFk;
  prodToppingStatus: BinaryFlag;
  selectedToppings: ToppingSelection[];
}

export interface ProductSavePayloadState extends RequiredProductFormState {
  branchUuid: string;
  prodCode: string;
  prodNameEng: string;
  prodOrderPoint: string;
  prodNotification: BinaryFlag;
  prodSetPrice: string;
  prodStatusImge: BinaryFlag;
  prodImage?: File | string;
}
