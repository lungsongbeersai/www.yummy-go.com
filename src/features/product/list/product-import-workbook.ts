import type { WorkBook, WorkSheet } from "xlsx";

type XlsxModule = typeof import("xlsx");

export const PRODUCT_IMPORT_WORKBOOK_LIMITS = {
  maxBytes: 10 * 1024 * 1024,
  maxSheets: 10,
  maxRowsPerSheet: 10_000,
  maxColumnsPerSheet: 200,
} as const;

export const PRODUCT_IMPORT_WORKBOOK_ERROR_CODES = {
  invalidFileType: "invalid-file-type",
  emptyFile: "empty-file",
  fileTooLarge: "file-too-large",
  tooManySheets: "too-many-sheets",
  tooManyRows: "too-many-rows",
  tooManyColumns: "too-many-columns",
  invalidWorkbook: "invalid-workbook",
} as const;

export type ProductImportWorkbookErrorCode =
  (typeof PRODUCT_IMPORT_WORKBOOK_ERROR_CODES)[keyof typeof PRODUCT_IMPORT_WORKBOOK_ERROR_CODES];

export interface ProductImportWorkbookFile {
  readonly name: string;
  readonly size: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
}

export interface ProductImportWorkbookSheets {
  Normal?: unknown[][];
  Set?: unknown[][];
}

interface LimitedWorkSheet extends WorkSheet {
  "!fullref"?: string;
}

const ERROR_MESSAGES: Record<ProductImportWorkbookErrorCode, string> = {
  "invalid-file-type": "Select an .xlsx or .xls file.",
  "empty-file": "The spreadsheet file is empty.",
  "file-too-large": "The spreadsheet file must be 10 MB or smaller.",
  "too-many-sheets": "The workbook can contain at most 10 sheets.",
  "too-many-rows": "Each sheet can contain at most 10,000 rows.",
  "too-many-columns": "Each sheet can contain at most 200 columns.",
  "invalid-workbook": "The spreadsheet file could not be read.",
};

export class ProductImportWorkbookError extends Error {
  constructor(readonly code: ProductImportWorkbookErrorCode) {
    super(ERROR_MESSAGES[code]);
    this.name = "ProductImportWorkbookError";
  }
}

export async function parseProductImportWorkbook(
  file: ProductImportWorkbookFile,
): Promise<ProductImportWorkbookSheets> {
  validateFile(file);

  try {
    const buffer = await file.arrayBuffer();
    validateFileBytes(buffer.byteLength);

    const XLSX = await import("xlsx");
    const workbook = XLSX.read(buffer, {
      type: "array",
      sheetRows: PRODUCT_IMPORT_WORKBOOK_LIMITS.maxRowsPerSheet + 1,
    });

    validateWorkbook(XLSX, workbook);

    return {
      Normal: worksheetRows(XLSX, workbook.Sheets.Normal),
      Set: worksheetRows(XLSX, workbook.Sheets.Set),
    };
  } catch (error) {
    if (error instanceof ProductImportWorkbookError) throw error;
    throw new ProductImportWorkbookError(PRODUCT_IMPORT_WORKBOOK_ERROR_CODES.invalidWorkbook);
  }
}

function validateFile(file: ProductImportWorkbookFile): void {
  if (!/\.(?:xlsx|xls)$/i.test(file.name.trim())) {
    throw new ProductImportWorkbookError(PRODUCT_IMPORT_WORKBOOK_ERROR_CODES.invalidFileType);
  }
  validateFileBytes(file.size);
}

function validateFileBytes(bytes: number): void {
  if (bytes <= 0) {
    throw new ProductImportWorkbookError(PRODUCT_IMPORT_WORKBOOK_ERROR_CODES.emptyFile);
  }
  if (bytes > PRODUCT_IMPORT_WORKBOOK_LIMITS.maxBytes) {
    throw new ProductImportWorkbookError(PRODUCT_IMPORT_WORKBOOK_ERROR_CODES.fileTooLarge);
  }
}

function validateWorkbook(XLSX: XlsxModule, workbook: WorkBook): void {
  if (workbook.SheetNames.length > PRODUCT_IMPORT_WORKBOOK_LIMITS.maxSheets) {
    throw new ProductImportWorkbookError(PRODUCT_IMPORT_WORKBOOK_ERROR_CODES.tooManySheets);
  }

  workbook.SheetNames.forEach((sheetName) => {
    const worksheet = workbook.Sheets[sheetName] as LimitedWorkSheet | undefined;
    const reference = worksheet?.["!fullref"] ?? worksheet?.["!ref"];
    if (!reference) return;

    const range = XLSX.utils.decode_range(reference);
    const rows = range.e.r - range.s.r + 1;
    const columns = range.e.c - range.s.c + 1;

    if (rows > PRODUCT_IMPORT_WORKBOOK_LIMITS.maxRowsPerSheet) {
      throw new ProductImportWorkbookError(PRODUCT_IMPORT_WORKBOOK_ERROR_CODES.tooManyRows);
    }
    if (columns > PRODUCT_IMPORT_WORKBOOK_LIMITS.maxColumnsPerSheet) {
      throw new ProductImportWorkbookError(PRODUCT_IMPORT_WORKBOOK_ERROR_CODES.tooManyColumns);
    }
  });
}

function worksheetRows(XLSX: XlsxModule, worksheet: WorkSheet | undefined): unknown[][] | undefined {
  if (!worksheet) return undefined;
  return XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    blankrows: false,
    defval: "",
  });
}
