import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import type { Product } from "@/services/product";
import { createProductExportWorkbook } from "./product-export-workbook";
import { analyzeProductImportWorkbook, sheetRowsFromAoA } from "./product-import-utils";
import { parseProductImportWorkbook } from "./product-import-workbook";

function rows(workbook: XLSX.WorkBook, sheetName: string) {
  return XLSX.utils.sheet_to_json<(string | number)[]>(workbook.Sheets[sheetName], {
    header: 1,
    defval: "",
  });
}

describe("product Excel export", () => {
  it("keeps multiple sizes together when the exported workbook is imported", async () => {
    const workbook = createProductExportWorkbook(XLSX, [{
      prod_uuid: "rice",
      prod_code: "0007",
      prod_name_la: "ເຂົ້າຜັດ",
      prod_name_eng: "Fried rice",
      cate_name_la: "Food",
      unite_name_la: "Plate",
      status_sort_fk: 1,
      details: [
        { size_name_la: "Regular", pro_detail_bprice: "10,000", pro_detail_sprice: "25000" },
        { size_name_la: "Large", pro_detail_bprice: 15000, pro_detail_sprice: 35000 },
      ],
    }]);
    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
    const parsed = await parseProductImportWorkbook({
      name: "products.xlsx",
      size: buffer.byteLength,
      arrayBuffer: async () => buffer,
    });

    expect(parsed.Normal?.slice(1)).toEqual([
      ["0007", "ເຂົ້າຜັດ", "Fried rice", "Food", "Plate", "Regular", 10000, 25000],
      ["", "", "", "", "", "Large", 15000, 35000],
    ]);
    const [headers, ...dataRows] = parsed.Normal ?? [];
    expect(headers).toBeDefined();
    const analysis = analyzeProductImportWorkbook({
      workbook: { Normal: sheetRowsFromAoA([headers, ...dataRows], headers as string[]) },
      branchUuid: "destination",
      existingProducts: [],
      generatedCodeSeed: "AUTO",
    });
    expect(analysis.drafts).toHaveLength(1);
    expect(analysis.drafts[0]).toMatchObject({
      productCode: "0007",
      detailCount: 2,
      sizeNames: ["Regular", "Large"],
      validationErrors: [],
    });
    expect(workbook.Sheets.Normal.G2).toMatchObject({ t: "n", v: 10000 });
    expect(workbook.Sheets.Normal.H3).toMatchObject({ t: "n", v: 35000 });
  });

  it("exports string status 2 as a set with the set price and each option's cost", () => {
    const workbook = createProductExportWorkbook(XLSX, [{
      prod_uuid: "breakfast",
      prod_code: "SET-01",
      prod_name_la: "ຊຸດເຊົ້າ",
      prod_name_eng: "Breakfast set",
      cate_name: "Sets",
      unite_name_eng: "Set",
      status_sort_fk: "2",
      prod_set_price: "45,000",
      details: [
        { size_name: "Coffee + sandwich", pro_detail_bprice: "25000", pro_detail_sprice: 999 },
        { size_name_eng: "Tea + sandwich", pro_detail_bprice: 23000, pro_detail_sprice: 998 },
      ],
    }]);

    const exported = rows(workbook, "Set");
    expect(exported.slice(1)).toEqual([
      ["SET-01", "ຊຸດເຊົ້າ", "Breakfast set", "Sets", "Set", "Coffee + sandwich", 25000, 45000],
      ["", "", "", "", "", "Tea + sandwich", 23000, 45000],
    ]);
    const analysis = analyzeProductImportWorkbook({
      workbook: { Set: sheetRowsFromAoA(exported, exported[0] as string[]) },
      branchUuid: "destination",
      existingProducts: [],
      generatedCodeSeed: "AUTO",
    });
    expect(analysis.drafts).toHaveLength(1);
    expect(analysis.drafts[0]).toMatchObject({
      type: "set",
      detailCount: 2,
      salePrice: 45000,
      validationErrors: [],
      warnings: [],
    });
  });

  it("includes promotion prices in Normal and preserves products with missing details", () => {
    const products: Product[] = [
      {
        prod_uuid: "promotion",
        status_sort_fk: "3",
        prod_name: "Promotion",
        cate_name_eng: "Drinks",
        unite_name: "Glass",
        details: [{ size_name: "Regular", pro_detail_bprice: 0, pro_detail_sprice: 0 }],
      },
      { prod_uuid: "empty-details", prod_name_eng: "No details", prod_price: "12.5" },
    ];
    const workbook = createProductExportWorkbook(XLSX, products);

    expect(rows(workbook, "Normal").slice(1)).toEqual([
      ["", "Promotion", "Promotion", "Drinks", "Glass", "Regular", 0, 0],
      ["", "No details", "No details", "", "", "", 0, 12.5],
    ]);
  });

  it("creates import headers for both sheets when no products exist", () => {
    const workbook = createProductExportWorkbook(XLSX, []);

    expect(workbook.SheetNames).toEqual(["Normal", "Set"]);
    expect(rows(workbook, "Normal")).toEqual([[
      "Product Code", "Product Name (Lao)", "Product Name (English)", "Category",
      "Unit", "Size Name", "Cost Price", "Sale Price",
    ]]);
    expect(rows(workbook, "Set")).toEqual([[
      "Product Code", "Set Name (Lao)", "Set Name (English)", "Category",
      "Unit", "Set Option / Product Name", "Cost Price", "Set Price",
    ]]);
  });

  it("serializes formula-looking names and codes as text instead of executable formulas", () => {
    const strings = ["=HYPERLINK(\"https://example.com\")", "+SUM(1,2)", "-1+2", "@SUM(1,2)"];
    const workbook = createProductExportWorkbook(XLSX, strings.map((value, index) => ({
      prod_uuid: String(index),
      prod_code: value,
      prod_name_la: value,
      prod_name_eng: value,
      cate_name_la: value,
      unite_name_la: value,
      details: [{ size_name_la: value, pro_detail_bprice: "invalid", pro_detail_sprice: "Infinity" }],
    })));
    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
    const parsed = XLSX.read(buffer, { type: "array" });

    strings.forEach((value, index) => {
      for (const column of ["A", "B", "C", "D", "E", "F"]) {
        expect(parsed.Sheets.Normal[`${column}${index + 2}`]).toMatchObject({ t: "s", v: value });
        expect(parsed.Sheets.Normal[`${column}${index + 2}`].f).toBeUndefined();
      }
      expect(parsed.Sheets.Normal[`G${index + 2}`]).toMatchObject({ t: "n", v: 0 });
      expect(parsed.Sheets.Normal[`H${index + 2}`]).toMatchObject({ t: "n", v: 0 });
    });
  });
});
