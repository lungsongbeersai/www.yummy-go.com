import type { ReportExcelCellStyle } from "../report-excel-utils";

// โทนสีมาตรฐานของตาราง Excel ทุกรายงาน — แก้ที่นี่ที่เดียวแล้วมีผลทุกไฟล์ export
export const REPORT_TABLE_HEADER_STYLE = {
  align: "center",
  bold: true,
  fill: "#1F4E78",
  fontColor: "#FFFFFF"
} as const satisfies ReportExcelCellStyle;

export const REPORT_GROUP_ROW_STYLE = {
  bold: true,
  fill: "#DEE8F4"
} as const satisfies ReportExcelCellStyle;

export const REPORT_GRAND_TOTAL_ROW_STYLE = {
  bold: true,
  fill: "#D9E2F3"
} as const satisfies ReportExcelCellStyle;
