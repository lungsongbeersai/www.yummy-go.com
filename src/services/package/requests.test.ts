import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  apiRequest: vi.fn()
}));

vi.mock("@/lib/api", () => ({
  apiRequest: apiMocks.apiRequest
}));

import {
  createPackagePlan,
  fetchBillingCycles,
  fetchPackageMethods,
  fetchPackagePage,
  fetchPackagePlanGroups,
  reorderBillingCycles,
  reorderPackageDetails,
  reorderPackagePlans,
  savePackage
} from "@/services/package/requests";

describe("package requests", () => {
  beforeEach(() => {
    apiMocks.apiRequest.mockReset();
    apiMocks.apiRequest.mockResolvedValue({ status: "success", message: "success", data: [] });
  });

  it("fetches active billing cycles with the exact API query", async () => {
    await fetchBillingCycles("la");

    expect(apiMocks.apiRequest).toHaveBeenCalledWith("get", "/api/v1/packages/billing_cycles", {
      params: { lang: "la", billing_cycle_status: 1 }
    });
  });

  it("fetches active package methods with the exact API query", async () => {
    await fetchPackageMethods("la");

    expect(apiMocks.apiRequest).toHaveBeenCalledWith("get", "/api/v1/packages/methods", {
      params: { lang: "la", pk_method_status: 1 }
    });
  });

  it("creates a package plan with the exact API body", async () => {
    await createPackagePlan({
      billingCycleId: "cycle-1",
      methodId: "method-1",
      status: 1,
      sortOrder: 2
    });

    expect(apiMocks.apiRequest).toHaveBeenCalledWith("post", "/api/v1/packages/plans/create", {
      data: {
        billing_cycle_uuid_fk: "cycle-1",
        package_method_uuid_fk: "method-1",
        package_plan_status: 1,
        sort_order: 2
      }
    });
  });

  it("fetches package plan groups with the exact API query", async () => {
    await fetchPackagePlanGroups("la");

    expect(apiMocks.apiRequest).toHaveBeenCalledWith("get", "/api/v1/packages/plans/fetch", {
      params: { lang: "la", package_plan_status: "all" }
    });
  });

  it("saves a package with the exact API body", async () => {
    await savePackage({
      planId: "plan-1",
      nameLa: "Basic LA",
      nameEn: "Basic",
      price: 400000,
      status: 1,
      language: "la",
      details: [{ nameLa: "Detail LA", nameEn: "Detail", status: 1 }]
    });

    expect(apiMocks.apiRequest).toHaveBeenCalledWith("post", "/api/v1/packages/create", {
      data: {
        package_uuid: "",
        package_plan_uuid_fk: "plan-1",
        package_name_la: "Basic LA",
        package_name_eng: "Basic",
        package_price: 400000,
        package_status: 1,
        lang: "la",
        details: [
          {
            package_price_detail_uuid: "",
            detail_name_la: "Detail LA",
            detail_name_eng: "Detail",
            detail_status: 1
          }
        ]
      }
    });
  });

  it("fetches the package page with the exact API query", async () => {
    await fetchPackagePage({
      language: "la",
      status: "all",
      search: "",
      page: 1,
      limit: 10,
      orderBy: "asc"
    });

    expect(apiMocks.apiRequest).toHaveBeenCalledWith("get", "/api/v1/packages/fetch_limit", {
      params: {
        lang: "la",
        package_status: "all",
        search: "",
        page: 1,
        limit: 10,
        orderBy: "asc"
      }
    });
  });

  it("reorders billing cycles with the exact API body", async () => {
    await reorderBillingCycles([{ id: "cycle-2" }, { id: "cycle-1" }]);

    expect(apiMocks.apiRequest).toHaveBeenCalledWith("patch", "/api/v1/packages/billing_cycles/reorder", {
      data: {
        items: [
          { billing_cycle_uuid: "cycle-2", sort_order: 1 },
          { billing_cycle_uuid: "cycle-1", sort_order: 2 }
        ]
      }
    });
  });

  it("reorders package plans with the exact API body", async () => {
    await reorderPackagePlans("cycle-1", [{ id: "plan-2" }, { id: "plan-1" }]);

    expect(apiMocks.apiRequest).toHaveBeenCalledWith("patch", "/api/v1/packages/plans/reorder", {
      data: {
        billing_cycle_uuid_fk: "cycle-1",
        items: [
          { package_plan_uuid: "plan-2", sort_order: 1 },
          { package_plan_uuid: "plan-1", sort_order: 2 }
        ]
      }
    });
  });

  it("reorders package details with the exact API body", async () => {
    await reorderPackageDetails("package-1", [{ id: "detail-2" }, { id: "detail-1" }]);

    expect(apiMocks.apiRequest).toHaveBeenCalledWith("patch", "/api/v1/packages/price-details/reorder", {
      data: {
        package_uuid_fk: "package-1",
        items: [
          { package_price_detail_uuid: "detail-2", sort_order: 1 },
          { package_price_detail_uuid: "detail-1", sort_order: 2 }
        ]
      }
    });
  });

  it("normalizes English to the eng API language code", async () => {
    await fetchBillingCycles("en-US");

    expect(apiMocks.apiRequest).toHaveBeenCalledWith("get", "/api/v1/packages/billing_cycles", {
      params: { lang: "eng", billing_cycle_status: 1 }
    });
  });
});
