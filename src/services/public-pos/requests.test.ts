import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  publicApiRequest: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  publicApiRequest: apiMocks.publicApiRequest,
}));

import { customerUpdateOrderNote } from "@/services/public-pos/requests";

describe("public pos requests", () => {
  beforeEach(() => {
    apiMocks.publicApiRequest.mockReset();
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
      "/api/v1/pos/customer/update_note?t=table-token",
      {
        data: {
          order_it_uuid: "8e99dfb5-929d-4030-a85c-48ffbaa9a650",
          order_it_note: "Testing",
        },
      },
    );
  });
});
