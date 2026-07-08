import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  apiRequest: vi.fn()
}));

vi.mock("@/lib/api", () => ({
  apiRequest: apiMocks.apiRequest
}));

import {
  confirmToKitchen,
  createPayment,
  createTableQR,
  fetchCateProducts,
  printInvoice,
  splitBill
} from "@/services/pos/requests";

function product(prod_uuid: string, prod_sort?: number | string) {
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

  it("normalizes category products by prod_sort", async () => {
    apiMocks.apiRequest.mockResolvedValue({
      status: "success",
      message: "success",
      data: [
        {
          cate_uuid: "cate-1",
          cate_name: "Beer",
          products: [
            product("prod-3", 3),
            product("prod-unsorted"),
            product("prod-1", 1),
            product("prod-2", "2")
          ]
        }
      ],
      special_products: [product("special-2", 2), product("special-1", 1)]
    });

    const result = await fetchCateProducts({
      branch_uuid_fk: "branch-1",
      lang: "la"
    });

    expect(apiMocks.apiRequest).toHaveBeenCalledWith("get", "/api/v1/pos/fetch_cate_products", {
      params: {
        branch_uuid_fk: "branch-1",
        lang: "la",
        search: ""
      }
    });
    expect(result.data[0]?.products.map((item) => item.prod_uuid)).toEqual([
      "prod-1",
      "prod-2",
      "prod-3",
      "prod-unsorted"
    ]);
    expect(result.special_products?.map((item) => item.prod_uuid)).toEqual([
      "special-1",
      "special-2"
    ]);
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

    expect(apiMocks.apiRequest).toHaveBeenCalledWith("post", "/api/v1/pos/print_invoice", {
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
