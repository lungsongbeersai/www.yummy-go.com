import { describe, expect, it } from "vitest";
import type { Category } from "@/services/category";
import type { Product } from "@/services/product";
import type { Size } from "@/services/size";
import type { Unit } from "@/services/unit";
import {
  analyzeProductImportWorkbook,
  buildProductImportDrafts,
  normalizeProductImportKey,
  productImportReferenceNames,
  sheetRowsFromAoA,
} from "./product-import-utils";

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
  it("starts a new product at an explicit identity and only inherits product fields for continuation rows", () => {
    const rows = sheetRowsFromAoA(
      [
        ["Product Code", "Product Name (Lao)", "Product Name (English)", "Category", "Unit", "Size Name", "Cost Price", "Sale Price"],
        ["P-001", "ເຝີ", "Noodle soup", "Noodles", "Bowl", "Regular", "25000", "35000"],
        ["", "", "", "", "", "Large", "", ""],
        ["P-002", "ເຂົ້າ", "Rice", "Noodles", "Bowl", "Regular", "30000", "40000"],
      ],
      ["Product Code", "Product Name (Lao)", "Product Name (English)", "Category", "Unit", "Size Name", "Cost Price", "Sale Price"],
    );

    const analysis = analyzeProductImportWorkbook({
      workbook: { Normal: rows },
      branchUuid: "branch-1",
      existingProducts: [],
      generatedCodeSeed: "AUTO",
    });

    expect(analysis.drafts).toHaveLength(2);
    expect(analysis.drafts[0]).toMatchObject({
      productCode: "P-001",
      productNameLa: "ເຝີ",
      rowNumbers: [2, 3],
      details: [
        { rowNumber: 2, referenceName: "Regular", costPrice: 25000, salePrice: 35000 },
        { rowNumber: 3, referenceName: "Large", costPrice: 0, salePrice: 0 },
      ],
    });
    expect(analysis.drafts[1]).toMatchObject({
      productCode: "P-002",
      productNameLa: "ເຂົ້າ",
      rowNumbers: [4],
    });
  });

  it("normalizes Unicode compatibility forms consistently", () => {
    expect(normalizeProductImportKey("  ＡＢＣ　123  ")).toBe("abc 123");
    expect(normalizeProductImportKey("ＡＢＣ")).toBe(
      normalizeProductImportKey("ABC"),
    );
  });

  it("reports duplicate workbook and database identities and reserves generated codes", () => {
    const rows = sheetRowsFromAoA(
      [
        ["Product Code", "Product Name (Lao)", "Product Name (English)", "Category", "Unit", "Size Name", "Cost Price", "Sale Price"],
        ["", "Generated", "", "Noodles", "Bowl", "Regular", "10", "20"],
        ["AUTO-2", "First", "", "Noodles", "Bowl", "Regular", "10", "20"],
        ["AUTO-2", "Second", "", "Noodles", "Bowl", "Regular", "10", "20"],
        ["DB-1", "Existing name", "", "Noodles", "Bowl", "Regular", "10", "20"],
      ],
      ["Product Code", "Product Name (Lao)", "Product Name (English)", "Category", "Unit", "Size Name", "Cost Price", "Sale Price"],
    );
    const existingProducts = [
      {
        prod_uuid: "existing-1",
        prod_code: "AUTO-1",
        prod_name_la: "Other",
      },
      {
        prod_uuid: "existing-2",
        prod_code: "DB-1",
        prod_name_la: "Existing name",
      },
    ] as Product[];

    const analysis = analyzeProductImportWorkbook({
      workbook: { Normal: rows },
      branchUuid: "branch-1",
      existingProducts,
      generatedCodeSeed: "AUTO",
    });

    expect(analysis.drafts[0]?.productCode).toBe("AUTO-3");
    expect(analysis.drafts[1]?.validationErrors.join(" ")).toMatch(/duplicate.*code/i);
    expect(analysis.drafts[2]?.validationErrors.join(" ")).toMatch(/duplicate.*code/i);
    expect(analysis.drafts[3]?.validationErrors.join(" ")).toMatch(
      /duplicate.*(code|name)/i,
    );
    expect(analysis.referenceNames.categoryNames).toEqual(["Noodles"]);
  });

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
    expect(draft.sizeNames).toEqual(["Regular", "Large"]);
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
    expect(draft.sizeNames).toEqual([
      "Coffee + sandwich",
      "Tea + sandwich",
    ]);
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

  it("keeps missing references importable and collects names for auto-create", () => {
    const rows = sheetRowsFromAoA(
      [
        ["Product Code", "Product Name (Lao)", "Product Name (English)", "Category", "Unit", "Size Name", "Cost Price", "Sale Price"],
        ["", "Unknown", "", "Missing", "Bowl", "Regular", "10", "20"],
      ],
      ["Product Code", "Product Name (Lao)", "Product Name (English)", "Category", "Unit", "Size Name", "Cost Price", "Sale Price"],
    );

    const [draft] = buildProductImportDrafts({ Normal: rows }, references);

    expect(draft.errors).toEqual([]);
    expect(draft.payload).toMatchObject({
      cate_uuid_fk: "",
      unite_uuid_fk: "unit-bowl",
      details: [expect.objectContaining({ size_uuid_fk: "size-regular" })],
    });
    expect(productImportReferenceNames({ Normal: rows })).toEqual({
      categoryNames: ["Missing"],
      unitNames: ["Bowl"],
      normalSizeNames: ["Regular"],
      setSizeNames: [],
    });
  });
});
