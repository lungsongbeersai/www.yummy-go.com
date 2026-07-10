import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { createSingleSheetReportWorkbook } from "./report-excel-utils";

describe("report Excel helpers", () => {
  it("places every report section in one worksheet", () => {
    const workbook = createSingleSheetReportWorkbook(XLSX, [
      {
        title: "Summary",
        rows: [{ Metric: "Total", Value: 417461066 }],
      },
      {
        title: "Rows",
        rows: [{ Name: "Coffee", Quantity: 2.5 }],
      },
    ]);

    expect(workbook.SheetNames).toEqual(["Report"]);

    const worksheet = workbook.Sheets.Report;
    expect(worksheet.A1.v).toBe("Summary");
    expect(worksheet.A2.v).toBe("Metric");
    expect(worksheet.A3.v).toBe("Total");
    expect(worksheet.A5.v).toBe("Rows");
    expect(worksheet.A6.v).toBe("Name");
    expect(worksheet.A7.v).toBe("Coffee");
    expect(worksheet.B3.z).toBe("#,##0");
    expect(XLSX.utils.format_cell(worksheet.B3)).toBe("417,461,066");
    expect(worksheet.B7.z).toBe("#,##0.##");
    expect(XLSX.utils.format_cell(worksheet.B7)).toBe("2.5");

    const exportedFile = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });
    const exportedWorkbook = XLSX.read(exportedFile, {
      cellNF: true,
      type: "array",
    });
    const exportedWorksheet = exportedWorkbook.Sheets.Report;

    expect(exportedWorksheet.B3.z).toBe("#,##0");
    expect(XLSX.utils.format_cell(exportedWorksheet.B3)).toBe("417,461,066");
  });
});
