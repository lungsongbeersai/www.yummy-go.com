import { describe, expect, it } from "vitest";
import { reportColumns, summaryConfigs } from "@/features/report/daily-sales/daily-sales-report-columns";
import { exportTableRows } from "@/features/report/daily-sales/daily-sales-report-export-utils";
import { summaryCardValue } from "@/features/report/daily-sales/daily-sales-report-utils";
import { createDailySalesBillGroups, normalizeDailySalesReportResponse } from "@/stores/report-store/normalizers";

const t = (key: string) => key;

describe("daily sales report normalizers", () => {
  it("groups flat report rows by invoice", () => {
    const groups = createDailySalesBillGroups([
      { order_invoice: "INV-1", prod_name: "Coffee", qty: 2, unit_price: 10, total: 20 },
      { order_invoice: "INV-1", prod_name: "Tea", qty: 1, unit_price: 5, total: 5 }
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      invoiceNumber: "INV-1",
      itemCount: 2,
      qtyTotal: 3,
      baseTotal: 25
    });
  });

  it("normalizes nested detail bill responses", () => {
    const normalized = normalizeDailySalesReportResponse({
      status: "success",
      message: "ok",
      data: [
        {
          title: { invoice: "INV-2", date: "2026-05-29", table_name: "A1" },
          summary: { total: 30 },
          details: [{ product_name: "Noodle", qty: 1, total: 30 }]
        }
      ]
    });

    expect(normalized.billGroups).toHaveLength(1);
    expect(normalized.billGroups[0].invoiceNumber).toBe("INV-2");
    expect(normalized.rows).toHaveLength(1);
  });

  it("normalizes live detail bill groups from branch item wrappers", () => {
    const normalized = normalizeDailySalesReportResponse({
      status: "success",
      message: "success",
      page: 1,
      limit: 5,
      total: 21,
      totalPages: 5,
      type_page: "detail",
      report_total: {
        bills_count: 21,
        amount: 13406726,
        topping_total: 101000,
        discount_bill: 301256,
        item_discount: 181960,
        service_charge: 904647,
        vat: 1382817,
        total: 15210974
      },
      data: [
        {
          branch_name: "Branch",
          branch_uuid_fk: "9c1390bd-e316-4235-8901-79acfe19f514",
          items: [
            {
              title: {
                date: "2026-06-10",
                invoice: "100626-0003",
                table_name: "T03",
                cashier_name: "silavongsone@gmail.com",
                payment_method: "cash"
              },
              summary: {
                amount: 66,
                topping_total: 0,
                discount_bill: 0,
                vat: 7,
                total: 78
              },
              details: [
                {
                  product_name: "Missing product",
                  sale_price: 66,
                  amount: 66,
                  qty: 1,
                  discount: 0,
                  total: 66,
                  toppings: []
                }
              ]
            }
          ]
        }
      ]
    });

    expect(normalized.billGroups).toHaveLength(1);
    expect(normalized.billGroups[0]).toMatchObject({
      amountTotal: 66,
      discountBillAmount: 0,
      invoiceNumber: "100626-0003",
      itemDiscountAmount: 0,
      lineTotal: 78,
      paymentType: "cash",
      serviceChargeAmount: 0,
      tableName: "T03",
      vatAmount: 7
    });
    expect(normalized.rows).toHaveLength(1);
    expect(normalized.rows[0]).toMatchObject({
      amount: 66,
      invoice_number: "100626-0003",
      line_total: 66,
      product_name: "Missing product"
    });
  });

  it("normalizes the current daily sales detail API shape", () => {
    const normalized = normalizeDailySalesReportResponse({
      status: "success",
      message: "success",
      lang: "la",
      page: 1,
      limit: 20,
      total: 25,
      totalPages: 2,
      date_from: "2026-06-01",
      date_to: "2026-06-12",
      type_page: "detail",
      payment_method: "all",
      payment_type: "all",
      report_total: {
        bills_count: 25,
        amount: 14691726,
        topping_total: 111000,
        discount_bill: 301256,
        item_discount: 181960,
        service_charge: 994597,
        vat: 1520312,
        total: 16723419,
        receive_cash: 14928865,
        receive_transfer: 1561950,
        debt_amount: 337799,
        change_amount: 105196,
        cancelled_count: 0,
        active_count: 25
      },
      data: [
        {
          branch_name: "Branch 1",
          branch_uuid_fk: "9c1390bd-e316-4235-8901-79acfe19f514",
          items: [
            {
              title: {
                date: "2026-06-12",
                invoice: "120626-0001",
                table_name: "01",
                cashier_name: "silavongsonedodo@gmail.com",
                payment_method: "cash"
              },
              details: [
                {
                  product_name: "Fish set",
                  prod_image: "https://example.test/product.jpg",
                  prod_status_imge: 1,
                  sale_price: 200000,
                  topping_total: 0,
                  amount: 200000,
                  qty: 1,
                  discount: 0,
                  total: 200000,
                  toppings: []
                }
              ],
              summary: {
                amount: 200000,
                topping_total: 0,
                discount_bill: 0,
                vat: 21400,
                total: 235400
              }
            },
            {
              title: {
                date: "2026-06-10",
                invoice: "100626-0002",
                table_name: "T01",
                cashier_name: "silavongsonedodo@gmail.com",
                payment_method: "debt"
              },
              details: [
                {
                  product_name: "Pepsi",
                  sale_price: 35000,
                  topping_total: 0,
                  amount: 35000,
                  qty: 6,
                  discount: 0,
                  total: 210000,
                  toppings: []
                },
                {
                  product_name: "Chicken",
                  sale_price: 60000,
                  topping_total: 5000,
                  amount: 65000,
                  qty: 2,
                  discount: 130000,
                  total: 0,
                  toppings: [{ qty: 1, name: "", price: 5000, total: 5000 }]
                }
              ],
              summary: {
                amount: 396000,
                topping_total: 10000,
                discount_bill: 133000,
                vat: 14231,
                total: 156541
              }
            }
          ]
        }
      ]
    });

    expect(normalized.reportTotal).toMatchObject({
      bills_count: 25,
      amount: 14691726,
      total: 16723419,
      receive_cash: 14928865,
      receive_transfer: 1561950
    });
    expect(normalized.billGroups).toHaveLength(2);
    expect(normalized.rows).toHaveLength(3);
    expect(normalized.billGroups[0]).toMatchObject({
      amountTotal: 200000,
      branchName: "Branch 1",
      invoiceNumber: "120626-0001",
      lineTotal: 235400,
      paymentType: "cash",
      serviceChargeAmount: 0,
      vatAmount: 21400
    });
    expect(normalized.billGroups[1]).toMatchObject({
      discountBillAmount: 133000,
      itemCount: 2,
      itemDiscountAmount: 130000,
      lineTotal: 156541,
      toppingTotal: 10000
    });
    expect(normalized.rows[2]).toMatchObject({
      branch_name: "Branch 1",
      invoice_number: "100626-0002",
      line_total: 0,
      payment_method: "debt",
      product_name: "Chicken",
      topping_total: 5000
    });
  });

  it("normalizes live daily sales summary branch groups", () => {
    const normalized = normalizeDailySalesReportResponse({
      status: "success",
      message: "success",
      lang: "la",
      page: 1,
      limit: 5,
      total: 10,
      totalPages: 2,
      date_from: "2026-05-01",
      date_to: "2026-05-29",
      type_page: "summary",
      payment_method: "all",
      report_total: {
        bills_count: 10,
        amount: 3218000,
        topping_total: 148000,
        discount_bill: 155350,
        item_discount: 36300,
        service_charge: 208974,
        vat: 323532,
        total: 3558856,
        receive_cash: 2723513,
        receive_transfer: 650000,
        debt_amount: 306020,
        change_amount: 120676,
        cancelled_count: 0,
        active_count: 10
      },
      data: [
        {
          branch_name: "ຮ້ານ ອານຸສອນ ສາຂາ ( 1 )",
          branch_uuid_fk: "9c1390bd-e316-4235-8901-79acfe19f514",
          items: [
            {
              date: "2026-05-29",
              invoice: "290526-0003",
              table_name: "T02",
              cashier_name: "silavongsone@gmail.com",
              payment_method: "ເງິນສົດ + ໂອນ",
              amount: 122000,
              topping_total: 32000,
              discount_bill: 20740,
              item_discount: 18300,
              service_charge: 5807,
              vat: 8877,
              total: 97644,
              receive_cash: 50000,
              receive_transfer: 50000,
              debt_amount: 0,
              change_amount: 2356,
              status: "ຊຳລະແລ້ວ"
            },
            {
              date: "2026-05-29",
              invoice: "290526-0002",
              table_name: "T02",
              cashier_name: "silavongsone@gmail.com",
              payment_method: "ເງິນສົດ",
              amount: 283000,
              topping_total: 48000,
              discount_bill: 0,
              item_discount: 0,
              service_charge: 19810,
              vat: 30281,
              total: 333091,
              receive_cash: 333091,
              receive_transfer: 0,
              debt_amount: 0,
              change_amount: 0,
              status: "ຊຳລະແລ້ວ"
            },
            {
              date: "2026-05-29",
              invoice: "290526-0001",
              table_name: "T02",
              cashier_name: "silavongsone@gmail.com",
              payment_method: "ເງິນສົດ",
              amount: 19000,
              topping_total: 0,
              discount_bill: 0,
              item_discount: 0,
              service_charge: 1330,
              vat: 2033,
              total: 22363,
              receive_cash: 23000,
              receive_transfer: 0,
              debt_amount: 0,
              change_amount: 637,
              status: "ຊຳລະແລ້ວ"
            },
            {
              date: "2026-05-28",
              invoice: "280526-0003",
              table_name: "04",
              cashier_name: "silavongsone@gmail.com",
              payment_method: "ເງິນສົດ",
              amount: 41000,
              topping_total: 0,
              discount_bill: 0,
              item_discount: 0,
              service_charge: 0,
              vat: 4100,
              total: 45100,
              receive_cash: 69000,
              receive_transfer: 0,
              debt_amount: 0,
              change_amount: 23900,
              status: "ຊຳລະແລ້ວ"
            },
            {
              date: "2026-05-28",
              invoice: "280526-0002",
              table_name: "T02",
              cashier_name: "silavongsone@gmail.com",
              payment_method: "ໜີ້ຄ້າງ",
              amount: 260000,
              topping_total: 0,
              discount_bill: 0,
              item_discount: 0,
              service_charge: 18200,
              vat: 27820,
              total: 306020,
              receive_cash: 0,
              receive_transfer: 0,
              debt_amount: 306020,
              change_amount: 0,
              status: "ໜີ້ຄ້າງ"
            }
          ]
        }
      ]
    });
    const cards = summaryConfigs(t, "summary");
    const columns = reportColumns(t, "summary");
    const exportedRow = exportTableRows([normalized.rows[0]], columns)[0];
    const cardValue = (label: string) => {
      const card = cards.find((card) => card.label === label);
      expect(card).toBeDefined();
      return summaryCardValue(
        normalized.summaryCards,
        normalized.reportTotal,
        card?.keys ?? []
      );
    };

    expect(normalized.rows).toHaveLength(5);
    expect(normalized.billGroups).toHaveLength(5);
    expect(normalized.reportTotal.total).toBe(3558856);
    expect(normalized.rows[0]).toMatchObject({
      branch_name: "ຮ້ານ ອານຸສອນ ສາຂາ ( 1 )",
      invoice: "290526-0003",
      payment_method: "ເງິນສົດ + ໂອນ",
      total: 97644
    });
    expect(cardValue("report.cards.orderTotal")).toBe(3218000);
    expect(cardValue("report.cards.toppingTotal")).toBe(148000);
    expect(cardValue("report.cards.discountAmount")).toBe(155350);
    expect(cardValue("report.cards.itemDiscountAmount")).toBe(36300);
    expect(cardValue("report.cards.netTotal")).toBe(3558856);
    expect(exportedRow).toMatchObject({
      "report.columns.invoiceNumber": "290526-0003",
      "report.columns.paymentType": "ເງິນສົດ + ໂອນ",
      "report.columns.netTotal": 97644,
      "report.columns.status": "ຊຳລະແລ້ວ"
    });
  });
});
