import { describe, expect, it } from "vitest";
import {
  findOrderQueueSection,
  sortOrderQueueItems,
  summarizeOrderQueueSections
} from "@/services/pos/order-queue-normalizers";
import type { FetchOrderQueueResponse, OrderQueueItem } from "@/services/pos/types";

const LIVE_RESPONSE: FetchOrderQueueResponse = {
  status: "success",
  message: "success",
  selected: "waiting_to_send",
  sections: [
    {
      key: "waiting_to_send",
      title: "ລໍຖ້າສົ່ງຄົວ",
      status: 1,
      total: 2,
      selected: true,
      items: [
        {
          order_item_uuid: "bdb85ccd-ad4c-4e74-8145-1396294bf046",
          table_name: "T11",
          order_it_q: 408,
          order_it_date_time: "2026-08-24 00:00:00",
          open_minutes: 2355,
          order_item_status: 1,
          product_name: "ຜັດກະເພົາງົວ (ນ້ອຍ)",
          product_image: "https://example.com/a.jpg",
          qty: 1,
          note: "",
          kitchen_print_queued: false,
          can_send_to_kitchen: true,
          can_confirm_served: false
        },
        {
          order_item_uuid: "39feba72-1428-42d9-b527-140d607b0c8a",
          table_name: "T01",
          order_it_q: 206,
          order_it_date_time: "2026-08-25 14:57:19",
          open_minutes: 18,
          order_item_status: 1,
          product_name: "VIENT (ນ້ອຍ)",
          product_image: "https://example.com/b.jpg",
          qty: 1,
          note: "",
          kitchen_print_queued: false,
          can_send_to_kitchen: true,
          can_confirm_served: false
        }
      ]
    },
    {
      key: "sent_to_kitchen",
      title: "ສົ່ງຄົວແລ້ວ",
      status: 2,
      total: 18,
      selected: false,
      items: []
    },
    {
      key: "served",
      title: "ເສີບແລ້ວ",
      status: 4,
      total: 6,
      selected: false,
      items: []
    },
    {
      key: "cancelled",
      title: "ຍົກເລີກ",
      status: 9,
      total: 2,
      selected: false,
      items: []
    },
    {
      key: "customer_pending",
      title: "ລໍຖ້າລູກຄ້າຢືນຢັນ",
      status: 0,
      total: 1,
      selected: false,
      items: []
    }
  ]
};

function item(overrides: Partial<OrderQueueItem>): OrderQueueItem {
  return {
    order_item_uuid: "item-1",
    table_name: "T01",
    order_it_q: 1,
    order_it_date_time: "2026-08-25 10:00:00",
    open_minutes: 5,
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

describe("findOrderQueueSection", () => {
  it("picks the section matching the requested status", () => {
    expect(findOrderQueueSection(LIVE_RESPONSE, 1)?.key).toBe("waiting_to_send");
    expect(findOrderQueueSection(LIVE_RESPONSE, 0)?.key).toBe("customer_pending");
  });

  it("returns undefined for a status with no matching section", () => {
    expect(findOrderQueueSection(LIVE_RESPONSE, 99)).toBeUndefined();
  });
});

describe("summarizeOrderQueueSections", () => {
  it("keeps totals for every tab even when items are only in the selected section", () => {
    expect(summarizeOrderQueueSections(LIVE_RESPONSE)).toEqual([
      { key: "waiting_to_send", title: "ລໍຖ້າສົ່ງຄົວ", status: 1, total: 2 },
      { key: "sent_to_kitchen", title: "ສົ່ງຄົວແລ້ວ", status: 2, total: 18 },
      { key: "served", title: "ເສີບແລ້ວ", status: 4, total: 6 },
      { key: "cancelled", title: "ຍົກເລີກ", status: 9, total: 2 },
      { key: "customer_pending", title: "ລໍຖ້າລູກຄ້າຢືນຢັນ", status: 0, total: 1 }
    ]);
  });
});

describe("sortOrderQueueItems", () => {
  it("puts the longest wait first", () => {
    const rows = sortOrderQueueItems([
      item({ order_item_uuid: "new", open_minutes: 18, order_it_q: 206 }),
      item({ order_item_uuid: "old", open_minutes: 2355, order_it_q: 408 })
    ]);

    expect(rows.map((row) => row.order_item_uuid)).toEqual(["old", "new"]);
  });

  it("breaks equal wait times by arrival datetime then ticket number", () => {
    const rows = sortOrderQueueItems([
      item({
        order_item_uuid: "later",
        open_minutes: 10,
        order_it_date_time: "2026-08-25 11:00:00",
        order_it_q: 1
      }),
      item({
        order_item_uuid: "earlier-high-q",
        open_minutes: 10,
        order_it_date_time: "2026-08-25 10:00:00",
        order_it_q: 9
      }),
      item({
        order_item_uuid: "earlier-low-q",
        open_minutes: 10,
        order_it_date_time: "2026-08-25 10:00:00",
        order_it_q: 2
      })
    ]);

    expect(rows.map((row) => row.order_item_uuid)).toEqual([
      "earlier-low-q",
      "earlier-high-q",
      "later"
    ]);
  });
});
