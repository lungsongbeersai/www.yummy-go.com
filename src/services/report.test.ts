import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/lib/api";
import { getBestSellingProductsReport } from "./report";

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    apiRequest: vi.fn().mockResolvedValue({ data: [] }),
  };
});

const mockedApiRequest = vi.mocked(apiRequest);

describe("report services", () => {
  beforeEach(() => {
    mockedApiRequest.mockClear();
  });

  it("sends best-selling products query params expected by the API", async () => {
    await getBestSellingProductsReport({
      branch_uuid_fk: "branch-1",
      date_from: "2026-06-02",
      date_to: "2026-06-02",
      group_uuid_fk: "all",
      lang: "la",
      limit: 10,
      page: 1,
      sort_by: "date_asc",
    });

    expect(mockedApiRequest).toHaveBeenCalledWith(
      "get",
      "/api/v1/best_selling/best_selling_products",
      {
        params: {
          branch_uuid_fk: "branch-1",
          date_from: "2026-06-02",
          date_to: "2026-06-02",
          group_uuid_fk: "all",
          lang: "la",
          limit: 10,
          page: 1,
          sort_by: "date_asc",
        },
      },
    );
  });
});
