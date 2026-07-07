import { describe, expect, it } from "vitest";
import type { Category } from "@/services/category";
import type { Size } from "@/services/size";
import type { Unit } from "@/services/unit";
import { buildProductImportDrafts, sheetRowsFromAoA } from "./product-import-utils";

const references = {
  branchUuid: "branch-1",
  categories: [
    { cate_uuid: "cat-noodle", cate_name_la: "Noodles", cate_name_eng: "Noodles" },
    { cate_uuid: "cat-set", cate_name_la: "Sets", cate_name_eng: "Sets" },
  ] as Category[],
  units: [
    { unite_uuid: "unit-bowl", unite_name_la: "Bowl", unite_name_eng: "Bowl" },
    { unite_uuid: "unit-set", unite_name_la: "Set", unite_name_eng: "Set" },
  ] as Unit[],
  sizes: [
    { size_uuid: "size-regular", size_name_la: "Regular", size_name_eng: "Regular" },
    { size_uuid: "size-large", size_name_la: "Large", size_name_eng: "Large" },
  ] as Size[],
  setSizes: [
    { size_uuid: "set-coffee", size_name_la: "Coffee + sandwich", size_name_eng: "Coffee + sandwich" },
    { size_uuid: "set-tea", size_name_la: "Tea + sandwich", size_name_eng: "Tea + sandwich" },
  ],
};

describe("product import utils", () => {
  it("builds normal product payloads from template rows and ignores template notes", () => {
    const rows = sheetRowsFromAoA(
      [
        ["Normal Product Import"],
        ["Product Code", "Product Name (Lao)", "Product Name (English)", "Category", "Unit", "Size Name", "Cost Price", "Sale Price"],
        ["", "ເຝີ", "Noodle soup", "Noodles", "Bowl", "Regular", "25000", "35000"],
        ["", "", "", "", "", "Large", "30000", "45000"],
        ["Import defaults: no images from Excel"],
      ],
      ["Product Code", "Product Name (Lao)", "Product Name (English)", "Category", "Unit", "Size Name", "Cost Price", "Sale Price"],
    );

    const [draft] = buildProductImportDrafts({ Normal: rows }, references);

    expect(draft.errors).toEqual([]);
    expect(draft.detailCount).toBe(2);
    expect(draft.payload).toMatchObject({
      branch_uuid_fk: "branch-1",
      cate_uuid_fk: "cat-noodle",
      unite_uuid_fk: "unit-bowl",
      prod_status_imge: 2,
      prod_image: "#10B981",
      prod_order_point: 10,
      prod_notification: 1,
      prod_topping_status: 1,
    });
    expect(draft.payload?.details).toEqual([
      expect.objectContaining({ size_uuid_fk: "size-regular", pro_detail_sprice: 35000, pro_detail_qty_stock: 100, pro_detail_stock: 2 }),
      expect.objectContaining({ size_uuid_fk: "size-large", pro_detail_sprice: 45000, pro_detail_qty_stock: 100, pro_detail_stock: 2 }),
    ]);
  });

  it("builds set product payloads with status 2 and set options", () => {
    const rows = sheetRowsFromAoA(
      [
        ["Set Product Import"],
        ["Product Code", "Set Name (Lao)", "Set Name (English)", "Category", "Unit", "Set Option / Product Name", "Cost Price", "Set Price"],
        ["SET-001", "ຊຸດເຊົ້າ", "Breakfast set", "Sets", "Set", "Coffee + sandwich", "25000", "45000"],
        ["", "", "", "", "", "Tea + sandwich", "23000", "45000"],
      ],
      ["Product Code", "Set Name (Lao)", "Set Name (English)", "Category", "Unit", "Set Option / Product Name", "Cost Price", "Set Price"],
    );

    const [draft] = buildProductImportDrafts({ Set: rows }, references);

    expect(draft.errors).toEqual([]);
    expect(draft.payload).toMatchObject({
      status_sort_fk: 2,
      prod_set_price: 45000,
      prod_code: "SET-001",
    });
    expect(draft.payload?.details).toEqual([
      expect.objectContaining({ size_uuid_fk: "set-coffee", pro_detail_status: 2 }),
      expect.objectContaining({ size_uuid_fk: "set-tea", pro_detail_status: 2 }),
    ]);
  });

  it("allows zero cost and sale prices for normal and set product imports", () => {
    const normalRows = sheetRowsFromAoA(
      [
        ["Product Code", "Product Name (Lao)", "Product Name (English)", "Category", "Unit", "Size Name", "Cost Price", "Sale Price"],
        ["", "Zero price item", "", "Noodles", "Bowl", "Regular", "0", "0"],
      ],
      ["Product Code", "Product Name (Lao)", "Product Name (English)", "Category", "Unit", "Size Name", "Cost Price", "Sale Price"],
    );
    const setRows = sheetRowsFromAoA(
      [
        ["Product Code", "Set Name (Lao)", "Set Name (English)", "Category", "Unit", "Set Option / Product Name", "Cost Price", "Set Price"],
        ["SET-002", "Zero price set", "", "Sets", "Set", "Coffee + sandwich", "0", "0"],
      ],
      ["Product Code", "Set Name (Lao)", "Set Name (English)", "Category", "Unit", "Set Option / Product Name", "Cost Price", "Set Price"],
    );

    const [normalDraft, setDraft] = buildProductImportDrafts(
      { Normal: normalRows, Set: setRows },
      references,
    );

    expect(normalDraft.errors).toEqual([]);
    expect(normalDraft.payload?.details?.[0]).toMatchObject({
      pro_detail_bprice: 0,
      pro_detail_sprice: 0,
    });
    expect(setDraft.errors).toEqual([]);
    expect(setDraft.payload?.prod_set_price).toBe(0);
    expect(setDraft.payload?.details?.[0]).toMatchObject({
      pro_detail_bprice: 0,
      pro_detail_status: 2,
    });
  });

  it("reports missing references instead of creating invalid payloads", () => {
    const rows = sheetRowsFromAoA(
      [
        ["Product Code", "Product Name (Lao)", "Product Name (English)", "Category", "Unit", "Size Name", "Cost Price", "Sale Price"],
        ["", "Unknown", "", "Missing", "Bowl", "Regular", "10", "20"],
      ],
      ["Product Code", "Product Name (Lao)", "Product Name (English)", "Category", "Unit", "Size Name", "Cost Price", "Sale Price"],
    );

    const [draft] = buildProductImportDrafts({ Normal: rows }, references);

    expect(draft.payload).toBeNull();
    expect(draft.errors).toContain("Category not found: Missing");
  });
});
