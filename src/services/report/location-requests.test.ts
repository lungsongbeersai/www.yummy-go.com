import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/lib/api";
import { getCustomerSalesReport } from "./customer-sales";
import { getEmployeeSalesReport } from "./employee-sales";
import { getVatReport } from "./vat";

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    apiRequest: vi.fn().mockResolvedValue({}),
  };
});

const mockedApiRequest = vi.mocked(apiRequest);
const location = {
  branch_uuid_fk: "branch-1",
  date_from: "2026-09-01",
  date_to: "2026-09-22",
  table_uuid_fk: "table-1",
  zone_uuid_fk: "zone-1",
};

describe("report_all location request params", () => {
  beforeEach(() => {
    mockedApiRequest.mockClear();
  });

  it("forwards location filters to employee sales", async () => {
    await getEmployeeSalesReport(location);

    expect(mockedApiRequest).toHaveBeenCalledWith(
      "get",
      "/api/v1/report_all/user_report",
      expect.objectContaining({ params: expect.objectContaining(location) }),
    );
  });

  it("forwards location filters to customer sales", async () => {
    await getCustomerSalesReport(location);

    expect(mockedApiRequest).toHaveBeenCalledWith(
      "get",
      "/api/v1/report_all/customer_report",
      expect.objectContaining({ params: expect.objectContaining(location) }),
    );
  });

  it("forwards location filters to VAT", async () => {
    await getVatReport(location);

    expect(mockedApiRequest).toHaveBeenCalledWith(
      "get",
      "/api/v1/report_all/vat_report",
      expect.objectContaining({ params: expect.objectContaining(location) }),
    );
  });
});
