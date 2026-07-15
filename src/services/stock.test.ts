import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  apiRequest: apiMocks.apiRequest,
}));

import { getStockProducts } from "@/services/stock";

describe("stock requests", () => {
  beforeEach(() => {
    apiMocks.apiRequest.mockReset();
  });

  it("requests stock with the default filters and pagination", async () => {
    const response = {
      status: "success",
      message: "success",
      data: [],
    };
    apiMocks.apiRequest.mockResolvedValue(response);

    await expect(getStockProducts({ branch_uuid_fk: "branch-1" })).resolves.toBe(response);

    expect(apiMocks.apiRequest).toHaveBeenCalledWith(
      "get",
      "/api/v1/product/stock_qty",
      {
        params: {
          branch_uuid_fk: "branch-1",
          category_fk: "all",
          stock_status: "all",
          page: 1,
          limit: 20,
          lang: "la",
        },
      },
    );
  });

  it("forwards stock filters and converts the API language", async () => {
    apiMocks.apiRequest.mockResolvedValue({
      status: "success",
      message: "success",
      data: [],
    });

    await getStockProducts({
      branch_uuid_fk: "branch-2",
      category_fk: "category-1",
      stock_status: "low_stock",
      page: 3,
      limit: 50,
      lang: "en",
    });

    expect(apiMocks.apiRequest).toHaveBeenCalledWith(
      "get",
      "/api/v1/product/stock_qty",
      {
        params: {
          branch_uuid_fk: "branch-2",
          category_fk: "category-1",
          stock_status: "low_stock",
          page: 3,
          limit: 50,
          lang: "eng",
        },
      },
    );
  });
});
