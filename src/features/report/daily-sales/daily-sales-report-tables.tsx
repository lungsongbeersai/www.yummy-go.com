// Barrel: หน้ารายงาน daily-sales แยกตารางออกเป็น 3 ไฟล์ย่อย (สรุป/รายละเอียด/เซลล์)
// คงชื่อไฟล์เดิมเป็นจุด import กลางเพื่อไม่ต้องแก้ผู้เรียก (page + export-surface)
export { renderPrintCell } from "./daily-sales-report-cells";
export { SummaryReportTable } from "./daily-sales-summary-table";
export { DetailBillTable } from "./daily-sales-detail-table";
