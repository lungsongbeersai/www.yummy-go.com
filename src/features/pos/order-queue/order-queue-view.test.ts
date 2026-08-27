import { describe, expect, it } from "vitest";
import {
  buildOrderQueueTabs,
  canSelectQueueItem,
  formatQueueWait,
  liveWaitMinutes,
  queueItemAction,
  queueWaitParts,
  queueWaitUrgency,
  resolveProductMedia,
  waitBadgeVariant
} from "@/features/pos/order-queue/order-queue-view";
import type { OrderQueueItem } from "@/services/pos";

// จำลอง t ของ i18next แบบตรงไปตรงมา: คืน key + ค่าที่แทน เพื่อยืนยันว่าเลือก key ถูกตัว
function fakeT(key: string, options?: Record<string, unknown>) {
  const suffix = options
    ? Object.entries(options)
        .map(([name, value]) => `${name}=${String(value)}`)
        .join(",")
    : "";
  return suffix ? `${key}(${suffix})` : key;
}

function item(overrides: Partial<OrderQueueItem> = {}): OrderQueueItem {
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

describe("queueWaitUrgency", () => {
  it("marks waits under 10 minutes as fresh", () => {
    expect(queueWaitUrgency(0)).toBe("fresh");
    expect(queueWaitUrgency(9)).toBe("fresh");
  });

  it("marks waits of 10-19 minutes as aging", () => {
    expect(queueWaitUrgency(10)).toBe("aging");
    expect(queueWaitUrgency(19)).toBe("aging");
  });

  it("marks waits of 20 minutes or more as late", () => {
    expect(queueWaitUrgency(20)).toBe("late");
    expect(queueWaitUrgency(2355)).toBe("late");
  });

  it("maps urgency to a built-in Badge variant", () => {
    expect(waitBadgeVariant("fresh")).toBe("secondary");
    expect(waitBadgeVariant("aging")).toBe("outline");
    expect(waitBadgeVariant("late")).toBe("destructive");
  });
});

describe("buildOrderQueueTabs", () => {
  it("orders tabs as working queue then history, not API array order", () => {
    const tabs = buildOrderQueueTabs([
      { status: 1, title: "Wait", total: 2 },
      { status: 2, title: "Kitchen", total: 18 },
      { status: 4, title: "Served", total: 6 },
      { status: 9, title: "Cancelled", total: 2 }
    ]);

    expect(tabs.map((tab) => tab.status)).toEqual([1, 2, 4, 9]);
  });

  it("hides the ORDERED (0, waiting for customer) tab even when the API still sends it", () => {
    const tabs = buildOrderQueueTabs([
      { status: 1, title: "Wait", total: 2 },
      { status: 0, title: "Customer", total: 1 },
      { status: 2, title: "Kitchen", total: 18 }
    ]);

    expect(tabs.some((tab) => tab.status === 0)).toBe(false);
    expect(tabs.map((tab) => tab.status)).toEqual([1, 2]);
  });
});

describe("canSelectQueueItem", () => {
  it("allows kitchen send only when the backend flags it", () => {
    expect(canSelectQueueItem(item({ can_send_to_kitchen: true }), 1)).toBe(true);
    expect(canSelectQueueItem(item({ can_send_to_kitchen: false }), 1)).toBe(false);
  });

  it("does not allow selecting customer-pending tickets", () => {
    expect(canSelectQueueItem(item(), 0)).toBe(false);
  });

  it("never allows selecting cancelled tickets even if a flag lingers", () => {
    expect(canSelectQueueItem(item({ can_confirm_served: true }), 9)).toBe(false);
  });

  it("keeps served tickets selectable so they can still be cancelled", () => {
    expect(
      canSelectQueueItem(
        item({ can_send_to_kitchen: false, can_confirm_served: false }),
        4
      )
    ).toBe(true);
  });
});

describe("queueItemAction", () => {
  it("derives the action from the backend flags, not the item status", () => {
    // status บอกว่ายังรอส่งครัว แต่ flag บอกว่าส่งไม่ได้แล้ว — ต้องเชื่อ flag
    expect(
      queueItemAction(item({ order_item_status: 1, can_send_to_kitchen: false }))
    ).toBeNull();

    expect(
      queueItemAction(
        item({
          order_item_status: 2,
          can_send_to_kitchen: false,
          can_confirm_served: true
        })
      )
    ).toBe("serve");
  });

  it("prefers sending to the kitchen when both flags are set", () => {
    expect(
      queueItemAction(
        item({ can_send_to_kitchen: true, can_confirm_served: true })
      )
    ).toBe("send");
  });
});

describe("queueWaitParts", () => {
  it("splits total minutes into days, hours and minutes", () => {
    expect(queueWaitParts(18)).toEqual({
      days: 0,
      hours: 0,
      minutes: 18,
      totalMinutes: 18
    });
    expect(queueWaitParts(65)).toEqual({
      days: 0,
      hours: 1,
      minutes: 5,
      totalMinutes: 65
    });
    // 2355 นาที = 1 วัน 15 ชม 15 นาที (ค่าจริงจาก API)
    expect(queueWaitParts(2355)).toEqual({
      days: 1,
      hours: 15,
      minutes: 15,
      totalMinutes: 2355
    });
  });

  it("clamps negative and non-numeric input to zero", () => {
    expect(queueWaitParts(-10).totalMinutes).toBe(0);
    expect(queueWaitParts(Number.NaN).totalMinutes).toBe(0);
  });
});

describe("formatQueueWait", () => {
  it("uses the coarsest unit that still communicates the wait", () => {
    expect(formatQueueWait(18, fakeT)).toBe("orderQueue.waitMinutes(count=18)");
    expect(formatQueueWait(65, fakeT)).toBe(
      "orderQueue.hoursMinutes(hours=1,minutes=5)"
    );
    expect(formatQueueWait(2355, fakeT)).toBe(
      "orderQueue.waitDaysHours(days=1,hours=15)"
    );
  });
});

describe("liveWaitMinutes", () => {
  it("advances the server wait by the time elapsed since the fetch", () => {
    expect(liveWaitMinutes(18, 0)).toBe(18);
    expect(liveWaitMinutes(18, 3)).toBe(21);
  });

  it("never rewinds the server value", () => {
    expect(liveWaitMinutes(18, -5)).toBe(18);
  });
});

describe("resolveProductMedia", () => {
  it("resolves a URL to an image media", () => {
    expect(resolveProductMedia("https://example.com/a.jpg")).toEqual({
      type: "image",
      src: "https://example.com/a.jpg"
    });
  });

  it.each(["#10B981", "#fff", "#ffffffaa"])(
    "resolves a hex color %s to a color media",
    (hex) => {
      expect(resolveProductMedia(hex)).toEqual({ type: "color", color: hex });
    }
  );

  it("resolves an empty string to empty media", () => {
    expect(resolveProductMedia("")).toEqual({ type: "empty" });
    expect(resolveProductMedia("   ")).toEqual({ type: "empty" });
  });

  it("does not misclassify a non-hex string starting with # as color", () => {
    expect(resolveProductMedia("#not-a-color")).toEqual({
      type: "image",
      src: "#not-a-color"
    });
  });
});
