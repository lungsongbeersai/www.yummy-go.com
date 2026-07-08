import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  apiRequest: vi.fn()
}));

vi.mock("@/lib/api", () => ({
  apiRequest: apiMocks.apiRequest
}));

import {
  getProducts,
  sortProductDetailsByProduct,
  sortProductsByCategory
} from "@/services/product/requests";

describe("product requests", () => {
  beforeEach(() => {
    apiMocks.apiRequest.mockReset();
  });

  it("sorts fetched product rows by prod_sort", async () => {
    apiMocks.apiRequest.mockResolvedValue({
      status: "success",
      message: "success",
      data: [
        { prod_uuid: "prod-3", prod_sort: 3 },
        { prod_uuid: "prod-unsorted" },
        { prod_uuid: "prod-1", prod_sort: 1 },
        { prod_uuid: "prod-2", prod_sort: "2" }
      ]
    });

    const result = await getProducts({ branch_uuid_fk: "branch-1", lang: "la" });

    expect(result.data.map((row) => row.prod_uuid)).toEqual([
      "prod-1",
      "prod-2",
      "prod-3",
      "prod-unsorted"
    ]);
  });

  it("posts product category sort payloads", async () => {
    apiMocks.apiRequest.mockResolvedValue({ status: "success", message: "success" });

    await sortProductsByCategory({
      cate_uuid_fk: "cate-1",
      items: [
        { prod_uuid: "prod-1", prod_sort: 1 },
        { prod_uuid: "prod-2", prod_sort: 2 }
      ]
    });

    expect(apiMocks.apiRequest).toHaveBeenCalledWith("post", "/api/v1/product/sort_by_category", {
      data: {
        cate_uuid_fk: "cate-1",
        items: [
          { prod_uuid: "prod-1", prod_sort: 1 },
          { prod_uuid: "prod-2", prod_sort: 2 }
        ]
      }
    });
  });

  it("posts product detail sort payloads", async () => {
    apiMocks.apiRequest.mockResolvedValue({ status: "success", message: "success" });

    await sortProductDetailsByProduct({
      prod_uuid_fk: "prod-1",
      items: [
        { pro_detail_uuid: "detail-1", pro_detail_sort: 1 },
        { pro_detail_uuid: "detail-2", pro_detail_sort: 2 }
      ]
    });

    expect(apiMocks.apiRequest).toHaveBeenCalledWith("post", "/api/v1/product/detail_sort_by_product", {
      data: {
        prod_uuid_fk: "prod-1",
        items: [
          { pro_detail_uuid: "detail-1", pro_detail_sort: 1 },
          { pro_detail_uuid: "detail-2", pro_detail_sort: 2 }
        ]
      }
    });
  });
});
