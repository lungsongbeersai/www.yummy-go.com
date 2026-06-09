import { describe, expect, it } from "vitest";
import type { CancelableDateOption } from "@/services/cancel";
import type { ApiEntity } from "@/services/shared/types";
import type { AuthUser } from "@/stores/auth-store";
import {
  billBranch,
  billCanCancel,
  billDateValue,
  billInvoice,
  billIsSelected,
  billStatus,
  billTable,
  billTotal,
  billUuid,
  buildSalesListInvoicePrintData,
  dateOptionLabel,
  dateOptionValue,
  discountLabel,
  itemCashier,
  itemDiscountAmount,
  itemDiscountRecord,
  itemName,
  itemNote,
  itemPrice,
  itemQty,
  itemSize,
  itemStatus,
  itemToppingTotal,
  itemToppings,
  itemTotal,
  pageBounds,
  salesListInvoicePrintItems,
  statusClass,
  statusDotClass,
  type BillSource
} from "./sales-list-utils";

function entity(value: Record<string, unknown>): ApiEntity {
  return value as ApiEntity;
}

function source(value: Record<string, unknown>): BillSource {
  return value as BillSource;
}

const translate = (key: string) => ({
  "fields.branch_address": "Branch address",
  "pos.customer": "Customer",
  "pos.invoicePrintAmountToPay": "Amount to pay",
  "pos.invoicePrintDate": "Date",
  "pos.invoicePrintDiscount": "Discount",
  "pos.invoicePrintNumber": "Invoice",
  "pos.invoicePrintStaff": "Staff",
  "pos.invoicePrintTable": "Table",
  "pos.invoicePrintThankYou": "Thank you",
  "pos.invoicePrintTitle": "Receipt",
  "pos.invoicePrintTotalAmount": "Subtotal",
  "pos.price": "Price",
  "pos.serviceTotal": "Service",
  "pos.toppingTotal": "Toppings",
  "pos.vat": "VAT",
  "salesList.serviceCharge": "Service charge",
  "salesList.toppings": "Toppings"
}[key] ?? key);

const user: AuthUser = {
  branch_address: "User branch address",
  branch_name: "User Branch",
  branch_tel: "020 5555",
  branch_uuid: "branch-1",
  email: "cashier@example.com",
  profile: "",
  status: 1,
  store_logo: "",
  store_name: "User Store",
  store_uuid: "store-1",
  uuid: "user-1"
};

describe("sales list utils", () => {
  it("chooses bill identity and display values from detail before list fallback rows", () => {
    const listRow = source({
      can_cancel: "0",
      created_at: "2026-06-01T08:00:00Z",
      order_grand_total: "1200",
      order_invoice: "INV-LIST",
      order_status_text: "paid",
      order_uuid: "order-list",
      table_name: "A1"
    });
    const detail = source({
      order: {
        branch_name_la: "Detail Branch",
        can_cancel: "1",
        created_at: "2026-06-02T09:30:00Z",
        invoice_number: "INV-DETAIL",
        order_status_text: "success",
        order_uuid: "order-detail",
        table_no: "T9"
      },
      totals: {
        grand_total: "1500"
      }
    });

    expect(billInvoice(detail, listRow)).toBe("INV-DETAIL");
    expect(billInvoice(source({}), listRow)).toBe("INV-LIST");
    expect(billUuid(detail)).toBe("order-detail");
    expect(billBranch(detail)).toBe("Detail Branch");
    expect(billTable(detail)).toBe("T9");
    expect(billTotal(detail)).toContain("1.500");
    expect(billStatus(detail)).toBe("success");
    expect(billCanCancel(detail, listRow)).toBe(true);
    expect(billIsSelected(listRow, "order-list")).toBe(true);
    expect(billDateValue(detail).getFullYear()).toBe(2026);
  });

  it("normalizes item labels, toppings, and discounts", () => {
    const item = entity({
      cashier: "Alice",
      item_discount: {
        amount: "100",
        type: "PCT",
        value: "5"
      },
      line_total: "1900",
      note: "Less spicy",
      product_name: "Noodle",
      qty: "2",
      size_name: "Large",
      status: "served",
      toppings: [
        { name: "Egg", qty: "1", topping_price: "200" },
        { prod_topping_name: "Cheese", topping_total: "300" }
      ],
      unit_price: "1000"
    });

    expect(itemName(item)).toBe("Noodle");
    expect(itemQty(item)).toBe("2");
    expect(itemPrice(item)).toContain("1.000");
    expect(itemTotal(item)).toContain("1.900");
    expect(itemStatus(item)).toBe("served");
    expect(itemSize(item)).toBe("Large");
    expect(itemNote(item)).toBe("Less spicy");
    expect(itemCashier(item)).toBe("Alice");
    expect(itemToppings(item)).toHaveLength(2);
    expect(itemToppingTotal(item)).toBe(500);
    expect(itemDiscountAmount(item)).toBe(100);
    expect(discountLabel(itemDiscountRecord(item), "Discount")).toBe("Discount (5%)");
  });

  it("builds invoice print items and bill print data from nested sections", () => {
    const bill = source({
      bill_discount: {
        amount: "100",
        type: "PCT",
        value: "5"
      },
      items: [
        {
          cashier: "Alice",
          item_discount: { amount: "100", type: "PCT", value: "5" },
          line_total: "1900",
          product_name: "Noodle",
          qty: "2",
          size_name: "Large",
          toppings: [{ name: "Egg", qty: "1", topping_price: "200" }],
          unit_price: "1000"
        }
      ],
      order: {
        branch_address: "Bill address",
        branch_name: "Bill Branch",
        branch_tel: "020 1111",
        created_at: "2026-06-03T10:00:00Z",
        order_invoice: "INV-PRINT",
        table_name: "B1"
      },
      payment: {
        customer_name: "Jane"
      },
      service_charge: {
        amount: "200",
        service_rate: "10"
      },
      totals: {
        grand_total: "3200",
        order_subtotal: "2800",
        order_total: "3000"
      },
      vat: {
        amount: "300",
        vat_rate: "7"
      }
    });
    const [printItem] = salesListInvoicePrintItems(bill, translate);
    const printData = buildSalesListInvoicePrintData({ bill, translate, user });

    expect(printItem).toMatchObject({
      displayTotal: 1900,
      hasItemDiscount: true,
      name: "Noodle (Large)",
      originalLineTotal: 2000,
      qty: 2,
      toppingTotal: 200,
      unitPrice: 1000
    });
    expect(printItem.toppings).toEqual([{ name: "Egg", qty: 1, total: 200 }]);
    expect(printData).toMatchObject({
      branchAddress: "Bill address",
      branchName: "Bill Branch",
      branchTel: "020 1111",
      cashier: "Alice",
      customer: "Jane",
      discount: 100,
      invoice: "INV-PRINT",
      service: 200,
      storeName: "User Store",
      subtotal: 2800,
      tableName: "B1",
      title: "Receipt",
      total: 3200,
      vat: 300
    });
    expect(printData.labels.service).toBe("Service charge (10%)");
    expect(printData.labels.vat).toBe("VAT (7%)");
  });

  it("keeps status badge classes stable for cancelled, paid, and pending rows", () => {
    expect(statusClass(source({ status: "cancelled" }))).toContain("text-destructive");
    expect(statusDotClass(source({ status: "0" }))).toBe("bg-destructive");
    expect(statusClass(source({ status: "paid" }))).toContain("text-primary");
    expect(statusDotClass(source({ status: "success" }))).toBe("bg-primary");
    expect(statusClass(source({ status: "pending" }))).toContain("text-muted-foreground");
    expect(statusDotClass(source({ can_cancel: "1", status: "pending" }))).toBe("bg-primary");
    expect(statusDotClass(source({ status: "pending" }))).toBe("bg-muted-foreground");
  });

  it("normalizes date options and page bounds", () => {
    expect(dateOptionValue({ date_select: "today" } as CancelableDateOption)).toBe("today");
    expect(dateOptionLabel({ name: "Custom range", value: "custom" } as CancelableDateOption)).toBe("Custom range");
    expect(dateOptionLabel({ value: "custom" } as CancelableDateOption)).toBe("custom");
    expect(pageBounds(2, 20, 8, 45)).toEqual({ start: 21, end: 28 });
    expect(pageBounds(1, 20, 0, 0)).toEqual({ start: 0, end: 0 });
  });
});
