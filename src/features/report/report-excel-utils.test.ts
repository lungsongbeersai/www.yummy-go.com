import * as XLSX from "xlsx";
import * as XLSXStyle from "xlsx-js-style";
import { strFromU8, unzipSync } from "fflate";
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
    expect(worksheet.A1.s.font.bold).toBe(true);
    expect(worksheet.A2.s.font.bold).toBe(true);
    expect(worksheet.A2.s.fill.fgColor.rgb).toBe("1F4E78");
    expect(worksheet["!cols"]?.[0]?.wch).toBeGreaterThanOrEqual(8);

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

  it("adds merged centered official headers and signature fields", () => {
    const workbook = createSingleSheetReportWorkbook(
      XLSXStyle,
      [{ title: "Rows", rows: [{ Name: "Coffee", Quantity: 2, Total: 10 }] }],
      {
        headerLines: ["Lao People’s Democratic Republic", "Peace, Independence, Democracy, Unity, and Prosperity"],
        signatures: { owner: "Shop owner", preparer: "Report preparer" },
      },
    );
    const worksheet = workbook.Sheets.Report;

    expect(worksheet.A1.v).toBe("Lao People’s Democratic Republic");
    expect(worksheet.A2.v).toBe("Peace, Independence, Democracy, Unity, and Prosperity");
    expect(worksheet.A1.s.alignment.horizontal).toBe("center");
    expect(worksheet["!merges"]).toContainEqual({ s: { c: 0, r: 0 }, e: { c: 2, r: 0 } });
    expect(Object.values(worksheet).some((cell) => cell?.v === "Shop owner")).toBe(true);
    expect(Object.values(worksheet).some((cell) => cell?.v === "Report preparer")).toBe(true);

    const exportedFile = XLSXStyle.write(workbook, { bookType: "xlsx", type: "array" });
    const exportedWorksheet = XLSXStyle.read(exportedFile, { type: "array" }).Sheets.Report;
    expect(exportedWorksheet["!merges"]).toContainEqual({ s: { c: 0, r: 0 }, e: { c: 2, r: 0 } });
    const archive = unzipSync(new Uint8Array(exportedFile));
    expect(strFromU8(archive["xl/styles.xml"])).toContain('horizontal="center"');
  });

  it("writes styled grid rows with merged cells and column widths", () => {
    const workbook = createSingleSheetReportWorkbook(XLSXStyle, [
      {
        grid: {
          columnCount: 4,
          columnWidths: [7, 20, 12, 14],
          rows: [
            {
              cells: [
                { value: "No" },
                { value: "Product" },
                { value: "Qty" },
                { value: "Total" },
              ],
              style: { bold: true, fill: "#EEF3F7" },
            },
            {
              cells: [
                { value: "" },
                { colSpan: 2, value: "- Coffee" },
                { style: { align: "right" }, value: 25 },
              ],
            },
          ],
        },
        title: "Detailed Report",
      },
    ]);
    const worksheet = workbook.Sheets.Report;

    expect(worksheet.A1.v).toBe("Detailed Report");
    expect(worksheet.A2.v).toBe("No");
    expect(worksheet.B3.v).toBe("- Coffee");
    expect(worksheet.D3.v).toBe(25);
    expect(worksheet["!merges"]).toContainEqual({
      e: { c: 2, r: 2 },
      s: { c: 1, r: 2 },
    });
    expect(worksheet["!cols"]?.map((column) => column.wch)).toEqual([
      7,
      20,
      12,
      14,
    ]);
    expect(worksheet.A2.s.font.bold).toBe(true);
    expect(worksheet.D3.s.alignment.horizontal).toBe("right");

    const exportedFile = XLSXStyle.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });
    const exportedWorksheet = XLSXStyle.read(exportedFile, {
      type: "array",
    }).Sheets.Report;
    expect(exportedWorksheet["!merges"]).toContainEqual({
      e: { c: 2, r: 2 },
      s: { c: 1, r: 2 },
    });
  });
});
