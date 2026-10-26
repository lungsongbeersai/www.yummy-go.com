import { describe, expect, it } from "vitest";
import type { PosZone, CartOrder } from "@/services/pos";
import { buildMyOrdersFromTables, ordersPlacedByMe } from "@/features/my-orders/my-orders-data";

const zones: PosZone[] = [
  {
    zone_uuid: "zone-1",
    zone_name: "Garden",
    tables: [
      { table_uuid: "table-open", table_name: "T01", table_status: 2 },
      { table_uuid: "table-free", table_name: "T02", table_status: 1 },
    ],
  },
];

function cart(orderUuid: string, items: NonNullable<CartOrder["items"]>): CartOrder {
  return { order_uuid: orderUuid, items };
}

const sharedOrders = buildMyOrdersFromTables(
  zones,
  new Map([["table-open", [cart("order-shared", [
    { order_item_uuid: "mine", prod_name: "My Soup", qty: 1, detail: { order_it_status: 2, order_it_created_by: "employee-1", order_it_created_by_name: "Mali" } },
    { order_item_uuid: "theirs", prod_name: "Other Tea", qty: 1, detail: { order_it_status: 4, order_it_created_by: "employee-2", order_it_created_by_name: "Noy" } },
  ])]]]),
  "employee-1",
);

describe("buildMyOrdersFromTables", () => {
  it("groups active table carts with zone, table, status and employee ownership", () => {
    expect(sharedOrders).toHaveLength(1);
    expect(sharedOrders[0]).toMatchObject({
      id: "order-shared",
      zone: "Garden",
      table: "T01",
      status: "sent_to_kitchen",
      isPlacedByMe: true,
      placedBy: "Mali, Noy",
    });
    expect(sharedOrders[0].items).toHaveLength(2);
  });

  it("keeps only the logged-in employee's items in Placed by Me", () => {
    const result = ordersPlacedByMe(sharedOrders, "employee-1");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "order-shared", table: "T01", isPlacedByMe: true });
    expect(result[0].placedBy).toBe("You");
    expect(result[0].items.map((item) => item.name)).toEqual(["My Soup"]);
    expect(sharedOrders[0].items).toHaveLength(2);
  });

  it("omits free tables, empty carts, and orders containing only cancelled items", () => {
    const result = buildMyOrdersFromTables(
      zones,
      new Map([
        ["table-open", [cart("cancelled-order", [{ prod_name: "Old item", detail: { order_it_status: 9 } }]), cart("empty-order", [])]],
        ["table-free", [cart("free-table-order", [{ prod_name: "Soup", detail: { order_it_status: 1 } }])]],
      ]),
      "employee-1",
    );
    expect(result).toEqual([]);
  });
});
