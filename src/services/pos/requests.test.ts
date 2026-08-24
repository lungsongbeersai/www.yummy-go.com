import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  apiRequest: vi.fn()
}));

vi.mock("@/lib/api", () => ({
  apiRequest: apiMocks.apiRequest,
  ServiceError: class ServiceError extends Error {}
}));

import {
  confirmToKitchen,
  createPayment,
  createTableQR,
  fetchCateProducts,
  getProdItem,
  printInvoice,
  reprintReceipt,
  splitBill
} from "@/services/pos/requests";
import { normalizeFetchCateProductsResponse } from "@/services/pos/normalizers";
import type { ApiCateProductItem } from "@/services/pos/api-types";

function product(prod_uuid: string, prod_sort?: number | string): ApiCateProductItem {
  return {
    prod_uuid,
    prod_sort,
    prod_name: prod_uuid,
    prod_image: "",
    prod_status_imge: 1,
    status_sort_fk: 1,
    can_add: true,
    has_options: false,
    options_msg: "",
    count_option_all: 0,
    count_option_enabled: 0,
    count_topping_enabled: 0
  };
}

describe("pos requests", () => {
  beforeEach(() => {
    apiMocks.apiRequest.mockReset();
  });

  it("maps the raw catalog response to camel-case domain values without coercing product fields", () => {
    const result = normalizeFetchCateProductsResponse({
      status: "success",
      message: "success",
      branch_uuid_fk: "branch-1",
      selected_cate_uuid: "cate-1",
      default_cate_uuid: "cate-1",
      total_special: 2,
      data: [
        {
          cate_uuid: "cate-1",
          cate_name: "Beer",
          cate_icon: "beer",
          products: [
            product("prod-3", 3),
            product("prod-unsorted"),
            {
              ...product("prod-1", 1),
              prod_code: "BEER-1",
              type_group: "set",
              unite_name: "bottle",
              prod_set_price: "25000",
              min_price: "10000",
              max_price: 15000,
              can_add: false,
              has_options: true,
              options_msg: "Choose a size",
              sold_out_manual: false,
              sold_out_msg: "",
              stock_sold_out: false,
              stock_available: true,
              count_option_all: 4,
              count_option_enabled: 3,
              count_topping_enabled: 2,
              customer_buy: 2,
              customer_free: 1,
              pro_detail_uuid: "detail-1",
            },
            product("prod-2", "2")
          ]
        }
      ],
      special_products: [product("special-2", 2), product("special-1", 1)]
    });

    expect(result).toMatchObject({
      branchUuidFk: "branch-1",
      selectedCateUuid: "cate-1",
      defaultCateUuid: "cate-1",
      totalSpecial: 2,
      categories: [
        {
          cateUuid: "cate-1",
          cateName: "Beer",
          cateIcon: "beer"
        }
      ]
    });
    expect(result.categories[0]?.products.map((item) => item.prodUuid)).toEqual([
      "prod-1",
      "prod-2",
      "prod-3",
      "prod-unsorted"
    ]);
    expect(result.specialProducts?.map((item) => item.prodUuid)).toEqual([
      "special-1",
      "special-2"
    ]);
    expect(result.categories[0]?.products[0]).toMatchObject({
      prodUuid: "prod-1",
      prodSort: 1,
      prodCode: "BEER-1",
      typeGroup: "set",
      uniteName: "bottle",
      prodSetPrice: "25000",
      minPrice: "10000",
      maxPrice: 15000,
      canAdd: false,
      hasOptions: true,
      optionsMsg: "Choose a size",
      soldOutManual: false,
      soldOutMsg: "",
      stockSoldOut: false,
      stockAvailable: true,
      countOptionAll: 4,
      countOptionEnabled: 3,
      countToppingEnabled: 2,
      customerBuy: 2,
      customerFree: 1,
      proDetailUuid: "detail-1"
    });
    expect(result).not.toHaveProperty("data");
    expect(result.categories[0]?.products[0]).not.toHaveProperty("prod_uuid");
  });

  it("maps camel-case catalog params to the exact API query", async () => {
    apiMocks.apiRequest.mockResolvedValue({
      status: "success",
      message: "success",
      data: []
    });

    const result = await fetchCateProducts({
      branchUuidFk: "branch-1",
      cateUuid: "cate-1",
      statusSortFk: 2,
      search: "beer",
      lang: "la"
    });

    expect(apiMocks.apiRequest).toHaveBeenCalledWith("get", "/api/v1/pos/fetch_cate_products", {
      params: {
        branch_uuid_fk: "branch-1",
        cate_uuid: "cate-1",
        status_sort_fk: 2,
        lang: "la",
        search: "beer"
      }
    });
    expect(result.categories).toEqual([]);
  });

  it("maps a raw product aggregate and sends the existing exact product body", async () => {
    apiMocks.apiRequest.mockResolvedValue({
      data: {
        prod_uuid: "prod-1",
        prod_code: "BEER-1",
        prod_name: "Beer",
        prod_status_imge: 1,
        prod_image: "beer.png",
        prod_color: "#f59e0b",
        prod_price: "12000",
        type_group: "normal",
        unite_name: "bottle",
        prod_set_price: null,
        pro_detail_sprice: "11000",
        details: [
          {
            pro_detail_uuid: "detail-1",
            pro_detail_id: "7",
            pro_detail_sort: "2",
            size_uuid_fk: "size-1",
            size_name: "Large",
            price: "12000",
            pro_detail_sprice: "11000",
            qty_stock: 8,
            pro_detail_qty_stock: "8",
            pro_detail_enabled: 1,
            pro_detail_status: 1,
            cut_stock: 2,
            pro_detail_cus_qtyBuy: 2,
            pro_detail_cus_qtyFree: 1,
            pro_detail_sDate: "2026-07-01",
            pro_detail_eDate: "2026-07-31",
            pro_detail_sTime: "09:00",
            pro_detail_eTime: "18:00",
            default_qty: 2
          }
        ],
        toppings: [
          {
            prod_topping_uuid: "product-topping-1",
            topping_uuid_fk: "topping-1",
            topping_uuid: "topping-1",
            topping_name: "Cheese",
            topping_name_la: "ເນີຍແຂງ",
            topping_name_eng: "Cheese",
            topping_price: "3000",
            topping_enabled: 1,
            topping_status: 1
          }
        ]
      }
    });

    const result = await getProdItem({
      prodUuid: "prod-1",
      cateUuid: "cate-1",
      search: "beer",
      statusSortFk: 2,
      lang: "en"
    });

    expect(apiMocks.apiRequest).toHaveBeenCalledWith("post", "/api/v1/pos/get_prod_item", {
      data: {
        prod_uuid: "prod-1",
        lang: "eng"
      }
    });
    expect(result).toEqual({
      prodUuid: "prod-1",
      prodCode: "BEER-1",
      prodName: "Beer",
      prodStatusImge: 1,
      prodImage: "beer.png",
      prodColor: "#f59e0b",
      prodPrice: "12000",
      typeGroup: "normal",
      uniteName: "bottle",
      prodSetPrice: null,
      proDetailSprice: "11000",
      details: [
        {
          proDetailUuid: "detail-1",
          proDetailId: "7",
          proDetailSort: "2",
          sizeUuidFk: "size-1",
          sizeName: "Large",
          price: "12000",
          proDetailSprice: "11000",
          qtyStock: 8,
          proDetailQtyStock: "8",
          proDetailEnabled: 1,
          proDetailStatus: 1,
          cutStock: 2,
          proDetailCusQtyBuy: 2,
          proDetailCusQtyFree: 1,
          proDetailSDate: "2026-07-01",
          proDetailEDate: "2026-07-31",
          proDetailSTime: "09:00",
          proDetailETime: "18:00",
          defaultQty: 2
        }
      ],
      toppings: [
        {
          prodToppingUuid: "product-topping-1",
          toppingUuidFk: "topping-1",
          toppingUuid: "topping-1",
          toppingName: "Cheese",
          toppingNameLa: "ເນີຍແຂງ",
          toppingNameEng: "Cheese",
          toppingPrice: "3000",
          toppingEnabled: 1,
          toppingStatus: 1
        }
      ]
    });
  });

  it("defaults missing product collections to empty arrays instead of crashing", async () => {
    // get_prod_item can omit details/toppings entirely (e.g. a product with
    // no purchasable variant yet); normalizeProdItem() in the order-customer
    // feature already has a graceful fallback for this (synthesizes a
    // single detail from the menu-listing item), so the mapper must not
    // throw here — it must resolve to empty arrays and let that fallback run.
    apiMocks.apiRequest.mockResolvedValue({
      data: {
        prod_uuid: "prod-1",
        prod_name: "Beer",
        prod_status_imge: 1,
        prod_image: "",
      },
    });

    const result = await getProdItem({
      prodUuid: "prod-1",
      lang: "la",
    });

    expect(result.details).toEqual([]);
    expect(result.toppings).toEqual([]);
  });

  it("posts the invoice print body expected by the API", async () => {
    apiMocks.apiRequest.mockResolvedValue({ status: "success" });

    await printInvoice({
      login_uuid_fk: "login-1",
      order_uuid: "order-1",
      lang: "la",
      document_type: "invoice",
      device_code: "device-1",
      agent_id: "agent-1",
      print_mode: "agent",
      order_item_uuids: ["item-1"]
    } as Parameters<typeof printInvoice>[0] & { order_item_uuids: string[] });

    expect(apiMocks.apiRequest).toHaveBeenCalledWith("post", "/api/v1/posAll/print_invoice", {
      data: {
        login_uuid_fk: "login-1",
        order_uuid: "order-1",
        lang: "la",
        document_type: "invoice",
        device_code: "device-1",
        agent_id: "agent-1",
        print_mode: "agent"
      }
    });
  });

  it("posts only the reprint receipt fields with a normalized language", async () => {
    apiMocks.apiRequest.mockResolvedValue({
      print_job: { print_job_uuid: "job-1" }
    });

    await reprintReceipt({
      order_uuid: "order-1",
      login_uuid_fk: "login-1",
      lang: "en-US",
      device_code: "device-1",
      agent_id: "agent-1",
      print_mode: "windows_agent"
    });

    expect(apiMocks.apiRequest).toHaveBeenCalledWith("post", "/api/v1/pos/reprint_receipt", {
      data: {
        order_uuid: "order-1",
        login_uuid_fk: "login-1",
        lang: "eng",
        device_code: "device-1",
        agent_id: "agent-1",
        print_mode: "windows_agent"
      }
    });
  });

  it("patches kitchen confirmation with printer identity fields", async () => {
    apiMocks.apiRequest.mockResolvedValue({ status: "success" });

    await confirmToKitchen({
      login_uuid_fk: "login-1",
      order_uuid: "order-1",
      order_item_uuids: ["item-1"],
      lang: "la",
      device_code: "device-1",
      agent_id: "agent-1",
      print_mode: "agent"
    });

    expect(apiMocks.apiRequest).toHaveBeenCalledWith("patch", "/api/v1/pos/confirm_to_kitchen", {
      data: {
        order_uuid: "order-1",
        login_uuid_fk: "login-1",
        order_item_uuids: ["item-1"],
        lang: "la",
        device_code: "device-1",
        agent_id: "agent-1",
        print_mode: "agent"
      }
    });
  });

  it("patches kitchen confirmation without order_item_uuids when confirming the whole order", async () => {
    apiMocks.apiRequest.mockResolvedValue({ status: "success" });

    await confirmToKitchen({
      login_uuid_fk: "fc445438-e617-471c-9af3-262ae747932f",
      order_uuid: "8ea2f7a8-e21a-4d55-b8d6-70df22e1376b",
      lang: "la",
      device_code: "INCLUDE",
      agent_id: "include-f8e4f9",
      print_mode: "windows_agent"
    });

    expect(apiMocks.apiRequest).toHaveBeenCalledWith("patch", "/api/v1/pos/confirm_to_kitchen", {
      data: {
        login_uuid_fk: "fc445438-e617-471c-9af3-262ae747932f",
        order_uuid: "8ea2f7a8-e21a-4d55-b8d6-70df22e1376b",
        lang: "la",
        device_code: "INCLUDE",
        agent_id: "include-f8e4f9",
        print_mode: "windows_agent"
      }
    });
  });

  it("posts payment with printer identity fields", async () => {
    apiMocks.apiRequest.mockResolvedValue({ status: "success" });

    await createPayment({
      order_uuid: "order-1",
      table_uuid: "table-5",
      customer_uuid_fk: "customer-1",
      payment_method: 1,
      order_channel: 1,
      amount: 100,
      cash_payment_amount: 100,
      transfer_payment_amount: 0,
      change_amount: 0,
      paid_at: null,
      lang: "la",
      login_uuid_fk: "login-1",
      device_code: "WINDOWS-001",
      agent_id: "WINDOWS-AGENT-001",
      print_mode: "windows_agent"
    });

    expect(apiMocks.apiRequest).toHaveBeenCalledWith("post", "/api/v1/pos/payment", {
      data: {
        order_uuid: "order-1",
        table_uuid: "table-5",
        customer_uuid_fk: "customer-1",
        payment_method: 1,
        order_channel: 1,
        amount: 100,
        cash_payment_amount: 100,
        transfer_payment_amount: 0,
        change_amount: 0,
        paid_at: null,
        lang: "la",
        login_uuid_fk: "login-1",
        device_code: "WINDOWS-001",
        agent_id: "WINDOWS-AGENT-001",
        print_mode: "windows_agent"
      }
    });
  });

  it("posts split bill with printer identity fields", async () => {
    apiMocks.apiRequest.mockResolvedValue({ status: "success" });

    await splitBill({
      order_uuid: "order-1",
      table_uuid: "table-5",
      order_item_uuids: ["item-1"],
      document_type: "receipt",
      customer_uuid_fk: "customer-1",
      payment_method: 1,
      order_channel: 1,
      amount: 100,
      cash_payment_amount: 100,
      transfer_payment_amount: 0,
      change_amount: 0,
      note: "",
      lang: "la",
      login_uuid_fk: "login-1",
      device_code: "WINDOWS-001",
      agent_id: "WINDOWS-AGENT-001",
      print_mode: "windows_agent"
    });

    expect(apiMocks.apiRequest).toHaveBeenCalledWith("post", "/api/v1/pos/split_bill", {
      data: {
        order_uuid: "order-1",
        table_uuid: "table-5",
        order_item_uuids: ["item-1"],
        document_type: "receipt",
        customer_uuid_fk: "customer-1",
        payment_method: 1,
        order_channel: 1,
        amount: 100,
        cash_payment_amount: 100,
        transfer_payment_amount: 0,
        change_amount: 0,
        note: "",
        lang: "la",
        login_uuid_fk: "login-1",
        device_code: "WINDOWS-001",
        agent_id: "WINDOWS-AGENT-001",
        print_mode: "windows_agent"
      }
    });
  });

  it("posts split invoices to split_bill without full-order fields", async () => {
    apiMocks.apiRequest.mockResolvedValue({
      print_job: { print_job_uuid: "job-1" }
    });

    await splitBill({
      order_uuid: "532f836f-d580-4244-b2fa-615526292b73",
      order_item_uuids: ["221aa39e-a6b7-4fcb-be26-dc0255bc10d2"],
      document_type: "invoice",
      order_channel: 1,
      customer_uuid_fk: "95eed663-1bad-4b2d-99c8-07676be13e94",
      payment_method: 1,
      amount: 63840,
      cash_payment_amount: 63840,
      transfer_payment_amount: 0,
      change_amount: 0,
      note: "split bill cash payment",
      lang: "la",
      login_uuid_fk: "fc445438-e617-471c-9af3-262ae747932f",
      device_code: "INCLUDE",
      agent_id: "include-f8e4f9",
      print_mode: "windows_agent"
    });

    expect(apiMocks.apiRequest).toHaveBeenCalledWith("post", "/api/v1/pos/split_bill", {
      data: {
        order_uuid: "532f836f-d580-4244-b2fa-615526292b73",
        order_item_uuids: ["221aa39e-a6b7-4fcb-be26-dc0255bc10d2"],
        document_type: "invoice",
        order_channel: 1,
        customer_uuid_fk: "95eed663-1bad-4b2d-99c8-07676be13e94",
        payment_method: 1,
        amount: 63840,
        cash_payment_amount: 63840,
        transfer_payment_amount: 0,
        change_amount: 0,
        note: "split bill cash payment",
        lang: "la",
        login_uuid_fk: "fc445438-e617-471c-9af3-262ae747932f",
        device_code: "INCLUDE",
        agent_id: "include-f8e4f9",
        print_mode: "windows_agent"
      }
    });
  });

  it("fetches table QR with printer identity fields", async () => {
    apiMocks.apiRequest.mockResolvedValue({ status: "success" });

    await createTableQR({
      table_uuid: "table-1",
      login_uuid_fk: "login-1",
      lang: "la",
      device_code: "WINDOWS-001",
      agent_id: "WINDOWS-AGENT-001",
      print_mode: "windows_agent"
    });

    expect(apiMocks.apiRequest).toHaveBeenCalledWith("get", "/api/v1/pos/admin/create_table_qr", {
      params: {
        table_uuid: "table-1",
        lang: "la",
        login_uuid_fk: "login-1",
        device_code: "WINDOWS-001",
        agent_id: "WINDOWS-AGENT-001",
        print_mode: "windows_agent"
      }
    });
  });

  it("patches kitchen confirmation with mobile wifi printer identity fields", async () => {
    apiMocks.apiRequest.mockResolvedValue({ status: "success" });

    await confirmToKitchen({
      login_uuid_fk: "login-1",
      order_uuid: "order-1",
      order_item_uuids: ["item-1"],
      lang: "la",
      device_code: "MOBILE-001",
      agent_id: "MOBILE-AGENT-001",
      print_mode: "mobile_wifi"
    });

    expect(apiMocks.apiRequest).toHaveBeenCalledWith("patch", "/api/v1/pos/confirm_to_kitchen", {
      data: {
        order_uuid: "order-1",
        login_uuid_fk: "login-1",
        order_item_uuids: ["item-1"],
        lang: "la",
        device_code: "MOBILE-001",
        agent_id: "MOBILE-AGENT-001",
        print_mode: "mobile_wifi"
      }
    });
  });

  it("posts payment with mobile wifi printer identity fields", async () => {
    apiMocks.apiRequest.mockResolvedValue({ status: "success" });

    await createPayment({
      order_uuid: "order-1",
      table_uuid: "table-5",
      customer_uuid_fk: "customer-1",
      payment_method: 1,
      order_channel: 1,
      amount: 100,
      cash_payment_amount: 100,
      transfer_payment_amount: 0,
      change_amount: 0,
      paid_at: null,
      lang: "la",
      login_uuid_fk: "login-1",
      device_code: "MOBILE-001",
      agent_id: "MOBILE-AGENT-001",
      print_mode: "mobile_wifi"
    });

    expect(apiMocks.apiRequest).toHaveBeenCalledWith("post", "/api/v1/pos/payment", {
      data: {
        order_uuid: "order-1",
        table_uuid: "table-5",
        customer_uuid_fk: "customer-1",
        payment_method: 1,
        order_channel: 1,
        amount: 100,
        cash_payment_amount: 100,
        transfer_payment_amount: 0,
        change_amount: 0,
        paid_at: null,
        lang: "la",
        login_uuid_fk: "login-1",
        device_code: "MOBILE-001",
        agent_id: "MOBILE-AGENT-001",
        print_mode: "mobile_wifi"
      }
    });
  });
});
