type XlsxModule = typeof import("xlsx");

const REPORT_DECIMAL_FORMAT = "#,##0.##";
const REPORT_INTEGER_FORMAT = "#,##0";

export interface ReportExcelSection {
  title: string;
  rows: ReadonlyArray<Record<string, unknown>>;
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

      cell.z = typeof cell.v === "number" && Number.isInteger(cell.v)
        ? REPORT_INTEGER_FORMAT
        : REPORT_DECIMAL_FORMAT;
      delete cell.w;
    }
  }
}

export function createSingleSheetReportWorkbook(
  XLSX: XlsxModule,
  sections: ReportExcelSection[],
) {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([]);
  let nextRow = 0;

  sections.forEach((section, index) => {
    XLSX.utils.sheet_add_aoa(worksheet, [[section.title]], {
      origin: { c: 0, r: nextRow },
    });
    nextRow += 1;

    if (section.rows.length) {
      XLSX.utils.sheet_add_json(worksheet, [...section.rows], {
        origin: { c: 0, r: nextRow },
      });
      nextRow += section.rows.length + 1;
    }

    if (index < sections.length - 1) nextRow += 1;
  });

  formatNumericCells(XLSX, worksheet);
  XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
  return workbook;
}
