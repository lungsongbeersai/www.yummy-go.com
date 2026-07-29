import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  apiRequest: vi.fn()
}));

vi.mock("@/lib/api", () => ({
  apiRequest: apiMocks.apiRequest
}));

import { deleteCustomer, saveCustomer } from "@/services/customer";

describe("customer service", () => {
  beforeEach(() => {
    apiMocks.apiRequest.mockReset();
    apiMocks.apiRequest.mockResolvedValue({ status: "success", message: "success" });
  });

  it("sends customer_uuid as a DELETE query parameter", async () => {
    await deleteCustomer("07f6e139-fbc9-45ae-bde5-1e7d22a97f15");

    expect(apiMocks.apiRequest).toHaveBeenCalledWith(
      "delete",
      "/api/v1/customer/delete",
      {
        params: {
          customer_uuid: "07f6e139-fbc9-45ae-bde5-1e7d22a97f15"
        }
      },
      "Failed to delete data"
    );
  });

  it("returns a customer when the create API puts the entity at the top level", async () => {
    apiMocks.apiRequest.mockResolvedValue({
      status: "success",
      message: "create customer success",
      customer_id: "39",
      customer_uuid: "07f6e139-fbc9-45ae-bde5-1e7d22a97f15",
      member_code: "00555",
      customer_name: "5555",
      customer_phone: "555",
      customer_address: "555",
      customer_status: 0,
      store_uuid_fk: "91982214-7d33-43fe-991d-1e8027d45ba6"
    });

    await expect(
      saveCustomer({
        store_uuid_fk: "91982214-7d33-43fe-991d-1e8027d45ba6",
        member_code: "00555",
        customer_name: "5555",
        customer_phone: "555",
        customer_address: "555",
        customer_status: 0
      })
    ).resolves.toMatchObject({
      customer_uuid: "07f6e139-fbc9-45ae-bde5-1e7d22a97f15",
      customer_name: "5555"
    });
  });

  it("returns a safe fallback row when create succeeds without an entity", async () => {
    apiMocks.apiRequest.mockResolvedValue({
      status: "success",
      message: "create customer success"
    });

    await expect(
      saveCustomer({
        store_uuid_fk: "store-1",
        customer_name: "Walk in",
        customer_phone: "02055555555"
      })
    ).resolves.toMatchObject({
      customer_uuid: "",
      customer_name: "Walk in",
      customer_phone: "02055555555",
      customer_status: 1,
      store_uuid_fk: "store-1"
    });
  });
});
