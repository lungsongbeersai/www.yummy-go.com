import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  publicApiRequest: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  publicApiRequest: apiMocks.publicApiRequest,
  ServiceError: class ServiceError extends Error {},
}));

import {
  customerFetchCateProducts,
  customerGetProdItem,
  customerUpdateOrderNote,
} from "@/services/public-pos/requests";

describe("public pos requests", () => {
  beforeEach(() => {
    apiMocks.publicApiRequest.mockReset();
  });

  it("maps public camel-case catalog params to wire keys and returns the domain response", async () => {
    apiMocks.publicApiRequest.mockResolvedValue({
      status: "success",
      message: "success",
      selected_cate_uuid: "cate-1",
      data: [
        {
          cate_uuid: "cate-1",
          cate_name: "Beer",
          products: [
            {
              prod_uuid: "prod-1",
              prod_sort: "2",
              prod_name: "Beer",
              prod_image: "",
              prod_status_imge: 1,
              status_sort_fk: 1,
              can_add: true,
              has_options: false,
              options_msg: "",
              count_option_all: 0,
              count_option_enabled: 0,
              count_topping_enabled: 0,
            },
          ],
        },
      ],
    });

    const result = await customerFetchCateProducts({
      token: "table token",
      cateUuid: "cate-1",
      search: "beer",
      lang: "la",
    });

    expect(apiMocks.publicApiRequest).toHaveBeenCalledWith(
      "get",
      "/api/v1/posAll/customer/fetch_cate_products",
      {
        params: {
          t: "table token",
          cate_uuid: "cate-1",
          lang: "la",
          search: "beer",
        },
      },
    );
    expect(result.selectedCateUuid).toBe("cate-1");
    expect(result.categories[0]?.products[0]).toMatchObject({
      prodUuid: "prod-1",
      prodSort: "2",
    });
  });

  it("maps public camel-case product params to the exact wire body and domain aggregate", async () => {
    apiMocks.publicApiRequest.mockResolvedValue({
      data: {
        prod_uuid: "prod-1",
        prod_name: "Beer",
        prod_status_imge: 1,
        prod_image: "",
        details: [
          {
            pro_detail_uuid: "detail-1",
            pro_detail_sprice: "12000",
          },
        ],
        toppings: [
          {
            prod_topping_uuid: "product-topping-1",
            topping_name_eng: "Cheese",
          },
        ],
      },
    });

    const result = await customerGetProdItem({
      token: "table token",
      prodUuid: "prod-1",
      cateUuid: "cate-1",
      search: "beer",
      lang: "en",
    });

    expect(apiMocks.publicApiRequest).toHaveBeenCalledWith(
      "post",
      "/api/v1/posAll/customer/get_prod_item?t=table%20token",
      {
        data: {
          prod_uuid: "prod-1",
          lang: "eng",
          cate_uuid: "cate-1",
          search: "beer",
          status_sort_fk: 1,
        },
      },
    );
    expect(result).toMatchObject({
      prodUuid: "prod-1",
      prodName: "Beer",
      details: [{ proDetailUuid: "detail-1", proDetailSprice: "12000" }],
      toppings: [
        {
          prodToppingUuid: "product-topping-1",
          toppingNameEng: "Cheese",
        },
      ],
    });
  });

  it("patches customer order item note with the expected body", async () => {
    apiMocks.publicApiRequest.mockResolvedValue({ status: "success" });

    await customerUpdateOrderNote({
      t: "table-token",
      order_it_uuid: "8e99dfb5-929d-4030-a85c-48ffbaa9a650",
      order_it_note: "Testing",
    });

    expect(apiMocks.publicApiRequest).toHaveBeenCalledWith(
      "patch",
      "/api/v1/posAll/customer/update_note?t=table-token",
      {
        data: {
          order_it_uuid: "8e99dfb5-929d-4030-a85c-48ffbaa9a650",
          order_it_note: "Testing",
        },
      },
    );
  });
});
