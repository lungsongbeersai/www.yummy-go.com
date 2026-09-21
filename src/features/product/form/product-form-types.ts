import type { Product, SizeOption } from "@/services/product";
import type { Size } from "@/services/size";

export type StatusSortFk = "1" | "2" | "3";
export type BinaryFlag = "1" | "2";
export type DetailStockSummary = "deduct" | "noDeduct" | "mixed";

export type SizeSelectOption =
  | Size
  | SizeOption
  | NonNullable<Product["details"]>[number];

// กลุ่มตัวเลือกในชุดอาหาร (เช่น "ກ້ຽວທອດຈຳໂບ້": ไก่/หมู) ไม่มีหน้าจัดการแยก —
// ใส่ชื่อกลุ่มในแต่ละแถว และแถวที่ใช้ชื่อเดียวกันจะถูกจับกลุ่มอัตโนมัติตอนบันทึก
// (ดู buildChoiceGroupsPayload ใน product-form-utils.ts)
export type SetChoiceGroupMode = "none" | "one" | "many";

export interface DetailRow {
  id: string;
  pro_detail_uuid: string;
  size_uuid_fk: string;
  pro_detail_bprice: string;
  pro_detail_sprice: string;
  pro_detail_qty_stock: string;
  pro_detail_stock: BinaryFlag;
  pro_detail_setqty_cut_stock: string;
  pro_detail_enabled: BinaryFlag;
  pro_detail_status: BinaryFlag;
  pro_detail_cus_qtyBuy: string;
  pro_detail_cus_qtyFree: string;
  pro_detail_sDate: string;
  pro_detail_eDate: string;
  pro_detail_sTime: string;
  pro_detail_eTime: string;
  // "none" = ไม่มีกลุ่ม (บังคับรวมเหมือนเดิม) — เฉพาะสินค้าแบบ Set (statusSortFk "2")
  set_choice_group_mode: SetChoiceGroupMode;
  // ชื่อกลุ่มที่แถวนี้เป็นสมาชิก (0 ตัวขึ้นไป) — มีความหมายเมื่อ mode ไม่ใช่ "none" เท่านั้น
  set_choice_group_names: string[];
  // น้ำจิ้ม/รสชาติที่เลือกได้เฉพาะเมื่อเลือก detail นี้ในสินค้า Set
  set_taste_max_select: string;
  set_taste_uuid_fks: string[];
}

export interface ToppingSelection {
  topping_uuid_fk: string;
  topping_price: string;
}

export interface TasteSelection {
  taste_uuid: string;
  taste_sort: number;
}

export interface RequiredProductFormState {
  prodNameLa: string;
  cateUuidFk: string;
  uniteUuidFk: string;
  details: DetailRow[];
  statusSortFk: StatusSortFk;
  prodToppingStatus: BinaryFlag;
  selectedToppings: ToppingSelection[];
  prodTasteMaxSelect?: string;
  selectedTastes?: TasteSelection[];
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
  prodToppingMaxSelect?: string;
}
