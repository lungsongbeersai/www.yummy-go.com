import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/lib/api";
import { fetchMySales } from "./my-sales";

vi.mock("@/lib/api", () => ({ apiRequest: vi.fn(), ServiceError: class extends Error {} }));

const request = vi.mocked(apiRequest);

describe("personal sales service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses the authenticated endpoint and sends only permitted filters", async () => {
    request.mockResolvedValue({ status: "success", data: [] });
    const untrustedInput = {
      page: 3, limit: 50, lang: "en", search: "  noodles  ", date_start: "2026-11-01", date_end: "2026-11-05",
      kitchen_status: "partial" as const, payment_status: "unpaid" as const,
      login_uuid_fk: "another-user", branch_uuid_fk: "another-branch", store_uuid_fk: "another-store",
    };
    await fetchMySales(untrustedInput);
    expect(request).toHaveBeenCalledWith("get", "/api/v1/posAll/my_sales", {
      params: {
        page: 3, limit: 50, lang: "eng", search: "noodles",
        date_start: "2026-11-01", date_end: "2026-11-05", kitchen_status: "partial", payment_status: "unpaid",
      },
    });
  });

  it("leaves dates unrestricted so old unclosed orders remain visible", async () => {
    request.mockResolvedValue({ status: "success", data: [] });
    await fetchMySales({ date_start: "", date_end: "" });
    expect(request).toHaveBeenCalledWith("get", "/api/v1/posAll/my_sales", {
      params: { page: 1, limit: 20, search: "", lang: "la", kitchen_status: "all", payment_status: "all" },
    });
  });

  it("supports the API's cancelled kitchen filter without forwarding identity or unsupported sorting", async () => {
    request.mockResolvedValue({ status: "success", data: [] });
    const untrustedInput = {
      kitchen_status: "cancelled" as const,
      payment_status: "cancelled" as const,
      login_uuid_fk: "another-user",
      branch_uuid_fk: "another-branch",
      orderBy: "ASC",
    };
    await fetchMySales(untrustedInput);
    expect(request).toHaveBeenCalledWith("get", "/api/v1/posAll/my_sales", {
      params: {
        page: 1, limit: 20, search: "", lang: "la",
        kitchen_status: "cancelled", payment_status: "cancelled",
      },
    });
  });

  it("propagates Backend failures instead of returning a local result", async () => {
    request.mockRejectedValue(new Error("Backend unavailable"));
    await expect(fetchMySales({})).rejects.toThrow("Backend unavailable");
  });
});
