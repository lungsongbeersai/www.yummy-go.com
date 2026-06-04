import { describe, expect, it } from "vitest";
import type { Customer } from "@/services/customer";
import type { CartOrder, PosTable } from "@/services/pos";
import type { AuthUser } from "@/stores/auth-store";
import {
  amountInput,
  buildInvoicePrintData,
  currencyMoney,
  defaultCustomerFromRows,
  defaultCustomerSearchTerm,
  defaultCurrencyInput,
  displayCaretFromRawCaret,
  exchangeCurrencyOptions,
  formatAmountInputDisplay,
  LAK_CURRENCY_OPTION,
  paymentAmounts,
  paymentNote,
  paymentValidation,
  quickCashAmounts,
  rawCaretFromDisplayCaret,
  renderLocalInvoiceHtml,
} from "./payment-dialog-utils";

const usd = {
  value: "usd",
  code: "USD",
  label: "USD",
  rate: 20000,
};

function order(): CartOrder {
  return {
    order_uuid: "order-1",
    order_invoice: "INV-1",
    items: [
      {
        order_it_uuid: "item-1",
        prod_name: "Noodle",
        detail: {
          order_it_qty: 2,
          unit_price: 10000,
          net_total: 20000,
          gross_total: 24000,
          order_it_discount_amount: 4000,
          size_name: "M",
        },
        toppings: [
          { topping_name: "Egg", topping_qty: 1, topping_price: 2000 },
        ],
      },
    ],
    sum_grand_total: 20000,
    totals: {
      order_grand_total: 20000,
      order_subtotal: 24000,
      order_discount_amount: 4000,
    },
  } as CartOrder;
}

const table: PosTable = {
  table_uuid: "table-1",
  table_name: "A1",
  table_status: 2,
};

const customer = {
  customer_uuid: "customer-1",
  customer_name: "<VIP>",
} as Customer;

const translate = (key: string, options?: Record<string, unknown>) =>
  options?.percent ? `${key}:${options.percent}` : key;

describe("payment dialog helpers", () => {
  it("finds default customer terms by language and exact name", () => {
    const laoCustomer = {
      customer_uuid: "default-la",
      customer_name: " ລູກຄ້າທົ່ວໄປ ",
    } as Customer;
    const englishCustomer = {
      customer_uuid: "default-en",
      customer_name: "Customer",
    } as Customer;
    const similarCustomer = {
      customer_uuid: "similar",
      customer_name: "customer1",
    } as Customer;

    expect(defaultCustomerSearchTerm("la")).toBe("ລູກຄ້າທົ່ວໄປ");
    expect(defaultCustomerSearchTerm("eng")).toBe("customer");
    expect(defaultCustomerSearchTerm("en")).toBe("customer");
    expect(defaultCustomerFromRows([similarCustomer], "customer")).toBeNull();
    expect(defaultCustomerFromRows([similarCustomer, englishCustomer], "customer")).toBe(
      englishCustomer,
    );
    expect(
      defaultCustomerFromRows([laoCustomer], defaultCustomerSearchTerm("la")),
    ).toBe(laoCustomer);
  });

  it("calculates payment amounts and validation", () => {
    const cash = paymentAmounts("cash", 50000, "40000", "", "", 1);
    expect(cash.balance).toBe(10000);
    expect(
      paymentValidation("cash", "order-1", 50000, cash, "customer-1"),
    ).toBe("pos.paymentCashInsufficient");

    const mixed = paymentAmounts(
      "cash_transfer",
      50000,
      "",
      "20000",
      "30000",
      1,
    );
    expect(mixed).toMatchObject({ cash: 20000, transfer: 30000, balance: 0 });
    expect(
      paymentValidation("cash_transfer", "order-1", 50000, mixed, "customer-1"),
    ).toBeNull();
    expect(paymentValidation("cash", "", 50000, mixed, "customer-1")).toBe(
      "pos.paymentMissingOrder",
    );
    expect(paymentValidation("cash", "order-1", 50000, mixed, "")).toBe(
      "pos.paymentCustomerRequired",
    );
  });

  it("formats currency input and caret positions", () => {
    expect(amountInput("0012.345", true)).toBe("12.34");
    expect(amountInput("0012.345", false)).toBe("12345");
    expect(defaultCurrencyInput(50000, LAK_CURRENCY_OPTION)).toBe("50000");
    expect(defaultCurrencyInput(50000, usd)).toBe("2.5");
    expect(formatAmountInputDisplay("1234567", LAK_CURRENCY_OPTION)).toBe(
      "1,234,567",
    );
    expect(rawCaretFromDisplayCaret("1,234", 5, false)).toBe(4);
    expect(displayCaretFromRawCaret("1234", 3, LAK_CURRENCY_OPTION)).toBe(4);
  });

  it("builds quick amounts, money labels, and payment notes", () => {
    expect(quickCashAmounts(125000, LAK_CURRENCY_OPTION)).toEqual([
      125000, 150000, 200000, 250000,
    ]);
    expect(currencyMoney(2.5, usd)).toBe("2,5 USD");
    expect(paymentNote("transfer", "")).toBe("TransferPayment");
    expect(paymentNote("cash", " custom ")).toBe("custom");
  });

  it("normalizes exchange options", () => {
    expect(
      exchangeCurrencyOptions([
        {
          ex_uuid: "ex-1",
          currency_name: "usd",
          currency_uuid_fk: "usd",
          ex_price: 20000,
          ex_status: 1,
        },
        {
          ex_uuid: "ex-2",
          currency_name: "usd",
          currency_uuid_fk: "usd-2",
          ex_price: 21000,
          ex_status: 1,
        },
        {
          ex_uuid: "ex-3",
          currency_name: "THB",
          currency_uuid_fk: "thb",
          ex_price: 0,
          ex_status: 1,
        },
      ]),
    ).toEqual([
      LAK_CURRENCY_OPTION,
      { value: "usd", code: "USD", label: "USD", rate: 20000, icon: undefined },
    ]);
  });

  it("builds escaped invoice print HTML data", () => {
    const data = buildInvoicePrintData({
      invoice: "INV-1",
      orders: [order()],
      qrUrl: "https://example.com/qr.png",
      selectedCustomer: customer,
      summary: {
        grandTotal: 20000,
        orderDiscount: 4000,
        orderVat: null,
        serviceRate: null,
        serviceTotal: 0,
        subtotal: 24000,
        tax: 0,
        taxRate: null,
        vatTotal: null,
      } as ReturnType<typeof import("./utils").cartSummary>,
      table,
      translate,
      user: {
        uuid: "user-1",
        email: "cashier@example.com",
        store_name: "<Store>",
        branch_name: "Branch",
      } as unknown as AuthUser,
    });

    const html = renderLocalInvoiceHtml(data, "safe");
    expect(data.customer).toBe("<VIP>");
    expect(data.items[0]).toMatchObject({
      name: "Noodle (M)",
      displayTotal: 20000,
      hasItemDiscount: true,
    });
    expect(html).toContain("&lt;Store&gt;");
    expect(html).toContain("&lt;VIP&gt;");
  });
});
