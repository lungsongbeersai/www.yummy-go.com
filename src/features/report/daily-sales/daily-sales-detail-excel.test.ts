import * as XLSX from "xlsx-js-style";
import { describe, expect, it } from "vitest";
import type { DailySalesBillGroup } from "@/stores/report-store";
import { createDailySalesDetailExcelWorkbook } from "./daily-sales-detail-excel";

const translations: Record<string, string> = {
  "report.dateTotals": "Daily Totals",
  "report.excel.bills": "Bills",
  "report.excel.items": "Items",
  "report.summary": "Summary",
};
const t = (key: string) => translations[key] ?? key;

function billGroup(): DailySalesBillGroup {
  return {
    amountTotal: 82,
    baseTotal: 80,
    branchName: "Main branch",
    cancelled: false,
    cashierName: "Cashier",
    changeAmount: 0,
    debtAmount: 0,
    discountBillAmount: 4,
    id: "bill-1",
    invoiceNumber: "INV-001",
    itemCount: 2,
    itemDiscountAmount: 3,
    items: [
      {
        amount: 32,
        discount: 1,
        product_name: "Noodle",
        qty: 3,
        sale_price: 10,
        status_name: "paid",
        topping_total: 2,
        toppings: [{ name: "Chili", qty: 1, total: 2 }],
        total: 31,
      },
      {
        amount: 50,
        discount: 2,
        product_name: "Tea",
        qty: 2,
        sale_price: 25,
        status_name: "paid",
        topping_total: 0,
        total: 48,
      },
    ],
    lineTotal: 87,
    paymentType: "cash",
    qtyTotal: 5,
    receiveCashAmount: 100,
    receiveTransferAmount: 0,
    saleDate: "2026-07-13 10:30:00",
    serviceChargeAmount: 5,
    status: "paid",
    tableName: "A1",
    toppingTotal: 2,
    vatAmount: 4,
  };
}

function workbook(
  dateTotals: Record<string, unknown>[] = [],
  totals: Record<string, unknown> = {
    bill_count: 1,
    sum_discount: 7,
    sum_servicecharge: 5,
    sum_total: 87,
    sum_vate: 4,
    total_qty: 5,
  },
  includeSummary = true,
) {
  return createDailySalesDetailExcelWorkbook(XLSX, {
    billGroups: [billGroup()],
    branchLabel: "Main branch",
    includeSummary,
    cards: [
      {
        keys: ["bill_count"],
        kind: "number",
        label: "Bills",
      },
      {
        keys: ["total_qty"],
        kind: "number",
        label: "Quantity",
      },
      {
        keys: ["sum_discount"],
        kind: "money",
        label: "Discount",
      },
      {
        keys: ["sum_servicecharge"],
        kind: "money",
        label: "Service charge",
      },
      {
        keys: ["sum_vate"],
        kind: "money",
        label: "VAT",
      },
      {
        keys: ["sum_total"],
        kind: "money",
        label: "Grand total",
      },
    ],
    dateFrom: "2026-07-01",
    dateTo: "2026-07-13",
    dateTotals,
    layout: {
      headerLines: [
        "Lao People’s Democratic Republic",
        "Peace, Independence, Democracy, Unity, and Prosperity",
      ],
      signatures: {
        owner: "Shop owner",
        preparer: "Report preparer",
      },
    },
    paymentMethodLabel: "Cash",
    reportTotal: totals,
    summaryCards: totals,
    t,
  });
}

describe("daily sales detail Excel workbook", () => {
  it("groups items under each bill in one worksheet", () => {
    const result = workbook();
    const sheet = result.Sheets.Report;

    expect(result.SheetNames).toEqual(["Report"]);
    expect(sheet.A1.v).toBe("Lao People’s Democratic Republic");
    expect(sheet.A4.v).toBe("report.excel.reportInformation");
    expect(sheet.A12.v).toBe("Summary");
    // sheet เดียวมีหลายตาราง — autofilter ต้องปิดเพื่อไม่ให้ซ่อนแถวตารางอื่น
    expect(sheet["!autofilter"]).toBeUndefined();
    expect(Object.values(sheet).some((entry) => entry?.v === "Shop owner")).toBe(true);
    expect(Object.values(sheet).some((entry) => entry?.v === "Report preparer")).toBe(true);

    expect(sheet.A21.v).toBe("Bills");
    expect(sheet.A22.v).toBe("fields.no");
    expect(sheet.F22.v).toBe("report.columns.productName");

    // แถวบิล: ข้อมูลบิลครั้งเดียว ตามด้วยรายการสินค้าของบิลนั้น
    expect(sheet.A23.v).toBe(1);
    expect(sheet.B23.v).toBe("INV-001");
    expect(typeof sheet.C23.v).toBe("number");
    expect(sheet.C23.z).toBe("yyyy-mm-dd hh:mm");
    expect(sheet.D23.v).toBe("A1");
    expect(sheet.E23.v).toBe("cash");
    expect(sheet.M23.v).toBe("paid");

    expect(sheet.F24.v).toContain("Noodle");
    expect(sheet.F24.v).toContain("Chili");
    expect(sheet.G24.v).toBe(10);
    expect(sheet.H24.v).toBe(3);
    expect(sheet.L24.v).toBe(31);
    expect(sheet.F25.v).toBe("Tea");
    expect(sheet.L25.v).toBe(48);

    // รวมย่อยของบิล + แถวปรับปรุง (ส่วนลดบิล/ค่าบริการ/VAT/ยอดสุทธิ)
    expect(sheet.B26.v).toBe("Summary");
    expect(sheet.G26.v).toBe(80);
    expect(sheet.L26.v).toBe(79);
    expect(sheet["!merges"]).toContainEqual({
      e: { c: 5, r: 25 },
      s: { c: 1, r: 25 },
    });
    expect(sheet.B27.v).toBe("report.columns.billDiscount");
    expect(sheet.L27.v).toBe(4);
    expect(sheet.B30.v).toBe("common.total");
    expect(sheet.L30.v).toBe(87);

    // เงินสดรับแสดงเป็นแถวข้อมูลชำระ เฉพาะรายการที่มียอด
    expect(sheet.B31.v).toBe("report.columns.cashReceived");
    expect(sheet.L31.v).toBe(100);

    // แถวยอดรวมทั้งรายงานพร้อมจำนวนบิล
    expect(sheet.B32.v).toBe("Summary - report.cards.billsCount: 1");
    expect(sheet.H32.v).toBe(5);
    expect(sheet.L32.v).toBe(87);

    const exportedFile = XLSX.write(result, {
      bookType: "xlsx",
      type: "array",
    });
    const reopened = XLSX.read(exportedFile, {
      cellNF: true,
      type: "array",
    });
    expect(reopened.SheetNames).toEqual(["Report"]);
    expect(reopened.Sheets.Report.B23.v).toBe("INV-001");
  });

  it("omits the summary section when summary cards are hidden", () => {
    const result = workbook([], undefined, false);
    const sheet = result.Sheets.Report;

    expect(result.SheetNames).toEqual(["Report"]);
    expect(sheet.A12.v).toBe("Bills");
    // "Grand total" เป็น label ของ summary card เท่านั้น — ต้องหายไปทั้ง sheet
    expect(Object.values(sheet).some((entry) => entry?.v === "Grand total")).toBe(false);
  });

  it("adds daily totals only when the API provides them", () => {
    const result = workbook([
      {
        bills_count: 1,
        date: "2026-07-13",
        total: 87,
      },
    ]);
    const sheet = result.Sheets.Report;

    expect(result.SheetNames).toEqual(["Report"]);
    expect(sheet.A34.v).toBe("Daily Totals");
    expect(sheet.A36.z).toBe("yyyy-mm-dd");
    expect(XLSX.utils.format_cell(sheet.A36)).toBe("2026-07-13");
    expect(sheet.B36.v).toBe(1);
    expect(sheet.I36.v).toBe(87);
  });

  it("resolves selected-export aliases without losing summary totals", () => {
    const result = workbook([], {
      bills_count: 1,
      discount_bill: 4,
      item_discount: 3,
      qty_total: 5,
      service_charge: 5,
      total: 87,
      vat: 4,
    });
    const sheet = result.Sheets.Report;

    expect(sheet.B14.v).toBe(1);
    expect(sheet.B15.v).toBe(5);
    expect(sheet.B16.v).toBe(7);
    expect(sheet.B17.v).toBe(5);
    expect(sheet.B18.v).toBe(4);
    expect(sheet.B19.v).toBe(87);
  });
});
