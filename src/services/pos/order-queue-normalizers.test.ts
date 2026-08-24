import { describe, expect, it } from "vitest";
import { findOrderQueueSection, flattenOrderQueueSection } from "@/services/pos/order-queue-normalizers";
import type { FetchOrderQueueResponse } from "@/services/pos/types";

// สำเนา response จริงจาก backend (2026-08-24, branch ที่มีโต๊ะ, query status=1) — sections
// ทั้ง 4 สถานะกลับมาพร้อมกันเสมอ แต่มีแค่ section ที่ selected: true (ตรงกับ query) เท่านั้นที่
// orders[] มีข้อมูลจริง ส่วนที่เหลือได้ total ที่ถูกต้องแต่ orders เป็น [] เสมอ
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
      orders: [
        {
          order_uuid: "4bcdc965-b1a6-40a4-9e4f-a8fffb6bdb0a",
          invoice: "210826-0004",
          table: { table_uuid: "e6bad37f-1a1b-4d71-82fe-9504a38ba58b", table_name: "T03", table_status: 3 },
          items: [
            {
              order_item_uuid: "b1e744b8-e0c9-4133-8731-8369a9f4e543",
              order_item_status: 1,
              product_name: "ຊອ໊ກໂກແລັດ (ຊ໊ອກໂກແລັດ)",
              product_image: "https://plc-files.sgp1.vultrobjects.com/api.yummy-go.com/uploaded/products/db2a3579-08e9-495b-a155-c22bc0c6c113.jpg",
              qty: 1,
              note: "",
              kitchen_print_queued: false,
              can_send_to_kitchen: true,
              can_confirm_served: false
            }
          ]
        },
        {
          order_uuid: "79d923b1-4f7d-4d0b-bee8-88b623876107",
          invoice: "230826-0001",
          table: { table_uuid: "e50a9efc-92b9-45aa-a806-6ee3e0e138ab", table_name: "T01", table_status: 3 },
          items: [
            {
              order_item_uuid: "4aeaa7ed-0128-4b2f-b71d-e71f45f8ee3e",
              order_item_status: 1,
              product_name: "ກະແລ້ມ ສະຕໍເບີລີ້ (ນ້ອຍ)",
              product_image: "https://plc-files.sgp1.vultrobjects.com/api.yummy-go.com/uploaded/products/c72c2665-30d7-4739-b8a9-1e085f3798a3.jpg",
              qty: 1,
              note: "",
              kitchen_print_queued: true,
              can_send_to_kitchen: false,
              can_confirm_served: false
            }
          ]
        }
      ]
    },
    { key: "sent_to_kitchen", title: "ສົ່ງຄົວແລ້ວ", status: 2, total: 10, selected: false, orders: [] },
    { key: "served", title: "ເສີບແລ້ວ", status: 4, total: 5, selected: false, orders: [] },
    { key: "cancelled", title: "ຍົກເລີກ", status: 9, total: 0, selected: false, orders: [] }
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
  it("flattens orders[].items[] into one row per item, carrying order-level context down", () => {
    const section = findOrderQueueSection(LIVE_RESPONSE, 1);
    const rows = flattenOrderQueueSection(section);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      order_item_uuid: "b1e744b8-e0c9-4133-8731-8369a9f4e543",
      order_uuid: "4bcdc965-b1a6-40a4-9e4f-a8fffb6bdb0a",
      order_invoice: "210826-0004",
      table_name: "T03",
      qty: 1,
      product_name: "ຊອ໊ກໂກແລັດ (ຊ໊ອກໂກແລັດ)",
      product_image: "https://plc-files.sgp1.vultrobjects.com/api.yummy-go.com/uploaded/products/db2a3579-08e9-495b-a155-c22bc0c6c113.jpg",
      can_send_to_kitchen: true,
      kitchen_print_queued: false
    });
    expect(rows[1]).toMatchObject({
      table_name: "T01",
      kitchen_print_queued: true,
      can_send_to_kitchen: false
    });
  });

  it("flattens to an empty array for a non-selected section even when its total is > 0 (backend stubs orders: [])", () => {
    // ยืนยันจาก response จริง: section ที่ไม่ตรงกับ query status ได้ total ที่ถูกต้องมาโชว์เป็น
    // badge ได้ แต่ orders เป็น [] เสมอ — ต้อง fetch ใหม่ด้วย status นั้นถึงจะได้แถวจริง
    const section = findOrderQueueSection(LIVE_RESPONSE, 2);
    expect(section?.total).toBe(10);
    expect(flattenOrderQueueSection(section)).toEqual([]);
  });

  it("returns an empty array when the section is missing entirely", () => {
    expect(flattenOrderQueueSection(undefined)).toEqual([]);
  });

  it("falls back table_name to null when the order has no table (no-table stores)", () => {
    const noTableResponse: FetchOrderQueueResponse = {
      ...LIVE_RESPONSE,
      sections: [
        {
          key: "sent_to_kitchen",
          title: "ສົ່ງຄົວແລ້ວ",
          status: 2,
          total: 2,
          selected: true,
          orders: [
            {
              order_uuid: "e48ac7be-fce6-4acc-b93d-311271b68c41",
              invoice: "040826-0001",
              table: null,
              items: [
                {
                  order_item_uuid: "1b08c9c0-6d1f-4551-ade3-73756d20e650",
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
        }
      ]
    };

    const rows = flattenOrderQueueSection(findOrderQueueSection(noTableResponse, 2));
    expect(rows[0].table_name).toBeNull();
  });
});
