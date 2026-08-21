import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/lib/api";
import {
  getBestSellingProductsReport,
  getCategorySalesReport,
  getDailySaleItems,
  getDailyStoreClosingReport,
  getDailySalesBillReport,
  getDailySalesOrderReport,
  getPaymentMethodsReport
} from "./requests";

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

  it("sends category sales query params expected by the API", async () => {
    await getCategorySalesReport({
      branch_uuid_fk: "branch-1",
      date_from: "2026-05-01",
      date_to: "2026-06-28",
      lang: "la",
      limit: 10,
      orderBy: "DESC",
      page: 1,
      payment_method: "all",
    });

    expect(mockedApiRequest).toHaveBeenCalledWith(
      "get",
      "/api/v1/report_all/group_list",
      {
        params: {
          branch_uuid_fk: "branch-1",
          date_from: "2026-05-01",
          date_to: "2026-06-28",
          lang: "la",
          limit: 10,
          orderBy: "DESC",
          page: 1,
          payment_method: "all",
        },
      },
    );
  });

  it("sends daily store closing query params expected by the API", async () => {
    await getDailyStoreClosingReport({
      branch_uuid_fk: "branch-1",
      date_from: "2026-07-10",
      date_to: "2026-07-10",
      lang: "en",
    });

    expect(mockedApiRequest).toHaveBeenCalledWith(
      "get",
      "/api/v1/report_all/daily_closing",
      {
        params: {
          branch_uuid_fk: "branch-1",
          date_from: "2026-07-10",
          date_to: "2026-07-10",
          lang: "eng",
        },
      },
    );
  });

  it("sends payment methods query params expected by the new API", async () => {
    await getPaymentMethodsReport({
      branch_uuid_fk: "branch-1",
      date_from: "2026-06-01",
      date_to: "2026-07-01",
      lang: "la",
      limit: "All",
      page: 1,
      payment_method: "all",
    });

    expect(mockedApiRequest).toHaveBeenCalledWith(
      "get",
      "/api/v1/report_all/payment_summary_by_method",
      {
        params: {
          branch_uuid_fk: "branch-1",
          date_from: "2026-06-01",
          date_to: "2026-07-01",
          lang: "la",
          limit: "all",
          page: 1,
          payment_method: "all",
        },
      },
    );
  });

  it("sends sale list query params expected by the API", async () => {
    await getDailySaleItems({
      branch_uuid_fk: "branch-1",
      date_from: "2026-06-20",
      date_to: "2026-06-29",
      lang: "la",
      limit: 4,
      orderBy: "DESC",
      page: 1,
      search: "",
    });

    expect(mockedApiRequest).toHaveBeenCalledWith(
      "get",
      "/api/v1/report_all/sale_list",
      {
        params: {
          branch_uuid_fk: "branch-1",
          date_from: "2026-06-20",
          date_to: "2026-06-29",
          lang: "la",
          limit: 4,
          orderBy: "DESC",
          page: 1,
          payment_method: "All",
          search: "",
        },
      },
    );
  });

  it("sends daily sales bill report query params expected by the API", async () => {
    await getDailySalesBillReport({
      branch_uuid_fk: "branch-1",
      date_from: "2026-06-20",
      date_to: "2026-06-28",
      lang: "la",
      limit: 4,
      orderBy: "DESC",
      page: 1,
      payment_method: "All",
      search: "",
    });

    expect(mockedApiRequest).toHaveBeenCalledWith(
      "get",
      "/api/v1/report_all/sale_report_bill",
      {
        params: {
          branch_uuid_fk: "branch-1",
          date_from: "2026-06-20",
          date_to: "2026-06-28",
          lang: "la",
          limit: 4,
          orderBy: "DESC",
          page: 1,
          payment_method: "All",
          search: "",
        },
      },
    );
  });

  it("sends detailed sales report list query params expected by the API", async () => {
    await getDailySalesOrderReport({
      branch_uuid_fk: "branch-1",
      date_from: "2026-06-01",
      date_to: "2026-06-29",
      lang: "la",
      limit: 4,
      orderBy: "DESC",
      page: 1,
      payment_method: "All",
      search: "",
    });

    expect(mockedApiRequest).toHaveBeenCalledWith(
      "get",
      "/api/v1/report_all/sale_report_list",
      {
        params: {
          branch_uuid_fk: "branch-1",
          date_from: "2026-06-01",
          date_to: "2026-06-29",
          lang: "la",
          limit: 4,
          orderBy: "DESC",
          page: 1,
          payment_method: "All",
          search: "",
        },
      },
    );
  });

  it("sends selected sale list payment method to the API", async () => {
    await getDailySaleItems({
      branch_uuid_fk: "branch-1",
      date_from: "2026-06-20",
      date_to: "2026-06-29",
      lang: "la",
      limit: 4,
      orderBy: "DESC",
      page: 1,
      payment_method: "4",
      search: "",
    });

    expect(mockedApiRequest).toHaveBeenCalledWith(
      "get",
      "/api/v1/report_all/sale_list",
      expect.objectContaining({
        params: expect.objectContaining({
          payment_method: "4",
        }),
      }),
    );
  });
});
