type XlsxUtils = typeof import("xlsx")["utils"];
export interface XlsxModule {
  utils: Omit<
    Pick<
      XlsxUtils,
      | "aoa_to_sheet"
      | "book_append_sheet"
      | "book_new"
      | "decode_range"
      | "encode_cell"
      | "encode_range"
      | "sheet_add_aoa"
      | "sheet_add_json"
    >,
    "book_append_sheet"
  > & {
    book_append_sheet: (
      ...args: Parameters<XlsxUtils["book_append_sheet"]>
    ) => void;
  };
}

const REPORT_DECIMAL_FORMAT = "#,##0.##";
const REPORT_INTEGER_FORMAT = "#,##0";
// สไตล์กลางของ section แบบ record (sheet_add_json) ให้ทุกหน้ารายงานอ่านง่ายเหมือนกัน
const RECORD_HEADER_STYLE = {
  align: "center",
  bold: true,
  fill: "#1F4E78",
  fontColor: "#FFFFFF",
} as const;
const RECORD_STRIPE_STYLE = { fill: "#F8FAFC" } as const;
const MIN_RECORD_COLUMN_WIDTH = 8;
const MAX_RECORD_COLUMN_WIDTH = 42;

export interface ReportExcelRecordSection {
  title: string;
  rows: ReadonlyArray<Record<string, unknown>>;
}

export interface ReportExcelCellStyle {
  align?: "center" | "left" | "right";
  bold?: boolean;
  fill?: string;
  fontColor?: string;
  italic?: boolean;
  numberFormat?: string;
}

export interface ReportExcelGridCell {
  colSpan?: number;
  style?: ReportExcelCellStyle;
  value: boolean | Date | number | string | null | undefined;
}

export interface ReportExcelGridRow {
  cells: ReadonlyArray<ReportExcelGridCell>;
  style?: ReportExcelCellStyle;
}

export interface ReportExcelGrid {
  autoFilter?: boolean;
  columnCount: number;
  columnWidths?: ReadonlyArray<number>;
  rows: ReadonlyArray<ReportExcelGridRow>;
}

export interface ReportExcelGridSection {
  grid: ReportExcelGrid;
  title: string;
}

export type ReportExcelSection =
  | ReportExcelGridSection
  | ReportExcelRecordSection;

export interface ReportExcelLayout {
  headerLines?: string[];
  signatures?: {
    owner: string;
    preparer: string;
  };
  title?: string;
}

// ระยะขอบมาตรฐานสำหรับพิมพ์กระดาษ A4 — xlsx-js-style เขียนได้แค่ !margins เท่านั้น
// (ตั้งขนาดกระดาษ/แนวกระดาษไม่ได้ในรุ่น community) จึงตั้งระยะขอบให้พอดีหน้า A4 แทน
const A4_PAGE_MARGINS = {
  bottom: 0.5,
  footer: 0.3,
  header: 0.3,
  left: 0.4,
  right: 0.4,
  top: 0.5,
} as const;

export interface ReportExcelWorksheet {
  layout?: ReportExcelLayout;
  name: string;
  sections: ReportExcelSection[];
}

function reportColumnCount(sections: ReportExcelSection[]) {
  return Math.max(
    2,
    ...sections.flatMap((section) =>
      "grid" in section
        ? [section.grid.columnCount]
        : section.rows.map((row) => Object.keys(row).length),
    ),
  );
}

function mergeRow(
  worksheet: ReturnType<XlsxModule["utils"]["aoa_to_sheet"]>,
  row: number,
  startColumn: number,
  endColumn: number,
) {
  worksheet["!merges"] ??= [];
  worksheet["!merges"].push({
    e: { c: endColumn, r: row },
    s: { c: startColumn, r: row },
  });
}

function colorValue(value: string) {
  return value.replace(/^#/, "").toUpperCase();
}

function mergeCellStyle(
  base: ReportExcelCellStyle | undefined,
  override: ReportExcelCellStyle | undefined,
) {
  return { ...base, ...override };
}

function applyCellStyle(
  cell: Record<string, unknown> | undefined,
  style: ReportExcelCellStyle | undefined,
) {
  if (!cell || !style) return;

  cell.s = {
    alignment: style.align
      ? { horizontal: style.align, vertical: "center" }
      : { vertical: "center" },
    fill: style.fill
      ? {
          fgColor: { rgb: colorValue(style.fill) },
          patternType: "solid",
        }
      : undefined,
    font:
      style.bold || style.fontColor || style.italic
        ? {
            bold: style.bold,
            color: style.fontColor
              ? { rgb: colorValue(style.fontColor) }
              : undefined,
            italic: style.italic,
          }
        : undefined,
  };
  if (style.numberFormat) cell.z = style.numberFormat;
}

function addGridSection(
  XLSX: XlsxModule,
  worksheet: ReturnType<XlsxModule["utils"]["aoa_to_sheet"]>,
  grid: ReportExcelGrid,
  startRow: number,
) {
  let nextRow = startRow;
  const filterStartRow = startRow;

  grid.rows.forEach((row) => {
    const occupiedColumns = row.cells.reduce(
      (total, cell) => total + Math.max(1, cell.colSpan ?? 1),
      0,
    );
    if (occupiedColumns > grid.columnCount) {
      throw new Error("Excel grid row exceeds its configured column count.");
    }

    const values: Array<boolean | Date | number | string | null | undefined> = [];
    const placements: Array<{
      cell: ReportExcelGridCell;
      startColumn: number;
    }> = [];
    let column = 0;

    row.cells.forEach((cell) => {
      const colSpan = Math.max(1, cell.colSpan ?? 1);
      placements.push({ cell, startColumn: column });
      values.push(cell.value, ...Array(colSpan - 1).fill(""));
      column += colSpan;
    });

    values.push(...Array(Math.max(0, grid.columnCount - values.length)).fill(""));
    XLSX.utils.sheet_add_aoa(worksheet, [values.slice(0, grid.columnCount)], {
      origin: { c: 0, r: nextRow },
    });

    for (let currentColumn = 0; currentColumn < grid.columnCount; currentColumn += 1) {
      applyCellStyle(
        worksheet[XLSX.utils.encode_cell({ c: currentColumn, r: nextRow })],
        row.style,
      );
    }

    placements.forEach(({ cell, startColumn }) => {
      const colSpan = Math.max(1, cell.colSpan ?? 1);
      if (colSpan > 1) {
        mergeRow(
          worksheet,
          nextRow,
          startColumn,
          Math.min(grid.columnCount - 1, startColumn + colSpan - 1),
        );
      }
      const style = mergeCellStyle(row.style, cell.style);
      for (
        let currentColumn = startColumn;
        currentColumn < Math.min(grid.columnCount, startColumn + colSpan);
        currentColumn += 1
      ) {
        applyCellStyle(
          worksheet[
            XLSX.utils.encode_cell({ c: currentColumn, r: nextRow })
          ],
          style,
        );
      }
    });

    nextRow += 1;
  });

  if (grid.columnWidths?.length) {
    applyColumnWidths(worksheet, [
      ...grid.columnWidths.slice(0, grid.columnCount),
    ]);
  }

  if (grid.autoFilter && nextRow > filterStartRow) {
    worksheet["!autofilter"] = {
      ref: XLSX.utils.encode_range({
        e: { c: grid.columnCount - 1, r: nextRow - 1 },
        s: { c: 0, r: filterStartRow },
      }),
    };
  }

  return nextRow;
}

function applyColumnWidths(
  worksheet: ReturnType<XlsxModule["utils"]["aoa_to_sheet"]>,
  widths: number[],
) {
  worksheet["!cols"] ??= [];
  widths.forEach((width, index) => {
    const current = worksheet["!cols"]?.[index]?.wch ?? 0;
    worksheet["!cols"]![index] = { wch: Math.max(current, width) };
  });
}

function recordHeaders(rows: ReadonlyArray<Record<string, unknown>>) {
  const headers: string[] = [];
  rows.forEach((row) => {
    Object.keys(row).forEach((key) => {
      if (!headers.includes(key)) headers.push(key);
    });
  });
  return headers;
}

function cellDisplayWidth(value: unknown) {
  if (value === null || value === undefined) return 0;
  // เผื่อความกว้างของตัวคั่นหลักพันที่ Excel แสดงตาม number format
  if (typeof value === "number") {
    return Math.round(value).toLocaleString("en-US").length + 3;
  }
  return String(value).length;
}

function addRecordSection(
  XLSX: XlsxModule,
  worksheet: ReturnType<XlsxModule["utils"]["aoa_to_sheet"]>,
  rows: ReadonlyArray<Record<string, unknown>>,
  startRow: number,
) {
  const headers = recordHeaders(rows);
  XLSX.utils.sheet_add_json(worksheet, [...rows], {
    header: headers,
    origin: { c: 0, r: startRow },
  });

  headers.forEach((_header, column) => {
    applyCellStyle(
      worksheet[XLSX.utils.encode_cell({ c: column, r: startRow })],
      RECORD_HEADER_STYLE,
    );
  });
  rows.forEach((_row, rowIndex) => {
    if (rowIndex % 2 === 0) return;
    headers.forEach((_header, column) => {
      applyCellStyle(
        worksheet[
          XLSX.utils.encode_cell({ c: column, r: startRow + 1 + rowIndex })
        ],
        RECORD_STRIPE_STYLE,
      );
    });
  });

  applyColumnWidths(
    worksheet,
    headers.map((header) =>
      Math.min(
        MAX_RECORD_COLUMN_WIDTH,
        Math.max(
          MIN_RECORD_COLUMN_WIDTH,
          cellDisplayWidth(header) + 2,
          ...rows.map((row) => cellDisplayWidth(row[header])),
        ),
      ),
    ),
  );

  return startRow + rows.length + 1;
}

function formatNumericCells(
  XLSX: XlsxModule,
  worksheet: ReturnType<XlsxModule["utils"]["aoa_to_sheet"]>,
) {
  const usedRange = worksheet["!ref"];
  if (!usedRange) return;

  const range = XLSX.utils.decode_range(usedRange);
  for (let row = range.s.r; row <= range.e.r; row += 1) {
    for (let column = range.s.c; column <= range.e.c; column += 1) {
      const cell = worksheet[XLSX.utils.encode_cell({ c: column, r: row })];
      if (cell?.t !== "n") continue;

      cell.z ??= typeof cell.v === "number" && Number.isInteger(cell.v)
        ? REPORT_INTEGER_FORMAT
        : REPORT_DECIMAL_FORMAT;
      delete cell.w;
    }
  }
}

function createReportWorksheet(
  XLSX: XlsxModule,
  sections: ReportExcelSection[],
  layout: ReportExcelLayout = {},
) {
  const worksheet = XLSX.utils.aoa_to_sheet([]);
  const columnCount = reportColumnCount(sections);
  let nextRow = 0;

  layout.headerLines?.forEach((line) => {
    XLSX.utils.sheet_add_aoa(worksheet, [[line]], {
      origin: { c: 0, r: nextRow },
    });
    mergeRow(worksheet, nextRow, 0, columnCount - 1);
    const cell = worksheet[XLSX.utils.encode_cell({ c: 0, r: nextRow })];
    cell.s = {
      alignment: { horizontal: "center", vertical: "center" },
      font: { bold: true, sz: 16 },
    };
    nextRow += 1;
  });
  if (layout.headerLines?.length) nextRow += 1;

  if (layout.title) {
    XLSX.utils.sheet_add_aoa(worksheet, [[layout.title]], {
      origin: { c: 0, r: nextRow },
    });
    mergeRow(worksheet, nextRow, 0, columnCount - 1);
    const titleCell = worksheet[XLSX.utils.encode_cell({ c: 0, r: nextRow })];
    titleCell.s = {
      alignment: { horizontal: "center", vertical: "center" },
      font: { bold: true, sz: 18 },
    };
    nextRow += 2;
  }

  sections.forEach((section, index) => {
    XLSX.utils.sheet_add_aoa(worksheet, [[section.title]], {
      origin: { c: 0, r: nextRow },
    });
    const titleCell = worksheet[XLSX.utils.encode_cell({ c: 0, r: nextRow })];
    titleCell.s = { font: { bold: true, sz: 14 } };
    nextRow += 1;

    if ("grid" in section) {
      nextRow = addGridSection(XLSX, worksheet, section.grid, nextRow);
    } else if (section.rows.length) {
      nextRow = addRecordSection(XLSX, worksheet, section.rows, nextRow);
    }

    if (index < sections.length - 1) nextRow += 1;
  });

  if (layout.signatures) {
    const rightStart = Math.ceil(columnCount / 2);
    nextRow += 3;
    XLSX.utils.sheet_add_aoa(
      worksheet,
      [[layout.signatures.owner, ...Array(rightStart - 1).fill(""), layout.signatures.preparer]],
      { origin: { c: 0, r: nextRow } },
    );
    mergeRow(worksheet, nextRow, 0, rightStart - 1);
    mergeRow(worksheet, nextRow, rightStart, columnCount - 1);
    [0, rightStart].forEach((column) => {
      const cell = worksheet[XLSX.utils.encode_cell({ c: column, r: nextRow })];
      cell.s = {
        alignment: { horizontal: "center", vertical: "center" },
        font: { bold: true, sz: 16 },
      };
    });
    nextRow += 4;
    XLSX.utils.sheet_add_aoa(
      worksheet,
      [["____________________________", ...Array(rightStart - 1).fill(""), "____________________________"]],
      { origin: { c: 0, r: nextRow } },
    );
    mergeRow(worksheet, nextRow, 0, rightStart - 1);
    mergeRow(worksheet, nextRow, rightStart, columnCount - 1);
  }

  formatNumericCells(XLSX, worksheet);
  worksheet["!margins"] = A4_PAGE_MARGINS;
  return worksheet;
}

function safeWorksheetName(name: string, index: number) {
  const safeName = name.replace(/[\\/?*\[\]:]/g, " ").trim().slice(0, 31);
  return safeName || `Report ${index + 1}`;
}

export function createReportWorkbook(
  XLSX: XlsxModule,
  sheets: ReportExcelWorksheet[],
) {
  const workbook = XLSX.utils.book_new();
  sheets.forEach((sheet, index) => {
    const worksheet = createReportWorksheet(
      XLSX,
      sheet.sections,
      sheet.layout,
    );
    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      safeWorksheetName(sheet.name, index),
    );
  });
  return workbook;
}

export function createSingleSheetReportWorkbook(
  XLSX: XlsxModule,
  sections: ReportExcelSection[],
  layout: ReportExcelLayout = {},
) {
  return createReportWorkbook(XLSX, [
    { layout, name: "Report", sections },
  ]);
}
