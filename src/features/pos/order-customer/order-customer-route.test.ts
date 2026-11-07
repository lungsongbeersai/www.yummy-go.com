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
      initialBillRequestKey: "",
    });
  });

  it("opens the requested table's cart for a bill request", () => {
    expect(orderCustomerRouteInput(new URLSearchParams("table_uuid=table-2&bill_request=bill-1%3Aopen-2"))).toMatchObject({
      initialTableUuid: "table-2",
      initialBillRequestKey: "bill-1:open-2",
    });
  });

  it("ignores bill intents without a real table", () => {
    expect(orderCustomerRouteInput(new URLSearchParams("bill_request=bill-1"))).toMatchObject({
      initialTableUuid: "",
      initialBillRequestKey: "",
    });
  });

  it("keeps counter-order routing backward compatible without table params", () => {
    expect(orderCustomerRouteInput(new URLSearchParams())).toEqual({
      initialTableUuid: "",
      initialTableName: "",
      initialZoneUuid: "",
      initialBillRequestKey: "",
    });
  });
});
