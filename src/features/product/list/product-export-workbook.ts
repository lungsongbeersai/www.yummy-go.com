import type { WorkBook } from "xlsx";
import type { Product, ProductDetail } from "@/services/product";

type XlsxModule = typeof import("xlsx");
type ExportCell = string | number;

const NORMAL_HEADERS = [
  "Product Code",
  "Product Name (Lao)",
  "Product Name (English)",
  "Category",
  "Unit",
  "Size Name",
  "Cost Price",
  "Sale Price",
];

const SET_HEADERS = [
  "Product Code",
  "Set Name (Lao)",
  "Set Name (English)",
  "Category",
  "Unit",
  "Set Option / Product Name",
  "Cost Price",
  "Set Price",
];

export function createProductExportWorkbook(
  XLSX: XlsxModule,
  products: readonly Product[],
): WorkBook {
  const normalRows: ExportCell[][] = [NORMAL_HEADERS];
  const setRows: ExportCell[][] = [SET_HEADERS];

  products.forEach((product) => {
    const isSet = String(product.status_sort_fk ?? "1") === "2";
    const target = isSet ? setRows : normalRows;
    const details: (ProductDetail | undefined)[] = product.details?.length
      ? product.details
      : [undefined];

    details.forEach((detail, index) => {
      // The importer starts a new product whenever an identity column is filled.
      const identity = index === 0
        ? [
          text(product.prod_code),
          text(product.prod_name_la, product.prod_name, product.prod_name_eng),
          text(product.prod_name_eng, product.prod_name, product.prod_name_la),
          text(product.cate_name_la, product.cate_name, product.cate_name_eng),
          text(product.unite_name_la, product.unite_name, product.unite_name_eng),
        ]
        : ["", "", "", "", ""];

      target.push([
        ...identity,
        text(detail?.size_name_la, detail?.size_name, detail?.size_name_eng),
        amount(detail?.pro_detail_bprice),
        amount(isSet ? product.prod_set_price : detail?.pro_detail_sprice ?? product.prod_price),
      ]);
    });
  });

  const workbook = XLSX.utils.book_new();
  for (const [name, rows] of [["Normal", normalRows], ["Set", setRows]] as const) {
    // String values stay string cells, including values beginning with "=".
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet["!cols"] = [22, 32, 32, 24, 18, 32, 18, 18].map((wch) => ({ wch }));
    sheet["!autofilter"] = { ref: `A1:H${rows.length}` };
    XLSX.utils.book_append_sheet(workbook, sheet, name);
  }
  return workbook;
}

function text(...values: unknown[]): string {
  for (const value of values) {
    const cleaned = String(value ?? "").trim();
    if (cleaned) return cleaned;
  }
  return "";
}

function amount(value: unknown): number {
  const parsed = Number(String(value ?? 0).replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}
