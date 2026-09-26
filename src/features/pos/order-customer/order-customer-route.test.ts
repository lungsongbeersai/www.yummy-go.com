import { describe, expect, it } from "vitest";
import { orderCustomerRouteInput } from "./order-customer-route";

describe("order customer route", () => {
  it("reads the selected table from the browser URL", () => {
    const params = new URLSearchParams(
      "table_uuid=a810a61e-b907-412a-a64a-8a6ffed00979&table_name=T02&zone_uuid=zone-1",
    );

    expect(orderCustomerRouteInput(params)).toEqual({
      initialTableUuid: "a810a61e-b907-412a-a64a-8a6ffed00979",
      initialTableName: "T02",
      initialZoneUuid: "zone-1",
    });
  });

  it("keeps counter-order routing backward compatible without table params", () => {
    expect(orderCustomerRouteInput(new URLSearchParams())).toEqual({
      initialTableUuid: "",
      initialTableName: "",
      initialZoneUuid: "",
    });
  });
});
