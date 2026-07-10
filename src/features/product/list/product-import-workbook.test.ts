import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  PRODUCT_IMPORT_WORKBOOK_ERROR_CODES,
  PRODUCT_IMPORT_WORKBOOK_LIMITS,
  parseProductImportWorkbook,
  type ProductImportWorkbookErrorCode,
  type ProductImportWorkbookFile,
} from "./product-import-workbook";

function bufferFile(
  name: string,
  buffer: ArrayBuffer,
  size = buffer.byteLength,
): ProductImportWorkbookFile {
  return {
    name,
    size,
    arrayBuffer: async () => buffer,
  };
}

function workbookFile(
  workbook: XLSX.WorkBook,
  name = "products.xlsx",
  bookType: XLSX.BookType = "xlsx",
) {
  const buffer = XLSX.write(workbook, { bookType, type: "array" }) as ArrayBuffer;
  return bufferFile(name, buffer);
}

function oneCellSheet() {
  return XLSX.utils.aoa_to_sheet([["value"]]);
}

async function expectErrorCode(
  file: ProductImportWorkbookFile,
  code: ProductImportWorkbookErrorCode,
) {
  await expect(parseProductImportWorkbook(file)).rejects.toMatchObject({
    name: "ProductImportWorkbookError",
    code,
  });
}

describe("product import workbook adapter", () => {
  it.each(["products.csv", "products.xlsx.exe", "products"])(
    "rejects unsupported file type %s before parsing",
    async (name) => {
      await expectErrorCode(
        bufferFile(name, new ArrayBuffer(1)),
        PRODUCT_IMPORT_WORKBOOK_ERROR_CODES.invalidFileType,
      );
    },
  );

  it("rejects empty files before parsing", async () => {
    await expectErrorCode(
      bufferFile("products.xlsx", new ArrayBuffer(0)),
      PRODUCT_IMPORT_WORKBOOK_ERROR_CODES.emptyFile,
    );
  });

  it("rejects files larger than 10 MB before reading their contents", async () => {
    let read = false;
    const file: ProductImportWorkbookFile = {
      name: "products.xlsx",
      size: PRODUCT_IMPORT_WORKBOOK_LIMITS.maxBytes + 1,
      arrayBuffer: async () => {
        read = true;
        return new ArrayBuffer(1);
      },
    };

    await expectErrorCode(file, PRODUCT_IMPORT_WORKBOOK_ERROR_CODES.fileTooLarge);
    expect(read).toBe(false);
  });

  it("parses supported product sheets", async () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([["Product Code"], ["P-001"]]),
      "Normal",
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([["Product Code"], ["S-001"]]),
      "Set",
    );

    await expect(parseProductImportWorkbook(workbookFile(workbook, "products.XLSX"))).resolves.toEqual({
      Normal: [["Product Code"], ["P-001"]],
      Set: [["Product Code"], ["S-001"]],
    });
  });

  it("accepts legacy .xls workbooks", async () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, oneCellSheet(), "Normal");

    await expect(
      parseProductImportWorkbook(workbookFile(workbook, "products.xls", "xls")),
    ).resolves.toEqual({ Normal: [["value"]], Set: undefined });
  });

  it("rejects workbooks with more than 10 sheets", async () => {
    const workbook = XLSX.utils.book_new();
    for (let index = 0; index <= PRODUCT_IMPORT_WORKBOOK_LIMITS.maxSheets; index += 1) {
      XLSX.utils.book_append_sheet(workbook, oneCellSheet(), `Sheet${index + 1}`);
    }

    await expectErrorCode(
      workbookFile(workbook),
      PRODUCT_IMPORT_WORKBOOK_ERROR_CODES.tooManySheets,
    );
  });

  it("rejects sheets with more than 10,000 rows", async () => {
    const workbook = XLSX.utils.book_new();
    const worksheet = oneCellSheet();
    worksheet["!ref"] = `A1:A${PRODUCT_IMPORT_WORKBOOK_LIMITS.maxRowsPerSheet + 1}`;
    XLSX.utils.book_append_sheet(workbook, worksheet, "Normal");

    await expectErrorCode(
      workbookFile(workbook),
      PRODUCT_IMPORT_WORKBOOK_ERROR_CODES.tooManyRows,
    );
  });

  it("rejects sheets with more than 200 columns", async () => {
    const workbook = XLSX.utils.book_new();
    const worksheet = oneCellSheet();
    const finalColumn = XLSX.utils.encode_col(PRODUCT_IMPORT_WORKBOOK_LIMITS.maxColumnsPerSheet);
    worksheet["!ref"] = `A1:${finalColumn}1`;
    XLSX.utils.book_append_sheet(workbook, worksheet, "Normal");

    await expectErrorCode(
      workbookFile(workbook),
      PRODUCT_IMPORT_WORKBOOK_ERROR_CODES.tooManyColumns,
    );
  });

  it("wraps file read failures with a stable error code", async () => {
    await expectErrorCode(
      {
        name: "products.xlsx",
        size: 1,
        arrayBuffer: async () => {
          throw new Error("read failed");
        },
      },
      PRODUCT_IMPORT_WORKBOOK_ERROR_CODES.invalidWorkbook,
    );
  });
});
