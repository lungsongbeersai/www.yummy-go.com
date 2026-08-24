import { describe, expect, it } from "vitest";
import { groupOrderQueueRows, resolveProductMedia } from "@/features/pos/order-queue/order-queue-view";
import type { OrderQueueRow } from "@/services/pos";

function row(overrides: Partial<OrderQueueRow>): OrderQueueRow {
  return {
    order_item_uuid: "item-1",
    order_uuid: "order-1",
    order_invoice: "inv-1",
    table_name: "T01",
    order_item_status: 1,
    product_name: "Product",
    product_image: "",
    qty: 1,
    note: "",
    kitchen_print_queued: false,
    can_send_to_kitchen: true,
    can_confirm_served: false,
    ...overrides
  };
}

describe("groupOrderQueueRows", () => {
  it("groups consecutive rows sharing the same order_uuid into one group", () => {
    const rows = [
      row({ order_item_uuid: "a", order_uuid: "order-1", table_name: "T02" }),
      row({ order_item_uuid: "b", order_uuid: "order-1", table_name: "T02" }),
      row({ order_item_uuid: "c", order_uuid: "order-2", table_name: "T01" })
    ];

    const groups = groupOrderQueueRows(rows);

    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({ order_uuid: "order-1", table_name: "T02" });
    expect(groups[0].rows.map((r) => r.order_item_uuid)).toEqual(["a", "b"]);
    expect(groups[1]).toMatchObject({ order_uuid: "order-2", table_name: "T01" });
  });

  it("preserves first-seen order of groups (FIFO)", () => {
    const rows = [
      row({ order_item_uuid: "a", order_uuid: "order-B" }),
      row({ order_item_uuid: "b", order_uuid: "order-A" }),
      row({ order_item_uuid: "c", order_uuid: "order-B" })
    ];

    const groups = groupOrderQueueRows(rows);

    expect(groups.map((g) => g.order_uuid)).toEqual(["order-B", "order-A"]);
  });

  it("keeps table_name null for no-table orders", () => {
    const groups = groupOrderQueueRows([row({ table_name: null })]);
    expect(groups[0].table_name).toBeNull();
  });

  it("returns an empty array for no rows", () => {
    expect(groupOrderQueueRows([])).toEqual([]);
  });
});

describe("resolveProductMedia", () => {
  it("resolves a URL to an image media", () => {
    expect(resolveProductMedia("https://example.com/a.jpg")).toEqual({
      type: "image",
      src: "https://example.com/a.jpg"
    });
  });

  it.each(["#10B981", "#fff", "#ffffffaa"])("resolves a hex color %s to a color media", (hex) => {
    expect(resolveProductMedia(hex)).toEqual({ type: "color", color: hex });
  });

  it("resolves an empty string to empty media", () => {
    expect(resolveProductMedia("")).toEqual({ type: "empty" });
    expect(resolveProductMedia("   ")).toEqual({ type: "empty" });
  });

  it("does not misclassify a non-hex string starting with # as color", () => {
    expect(resolveProductMedia("#not-a-color")).toEqual({ type: "image", src: "#not-a-color" });
  });
});
