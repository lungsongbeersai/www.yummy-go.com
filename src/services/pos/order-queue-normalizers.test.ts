import { describe, expect, it } from "vitest";
import { findOrderQueueSection, flattenOrderQueueSection } from "@/services/pos/order-queue-normalizers";
import type { FetchOrderQueueResponse } from "@/services/pos/types";

// Response จริงรูปแบบปัจจุบัน: ข้อมูล order/table อยู่ใน section.items[] โดยตรง
// และมีข้อมูลเฉพาะ section ที่ selected ตาม query status
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
          order_item_uuid: "b1e744b8-e0c9-4133-8731-8369a9f4e543",
          order_uuid: "4bcdc965-b1a6-40a4-9e4f-a8fffb6bdb0a",
          invoice: "210826-0004",
          created_at: "2026-08-21 10:13:05",
          table: {
            table_uuid: "e6bad37f-1a1b-4d71-82fe-9504a38ba58b",
            table_name: "T03",
            table_status: 3,
            table_date_in: "2026-08-21",
            table_time_in: "10:13:05",
            opened_at: "2026-08-21 10:13:05",
            open_minutes: 20
          },
          order_item_status: 1,
          product_name: "ຊອ໊ກໂກແລັດ (ຊ໊ອກໂກແລັດ)",
          product_image: "https://example.com/chocolate.jpg",
          qty: 1,
          note: "",
          kitchen_print_queued: false,
          can_send_to_kitchen: true,
          can_confirm_served: false
        },
        {
          order_item_uuid: "4aeaa7ed-0128-4b2f-b71d-e71f45f8ee3e",
          order_uuid: "79d923b1-4f7d-4d0b-bee8-88b623876107",
          invoice: "230826-0001",
          created_at: "2026-08-23 08:16:36",
          table: {
            table_uuid: "e50a9efc-92b9-45aa-a806-6ee3e0e138ab",
            table_name: "T01",
            table_status: 3
          },
          order_item_status: 1,
          product_name: "ກະແລ້ມ ສະຕໍເບີລີ້ (ນ້ອຍ)",
          product_image: "#10B981",
          qty: 1,
          note: "",
          kitchen_print_queued: true,
          can_send_to_kitchen: false,
          can_confirm_served: false
        }
      ]
    },
    { key: "sent_to_kitchen", title: "ສົ່ງຄົວແລ້ວ", status: 2, total: 10, selected: false, items: [] },
    { key: "served", title: "ເສີບແລ້ວ", status: 4, total: 5, selected: false, items: [] },
    { key: "cancelled", title: "ຍົກເລີກ", status: 9, total: 0, selected: false, items: [] }
  ]
};

describe("findOrderQueueSection", () => {
  it("picks the section matching the requested status", () => {
    expect(findOrderQueueSection(LIVE_RESPONSE, 1)?.key).toBe("waiting_to_send");
    expect(findOrderQueueSection(LIVE_RESPONSE, 2)?.key).toBe("sent_to_kitchen");
  });

  it("returns undefined for a status with no matching section", () => {
    expect(findOrderQueueSection(LIVE_RESPONSE, 99)).toBeUndefined();
  });
});

describe("flattenOrderQueueSection", () => {
  it("normalizes flat items and preserves order-level context", () => {
    const rows = flattenOrderQueueSection(findOrderQueueSection(LIVE_RESPONSE, 1));

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      order_item_uuid: "b1e744b8-e0c9-4133-8731-8369a9f4e543",
      order_uuid: "4bcdc965-b1a6-40a4-9e4f-a8fffb6bdb0a",
      order_invoice: "210826-0004",
      table_name: "T03",
      qty: 1,
      can_send_to_kitchen: true,
      kitchen_print_queued: false
    });
    expect(rows[1]).toMatchObject({
      table_name: "T01",
      kitchen_print_queued: true,
      can_send_to_kitchen: false
    });
  });

  it("returns an empty array for a non-selected section even when total is positive", () => {
    const section = findOrderQueueSection(LIVE_RESPONSE, 2);
    expect(section?.total).toBe(10);
    expect(flattenOrderQueueSection(section)).toEqual([]);
  });

  it("returns an empty array when the section is missing", () => {
    expect(flattenOrderQueueSection(undefined)).toEqual([]);
  });

  it("supports flat no-table orders", () => {
    const response: FetchOrderQueueResponse = {
      ...LIVE_RESPONSE,
      sections: [
        {
          key: "sent_to_kitchen",
          title: "ສົ່ງຄົວແລ້ວ",
          status: 2,
          total: 1,
          selected: true,
          items: [
            {
              order_item_uuid: "1b08c9c0-6d1f-4551-ade3-73756d20e650",
              order_uuid: "e48ac7be-fce6-4acc-b93d-311271b68c41",
              invoice: "040826-0001",
              created_at: "2026-08-04",
              table: null,
              order_item_status: 2,
              product_name: "ເຂົ້າໄຂ່ຈຽວໝູສັບ (ປົກກະຕິ)",
              product_image: "#10B981",
              qty: 20,
              note: "",
              kitchen_print_queued: false,
              can_send_to_kitchen: false,
              can_confirm_served: true
            }
          ]
        }
      ]
    };

    const rows = flattenOrderQueueSection(findOrderQueueSection(response, 2));
    expect(rows[0].table_name).toBeNull();
  });

  it("keeps compatibility with the previous orders[].items[] response during rolling deploy", () => {
    const legacyResponse: FetchOrderQueueResponse = {
      ...LIVE_RESPONSE,
      sections: [
        {
          key: "waiting_to_send",
          title: "ລໍຖ້າສົ່ງຄົວ",
          status: 1,
          total: 1,
          selected: true,
          orders: [
            {
              order_uuid: "legacy-order",
              invoice: "legacy-invoice",
              table: null,
              items: [
                {
                  order_item_uuid: "legacy-item",
                  order_item_status: 1,
                  product_name: "Legacy product",
                  product_image: "",
                  qty: 1,
                  note: "",
                  kitchen_print_queued: false,
                  can_send_to_kitchen: true,
                  can_confirm_served: false
                }
              ]
            }
          ]
        }
      ]
    };

    expect(flattenOrderQueueSection(findOrderQueueSection(legacyResponse, 1))[0]).toMatchObject({
      order_item_uuid: "legacy-item",
      order_uuid: "legacy-order",
      order_invoice: "legacy-invoice",
      table_name: null
    });
  });
});
