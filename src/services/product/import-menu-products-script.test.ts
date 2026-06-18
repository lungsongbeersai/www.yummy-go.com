import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import * as XLSX from "xlsx";

interface ProductDetailPayload {
  size_uuid_fk: string;
  pro_detail_bprice: number;
  pro_detail_sprice: number;
  pro_detail_qty_stock: number;
  pro_detail_stock: number;
  pro_detail_enabled: number;
}

interface ProductPayload {
  branch_uuid_fk: string;
  cate_uuid_fk: string;
  unite_uuid_fk: string;
  prod_code: string;
  details: ProductDetailPayload[];
}

interface ImportItem {
  rowNumber: number;
  categoryHeader: string;
  unitName: string;
  payload: ProductPayload;
}

interface SkippedItem {
  rowNumber: number;
  name: string;
  categoryHeader: string;
  reason: string;
}

interface MenuImportScript {
  DEFAULT_BRANCH_UUID: string;
  DEFAULT_SIZE_UUID: string;
  parseMenuRows: (
    rows: unknown[][],
    existingProducts?: Array<Record<string, unknown>>,
  ) => { importable: ImportItem[]; skipped: SkippedItem[] };
  serializePayload: (payload: ProductPayload) => Record<string, unknown>;
}

let script: MenuImportScript;

const excelPath = path.resolve(
  process.cwd(),
  "outputs/menu-units/ລາຍການອາຫານ 2026 - with units.xlsx"
);

function readRows(): unknown[][] {
  const workbook = XLSX.readFile(excelPath);
  const firstSheet = workbook.SheetNames[0];
  return XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], {
    header: 1,
    blankrows: false,
    defval: null
  }) as unknown[][];
}

describe("menu product import script", () => {
  beforeAll(async () => {
    // @ts-expect-error - one-off import script is intentionally plain Node.js.
    script = await import("../../../scripts/import-menu-products.mjs");
  });

  it("parses the Excel menu into product payloads", () => {
    const { importable, skipped } = script.parseMenuRows(readRows());

    expect(importable).toHaveLength(138);
    expect(skipped).toHaveLength(0);

    expect(importable.every((item) => item.payload.branch_uuid_fk === script.DEFAULT_BRANCH_UUID)).toBe(true);
    expect(importable.every((item) => item.payload.cate_uuid_fk)).toBe(true);
    expect(importable.every((item) => item.payload.unite_uuid_fk)).toBe(true);
    expect(importable.every((item) => item.payload.details[0]?.size_uuid_fk === script.DEFAULT_SIZE_UUID)).toBe(true);
    expect(importable.every((item) => item.payload.details[0]?.pro_detail_sprice > 0)).toBe(true);
  });

  it("serializes nested details and toppings for product create FormData", () => {
    const { importable } = script.parseMenuRows(readRows());
    const payload = script.serializePayload(importable[0].payload);

    expect(payload.details).toBe(
      JSON.stringify([
        {
          size_uuid_fk: script.DEFAULT_SIZE_UUID,
          pro_detail_bprice: 50000,
          pro_detail_sprice: 50000,
          pro_detail_qty_stock: 100,
          pro_detail_stock: 1,
          pro_detail_enabled: 1
        }
      ])
    );
    expect(payload.toppings).toBe("[]");
  });

  it("skips existing product names and existing generated codes", () => {
    const { importable, skipped } = script.parseMenuRows(readRows(), [
      { prod_code: "PRD-001", prod_name_la: "ແຈ່ວບອງ" }
    ]);

    expect(importable[0].payload.prod_code).toBe("PRD-002");
    expect(skipped).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "ແຈ່ວບອງ",
          reason: "duplicate_name"
        })
      ])
    );
  });
});
